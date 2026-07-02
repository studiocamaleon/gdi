import { SetMetadata } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

export const ROLES_KEY = 'requiredRoles';

/**
 * Restringe un endpoint (o un controller completo) a los roles indicados.
 * Semántica de conjunto: el usuario pasa si su rol es uno de los listados.
 * ADMINISTRADOR no se incluye implícitamente — hay que listarlo cuando aplique.
 */
export const Roles = (...roles: RolSistema[]) => SetMetadata(ROLES_KEY, roles);
