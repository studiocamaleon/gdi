import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolSistema } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantProvisioningService } from '../provisionamiento/tenant-provisioning.service';
import { CorreoTransaccionalService } from './correo-transaccional.service';
import { IniciarRegistroDto } from './dto/iniciar-registro.dto';

const TOKEN_MS = 2 * 60 * 60 * 1000;
const REENVIO_MS = 60 * 1000;

@Injectable()
export class RegistroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoTransaccionalService,
    private readonly provisionamiento: TenantProvisioningService,
    private readonly auth: AuthService,
  ) {}

  async planes() {
    const planes = await this.prisma.plan.findMany({
      where: { activo: true, publico: true },
      orderBy: { orden: 'asc' },
    });
    return planes.map((plan) => ({
      codigo: plan.codigo,
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precioMensual: plan.precioAConsultar ? null : Number(plan.precioMensual),
      moneda: plan.moneda,
      trialDias: plan.registroPublico ? plan.trialDias : null,
      registroPublico: plan.registroPublico,
      recomendado: plan.recomendado,
      precioAConsultar: plan.precioAConsultar,
      features: plan.featuresJson,
    }));
  }

  async iniciar(dto: IniciarRegistroDto) {
    this.asegurarHabilitado();
    if (!dto.aceptaTerminos) {
      throw new BadRequestException(
        'Debés aceptar los términos para continuar.',
      );
    }
    validarZona(dto.zonaHoraria);
    const plan = await this.prisma.plan.findFirst({
      where: { codigo: dto.planCodigo, activo: true, registroPublico: true },
    });
    if (!plan) throw new BadRequestException('Ese plan no admite alta Trial.');

    const email = dto.email.trim().toLowerCase();
    const anterior = await this.prisma.registroTenant.findFirst({
      where: { email, completadoEl: null, revocadoEl: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      anterior?.ultimoEnvioEl &&
      Date.now() - anterior.ultimoEnvioEl.getTime() < REENVIO_MS
    ) {
      throw new BadRequestException(
        'Esperá un minuto antes de pedir otro correo.',
      );
    }

    const usuarioExistente = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hash(rawToken);
    const ahora = new Date();
    const datosCrear = {
      email,
      nombreCompleto: dto.nombreCompleto.trim(),
      empresaNombre: dto.empresaNombre.trim(),
      passwordHash: usuarioExistente
        ? null
        : await bcrypt.hash(dto.password, 10),
      planId: plan.id,
      paisCodigo: dto.paisCodigo.toUpperCase(),
      zonaHoraria: dto.zonaHoraria,
      tokenHash,
      tokenExpiraEl: new Date(Date.now() + TOKEN_MS),
      ultimoEnvioEl: ahora,
      terminosVersion: process.env.TERMINOS_VERSION ?? '2026-08-27',
      terminosAceptadosEl: ahora,
      marketingAceptadoEl: dto.aceptaMarketing ? ahora : null,
      origen: dto.origen ?? 'web',
      atribucionJson: dto.atribucion as Prisma.InputJsonValue | undefined,
    };
    const datosActualizar = {
      nombreCompleto: dto.nombreCompleto.trim(),
      empresaNombre: dto.empresaNombre.trim(),
      passwordHash: usuarioExistente
        ? null
        : await bcrypt.hash(dto.password, 10),
      planId: plan.id,
      paisCodigo: dto.paisCodigo.toUpperCase(),
      zonaHoraria: dto.zonaHoraria,
      tokenHash,
      tokenExpiraEl: new Date(Date.now() + TOKEN_MS),
      tokenVersion: { increment: 1 },
      ultimoEnvioEl: ahora,
      terminosVersion: process.env.TERMINOS_VERSION ?? '2026-08-27',
      terminosAceptadosEl: ahora,
      marketingAceptadoEl: dto.aceptaMarketing ? ahora : null,
      revocadoEl: null,
      intentos: 0,
    };
    const registro = anterior
      ? await this.prisma.registroTenant.update({
          where: { id: anterior.id },
          data: datosActualizar,
        })
      : await this.prisma.registroTenant.create({ data: datosCrear });
    const url = `${this.urlPublica()}/registro/verificar?token=${encodeURIComponent(rawToken)}`;
    const enviado = await this.correo.enviarVerificacion({
      para: email,
      nombre: registro.nombreCompleto,
      empresa: registro.empresaNombre,
      url,
    });
    await this.prisma.registroTenant.update({
      where: { id: registro.id },
      data: { proveedorMensajeId: enviado.id },
    });
    return respuestaGenerica();
  }

  async estado(token: string) {
    const registro = await this.buscarToken(token);
    return {
      valido:
        !registro.completadoEl &&
        !registro.revocadoEl &&
        Boolean(registro.tokenExpiraEl && registro.tokenExpiraEl > new Date()),
      vencido: Boolean(
        registro.tokenExpiraEl && registro.tokenExpiraEl <= new Date(),
      ),
      completado: Boolean(registro.completadoEl),
      requiereLogin: Boolean(
        await this.prisma.user.findUnique({
          where: { email: registro.email },
          select: { id: true },
        }),
      ),
      email: ocultarEmail(registro.email),
      empresa: registro.empresaNombre,
      plan: registro.plan.nombre,
    };
  }

  async completarNuevo(token: string) {
    const registro = await this.buscarTokenValido(token);
    const existente = await this.prisma.user.findUnique({
      where: { email: registro.email },
    });
    if (existente) return { requiereLogin: true as const };
    if (!registro.passwordHash)
      throw new BadRequestException('El registro no tiene una clave válida.');

    const creado = await this.prisma.$transaction(async (tx) => {
      const vigente = await tx.registroTenant.findFirst({
        where: {
          id: registro.id,
          completadoEl: null,
          revocadoEl: null,
          tokenExpiraEl: { gt: new Date() },
        },
        include: { plan: true },
      });
      if (!vigente)
        throw new ConflictException('Este registro ya fue utilizado o venció.');
      const user = await tx.user.create({
        data: {
          email: vigente.email,
          nombreCompleto: vigente.nombreCompleto,
          passwordHash: vigente.passwordHash,
          activo: true,
        },
      });
      return this.crearTenant(tx, vigente, user);
    });
    return this.crearSesion(creado);
  }

  async completarExistente(token: string, current: CurrentAuth) {
    const registro = await this.buscarTokenValido(token);
    if (registro.email !== current.email.toLowerCase()) {
      throw new BadRequestException(
        'Iniciaste sesión con un correo diferente al del registro.',
      );
    }
    const creado = await this.prisma.$transaction(async (tx) => {
      const vigente = await tx.registroTenant.findFirst({
        where: {
          id: registro.id,
          completadoEl: null,
          revocadoEl: null,
          tokenExpiraEl: { gt: new Date() },
        },
        include: { plan: true },
      });
      if (!vigente)
        throw new ConflictException('Este registro ya fue utilizado o venció.');
      const user = await tx.user.findUniqueOrThrow({
        where: { id: current.userId },
      });
      return this.crearTenant(tx, vigente, user);
    });
    return this.crearSesion(creado);
  }

  async completarOnboarding(auth: CurrentAuth) {
    await this.prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { onboardingCompletadoEl: new Date() },
    });
    return { ok: true };
  }

  private async crearTenant(
    tx: Prisma.TransactionClient,
    registro: Awaited<ReturnType<RegistroService['buscarTokenValido']>>,
    user: {
      id: string;
      email: string;
      nombreCompleto: string | null;
      rolPlataforma: import('@prisma/client').RolPlataforma | null;
    },
  ) {
    const provisionado = await this.provisionamiento.provisionarBase(tx, {
      nombre: registro.empresaNombre,
      plan: { id: registro.plan.id, trialDias: registro.plan.trialDias },
      origen: 'registro_publico',
      paisCodigo: registro.paisCodigo,
      zonaHoraria: registro.zonaHoraria,
      emailEmpresa: registro.email,
      iniciaTrial: true,
    });
    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        tenantId: provisionado.tenantId,
        rol: RolSistema.ADMINISTRADOR,
        rolId: provisionado.administradorRolId,
      },
      include: { tenant: true },
    });
    await tx.registroTenant.update({
      where: { id: registro.id },
      data: {
        emailVerificadoEl: new Date(),
        completadoEl: new Date(),
        tenantCreadoId: provisionado.tenantId,
        tokenHash: null,
      },
    });
    return { user, membership };
  }

  private async crearSesion(
    creado: Awaited<ReturnType<RegistroService['crearTenant']>>,
  ) {
    const { user, membership } = creado;
    const sesion = await this.auth.crearSesionParaMembership(
      user.id,
      user.email,
      membership,
      this.prisma,
      user.nombreCompleto,
      user.rolPlataforma,
    );
    return { requiereLogin: false as const, ...sesion };
  }

  private async buscarToken(raw: string) {
    const registro = await this.prisma.registroTenant.findUnique({
      where: { tokenHash: hash(raw) },
      include: { plan: true },
    });
    if (!registro) throw new NotFoundException('El enlace no es válido.');
    return registro;
  }

  private async buscarTokenValido(raw: string) {
    const registro = await this.buscarToken(raw);
    if (registro.completadoEl)
      throw new ConflictException('Esta cuenta ya fue creada.');
    if (
      registro.revocadoEl ||
      !registro.tokenExpiraEl ||
      registro.tokenExpiraEl <= new Date()
    ) {
      throw new BadRequestException(
        'El enlace venció. Volvé a iniciar el registro.',
      );
    }
    return registro;
  }

  private asegurarHabilitado() {
    if (process.env.REGISTRO_PUBLICO_HABILITADO === 'false') {
      throw new NotFoundException('El registro público no está habilitado.');
    }
  }

  private urlPublica() {
    return (
      process.env.REGISTRO_PUBLICO_URL ??
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ??
      'http://localhost:3000'
    );
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function respuestaGenerica() {
  return {
    ok: true,
    mensaje:
      'Si los datos son válidos, vas a recibir un correo para continuar.',
  };
}
function ocultarEmail(email: string) {
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(2, u.length - 2))}@${d}`;
}
function validarZona(zona: string) {
  try {
    new Intl.DateTimeFormat('es', { timeZone: zona }).format();
  } catch {
    throw new BadRequestException('La zona horaria no es válida.');
  }
}
