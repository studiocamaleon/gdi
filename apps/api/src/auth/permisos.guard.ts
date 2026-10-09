import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CurrentAuth } from './auth.types';
import {
  PERMISO_KEY,
  SOLO_AUTENTICADO_KEY,
  VISTA_KEY,
} from './permiso.decorator';
import { SIN_TENANT_KEY } from '../common/sin-tenant.decorator';
import { expandir, type PermisoClave } from './permisos';

/**
 * Guard de autorización por permiso. Corre después de AuthGuard, así que
 * `request.auth.permisos` ya está resuelto.
 *
 * **Deniega por defecto.** Un endpoint de tenant que no declara ni `@Permiso`
 * ni `@SoloAutenticado` no pasa. Es lo contrario de lo que hacía `RolesGuard`
 * —que permitía cuando no había anotación— y es el punto del módulo: con el
 * default abierto, olvidarse de anotar un endpoint nuevo lo dejaba disponible
 * para cualquiera, y así estaban 278 de los 301.
 *
 * Fuera de su alcance, a propósito:
 * - `@Public()`: ya cortó en AuthGuard, ni siquiera hay usuario.
 * - `@SinTenant()`: el control plane se autoriza por `rolPlataforma`, que es
 *   otro eje. Sus guards son propios.
 * - Impersonación: el staff entra con permisos de administrador del tenant.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  private readonly logger = new Logger(PermisosGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const esSinTenant = this.reflector.getAllAndOverride<boolean>(
      SIN_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (esSinTenant) return true;

    const request = context.switchToHttp().getRequest<{ auth?: CurrentAuth }>();
    const auth = request.auth;
    // Sin auth es una ruta @Public que AuthGuard dejó pasar: no hay permiso que
    // evaluar. (Si no fuera pública, AuthGuard ya habría tirado 401.)
    if (!auth) return true;
    if (!auth.mcp) auth.permisos = expandir([...(auth.permisos ?? [])]);
    const vistas = this.reflector.getAllAndOverride<PermisoClave[]>(VISTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (vistas && !vistas.some((p) => auth.permisos?.has(p))) {
      throw new ForbiddenException('No tenés acceso a esta vista.');
    }

    // Resolver ambas reglas en el mismo nivel antes de heredar. Buscar cada
    // clave por separado permitía que @SoloAutenticado del controller anulase
    // un @Permiso más estricto del método. Si coinciden, prevalece el permiso,
    // incluso vacío (denegación), independientemente del orden de decoradores.
    let declarado: PermisoClave | PermisoClave[] | undefined;
    for (const target of [context.getHandler(), context.getClass()]) {
      declarado = this.reflector.get<PermisoClave | PermisoClave[]>(
        PERMISO_KEY,
        target,
      );
      if (declarado !== undefined) break;
      if (this.reflector.get<boolean>(SOLO_AUTENTICADO_KEY, target) === true) {
        return true;
      }
    }

    // Puede venir uno solo (la forma vieja) o varios: alcanza con cualquiera.
    const requerido = declarado
      ? Array.isArray(declarado)
        ? declarado
        : [declarado]
      : null;

    if (!requerido || requerido.length === 0) {
      // Se registra fuerte: no es que el usuario no tenga permiso, es que el
      // endpoint no declaró cuál pide. Es un bug nuestro y se arregla anotando.
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} no declara @Permiso ni @SoloAutenticado: denegado.`,
      );
      throw new ForbiddenException('Esta acción no está disponible.');
    }

    if (!requerido.some((p) => auth.permisos?.has(p))) {
      throw new ForbiddenException('No tenés permisos para hacer esto.');
    }

    return true;
  }
}
