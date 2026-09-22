import { RequiereCapacidad } from '../suscripciones/capacidad.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { PlanificacionEntregasService } from './planificacion.service';
import {
  ReprogramarEntregasDto,
  ElegirPlanEntregaDto,
  SolicitarPlanEntregaDto,
} from './planificacion.dto';

@Permiso('comercial.gestionar')
@OcultaMargenes()
@Controller('cotizaciones/items/:itemId/planificacion-entregas')
export class PlanificacionCotizacionController {
  constructor(private readonly planes: PlanificacionEntregasService) {}
  @Get()
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.planes.consultar(auth.tenantId, itemId, true);
  }
  @Post()
  @RequiereCapacidad('planificacion_avanzada')
  solicitar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SolicitarPlanEntregaDto,
  ) {
    return this.planes.solicitar(auth, itemId, dto, true);
  }
  @Post('reprogramar')
  @RequiereCapacidad('planificacion_avanzada')
  @Permiso('produccion.supervisar')
  reprogramar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReprogramarEntregasDto,
  ) {
    return this.planes.reprogramar(auth, itemId, dto, true);
  }
  @Post('elegir')
  @RequiereCapacidad('planificacion_avanzada')
  elegir(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ElegirPlanEntregaDto,
  ) {
    return this.planes.elegir(auth, itemId, dto, true);
  }
}
