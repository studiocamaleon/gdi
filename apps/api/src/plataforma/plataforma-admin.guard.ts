import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RolPlataforma } from '@prisma/client';

/**
 * La segunda puerta: escrituras del control plane sólo para ADMIN.
 *
 * Corre DESPUÉS del PlataformaGuard de la clase (Nest ejecuta guards de clase
 * antes que los de handler), así que `request.rolPlataforma` ya está resuelto
 * contra la base. SOPORTE ve todo; muta nada.
 */
@Injectable()
export class PlataformaAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ rolPlataforma?: RolPlataforma }>();
    if (request.rolPlataforma !== RolPlataforma.ADMIN) {
      throw new ForbiddenException(
        'Esta acción es de administración de la plataforma.',
      );
    }
    return true;
  }
}
