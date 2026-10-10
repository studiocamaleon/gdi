import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { CurrentAuth } from './auth.types';
import { PERMISO_KEY, SOLO_AUTENTICADO_KEY } from './permiso.decorator';
import { SIN_TENANT_KEY } from '../common/sin-tenant.decorator';

/**
 * Guard global de autorización por rol. Corre después de AuthGuard, por lo que
 * `request.auth` ya está poblado. Si el handler (o su controller) no declara
 * `@Roles(...)`, permite el acceso a cualquier usuario autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolSistema[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ auth?: CurrentAuth }>();
    const auth = request.auth;

    // En roles editados por vista, el permiso explícito es la autorización
    // efectiva. El enum histórico no puede anular una concesión granular.
    // El guard de permisos posterior sigue denegando por defecto.
    if (
      auth?.permisos?.has('acceso.por_vista') &&
      !this.reflector.getAllAndOverride(SIN_TENANT_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      for (const target of [context.getHandler(), context.getClass()]) {
        if (this.reflector.get(PERMISO_KEY, target) !== undefined) return true;
        if (this.reflector.get(SOLO_AUTENTICADO_KEY, target)) break;
      }
    }

    if (!auth || !requiredRoles.includes(auth.role)) {
      throw new ForbiddenException(
        'No tenes permisos para realizar esta accion.',
      );
    }

    return true;
  }
}
