import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SIN_TENANT_KEY } from '../common/sin-tenant.decorator';
import { CurrentAuth, JwtPayload } from './auth.types';
import { ipDeRequest, ipPermitida } from './ip';
import { expandir, permisosDeRolBase } from './permisos';
import { SessionCacheService } from './session-cache.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      auth?: CurrentAuth;
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();

    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Debes iniciar sesion.');
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
          userId: true,
          user: { select: { activo: true, rolPlataforma: true } },
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
      request.auth = {
        userId: payload.sub,
        sessionId: payload.sessionId,
        tenantId: '',
        membershipId: '',
        role: payload.role,
        email: payload.email,
        esPlataforma: true,
      };
      return true;
    }

    // Cache hit: evita el query con 3 joins. Requiere que el tenant/membership
    // La impersonación NO se cachea: la sesión puede cerrarse o expirar en
    // cualquier momento y el corte tiene que ser inmediato (a diferencia del
    // camino normal, que tolera el cache de 30 s). Va siempre a la base.
    if (!payload.imp) {
      // cacheados coincidan con el token (tras switch-tenant el token cambia y
      // el cache se invalida, así que un mismatch fuerza revalidación en DB).
      const cached = this.sessionCache.get(payload.sessionId);
      if (
        cached &&
        !cached.impersonacion &&
        cached.userId === payload.sub &&
        cached.tenantId === payload.tenantId &&
        cached.membershipId === payload.membershipId
      ) {
        // La IP se compara también contra el cache: sin esto, un usuario
        // restringido que ya pasó una vez seguiría entrando desde cualquier
        // lado durante los 30 s del TTL.
        if (!ipPermitida(ipDeRequest(request), cached.ipsPermitidas ?? [])) {
          throw new UnauthorizedException(
            'Tu cuenta sólo puede usarse desde la red autorizada de tu empresa.',
          );
        }
        request.auth = cached;
        return true;
      }
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: true,
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

    // ── Impersonación ──────────────────────────────────────────────────
    if (payload.imp) {
      const imp = session.impersonacion;
      if (
        !imp ||
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

    const rol = session.currentMembership.rolDelTenant;
    const auth: CurrentAuth = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      role: payload.role,
      email: payload.email,
      // Con rol asignado manda el rol; sin él —membership que el backfill no
      // alcanzó, o rol borrado— se cae a los permisos del enum. Nadie queda
      // sin acceso por no tener rol.
      permisos: expandir(
        rol ? rol.permisos : permisosDeRolBase(session.currentMembership.rol),
      ),
      ipsPermitidas: session.currentMembership.ipsPermitidas,
    };

    this.sessionCache.set(auth);
    request.auth = auth;

    return true;
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
