import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { vencimientoRenovado } from './sesion-vida';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SIN_TENANT_KEY } from '../common/sin-tenant.decorator';
import { CurrentAuth, JwtPayload } from './auth.types';
import { ipDeRequest, ipPermitida } from './ip';
import { expandir, permisosDeRolBase } from './permisos';
import { CLAVE_PROVISORIA } from './clave-provisoria.decorator';
import {
  REVALIDAR_ACCESO,
  type RequestConRevalidacion,
} from './revalidacion-acceso';
import {
  ENROLAMIENTO_PLATAFORMA,
  mfaPlataformaCompleta,
} from './enrolamiento-plataforma';
import {
  PREFIJO_TOKEN_MCP,
  hashTokenMcp,
  permisosEfectivosMcp,
} from './credencial-mcp.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async canActivate(context: ExecutionContext, renovarSesion = true) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      RequestConRevalidacion & {
        headers: Record<string, string | undefined>;
        auth?: CurrentAuth;
        ip?: string;
        socket?: { remoteAddress?: string };
      }
    >();

    if (renovarSesion) {
      request[REVALIDAR_ACCESO] = async () => {
        await this.canActivate(context, false);
        if (!request.auth) throw new UnauthorizedException('Sesion invalida.');
        return request.auth;
      };
    }

    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesion.');
    }

    // ── Credencial MCP (token opaco, no es un JWT) ─────────────────────
    // El prefijo decide el camino ANTES de verifyAsync: un token grafo_mcp_
    // jamás pasa por el verificador JWT ni viceversa.
    if (token.startsWith(PREFIJO_TOKEN_MCP)) {
      return this.autenticarCredencialMcp(token, context, request);
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Sesion invalida.');
    }

    // ── Sesión de plataforma (backoffice) ──────────────────────────────
    // No está parada en ningún tenant, así que SÓLO puede usar rutas
    // @SinTenant (el control plane). Cualquier ruta de tenant la rechaza:
    // sin contexto, el tenant-guard no filtra y leería todos los tenants.
    if (payload.plat) {
      const esSinTenant = this.reflector.getAllAndOverride<boolean>(
        SIN_TENANT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!esSinTenant) {
        throw new UnauthorizedException(
          'Esta sesión es del backoffice: no opera dentro de un tenant.',
        );
      }
      const session = await this.prisma.authSession.findUnique({
        where: { id: payload.sessionId },
        select: {
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
          userId: true,
          mfaVerificadoEl: true,
          user: {
            select: {
              activo: true,
              rolPlataforma: true,
              debeCambiarPassword: true,
              mfa: {
                select: { activatedAt: true, recuperacionConfirmadaEl: true },
              },
            },
          },
        },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.userId !== payload.sub ||
        !session.user.activo ||
        !session.user.rolPlataforma
      ) {
        throw new UnauthorizedException('Sesion expirada o revocada.');
      }
      if (renovarSesion)
        void this.renovar({ ...session, id: payload.sessionId });
      const plataformaMfaPendiente = !mfaPlataformaCompleta(
        session.user.mfa,
        session.mfaVerificadoEl,
      );
      const plataformaPasswordPendiente = session.user.debeCambiarPassword;
      if (
        (plataformaMfaPendiente || plataformaPasswordPendiente) &&
        !this.reflector.getAllAndOverride<boolean>(ENROLAMIENTO_PLATAFORMA, [
          context.getHandler(),
          context.getClass(),
        ])
      ) {
        throw new ForbiddenException(
          plataformaPasswordPendiente
            ? 'Elegí tu clave personal en el backoffice para continuar.'
            : 'Completá MFA y guardá tus códigos de recuperación en Seguridad del backoffice para continuar.',
        );
      }
      request.auth = {
        userId: payload.sub,
        sessionId: payload.sessionId,
        tenantId: '',
        membershipId: '',
        role: payload.role,
        email: payload.email,
        esPlataforma: true,
        plataformaMfaPendiente,
        plataformaPasswordPendiente,
      };
      return true;
    }

    // La base compartida es la autoridad en CADA request. Un resultado local
    // cacheado puede seguir autorizando después de revocar, cambiar permisos o
    // activar MFA en otra réplica. Tampoco autorizar si la base no responde.
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            mfa: {
              select: { activatedAt: true, recuperacionConfirmadaEl: true },
            },
          },
        },
        currentTenant: true,
        // El rol viene con la membership: los permisos se resuelven acá y no en
        // un query aparte por request.
        currentMembership: { include: { rolDelTenant: true } },
        impersonacion: true,
      },
    });

    // Base común a los dos caminos de tenant. currentTenant no puede ser null
    // acá (las sesiones sin tenant son las de plataforma, que ya retornaron).
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.activo ||
      !session.currentTenant?.activo ||
      session.userId !== payload.sub ||
      session.currentTenantId !== payload.tenantId
    ) {
      throw new UnauthorizedException('Sesion expirada o revocada.');
    }

    // La sesión se corre con el uso: muere por inactividad, no a plazo fijo.
    // `vencimientoRenovado` devuelve null casi siempre —sólo escribe cuando ya
    // pasó media ventana—, así que esto no es un UPDATE por request. Además
    // la autorización siempre consulta el estado vigente.
    if (renovarSesion) void this.renovar(session);

    // ── Impersonación ──────────────────────────────────────────────────
    if (payload.imp) {
      const imp = session.impersonacion;
      if (
        !imp ||
        session.user.rolPlataforma !== 'ADMIN' ||
        !mfaPlataformaCompleta(session.user.mfa, session.mfaVerificadoEl) ||
        imp.id !== payload.imp.sesionId ||
        imp.cerradaEl ||
        imp.expiraEl <= new Date() ||
        imp.tenantId !== payload.tenantId
      ) {
        throw new UnauthorizedException(
          'La sesión de impersonación terminó o expiró.',
        );
      }
      // El staff opera con rol ADMINISTRADOR del tenant, pero el actor real
      // viaja aparte: es lo que firma lo que el tenant ve.
      request.auth = {
        userId: payload.sub,
        sessionId: payload.sessionId,
        tenantId: payload.tenantId,
        membershipId: '',
        role: payload.role,
        email: payload.email,
        // Sin membership no hay rol del tenant: los permisos salen del enum,
        // que en impersonación es ADMINISTRADOR (todo el catálogo).
        permisos: expandir(permisosDeRolBase(payload.role)),
        impersonacion: {
          sesionId: imp.id,
          actorUserId: payload.imp.actorUserId,
          actorNombre: payload.imp.actorNombre,
        },
      };
      return true;
    }

    // ── Sesión normal ──────────────────────────────────────────────────
    if (
      !session.currentMembership?.activa ||
      session.currentMembershipId !== payload.membershipId
    ) {
      throw new UnauthorizedException('Sesion expirada o revocada.');
    }

    /**
     * La restricción de IP se revisa en CADA request, no sólo al entrar.
     *
     * Si sólo se mirara en el login, el que se lleva la notebook a su casa
     * sigue trabajando con la sesión abierta y la restricción no significa
     * nada. Es una comparación de strings contra un array que ya vino en el
     * mismo query: no agrega una consulta.
     */
    if (
      !ipPermitida(
        ipDeRequest(request),
        session.currentMembership.ipsPermitidas,
      )
    ) {
      throw new UnauthorizedException(
        'Tu cuenta sólo puede usarse desde la red autorizada de tu empresa.',
      );
    }

    if (
      session.user.debeCambiarPassword &&
      !this.reflector.getAllAndOverride<boolean>(CLAVE_PROVISORIA, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      throw new ForbiddenException('Elegí tu clave personal para continuar.');
    }

    const rol = session.currentMembership.rolDelTenant;
    const auth: CurrentAuth = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      role: session.currentMembership.rol,
      email: session.user.email,
      // Con rol asignado manda el rol; sin él —membership que el backfill no
      // alcanzó, o rol borrado— se cae a los permisos del enum. Nadie queda
      // sin acceso por no tener rol.
      permisos: expandir(
        rol ? rol.permisos : permisosDeRolBase(session.currentMembership.rol),
      ),
      ipsPermitidas: session.currentMembership.ipsPermitidas,
    };

    request.auth = auth;

    return true;
  }

  /**
   * Autentica un token opaco de credencial MCP (`grafo_mcp_...`).
   *
   * Espejo del camino de sesión normal, con tres diferencias:
   *  - No hay AuthSession: la credencial ES la sesión. Revocación/expiración
   *    se validan acá en cada request contra la base compartida.
   *  - Los permisos son rol ∩ scopes y NUNCA incluyen finanzas.ver_margenes
   *    (permisosEfectivosMcp): la IA ve precios, jamás costos ni márgenes.
   *  - Rutas @SinTenant se rechazan siempre: una credencial MCP vive DENTRO
   *    de un tenant (inverso exacto de la sesión de plataforma).
   *
   * El mensaje de error es único a propósito: no se le cuenta a un cliente
   * externo si la credencial no existe, venció o fue revocada.
   */
  private async autenticarCredencialMcp(
    token: string,
    context: ExecutionContext,
    request: {
      headers: Record<string, string | undefined>;
      auth?: CurrentAuth;
      ip?: string;
      socket?: { remoteAddress?: string };
    },
  ): Promise<boolean> {
    const rechazo = new UnauthorizedException(
      'Credencial MCP invalida, vencida o revocada.',
    );

    const esSinTenant = this.reflector.getAllAndOverride<boolean>(
      SIN_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (esSinTenant) {
      throw new UnauthorizedException(
        'Las credenciales MCP operan dentro de un tenant.',
      );
    }

    const tokenHash = hashTokenMcp(token);
    const credencial = await this.prisma.credencialMcp.findUnique({
      where: { tokenHash },
      include: {
        membership: {
          include: {
            rolDelTenant: true,
            user: {
              select: { activo: true, email: true, debeCambiarPassword: true },
            },
            tenant: { select: { activo: true } },
          },
        },
      },
    });

    if (
      !credencial ||
      credencial.revocadoEl ||
      (credencial.expiraEl && credencial.expiraEl <= new Date()) ||
      !credencial.membership.activa ||
      !credencial.membership.user.activo ||
      credencial.membership.user.debeCambiarPassword ||
      !credencial.membership.tenant.activo ||
      // Cinturón: la credencial y su membership tienen que ser del mismo
      // tenant. No debería poder divergir, pero si diverge es fuga, no bug.
      credencial.tenantId !== credencial.membership.tenantId
    ) {
      throw rechazo;
    }

    await this.capacidades.exigir(credencial.tenantId, 'mcp');
    const membership = credencial.membership;
    if (!ipPermitida(ipDeRequest(request), membership.ipsPermitidas)) {
      throw new UnauthorizedException(
        'Tu cuenta sólo puede usarse desde la red autorizada de tu empresa.',
      );
    }

    const rol = membership.rolDelTenant;
    const permisosDelRol = expandir(
      rol ? rol.permisos : permisosDeRolBase(membership.rol),
    );
    const auth: CurrentAuth = {
      userId: membership.userId,
      sessionId: `mcp:${tokenHash}`,
      tenantId: credencial.tenantId,
      membershipId: credencial.membershipId,
      role: membership.rol,
      email: membership.user.email,
      // Expandir ANTES de intersecar: expandir después podría resucitar un
      // `ver` que la intersección había sacado.
      permisos: permisosEfectivosMcp(
        permisosDelRol,
        expandir(credencial.scopes),
      ),
      ipsPermitidas: membership.ipsPermitidas,
      mcp: {
        credencialId: credencial.id,
        credencialNombre: credencial.nombre,
      },
    };

    // Último uso best-effort: como mucho un UPDATE por minuto por credencial,
    // sin await y sin tumbar el request si falla (es métrica, no autorización).
    const haceUnMinuto = Date.now() - 60_000;
    if (
      !credencial.ultimoUsoEl ||
      credencial.ultimoUsoEl.getTime() < haceUnMinuto
    ) {
      void this.prisma.credencialMcp
        .update({
          where: { id: credencial.id },
          data: { ultimoUsoEl: new Date() },
        })
        .catch(() => {});
    }

    request.auth = auth;
    return true;
  }

  /**
   * Corre el vencimiento de la sesión que se acaba de usar.
   *
   * No se espera (`void`) ni tumba el request si falla: renovar es higiene, no
   * autorización. Que dos requests del mismo usuario pisen el mismo UPDATE es
   * inofensivo —escriben casi el mismo instante—, y que la DB rechace el write
   * no puede dejar afuera a alguien que ya está validado.
   */
  private async renovar(sesion: {
    id: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<void> {
    const nuevo = vencimientoRenovado(sesion);
    if (!nuevo) return;
    try {
      await this.prisma.authSession.update({
        where: { id: sesion.id },
        data: { expiresAt: nuevo },
      });
    } catch {
      // Si no se pudo estirar, se estira en el request siguiente.
    }
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
