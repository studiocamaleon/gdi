import {
  Body,
  Controller,
  Delete,
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
  EliminarPlanEntregaDto,
  SolicitarPlanEntregaDto,
} from './planificacion.dto';

@Permiso('comercial.ver', 'produccion.ver')
@OcultaMargenes()
@Controller('ordenes-trabajo/items/:itemId/planificacion-entregas')
export class PlanificacionEntregasController {
  constructor(private readonly planes: PlanificacionEntregasService) {}
  @Get('lotes/:loteId')
  lote(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('loteId', ParseUUIDPipe) loteId: string,
  ) {
    return this.planes.detalleLote(auth.tenantId, itemId, loteId);
  }
  @Delete()
  @Permiso('comercial.gestionar')
  eliminar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: EliminarPlanEntregaDto,
  ) {
    return this.planes.eliminar(auth, itemId, dto);
  }
  @Get()
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.planes.consultar(auth.tenantId, itemId);
  }
  @Post()
  @Permiso('comercial.gestionar')
  solicitar(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SolicitarPlanEntregaDto,
  ) {
    return this.planes.solicitar(auth, itemId, dto);
  }
  @Post('reprogramar')
  @Permiso('produccion.supervisar')
  reprogramar(@CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: ReprogramarEntregasDto) {
    return this.planes.reprogramar(auth, itemId, dto, false);
  }
  @Post('elegir')
  @Permiso('comercial.gestionar')
  elegir(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ElegirPlanEntregaDto,
  ) {
    return this.planes.elegir(auth, itemId, dto);
  }
}
