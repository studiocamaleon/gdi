import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RolPlataforma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';

/**
 * La puerta del control plane: sesión válida (eso ya lo hizo el AuthGuard
 * global) + `User.rolPlataforma`.
 *
 * Lee el rol de la BASE en cada request, a propósito y a diferencia del resto
 * de la autorización (que viaja cacheada en la sesión 30 s): revocarle el rol
 * a alguien del staff tiene que cortar en el acto, no cuando venza un cache.
 * Es una query por request de un namespace que usan dos personas — barato.
 *
 * Deja `request.rolPlataforma` para que los handlers de escritura (etapa B)
 * distingan ADMIN de SOPORTE. En la etapa A todo es lectura y ambos pasan.
 * Ver docs/control-plane-diseno.md
 */
@Injectable()
export class PlataformaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      auth?: CurrentAuth;
      rolPlataforma?: RolPlataforma;
    }>();

    if (!request.auth) {
      // El AuthGuard global corre antes; si no pobló auth, algo está mal
      // cableado y la respuesta segura es rebotar.
      throw new UnauthorizedException('Debes iniciar sesion.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { activo: true, rolPlataforma: true },
    });

    if (!user?.activo || !user.rolPlataforma) {
      throw new ForbiddenException(
        'Esta sección es del equipo de la plataforma.',
      );
    }

    request.rolPlataforma = user.rolPlataforma;
    return true;
  }
}
