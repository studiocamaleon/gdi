import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { SessionCacheService } from '../auth/session-cache.service';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';
import {
  MODULOS,
  PERMISOS_TRANSVERSALES,
  ROLES_PREDEFINIDOS,
  esPermisoValido,
  expandir,
} from '../auth/permisos';
import type { CurrentAuth } from '../auth/auth.types';
import type { CrearUsuarioDto, EditarUsuarioDto } from './usuarios.dto';

/** Una semana, igual que la invitación que emitía Empleados. */
const VIGENCIA_INVITACION_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Usuarios del tenant: quién entra al sistema y con qué rol.
 *
 * Un usuario NO es un empleado. Hay usuarios que no son empleados —el dueño, el
 * contador externo— y empleados que nunca se loguean, que en una imprenta son
 * casi todos. El vínculo existe porque lo necesitan la mesa de trabajo y las
 * comisiones, pero es opcional y va de este lado: el legajo no manda sobre el
 * acceso. Ver docs/usuarios-roles-permisos-diseno.md
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionCacheService,
    private readonly suscripciones: SuscripcionesService,
  ) {}

  // ── Usuarios ────────────────────────────────────────────────────────

  async listar(auth: CurrentAuth) {
    const [memberships, limite] = await Promise.all([
      this.prisma.membership.findMany({
        where: { tenantId: auth.tenantId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nombreCompleto: true,
              activo: true,
              passwordHash: true,
              empleados: {
                where: { tenantId: auth.tenantId },
                select: { id: true, nombreCompleto: true },
                take: 1,
              },
            },
          },
          rolDelTenant: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.suscripciones.limites(auth.tenantId),
    ]);

    // Una sola consulta para todas las invitaciones vivas, en vez de una por
    // usuario: el listado es de 6 filas pero el N+1 se paga igual.
    const pendientes = await this.prisma.invitation.findMany({
      where: { tenantId: auth.tenantId, acceptedAt: null, revokedAt: null },
      select: { userId: true, expiresAt: true },
    });
    const invitacionDe = new Map(
      pendientes.map((i) => [i.userId, i.expiresAt]),
    );

    const usuarios = memberships.map((m) => {
      const invitacion = invitacionDe.get(m.userId);
      return {
        id: m.user.id,
        membershipId: m.id,
        email: m.user.email,
        nombreCompleto: m.user.nombreCompleto,
        rolId: m.rolId,
        rolNombre: m.rolDelTenant?.nombre ?? this.nombreDelEnum(m.rol),
        activa: m.activa,
        empleado: m.user.empleados[0] ?? null,
        /**
         * El estado que se lee de un vistazo. `pendiente` significa que la
         * cuenta existe y el acceso está dado, pero todavía no fijó su
         * contraseña: es información distinta de "lo invitamos y no sabemos
         * nada", que es lo que parecía decir la ficha del empleado.
         */
        estado: !m.activa
          ? ('desactivado' as const)
          : m.user.passwordHash
            ? ('activo' as const)
            : ('pendiente' as const),
        invitacionVence: invitacion?.toISOString() ?? null,
        esYo: m.userId === auth.userId,
      };
    });

    return {
      usuarios,
      limite: limite.usuariosMax,
      /** Los que ocupan cupo: un desactivado no le cuesta al plan. */
      enUso: usuarios.filter((u) => u.activa).length,
    };
  }

  /**
   * Da de alta el acceso y devuelve el link de invitación.
   *
   * La membership queda ACTIVA de entrada, como venía haciendo Empleados: la
   * invitación sirve para que la persona fije su contraseña, no para habilitar
   * el acceso. El listado lo dice con todas las letras (`pendiente`).
   */
  async crear(auth: CurrentAuth, dto: CrearUsuarioDto) {
    const email = dto.email.trim().toLowerCase();
    const rol = await this.rolDelTenant(auth.tenantId, dto.rolId);

    const existente = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { where: { tenantId: auth.tenantId } },
      },
    });
    if (existente?.memberships[0]?.activa) {
      throw new ConflictException(
        'Ese email ya tiene acceso a esta empresa. Cambiale el rol desde el listado.',
      );
    }

    await this.verificarCupo(auth.tenantId);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const user =
        existente ??
        (await tx.user.create({
          data: {
            email,
            nombreCompleto: dto.nombreCompleto?.trim() || null,
            activo: true,
          },
        }));

      await tx.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: auth.tenantId } },
        update: { rol: rol.rolBase, rolId: rol.id, activa: true },
        create: {
          userId: user.id,
          tenantId: auth.tenantId,
          rol: rol.rolBase,
          rolId: rol.id,
          activa: true,
        },
      });

      if (dto.empleadoId) {
        await this.vincularEmpleado(tx, auth.tenantId, dto.empleadoId, user.id);
      }

      // Una invitación viva por vez: la anterior deja de servir apenas se
      // emite otra, así el link que circula es siempre el último.
      await tx.invitation.updateMany({
        where: {
          tenantId: auth.tenantId,
          userId: user.id,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.invitation.create({
        data: {
          tenantId: auth.tenantId,
          userId: user.id,
          empleadoId: dto.empleadoId ?? null,
          invitedByMembershipId: auth.membershipId || null,
          email,
          rol: rol.rolBase,
          rolId: rol.id,
          tokenHash,
          expiresAt: new Date(Date.now() + VIGENCIA_INVITACION_MS),
        },
      });
    });

    return {
      invitacionUrl: this.urlDeInvitacion(rawToken),
      yaTeniaCuenta: Boolean(existente?.passwordHash),
    };
  }

  async editar(auth: CurrentAuth, userId: string, dto: EditarUsuarioDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: auth.tenantId } },
    });
    if (!membership) throw new NotFoundException('Ese usuario no existe acá.');

    // Nadie se saca a sí mismo del sistema: si el único administrador se
    // desactiva o se pasa a operario, el tenant se queda sin quien lo arregle.
    if (userId === auth.userId && (dto.activa === false || dto.rolId)) {
      throw new BadRequestException(
        'No podés cambiar tu propio acceso. Pedíselo a otro administrador.',
      );
    }

    const rol = dto.rolId
      ? await this.rolDelTenant(auth.tenantId, dto.rolId)
      : null;

    if (dto.activa === true && !membership.activa) {
      await this.verificarCupo(auth.tenantId);
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        ...(rol ? { rolId: rol.id, rol: rol.rolBase } : {}),
        ...(dto.activa === undefined ? {} : { activa: dto.activa }),
      },
    });

    if (dto.empleadoId !== undefined) {
      await this.vincularEmpleado(
        this.prisma,
        auth.tenantId,
        dto.empleadoId,
        userId,
      );
    }

    // Que el cambio se sienta YA: sin esto, quitarle acceso a alguien tardaba
    // hasta el TTL del cache de sesión, que es justo cuando el admin está
    // mirando si funcionó.
    this.sessionCache.invalidarTenant(auth.tenantId);

    // Desactivar tiene que cortar de verdad: las sesiones abiertas se revocan.
    if (dto.activa === false) {
      await this.prisma.authSession.updateMany({
        where: { userId, currentTenantId: auth.tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { ok: true as const };
  }

  // ── Roles ───────────────────────────────────────────────────────────

  /** El catálogo para la UI: los módulos, sus permisos y qué trae el plan. */
  async catalogo(auth: CurrentAuth) {
    const [afip, whatsapp] = await Promise.all([
      this.suscripciones.feature(auth.tenantId, 'afip'),
      this.suscripciones.feature(auth.tenantId, 'whatsapp'),
    ]);
    return {
      modulos: MODULOS.map((m) => ({
        clave: m.clave,
        label: m.label,
        descripcion: m.descripcion,
        /**
         * Fuera del plan se muestra atenuado, no se oculta ni se borra el
         * permiso guardado: si el tenant vuelve a subir de plan, sus roles
         * siguen configurados. Hoy sólo Administración depende de un feature.
         */
        enElPlan: m.clave === 'administracion' ? afip : true,
      })),
      transversales: PERMISOS_TRANSVERSALES.map((p) => ({ ...p })),
      /** Para el aviso del editor: qué features tiene el plan. */
      features: { afip, whatsapp },
    };
  }

  async listarRoles(auth: CurrentAuth) {
    const roles = await this.prisma.rol.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ esDelSistema: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { memberships: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esDelSistema: r.esDelSistema,
      permisos: r.permisos,
      usuarios: r._count.memberships,
    }));
  }

  /**
   * Siembra los predefinidos que falten. Se llama al listar: un tenant creado
   * después de la migración —o uno al que Grafo le agregó un rol al catálogo—
   * los tiene sin que nadie corra nada.
   */
  async sembrarPredefinidos(tenantId: string) {
    const existentes = await this.prisma.rol.findMany({
      where: { tenantId, codigo: { not: null } },
      select: { codigo: true },
    });
    const yaEstan = new Set(existentes.map((r) => r.codigo));
    const faltan = ROLES_PREDEFINIDOS.filter((r) => !yaEstan.has(r.codigo));
    if (faltan.length === 0) return;

    await this.prisma.rol.createMany({
      data: faltan.map((r) => ({
        tenantId,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion,
        esDelSistema: true,
        permisos: [...r.permisos],
      })),
      skipDuplicates: true,
    });
  }

  // ── Internos ────────────────────────────────────────────────────────

  private async rolDelTenant(tenantId: string, rolId: string) {
    const rol = await this.prisma.rol.findFirst({
      where: { id: rolId, tenantId },
    });
    if (!rol) throw new NotFoundException('Ese rol no existe.');
    return {
      id: rol.id,
      /**
       * El enum sigue viajando en el JWT y lo leen los endpoints con @Roles, así
       * que hay que darle uno: sale del predefinido que corresponde, y un rol
       * hecho a mano se trata como SUPERVISOR salvo que tenga configuración,
       * que es lo que hace un administrador.
       */
      rolBase: this.rolBaseDe(rol.codigo, rol.permisos),
    };
  }

  private rolBaseDe(codigo: string | null, permisos: string[]): RolSistema {
    const predefinido = ROLES_PREDEFINIDOS.find((r) => r.codigo === codigo);
    if (predefinido) return predefinido.rolBase;
    const efectivos = expandir(permisos);
    if (efectivos.has('configuracion.gestionar')) return RolSistema.ADMINISTRADOR;
    if (efectivos.size <= 2 && efectivos.has('produccion.ver')) {
      return RolSistema.OPERADOR;
    }
    return RolSistema.SUPERVISOR;
  }

  private nombreDelEnum(rol: RolSistema): string {
    const predefinido = ROLES_PREDEFINIDOS.find((r) => r.rolBase === rol);
    return predefinido?.nombre ?? 'Sin rol';
  }

  /** El tope del plan. Cuenta memberships activas: un desactivado no ocupa. */
  private async verificarCupo(tenantId: string) {
    const { usuariosMax } = await this.suscripciones.limites(tenantId);
    if (usuariosMax === null) return;
    const activas = await this.prisma.membership.count({
      where: { tenantId, activa: true },
    });
    if (activas >= usuariosMax) {
      throw new BadRequestException(
        `Tu plan incluye ${usuariosMax} usuarios y ya los estás usando. Podés desactivar uno o pasar a un plan mayor.`,
      );
    }
  }

  /**
   * Un empleado tiene a lo sumo un usuario y un usuario a lo sumo un empleado
   * dentro del tenant: `Empleado.userId` es el único vínculo, así que vincular
   * a otro implica soltar el anterior.
   */
  private async vincularEmpleado(
    db: {
      empleado: {
        updateMany: (args: unknown) => Promise<unknown>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
      };
    },
    tenantId: string,
    empleadoId: string | null,
    userId: string,
  ) {
    await db.empleado.updateMany({
      where: { tenantId, userId },
      data: { userId: null },
    });
    if (!empleadoId) return;
    const empleado = await db.empleado.findFirst({
      where: { id: empleadoId, tenantId },
      select: { id: true },
    });
    if (!empleado) throw new NotFoundException('Ese empleado no existe.');
    await db.empleado.updateMany({
      where: { id: empleadoId, tenantId },
      data: { userId },
    });
  }

  private urlDeInvitacion(token: string): string {
    const base =
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3000';
    return `${base}/aceptar-invitacion?token=${token}`;
  }
}

/** Valida un array de permisos contra el catálogo. Lo usa el DTO. */
export function permisosValidos(permisos: string[]): boolean {
  return permisos.every((p) => esPermisoValido(p));
}
