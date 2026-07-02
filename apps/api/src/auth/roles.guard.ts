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

    if (!auth || !requiredRoles.includes(auth.role)) {
      throw new ForbiddenException(
        'No tenes permisos para realizar esta accion.',
      );
    }

    return true;
  }
}
