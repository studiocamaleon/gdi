import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';

const MANUAL = 'impresion:manual';
/** La vista/descarga de una etiqueta no envía nada a una impresora. */
export const ImpresionManual = () => SetMetadata(MANUAL, true);

@Injectable()
export class ImpresionDirectaGuard implements CanActivate {
  constructor(
    private readonly suscripciones: SuscripcionesService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(MANUAL, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const tenantId = context
      .switchToHttp()
      .getRequest<{ auth?: { tenantId?: string } }>().auth?.tenantId;
    if (
      !tenantId ||
      !(await this.suscripciones.feature(tenantId, 'impresionDirecta'))
    ) {
      throw new ForbiddenException(
        'La impresión directa no está habilitada para esta empresa. Podés cotizar y emitir la orden normalmente.',
      );
    }
    return true;
  }
}
