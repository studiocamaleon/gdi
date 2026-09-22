import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';

const COLAS = 'impresion:colas';
/** Envío de documentos y gestión de su cola; las etiquetas directas no lo requieren. */
export const ColasImpresion = () => SetMetadata(COLAS, true);
/** Sólo actualiza envíos existentes; nunca autoriza un nuevo envío. */
export const ImpresionRegistrada = () =>
  SetMetadata('impresion:registrada', true);

const MANUAL = 'impresion:manual';
/** La vista/descarga de una etiqueta no envía nada a una impresora. */
export const ImpresionManual = () => SetMetadata(MANUAL, true);

@Injectable()
export class ImpresionDirectaGuard implements CanActivate {
  constructor(
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.get<boolean>('impresion:registrada', context.getHandler())
    )
      return true;
    const tenantId = context
      .switchToHttp()
      .getRequest<{ auth?: { tenantId?: string } }>().auth?.tenantId;
    if (
      this.reflector.getAllAndOverride<boolean>(MANUAL, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      if (!tenantId) throw new ForbiddenException('No se encontró la empresa.');
      await this.capacidades.exigirAlguna(tenantId, [
        'etiquetas_pdf',
        'impresion_directa',
      ]);
      return true;
    }
    if (
      !tenantId ||
      !(await this.capacidades.puedeOperar(tenantId, 'impresion_directa'))
    ) {
      throw new ForbiddenException(
        'La impresión directa no está habilitada para esta empresa. Podés cotizar y emitir la orden normalmente.',
      );
    }
    if (this.reflector.get<boolean>(COLAS, context.getHandler()))
      await this.capacidades.exigir(tenantId, 'colas_impresion');
    return true;
  }
}
