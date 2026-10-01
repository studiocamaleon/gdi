import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../integraciones/cripto/secretos.service';
import { CorreoTransaccionalService } from '../registro/correo-transaccional.service';
import { bloquearIdentidad, huellaPassword } from './mfa.service';
import type { CurrentAuth } from './auth.types';

const QUINCE_MINUTOS = 15 * 60_000;
const HORA = 3_600_000;
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const RESPUESTA = {
  ok: true,
  mensaje:
    'Si la cuenta tiene un correo verificado, vas a recibir un enlace para continuar.',
};
const INVALIDO =
  'El enlace venció, ya se usó o no es válido. Solicitá uno nuevo.';
type Sobre = { email: string; url?: string; tokenHash?: string };

/** Identidad global: ninguna ruta admite userId, tenantId ni un correo de reemplazo. */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretos: SecretosService,
    private readonly correo: CorreoTransaccionalService,
  ) {}

  habilitado() {
    return (
      process.env.RECUPERACION_ACCESO_HABILITADA === 'true' &&
      this.secretos.disponible &&
      this.correo.accesoDisponible &&
      !!this.origen()
    );
  }
  private origen() {
    try {
      const url = new URL(process.env.RECUPERACION_ACCESO_URL ?? '');
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        return null;
      if (
        url.protocol !== 'https:' &&
        !(
          process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        )
      )
        return null;
      return url.origin;
    } catch {
      return null;
    }
  }
  private exigirHabilitado() {
    if (!this.habilitado())
      throw new ServiceUnavailableException(
        'La recuperación por correo todavía no está disponible. Contactá al equipo de Grafo.',
      );
  }
  private propio(auth: CurrentAuth) {
    if (auth.mcp || auth.impersonacion)
      throw new ForbiddenException('Usá tu acceso personal.');
  }
  private verificado(user: User) {
    return !!user.emailVerificadoEl && user.emailVerificado === user.email;
  }

  /** Cuota atómica compartida. No depende de un token/encabezado del cliente. */
  private async cuota(ambito: string, valor: string, maximo: number) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException();
    const clave = createHmac('sha256', secret)
      .update(`${ambito}:${valor}`)
      .digest('hex');
    const filas = await this.prisma.$queryRaw<Array<{ cantidad: number }>>`
      INSERT INTO "AccesoLimite" ("clave", "cantidad", "venceEl") VALUES (${clave}, 1, now() + interval '1 hour')
      ON CONFLICT ("clave") DO UPDATE SET
        "cantidad" = CASE WHEN "AccesoLimite"."venceEl" <= now() THEN 1 ELSE "AccesoLimite"."cantidad" + 1 END,
        "venceEl" = CASE WHEN "AccesoLimite"."venceEl" <= now() THEN now() + interval '1 hour' ELSE "AccesoLimite"."venceEl" END
      WHERE "AccesoLimite"."venceEl" <= now() OR "AccesoLimite"."cantidad" < ${maximo}
      RETURNING "cantidad"`;
    return filas.length === 1;
  }

  async estado(auth: CurrentAuth) {
    this.propio(auth);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
    });
    return {
      habilitado: this.habilitado(),
      pendienteMfa: auth.plataformaMfaPendiente === true,
      verificado: this.verificado(user),
      email: user.email,
    };
  }

  async solicitar(email: string, ip: string) {
    this.exigirHabilitado();
    // Mismo trabajo para toda dirección: NO consultar User ni esperar al proveedor.
    const permitidaIp = await this.cuota('solicitud-ip', ip, 20);
    if (!permitidaIp) return RESPUESTA;
    const normalizado = email.trim().toLowerCase();
    if (!(await this.cuota('solicitud-correo', normalizado, 3)))
      return RESPUESTA;
    await this.prisma.accesoCorreo.create({
      data: {
        tipo: 'solicitud',
        sobre: this.secretos.cifrar(JSON.stringify({ email: normalizado })),
        venceEl: new Date(Date.now() + QUINCE_MINUTOS),
      },
    });
    return RESPUESTA;
  }

  async pedirVerificacion(auth: CurrentAuth, password: string, ip: string) {
    this.exigirHabilitado();
    this.propio(auth);
    if (
      !(await this.cuota('verificacion-ip', ip, 15)) ||
      !(await this.cuota('verificacion-usuario', auth.userId, 3))
    )
      throw new BadRequestException('Esperá antes de solicitar otro correo.');
    const original = await this.prisma.user.findUnique({
      where: { id: auth.userId },
    });
    if (
      !original?.passwordHash ||
      !(await bcrypt.compare(password, original.passwordHash))
    )
      throw new BadRequestException('La contraseña actual no es correcta.');
    await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, auth.userId);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
      });
      const sesion = await tx.authSession.findFirst({
        where: {
          id: auth.sessionId,
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          impersonacionId: null,
        },
      });
      if (
        !sesion ||
        !user.activo ||
        user.debeCambiarPassword ||
        user.passwordHash !== original.passwordHash
      )
        throw new UnauthorizedException(
          'Volvé a ingresar con tu clave personal.',
        );
      if (this.verificado(user)) return;
      const enlace = await this.crearToken(tx, user, 'verificar');
      await tx.accesoCorreo.create({
        data: {
          userId: user.id,
          tipo: 'verificar',
          sobre: this.secretos.cifrar(JSON.stringify(enlace)),
          venceEl: new Date(Date.now() + QUINCE_MINUTOS),
        },
      });
    });
    return {
      ok: true,
      mensaje: 'Revisá tu correo para confirmar que te pertenece.',
    };
  }

  private async crearToken(
    tx: Prisma.TransactionClient,
    user: User,
    tipo: 'verificar' | 'restablecer',
  ) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hash(token);
    await tx.accesoToken.create({
      data: {
        userId: user.id,
        tipo,
        email: user.email,
        passwordStamp: huellaPassword(user.passwordHash),
        tokenHash,
        venceEl: new Date(Date.now() + QUINCE_MINUTOS),
      },
    });
    // El fragmento no viaja al servidor, al referer ni a los logs de la URL.
    return {
      email: user.email,
      tokenHash,
      url: `${this.origen()}/recuperar-acceso#modo=${tipo}&token=${token}`,
    };
  }

  async confirmar(
    token: string,
    tipo: 'verificar' | 'restablecer',
    ip: string,
    nueva?: string,
  ) {
    this.exigirHabilitado();
    if (!(await this.cuota('consumir-ip', ip, 30)))
      throw new BadRequestException(
        'Demasiados intentos. Volvé a intentarlo más tarde.',
      );
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException(INVALIDO);
    const original = await this.prisma.accesoToken.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (
      !original ||
      original.tipo !== tipo ||
      original.usadoEl ||
      original.venceEl <= new Date()
    )
      throw new BadRequestException(INVALIDO);
    if (
      tipo === 'restablecer' &&
      (!nueva || nueva.length < 8 || Buffer.byteLength(nueva, 'utf8') > 72)
    )
      throw new BadRequestException(
        'Usá una contraseña de al menos 8 caracteres, sin superar el largo permitido.',
      );
    const passwordHash =
      tipo === 'restablecer' ? await bcrypt.hash(nueva!, 10) : null;
    await this.prisma.$transaction(async (tx) => {
      await bloquearIdentidad(tx, original.userId);
      const actual = await tx.accesoToken.findUniqueOrThrow({
        where: { id: original.id },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: original.userId },
      });
      if (
        !user.activo ||
        !user.passwordHash ||
        actual.usadoEl ||
        actual.venceEl <= new Date() ||
        actual.email !== user.email ||
        actual.passwordStamp !== huellaPassword(user.passwordHash) ||
        (tipo === 'restablecer' && !this.verificado(user))
      )
        throw new BadRequestException(INVALIDO);
      await tx.accesoToken.update({
        where: { id: actual.id },
        data: { usadoEl: new Date() },
      });
      if (tipo === 'verificar') {
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerificado: user.email, emailVerificadoEl: new Date() },
        });
        return;
      }
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: passwordHash!, debeCambiarPassword: false },
      });
      await tx.accesoToken.updateMany({
        where: { userId: user.id, usadoEl: null },
        data: { usadoEl: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.mfaChallenge.deleteMany({ where: { userId: user.id } });
      await tx.mfaDispositivo.updateMany({
        where: { userId: user.id, revocadoEl: null },
        data: { revocadoEl: new Date() },
      });
      // El aviso se confirma con el cambio. Una caída de correo no pierde la tarea.
      await tx.accesoCorreo.create({
        data: {
          userId: user.id,
          tipo: 'aviso',
          sobre: this.secretos.cifrar(JSON.stringify({ email: user.email })),
          venceEl: new Date(Date.now() + 23 * HORA),
        },
      });
    });
    return { ok: true };
  }

  /** Outbox con lease por fila e idempotencia del proveedor; sin red en transacciones. */
  async procesarPendientes() {
    if (!this.habilitado()) return;
    const ahora = new Date();
    const filas = await this.prisma.accesoCorreo.findMany({
      where: {
        estado: 'pendiente',
        proximoEl: { lte: ahora },
        venceEl: { gt: ahora },
        OR: [{ leaseHasta: null }, { leaseHasta: { lt: ahora } }],
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });
    for (const fila of filas) {
      const lease = randomUUID();
      const tomada = await this.prisma.accesoCorreo.updateMany({
        where: {
          id: fila.id,
          estado: 'pendiente',
          proximoEl: { lte: new Date() },
          venceEl: { gt: new Date() },
          OR: [{ leaseHasta: null }, { leaseHasta: { lt: new Date() } }],
        },
        data: {
          lease,
          leaseHasta: new Date(Date.now() + 60_000),
          intentos: { increment: 1 },
        },
      });
      if (!tomada.count) continue;
      try {
        if (fila.tipo === 'solicitud')
          await this.prepararSolicitud(fila.id, lease);
        const tarea = await this.prisma.accesoCorreo.findUniqueOrThrow({
          where: { id: fila.id },
        });
        if (tarea.estado !== 'pendiente' || tarea.lease !== lease) continue;
        if (tarea.venceEl <= new Date()) continue;
        const datos = JSON.parse(
          this.secretos.descifrar(tarea.sobre as SecretoCifrado),
        ) as Sobre;
        if (tarea.tipo !== 'aviso') {
          const token = await this.prisma.accesoToken.findUnique({
            where: { tokenHash: datos.tokenHash! },
            include: { user: true },
          });
          if (
            !token ||
            token.usadoEl ||
            token.venceEl <= new Date() ||
            !token.user.activo ||
            token.email !== token.user.email ||
            token.passwordStamp !== huellaPassword(token.user.passwordHash)
          ) {
            await this.terminar(tarea.id, lease);
            continue;
          }
        }
        await this.correo.enviarAcceso(
          { tipo: tarea.tipo, para: datos.email, url: datos.url },
          `acceso-${tarea.id}`,
        );
        await this.terminar(tarea.id, lease);
      } catch {
        const agotado = fila.intentos + 1 >= 5;
        await this.prisma.accesoCorreo.updateMany({
          where: { id: fila.id, lease },
          data: {
            estado: agotado ? 'fallido' : 'pendiente',
            sobre: agotado ? Prisma.DbNull : undefined,
            lease: null,
            leaseHasta: null,
            proximoEl: new Date(Date.now() + 60_000 * 2 ** fila.intentos),
          },
        });
        // Sólo identificador interno: nunca correo, URL, token ni error del proveedor.
        this.logger.error(
          `Correo de acceso ${fila.id}: ${agotado ? 'agotó reintentos' : 'reintento programado'}.`,
        );
      }
    }
    await this.prisma.accesoCorreo.updateMany({
      where: { estado: 'pendiente', venceEl: { lte: new Date() } },
      data: {
        estado: 'vencido',
        sobre: Prisma.DbNull,
        lease: null,
        leaseHasta: null,
      },
    });
    await this.prisma.accesoLimite.deleteMany({
      where: { venceEl: { lt: new Date(Date.now() - HORA) } },
    });
    const corte = new Date(Date.now() - 30 * 24 * HORA);
    await this.prisma.accesoCorreo.deleteMany({
      where: { venceEl: { lt: corte } },
    });
    await this.prisma.accesoToken.deleteMany({
      where: { venceEl: { lt: corte } },
    });
  }

  private async prepararSolicitud(id: string, lease: string) {
    await this.prisma.$transaction(async (tx) => {
      const fila = await tx.accesoCorreo.findUniqueOrThrow({ where: { id } });
      if (
        fila.lease !== lease ||
        fila.tipo !== 'solicitud' ||
        fila.estado !== 'pendiente' ||
        fila.venceEl <= new Date()
      )
        return;
      const { email } = JSON.parse(
        this.secretos.descifrar(fila.sobre as SecretoCifrado),
      ) as Sobre;
      const original = await tx.user.findUnique({ where: { email } });
      if (original) await bloquearIdentidad(tx, original.id);
      const user = original
        ? await tx.user.findUnique({ where: { id: original.id } })
        : null;
      if (
        !user?.activo ||
        !user.passwordHash ||
        !this.verificado(user) ||
        user.email !== email
      ) {
        await tx.accesoCorreo.update({
          where: { id },
          data: {
            estado: 'completo',
            sobre: Prisma.DbNull,
            lease: null,
            leaseHasta: null,
          },
        });
        return;
      }
      const datos = await this.crearToken(tx, user, 'restablecer');
      await tx.accesoCorreo.update({
        where: { id },
        data: {
          userId: user.id,
          tipo: 'restablecer',
          sobre: this.secretos.cifrar(JSON.stringify(datos)),
        },
      });
    });
  }
  private terminar(id: string, lease: string) {
    return this.prisma.accesoCorreo.updateMany({
      where: { id, lease },
      data: {
        estado: 'completo',
        sobre: Prisma.DbNull,
        lease: null,
        leaseHasta: null,
      },
    });
  }
}
