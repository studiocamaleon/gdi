import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolPlataforma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionCacheService } from '../auth/session-cache.service';
import type { CurrentAuth } from '../auth/auth.types';
import { randomBytes } from 'node:crypto';
import { hashInvitacionEquipo } from '../auth/invitacion-plataforma';
import { mfaPlataformaCompleta } from '../auth/enrolamiento-plataforma';

export const ROLES_EQUIPO = [
  {
    codigo: 'ADMIN',
    nombre: 'Administración',
    descripcion:
      'Gestiona empresas, planes y equipo. Puede iniciar accesos de soporte a empresas.',
  },
  {
    codigo: 'SOPORTE',
    nombre: 'Soporte',
    descripcion:
      'Consulta empresas, planes, métricas e historial. No modifica datos ni ingresa a empresas por impersonación.',
  },
] as const;

@Injectable()
export class EquipoPlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: SessionCacheService,
  ) {}

  async listar(auth: CurrentAuth, pagina: number, limite: number, q?: string) {
    const sesionesVigentes: Prisma.AuthSessionWhereInput = {
      currentTenantId: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    };
    const where: Prisma.UserWhereInput = {
      rolPlataforma: { not: null },
      ...(q?.trim()
        ? {
            OR: [
              { email: { contains: q.trim(), mode: 'insensitive' } },
              { nombreCompleto: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, usuarios] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ email: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          email: true,
          nombreCompleto: true,
          activo: true,
          rolPlataforma: true,
          mfa: {
            select: { activatedAt: true, recuperacionConfirmadaEl: true },
          },
          _count: { select: { authSessions: { where: sesionesVigentes } } },
          authSessions: {
            where: sesionesVigentes,
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      roles: ROLES_EQUIPO,
      usuarios: usuarios.map((u) => ({
        id: u.id,
        email: u.email,
        nombre: u.nombreCompleto,
        activo: u.activo,
        rol: u.rolPlataforma!,
        esPropio: u.id === auth.userId,
        mfaActivo: !!u.mfa?.activatedAt,
        recuperacionConfirmada: !!u.mfa?.recuperacionConfirmadaEl,
        sesionesActivas: u._count.authSessions,
        ultimaSesionActivaEl:
          u.authSessions[0]?.createdAt.toISOString() ?? null,
      })),
    };
  }

  async historial(pagina: number, limite: number) {
    const where: Prisma.PlataformaEventoWhereInput = {
      OR: [
        { tipo: { startsWith: 'equipo_' } },
        { tipo: { startsWith: 'mfa_' } },
        { tipo: { in: ['rol_otorgado', 'rol_revocado'] } },
      ],
    };
    const [total, eventos] = await this.prisma.$transaction([
      this.prisma.plataformaEvento.count({ where }),
      this.prisma.plataformaEvento.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          tipo: true,
          descripcion: true,
          createdAt: true,
          staff: { select: { nombreCompleto: true, email: true } },
        },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        creadoEl: e.createdAt.toISOString(),
        actor: e.staff.nombreCompleto ?? e.staff.email,
      })),
    };
  }

  /** Serializa los cambios del equipo, incluyendo administradores que se revocan entre sí. */
  private async autorizar(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    if (!auth.esPlataforma || auth.impersonacion || auth.mcp)
      throw new ForbiddenException(
        'Ingresá desde el backoffice con tu cuenta personal para gestionar el equipo.',
      );
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(724611, 1)::text`;
    const actor = await tx.user.findUnique({
      where: { id: auth.userId },
      select: {
        activo: true,
        rolPlataforma: true,
        mfa: { select: { activatedAt: true, recuperacionConfirmadaEl: true } },
      },
    });
    const sesion = await tx.authSession.findFirst({
      where: {
        id: auth.sessionId,
        userId: auth.userId,
        currentTenantId: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, mfaVerificadoEl: true },
    });
    if (
      !actor?.activo ||
      actor.rolPlataforma !== 'ADMIN' ||
      !sesion ||
      !mfaPlataformaCompleta(actor.mfa, sesion.mfaVerificadoEl)
    )
      throw new ForbiddenException(
        'Esta acción requiere una sesión vigente de administración de Plataforma.',
      );
  }

  private motivo(valor: string) {
    const motivo = valor.trim();
    if (motivo.length < 5 || motivo.length > 300)
      throw new BadRequestException(
        'Indicá un motivo de entre 5 y 300 caracteres.',
      );
    return motivo;
  }

  async invitaciones(pagina: number, limite: number) {
    const [total, invitaciones] = await this.prisma.$transaction([
      this.prisma.invitacionPlataforma.count(),
      this.prisma.invitacionPlataforma.findMany({
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ creadaEl: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          email: true,
          rol: true,
          creadaEl: true,
          venceEl: true,
          revocadaEl: true,
          aceptadaEl: true,
          invitador: { select: { nombreCompleto: true, email: true } },
        },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      invitaciones: invitaciones.map((i) => ({
        id: i.id,
        email: i.email,
        rol: i.rol,
        creadaEl: i.creadaEl.toISOString(),
        venceEl: i.venceEl.toISOString(),
        estado: i.aceptadaEl
          ? 'aceptada'
          : i.revocadaEl
            ? 'cancelada'
            : i.venceEl <= new Date()
              ? 'vencida'
              : 'pendiente',
        invitador: i.invitador.nombreCompleto ?? i.invitador.email,
      })),
    };
  }

  private async crearInvitacion(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    email: string,
    rol: RolPlataforma,
    motivo: string,
  ) {
    const user = await tx.user.findUnique({
      where: { email },
      select: { activo: true, rolPlataforma: true },
    });
    if (user?.rolPlataforma)
      throw new ConflictException(
        'Esta persona ya pertenece al equipo. Gestioná su acceso desde la lista.',
      );
    if (user && !user.activo)
      throw new ConflictException(
        'La cuenta está desactivada. Revisá su identidad antes de invitarla.',
      );
    if (
      await tx.invitacionPlataforma.count({
        where: {
          email,
          aceptadaEl: null,
          revocadaEl: null,
          venceEl: { gt: new Date() },
        },
      })
    )
      throw new ConflictException(
        'Ya hay una invitación pendiente para ese correo. Podés renovar su enlace.',
      );
    const token = randomBytes(32).toString('hex');
    const invitacion = await tx.invitacionPlataforma.create({
      data: {
        email,
        rol,
        tokenHash: hashInvitacionEquipo(token),
        invitadorId: auth.userId,
        venceEl: new Date(Date.now() + 72 * 60 * 60_000),
      },
    });
    await tx.plataformaEvento.create({
      data: {
        staffUserId: auth.userId,
        tipo: 'equipo_invitacion_creada',
        descripcion: `Invitó a ${email} con rol ${rol}. Motivo: ${motivo}`,
        datosJson: { invitacionId: invitacion.id, email, rol, motivo },
      },
    });
    const base =
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
      'http://localhost:3000';
    return {
      id: invitacion.id,
      email,
      venceEl: invitacion.venceEl.toISOString(),
      url: `${base.replace(/\/$/, '')}/backoffice/invitacion#token=${token}`,
    };
  }

  async invitar(
    auth: CurrentAuth,
    email: string,
    rol: RolPlataforma,
    razon: string,
  ) {
    const motivo = this.motivo(razon);
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      return this.crearInvitacion(
        tx,
        auth,
        email.trim().toLowerCase(),
        rol,
        motivo,
      );
    });
  }

  async gestionarInvitacion(
    auth: CurrentAuth,
    id: string,
    accion: 'cancelar' | 'renovar',
    razon: string,
  ) {
    const motivo = this.motivo(razon);
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      const invitacion = await tx.invitacionPlataforma.findUnique({
        where: { id },
      });
      if (!invitacion || invitacion.aceptadaEl || invitacion.revocadaEl)
        throw new ConflictException(
          'La invitación ya se aceptó o canceló. Actualizá la lista.',
        );
      const cambio = await tx.invitacionPlataforma.updateMany({
        where: { id, aceptadaEl: null, revocadaEl: null },
        data: { revocadaEl: new Date() },
      });
      if (cambio.count !== 1)
        throw new ConflictException(
          'La invitación cambió mientras la revisabas.',
        );
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: `equipo_invitacion_${accion === 'renovar' ? 'renovada' : 'cancelada'}`,
          descripcion: `${accion === 'renovar' ? 'Renovó el enlace para' : 'Canceló la invitación a'} ${invitacion.email}. Motivo: ${motivo}`,
          datosJson: { invitacionId: id, motivo },
        },
      });
      if (accion === 'renovar')
        return this.crearInvitacion(
          tx,
          auth,
          invitacion.email,
          invitacion.rol,
          motivo,
        );
      return { ok: true };
    });
  }

  async agregar(
    auth: CurrentAuth,
    email: string,
    rol: RolPlataforma,
    razon: string,
  ) {
    const motivo = this.motivo(razon);
    if (!Object.values(RolPlataforma).includes(rol))
      throw new BadRequestException('Rol inválido.');
    const usuarioId = await this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      const usuario = await tx.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: {
          id: true,
          email: true,
          activo: true,
          passwordHash: true,
          rolPlataforma: true,
        },
      });
      if (!usuario?.activo || !usuario.passwordHash)
        throw new BadRequestException(
          'Necesitás una cuenta de Grafo activa con contraseña configurada.',
        );
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${usuario.id}::uuid FOR UPDATE`;
      // Releer después del lock: el alta o una baja externa pueden haber cambiado la identidad.
      const actual = await tx.user.findUniqueOrThrow({
        where: { id: usuario.id },
        select: { activo: true, passwordHash: true, rolPlataforma: true },
      });
      if (!actual.activo || !actual.passwordHash)
        throw new ConflictException('La cuenta cambió. Actualizá la vista.');
      if (actual.rolPlataforma)
        throw new ConflictException(
          'Esta persona ya pertenece al equipo. Editá su acceso desde la lista.',
        );
      await tx.user.update({
        where: { id: usuario.id },
        data: { rolPlataforma: rol },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: 'equipo_alta',
          descripcion: `Acceso ${rol} otorgado a ${usuario.email}. Motivo: ${motivo}`,
          datosJson: {
            usuarioId: usuario.id,
            antes: null,
            despues: rol,
            motivo,
          },
        },
      });
      return usuario.id;
    });
    this.cache.invalidarUsuario(usuarioId);
    return { ok: true };
  }

  async actualizar(
    auth: CurrentAuth,
    id: string,
    accion: 'rol' | 'revocar' | 'sesiones',
    rolActual: RolPlataforma,
    rol: RolPlataforma | undefined,
    razon: string,
  ) {
    const motivo = this.motivo(razon);
    if (
      accion === 'rol' &&
      (!rol || !Object.values(RolPlataforma).includes(rol))
    )
      throw new BadRequestException('Elegí un rol válido.');
    const resultado = await this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const usuario = await tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, rolPlataforma: true },
      });
      if (!usuario?.rolPlataforma)
        throw new NotFoundException('La persona ya no pertenece al equipo.');
      if (usuario.rolPlataforma !== rolActual)
        throw new ConflictException(
          'El rol cambió desde que abriste la vista. Actualizá antes de continuar.',
        );
      const nuevoRol =
        accion === 'revocar'
          ? null
          : accion === 'rol'
            ? rol!
            : usuario.rolPlataforma;
      if (accion === 'rol' && nuevoRol === usuario.rolPlataforma)
        throw new BadRequestException('Elegí un rol diferente.');
      if (usuario.rolPlataforma === 'ADMIN' && nuevoRol !== 'ADMIN') {
        const restantes = await tx.user.count({
          where: {
            id: { not: id },
            activo: true,
            passwordHash: { not: null },
            rolPlataforma: 'ADMIN',
            mfa: {
              is: {
                activatedAt: { not: null },
                recuperacionConfirmadaEl: { not: null },
              },
            },
          },
        });
        if (!restantes)
          throw new BadRequestException(
            'Debe quedar al menos un administrador activo con MFA y recuperación confirmada para acceder a Plataforma.',
          );
      }
      if (accion !== 'sesiones')
        await tx.user.update({
          where: { id },
          data: { rolPlataforma: nuevoRol },
        });
      if (usuario.rolPlataforma === 'ADMIN' && nuevoRol !== 'ADMIN') {
        await tx.invitacionPlataforma.updateMany({
          where: { invitadorId: id, revocadaEl: null, aceptadaEl: null },
          data: { revocadaEl: new Date() },
        });
      }
      const ahora = new Date();
      const sesiones = await tx.authSession.updateMany({
        where: {
          userId: id,
          revokedAt: null,
          expiresAt: { gt: ahora },
          ...(accion === 'sesiones' && id === auth.userId
            ? { id: { not: auth.sessionId } }
            : {}),
          OR: [{ currentTenantId: null }, { impersonacionId: { not: null } }],
        },
        data: { revokedAt: ahora },
      });
      await tx.sesionImpersonacion.updateMany({
        where: { staffUserId: id, cerradaEl: null },
        data: { cerradaEl: ahora, motivoCierre: 'equipo_acceso_actualizado' },
      });
      await tx.mfaChallenge.deleteMany({
        where: { userId: id, destination: 'plataforma' },
      });
      const texto =
        accion === 'sesiones'
          ? 'Sesiones de Plataforma cerradas'
          : accion === 'revocar'
            ? 'Acceso a Plataforma revocado'
            : `Rol cambiado a ${nuevoRol}`;
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: `equipo_${accion}`,
          descripcion: `${texto} para ${usuario.email}. Motivo: ${motivo}`,
          datosJson: {
            usuarioId: id,
            antes: usuario.rolPlataforma,
            despues: nuevoRol,
            motivo,
            sesionesCerradas: sesiones.count,
          },
        },
      });
      return {
        ok: true,
        sesionActualCerrada: id === auth.userId && accion !== 'sesiones',
      };
    });
    this.cache.invalidarUsuario(id);
    return resultado;
  }
}
