import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { SessionCacheService } from '../auth/session-cache.service';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';
import { esIpOrangoValido, ipPermitida } from '../auth/ip';
import {
  MODULOS,
  PERMISOS_TRANSVERSALES,
  ROLES_PREDEFINIDOS,
  esPermisoValido,
  expandir,
} from '../auth/permisos';
import type { CurrentAuth } from '../auth/auth.types';
import type {
  CrearRolDto,
  CrearUsuarioDto,
  EditarRolDto,
  EditarUsuarioDto,
} from './usuarios.dto';

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
  private readonly logger = new Logger(UsuariosService.name);

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
              debeCambiarPassword: true,
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

    const usuarios = memberships.map((m) => {
      return {
        id: m.user.id,
        membershipId: m.id,
        email: m.user.email,
        nombreCompleto: m.user.nombreCompleto,
        rolId: m.rolId,
        rolNombre: m.rolDelTenant?.nombre ?? this.nombreDelEnum(m.rol),
        /** Vacío = entra desde cualquier lado. */
        ipsPermitidas: m.ipsPermitidas,
        activa: m.activa,
        empleado: m.user.empleados[0] ?? null,
        /**
         * `pendiente` es "todavía no eligió SU clave": sigue con la provisoria
         * que le dictaron. Mirar sólo `passwordHash` daría por activo a alguien
         * cuya clave la sabe el administrador, que es medio activo nada más.
         */
        estado: !m.activa
          ? ('desactivado' as const)
          : m.user.passwordHash && !m.user.debeCambiarPassword
            ? ('activo' as const)
            : ('pendiente' as const),
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
   * Da de alta el acceso y devuelve la clave provisoria para dictarle.
   *
   * La membership queda ACTIVA de entrada: la clave provisoria es para que la
   * persona fije la suya, no para habilitar el acceso. Mientras no la cambie,
   * el listado lo dice con todas las letras (`pendiente`).
   */
  async crear(auth: CurrentAuth, dto: CrearUsuarioDto) {
    const email = dto.email.trim().toLowerCase();
    const rol = await this.rolDelTenant(auth.tenantId, dto.rolId);
    // Una sola forma de entregarle el acceso: el sistema genera una clave
    // provisoria, el admin la dicta, y la persona la cambia al entrar. Hubo un
    // modo "le mando un link" que se retiró (2026-07-27): el link se generaba
    // pero no lo mandaba nadie, así que el admin igual lo copiaba a mano.
    const provisoria = generarProvisoria();

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

      // Vale también para el que YA tenía cuenta en otra empresa: la clave se
      // le pisa con la provisoria y la cambia al entrar.
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(provisoria, 10),
          debeCambiarPassword: true,
        },
      });

      await tx.membership.upsert({
        where: {
          userId_tenantId: { userId: user.id, tenantId: auth.tenantId },
        },
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

      // Si le quedaba una invitación viva de antes —de cuando existía el modo
      // link— deja de servir: el acceso ahora es la clave que se acaba de
      // generar y un token suelto por ahí sólo sería otra puerta.
      await tx.invitation.updateMany({
        where: {
          tenantId: auth.tenantId,
          userId: user.id,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });

    await this.registrar(auth, {
      tipo: 'usuario_invitado',
      usuarioAfectadoNombre: dto.nombreCompleto?.trim() || email,
      descripcion: `Le dio acceso a ${email} como ${rol.nombre}`,
      datos: { rolId: rol.id },
    });

    return {
      provisoria,
      yaTeniaCuenta: Boolean(existente?.passwordHash),
    };
  }

  async editar(auth: CurrentAuth, userId: string, dto: EditarUsuarioDto) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: auth.tenantId } },
      include: {
        user: { select: { email: true, nombreCompleto: true } },
        rolDelTenant: { select: { nombre: true } },
      },
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

    const quien = membership.user.nombreCompleto || membership.user.email;
    if (rol) {
      await this.registrar(auth, {
        tipo: 'rol_cambiado',
        usuarioAfectadoId: userId,
        usuarioAfectadoNombre: quien,
        descripcion: `${quien} pasó de ${membership.rolDelTenant?.nombre ?? 'sin rol'} a ${rol.nombre}`,
        datos: { rolAnterior: membership.rolId, rolNuevo: rol.id },
      });
    }
    if (dto.activa !== undefined && dto.activa !== membership.activa) {
      await this.registrar(auth, {
        tipo: dto.activa ? 'acceso_devuelto' : 'acceso_quitado',
        usuarioAfectadoId: userId,
        usuarioAfectadoNombre: quien,
        descripcion: dto.activa
          ? `Le devolvió el acceso a ${quien}`
          : `Le quitó el acceso a ${quien}`,
      });
    }

    return { ok: true as const };
  }

  /**
   * Le pone una clave PROVISORIA y obliga a cambiarla al entrar.
   *
   * El admin no elige la clave ni necesita saber la que tenía: la genera el
   * sistema, se muestra una sola vez para dictarla y deja de servir apenas la
   * persona entra. Así el que administra puede devolverle el acceso a
   * cualquiera —el operario que la olvidó, el que volvió de vacaciones— sin
   * quedar sabiendo con qué clave trabaja después, que es lo que haría
   * discutible la auditoría de quién hizo qué.
   *
   * Corta las sesiones abiertas: si a alguien le restablecen la clave, lo que
   * estuviera abierto en otra máquina deja de valer.
   */
  async restablecerPassword(auth: CurrentAuth, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: auth.tenantId } },
      include: { user: { select: { email: true, nombreCompleto: true } } },
    });
    if (!membership) throw new NotFoundException('Ese usuario no existe acá.');

    const provisoria = generarProvisoria();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(provisoria, 10),
        debeCambiarPassword: true,
      },
    });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.sessionCache.invalidarTenant(auth.tenantId);

    const quien = membership.user.nombreCompleto || membership.user.email;
    await this.registrar(auth, {
      tipo: 'password_restablecida',
      usuarioAfectadoId: userId,
      usuarioAfectadoNombre: quien,
      descripcion: `Le restableció la contraseña a ${quien}`,
    });

    return { provisoria, email: membership.user.email };
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

  async crearRol(auth: CurrentAuth, dto: CrearRolDto) {
    const permisos = this.limpiarPermisos(dto.permisos);
    await this.verificarNombreLibre(auth.tenantId, dto.nombre);

    const rol = await this.prisma.rol.create({
      data: {
        tenantId: auth.tenantId,
        // Sin código: los códigos son de los predefinidos de Grafo y son la
        // clave que usa el backfill. Uno del tenant no puede tomar uno.
        codigo: null,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        esDelSistema: false,
        permisos,
      },
    });
    await this.registrar(auth, {
      tipo: 'rol_creado',
      descripcion: `Creó el rol ${rol.nombre}`,
      datos: { rolId: rol.id, permisos },
    });
    return { id: rol.id };
  }

  async editarRol(auth: CurrentAuth, rolId: string, dto: EditarRolDto) {
    const rol = await this.prisma.rol.findFirst({
      where: { id: rolId, tenantId: auth.tenantId },
    });
    if (!rol) throw new NotFoundException('Ese rol no existe.');

    // Los de fábrica se ajustan en permisos pero no se renombran: son la
    // referencia común —"el Vendedor de Grafo"— y un Vendedor que en realidad
    // es un administrador vuelve inútil hablar de roles con nadie.
    if (rol.esDelSistema && dto.nombre && dto.nombre.trim() !== rol.nombre) {
      throw new BadRequestException(
        'Los roles de fábrica no se renombran. Duplicalo y ponele el nombre que quieras.',
      );
    }
    if (dto.nombre && dto.nombre.trim() !== rol.nombre) {
      await this.verificarNombreLibre(auth.tenantId, dto.nombre);
    }

    const permisos =
      dto.permisos === undefined
        ? rol.permisos
        : this.limpiarPermisos(dto.permisos);

    if (dto.permisos !== undefined) {
      await this.verificarQuedaAlguienConLasLlaves(auth, rolId, permisos);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rol.update({
        where: { id: rolId },
        data: {
          ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.descripcion === undefined
            ? {}
            : { descripcion: dto.descripcion?.trim() || null }),
          ...(dto.permisos === undefined ? {} : { permisos }),
        },
      });

      // El enum sigue vivo y tiene que seguir al rol: si un rol pasa a tener
      // configuración, sus miembros son ADMINISTRADOR para los endpoints que
      // todavía miran @Roles. Sin esto, cambiar permisos arreglaba la mitad.
      if (dto.permisos !== undefined) {
        await tx.membership.updateMany({
          where: { tenantId: auth.tenantId, rolId },
          data: { rol: this.rolBaseDe(rol.codigo, permisos) },
        });
      }
    });

    this.sessionCache.invalidarTenant(auth.tenantId);
    await this.registrar(auth, {
      tipo: 'rol_editado',
      descripcion: `Cambió el rol ${rol.nombre}`,
      datos: { rolId, permisosAntes: rol.permisos, permisosDespues: permisos },
    });
    return { ok: true as const };
  }

  /**
   * Borra un rol del tenant. Si tiene gente, hay que decir a qué rol se mudan:
   * dejarlos sin rol los tiraría al fallback del enum, que es un permiso
   * distinto del que el admin creía estar sacando.
   */
  async eliminarRol(auth: CurrentAuth, rolId: string, destinoId?: string) {
    const rol = await this.prisma.rol.findFirst({
      where: { id: rolId, tenantId: auth.tenantId },
      include: { _count: { select: { memberships: true } } },
    });
    if (!rol) throw new NotFoundException('Ese rol no existe.');
    if (rol.esDelSistema) {
      throw new BadRequestException(
        'Los roles de fábrica no se borran. Si no lo usás, no se lo asignes a nadie.',
      );
    }

    if (rol._count.memberships > 0) {
      if (!destinoId) {
        throw new BadRequestException(
          `Ese rol lo están usando ${rol._count.memberships} usuarios. Elegí a qué rol pasan.`,
        );
      }
      const destino = await this.rolDelTenant(auth.tenantId, destinoId);
      await this.verificarQuedaAlguienConLasLlaves(auth, rolId, []);
      await this.prisma.membership.updateMany({
        where: { tenantId: auth.tenantId, rolId },
        data: { rolId: destino.id, rol: destino.rolBase },
      });
    }

    await this.prisma.rol.delete({ where: { id: rolId } });
    this.sessionCache.invalidarTenant(auth.tenantId);
    await this.registrar(auth, {
      tipo: 'rol_eliminado',
      descripcion: `Eliminó el rol ${rol.nombre}`,
      datos: {
        permisos: rol.permisos,
        usuariosMudados: rol._count.memberships,
      },
    });
    return { ok: true as const };
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

  // ── Seguridad ───────────────────────────────────────────────────────

  /**
   * Quién está conectado ahora mismo a esta empresa.
   *
   * Las sesiones existen desde siempre y no las veía nadie: para saber si al
   * empleado que se fue le quedó algo abierto había que entrar a la base. Se
   * listan sólo las vivas —ni revocadas ni vencidas— porque la pregunta es del
   * presente; el pasado está en el registro de actividad.
   */
  async sesiones(auth: CurrentAuth) {
    const abiertas = await this.prisma.authSession.findMany({
      where: {
        currentTenantId: auth.tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, nombreCompleto: true } },
      },
    });
    return abiertas.map((s) => ({
      id: s.id,
      usuarioId: s.user.id,
      usuarioNombre: s.user.nombreCompleto || s.user.email,
      email: s.user.email,
      desde: s.createdAt.toISOString(),
      expira: s.expiresAt.toISOString(),
      /** La del que está mirando: no se ofrece cerrarla desde acá. */
      esLaMia: s.id === auth.sessionId,
      /** El staff de Grafo operando adentro del tenant. */
      esImpersonacion: s.impersonacionId !== null,
    }));
  }

  /**
   * Desde qué IPs puede entrar esta persona. Lista vacía = desde cualquier lado.
   *
   * El cerrojo importante: nadie puede restringirse a sí mismo a una IP que no
   * sea desde la que está mirando. Sin eso, un admin se encierra afuera de su
   * propio sistema con un error de tipeo y no queda nadie que pueda arreglarlo
   * salvo entrando a la base.
   */
  async cambiarIps(
    auth: CurrentAuth,
    userId: string,
    ips: string[],
    ipActual: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: auth.tenantId } },
      include: { user: { select: { email: true, nombreCompleto: true } } },
    });
    if (!membership) throw new NotFoundException('Ese usuario no existe acá.');

    const limpias = [...new Set(ips.map((i) => i.trim()).filter(Boolean))];
    const invalida = limpias.find((i) => !esIpOrangoValido(i));
    if (invalida) {
      throw new BadRequestException(
        `"${invalida}" no es una IP ni un rango válido. Ejemplos: 190.1.2.3 o 190.1.2.0/24.`,
      );
    }

    if (userId === auth.userId && limpias.length > 0) {
      if (!ipPermitida(ipActual, limpias)) {
        throw new BadRequestException(
          `Te estarías dejando afuera: estás entrando desde ${ipActual || 'un origen desconocido'} y esa IP no está en la lista.`,
        );
      }
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: { ipsPermitidas: limpias },
    });
    this.sessionCache.invalidarTenant(auth.tenantId);

    const quien = membership.user.nombreCompleto || membership.user.email;
    await this.registrar(auth, {
      tipo: 'ips_cambiadas',
      usuarioAfectadoId: userId,
      usuarioAfectadoNombre: quien,
      descripcion:
        limpias.length === 0
          ? `${quien} puede entrar desde cualquier lugar`
          : `${quien} sólo puede entrar desde ${limpias.join(', ')}`,
      datos: { antes: membership.ipsPermitidas, ahora: limpias },
    });

    return { ipsPermitidas: limpias };
  }

  /** Cierra TODAS las sesiones de una persona en esta empresa. */
  async cerrarSesiones(auth: CurrentAuth, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: auth.tenantId } },
      include: { user: { select: { email: true, nombreCompleto: true } } },
    });
    if (!membership) throw new NotFoundException('Ese usuario no existe acá.');

    const { count } = await this.prisma.authSession.updateMany({
      where: { userId, currentTenantId: auth.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.sessionCache.invalidarTenant(auth.tenantId);

    const quien = membership.user.nombreCompleto || membership.user.email;
    await this.registrar(auth, {
      tipo: 'sesiones_cerradas',
      usuarioAfectadoId: userId,
      usuarioAfectadoNombre: quien,
      descripcion: `Cerró ${count === 1 ? 'la sesión' : `las ${count} sesiones`} de ${quien}`,
    });
    return { cerradas: count };
  }

  // ── Auditoría ───────────────────────────────────────────────────────

  /**
   * Deja constancia de un cambio de acceso.
   *
   * Best-effort: que falle el registro no puede voltear el cambio que el admin
   * acaba de hacer —quedaría un botón que a veces funciona y a veces no— pero
   * se loguea fuerte, porque una auditoría con agujeros es peor que ninguna si
   * nadie sabe que los tiene.
   */
  private async registrar(
    auth: CurrentAuth,
    evento: {
      tipo: string;
      descripcion: string;
      usuarioAfectadoId?: string;
      usuarioAfectadoNombre?: string;
      datos?: Record<string, unknown>;
    },
  ) {
    try {
      await this.prisma.eventoAcceso.create({
        data: {
          tenantId: auth.tenantId,
          actorUserId: auth.userId || null,
          // El nombre del actor se congela: si mañana cambia de mail o se da de
          // baja, la línea tiene que seguir diciendo quién fue.
          actorNombre: auth.impersonacion?.actorNombre ?? auth.email,
          tipo: evento.tipo,
          usuarioAfectadoId: evento.usuarioAfectadoId ?? null,
          usuarioAfectadoNombre: evento.usuarioAfectadoNombre ?? null,
          descripcion: evento.descripcion,
          datosJson: (evento.datos ?? null) as never,
        },
      });
    } catch (error) {
      this.logger.error(
        `No pude registrar el evento de acceso ${evento.tipo}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** El historial que muestra la pantalla. Sólo lectura, sin paginar: son pocos. */
  async historial(auth: CurrentAuth) {
    const eventos = await this.prisma.eventoAcceso.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return eventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      actorNombre: e.actorNombre,
      usuarioAfectadoNombre: e.usuarioAfectadoNombre,
      descripcion: e.descripcion,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  // ── Internos ────────────────────────────────────────────────────────

  /** Se guardan sólo claves del catálogo, sin repetir y sin el `ver` que ya
   *  arrastra su `gestionar`: dos formas de decir lo mismo terminan en dos
   *  matrices que se ven distintas y hacen lo mismo. */
  private limpiarPermisos(permisos: string[]): string[] {
    const validos = permisos.filter((p) => esPermisoValido(p));
    const gestion = new Set(
      validos
        .filter((p) => p.endsWith('.gestionar'))
        .map((p) => p.replace('.gestionar', '')),
    );
    return [
      ...new Set(
        validos.filter(
          (p) => !(p.endsWith('.ver') && gestion.has(p.replace('.ver', ''))),
        ),
      ),
    ];
  }

  private async verificarNombreLibre(tenantId: string, nombre: string) {
    const limpio = nombre.trim();
    if (limpio.length < 2) {
      throw new BadRequestException('El rol necesita un nombre.');
    }
    const existe = await this.prisma.rol.findFirst({
      where: { tenantId, nombre: { equals: limpio, mode: 'insensitive' } },
    });
    if (existe) {
      throw new ConflictException(`Ya hay un rol que se llama "${limpio}".`);
    }
  }

  /**
   * Nadie puede dejar la empresa sin un solo usuario capaz de administrar la
   * configuración.
   *
   * Es el cerrojo que hace segura toda la pantalla: sin esto, sacarle
   * `configuracion.gestionar` al rol Administrador —o borrar el rol de la única
   * persona que lo tiene— deja al tenant sin nadie que pueda revertirlo, y hay
   * que entrar por la base a arreglarlo.
   */
  private async verificarQuedaAlguienConLasLlaves(
    auth: CurrentAuth,
    rolIdQueCambia: string,
    permisosNuevos: string[],
  ) {
    const sigueTeniendo = expandir(permisosNuevos).has(
      'configuracion.gestionar',
    );
    if (sigueTeniendo) return;

    const conLlaves = await this.prisma.membership.count({
      where: {
        tenantId: auth.tenantId,
        activa: true,
        rolId: { not: rolIdQueCambia },
        rolDelTenant: { permisos: { has: 'configuracion.gestionar' } },
      },
    });
    if (conLlaves === 0) {
      throw new BadRequestException(
        'Con este cambio nadie podría administrar la empresa. Dale acceso a la configuración a otro usuario primero.',
      );
    }
  }

  private async rolDelTenant(tenantId: string, rolId: string) {
    const rol = await this.prisma.rol.findFirst({
      where: { id: rolId, tenantId },
    });
    if (!rol) throw new NotFoundException('Ese rol no existe.');
    return {
      id: rol.id,
      nombre: rol.nombre,
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
    if (efectivos.has('configuracion.gestionar'))
      return RolSistema.ADMINISTRADOR;
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
      where: { id: empleadoId, tenantId, activo: true },
      select: { id: true },
    });
    if (!empleado) {
      throw new NotFoundException('Ese empleado no existe o está dado de baja.');
    }
    await db.empleado.updateMany({
      where: { id: empleadoId, tenantId },
      data: { userId },
    });
  }
}

/**
 * Clave provisoria para dictar por teléfono o anotar en un papel.
 *
 * Sin caracteres que se confunden al leerlos en voz alta (0/O, 1/l/I) y en
 * bloques de cuatro: la van a pasar hablando, no copiando. La entropía alcanza
 * de sobra para algo que muere en el primer ingreso.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generarProvisoria(): string {
  const bloque = () =>
    Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join(
      '',
    );
  return `${bloque()}-${bloque()}-${bloque()}`;
}

/** Valida un array de permisos contra el catálogo. Lo usa el DTO. */
export function permisosValidos(permisos: string[]): boolean {
  return permisos.every((p) => esPermisoValido(p));
}
