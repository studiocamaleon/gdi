import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROHIBIDO_IMPERSONANDO } from './prohibido-impersonando.decorator';
import type { CurrentAuth } from './auth.types';

/**
 * Hace cumplir @ProhibidoImpersonando(): corre después del AuthGuard (ya pobló
 * request.auth) y, si es una impersonación pegándole a un handler marcado,
 * corta con 403.
 *
 * Global, pero sólo mira handlers marcados: en el 99% de las rutas es un
 * lookup de metadata y sigue. Ver docs/control-plane-diseno.md
 */
@Injectable()
export class ImpersonacionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const prohibido = this.reflector.getAllAndOverride<boolean>(
      PROHIBIDO_IMPERSONANDO,
      [context.getHandler(), context.getClass()],
    );
    if (!prohibido) return true;

    const auth = context
      .switchToHttp()
      .getRequest<{ auth?: CurrentAuth }>().auth;
    if (auth?.impersonacion) {
      throw new ForbiddenException(
        'Esta acción no está permitida durante una sesión de impersonación: toca el acceso o los datos de la cuenta del cliente.',
      );
    }
    return true;
  }
}
