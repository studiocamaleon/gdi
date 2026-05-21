import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { MotorUniversalService } from './motor.service';
import { CotizarDto } from './cotizar.dto';
import type { CotizarOutput } from './tipos';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@Controller('motor-universal')
export class MotorUniversalController {
  constructor(private readonly motor: MotorUniversalService) {}

  /**
   * POST /motor-universal/cotizar
   *
   * Recibe un producto + jobContext y devuelve el costeo + trazabilidad.
   * Equivalente al "Cotizar" del modelo viejo, pero usando el motor universal.
   */
  @Post('cotizar')
  async cotizar(
    @Body() dto: CotizarDto,
    @Req() req: RequestWithAuth,
  ): Promise<CotizarOutput> {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.cotizar({
      tenantId,
      productoId: dto.productoId,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
    });
  }

  /**
   * POST /motor-universal/cotizar-y-guardar
   *
   * Cotiza y persiste como CotizacionItem (con snapshot completo).
   * Si se pasa cotizacionId, agrega item a esa cotización; sino crea una nueva.
   */
  @Post('cotizar-y-guardar')
  async cotizarYGuardar(
    @Body() dto: CotizarDto & { cotizacionId?: string },
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.cotizarYGuardar({
      tenantId,
      productoId: dto.productoId,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
      cotizacionId: dto.cotizacionId,
    });
  }

  @Patch('cotizacion-items/:id/recotizar')
  async recotizarItem(
    @Param('id') id: string,
    @Body() dto: Pick<CotizarDto, 'jobContext' | 'rutaAlternativaId' | 'clienteId' | 'periodo'>,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.recotizarItem({
      tenantId,
      cotizacionItemId: id,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
    });
  }
}
