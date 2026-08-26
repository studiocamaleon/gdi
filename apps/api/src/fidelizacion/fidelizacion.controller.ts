import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import {
  AjustarPuntosDto,
  ActualizarFidelizacionDto,
  SimularFidelizacionDto,
} from './dto/fidelizacion.dto';
import { FidelizacionService } from './fidelizacion.service';

@Permiso('crm.ver')
@Controller('fidelizacion')
export class FidelizacionController {
  constructor(private readonly service: FidelizacionService) {}
  @Get('configuracion') configuracion(@CurrentSession() auth: CurrentAuth) {
    return this.service.configuracion(auth.tenantId);
  }
  @Permiso('crm.configurar_fidelizacion') @Patch('configuracion') actualizar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ActualizarFidelizacionDto,
  ) {
    return this.service.actualizarConfiguracion(auth, dto);
  }
  @Get('resumen') resumen(@CurrentSession() auth: CurrentAuth) {
    return this.service.resumen(auth);
  }
  @Get('clientes/:clienteId') cuenta(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
  ) {
    return this.service.cuenta(auth, clienteId);
  }
  @Permiso('crm.configurar_fidelizacion')
  @Post('clientes/:clienteId/ajustes')
  ajustar(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
    @Body() dto: AjustarPuntosDto,
  ) {
    return this.service.ajustar(auth, clienteId, dto);
  }
  @Permiso('comercial.gestionar') @Post('clientes/:clienteId/simular') simular(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
    @Body() dto: SimularFidelizacionDto,
  ) {
    return this.service.simular(
      auth.tenantId,
      clienteId,
      dto.margen,
      dto.total,
      dto.canjePuntos,
    );
  }
}
