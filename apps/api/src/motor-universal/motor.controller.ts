import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
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
  async cotizar(@Body() dto: CotizarDto, @Req() req: RequestWithAuth): Promise<CotizarOutput> {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Falta tenant en el contexto de autenticación');
    }

    return this.motor.cotizar({
      tenantId,
      productoId: dto.productoId,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never, // DTO compatible con JobContext (interface tiene index signature)
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
    });
  }
}
