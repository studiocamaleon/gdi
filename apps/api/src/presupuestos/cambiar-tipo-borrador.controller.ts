import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsISO8601 } from 'class-validator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, RequiereVista } from '../auth/permiso.decorator';
import { CambiarTipoBorradorService } from './cambiar-tipo-borrador.service';

export class CambiarTipoBorradorDto {
  @IsISO8601({ strict: true })
  version!: string;
}

@Permiso('comercial.presupuestos.gestionar')
@RequiereVista('comercial.ordenes.gestionar')
@Controller('borradores')
export class CambiarTipoBorradorController {
  constructor(private readonly service: CambiarTipoBorradorService) {}
  @Post('orden/:id/a-presupuesto')
  aPresupuesto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarTipoBorradorDto,
  ) {
    return this.service.cambiar(auth, 'orden', id, dto.version);
  }
  @Post('presupuesto/:id/a-orden')
  aOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarTipoBorradorDto,
  ) {
    return this.service.cambiar(auth, 'presupuesto', id, dto.version);
  }
}
