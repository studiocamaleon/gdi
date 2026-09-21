import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentAuth } from '../auth/auth.types';
import { CapacidadesEmpresaService } from './capacidades-empresa.service';
import type { ClaveCapacidad } from './evaluador-capacidades';

const CLAVE = 'capacidad:requerida';
const ALGUNA = 'capacidad:alguna';
export const RequiereAlgunaCapacidad = (...claves: ClaveCapacidad[]) =>
  applyDecorators(SetMetadata(ALGUNA, claves), UseGuards(CapacidadGuard));
export const RequiereCapacidad = (clave: ClaveCapacidad) =>
  applyDecorators(SetMetadata(CLAVE, clave), UseGuards(CapacidadGuard));

@Injectable()
export class CapacidadGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const claves = [
      ...new Set(
        [context.getClass(), context.getHandler()]
          .map((target) => this.reflector.get<ClaveCapacidad>(CLAVE, target))
          .filter((clave): clave is ClaveCapacidad => Boolean(clave)),
      ),
    ];
    const alternativas = [context.getClass(), context.getHandler()]
      .map((target) => this.reflector.get<ClaveCapacidad[]>(ALGUNA, target))
      .filter((grupo): grupo is ClaveCapacidad[] => Boolean(grupo));
    if (!claves.length && !alternativas.length) return true;
    const { auth } = context
      .switchToHttp()
      .getRequest<{ auth?: CurrentAuth }>();
    if (!auth?.tenantId)
      throw new UnauthorizedException('Seleccioná una empresa.');
    // El estado de la suscripción y el permiso personal siguen en sus guards.
    // No convertir una suscripción en sólo lectura en una prohibición de leer.
    for (const clave of claves) {
      await this.capacidades.exigirIncluida(auth.tenantId, clave);
    }
    for (const grupo of alternativas) {
      await this.capacidades.exigirAlgunaIncluida(auth.tenantId, grupo);
    }
    return true;
  }
}
