import { RequiereCapacidad } from '../suscripciones/capacidad.guard';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, RequiereVista } from '../auth/permiso.decorator';
import {
  AjustarPuntosDto,
  ActualizarFidelizacionDto,
  SimularFidelizacionDto,
} from './dto/fidelizacion.dto';
import { FidelizacionService } from './fidelizacion.service';

@Permiso("crm.fidelizacion.ver")
@Controller('fidelizacion')
export class FidelizacionController {
  constructor(private readonly service: FidelizacionService) {}
  @Get('configuracion') configuracion(@CurrentSession() auth: CurrentAuth) {
    return this.service.configuracion(auth.tenantId);
  }
  @RequiereCapacidad('fidelizacion')
  @Permiso("crm.fidelizacion.gestionar")
  @RequiereVista("crm.fidelizacion.ver")
  @Patch('configuracion')
  actualizar(
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
  @Permiso("crm.fidelizacion.gestionar")
  @RequiereVista("crm.fidelizacion.ver")
  @RequiereCapacidad('fidelizacion')
  @Post('clientes/:clienteId/ajustes')
  ajustar(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
    @Body() dto: AjustarPuntosDto,
  ) {
    return this.service.ajustar(auth, clienteId, dto);
  }
  @RequiereCapacidad('fidelizacion')
  @Permiso("comercial.ordenes.gestionar")
  @Post('clientes/:clienteId/simular')
  async simular(
    @CurrentSession() auth: CurrentAuth,
    @Param('clienteId') clienteId: string,
    @Body() dto: SimularFidelizacionDto,
  ) {
    const conoceMargen = auth.permisos?.has("finanzas.ver_margenes") && dto.margen != null;
    const { snapshot: _configuracionPrivada, ...resultado } = await this.service.simular(
      auth.tenantId,
      clienteId,
      conoceMargen ? dto.margen! : 0,
      dto.total,
      dto.canjePuntos,
    );
    // El canje depende del saldo y la venta. No necesita exponer ni inventar
    // costos: la acumulación definitiva se calcula en el servidor al emitir.
    return conoceMargen ? resultado : {
      ...resultado, puntosEstimados: null, puntosEstimadosMonto: null,
    };
  }
}
