import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { CostosService } from './costos.service';
import { UpsertCentroCostoDto } from './dto/upsert-centro-costo.dto';
import { UpsertPlantaDto } from './dto/upsert-planta.dto';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';
import { ReplaceCentroLineasDto } from './dto/replace-centro-lineas.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';
import { Permiso } from '../auth/permiso.decorator';
import { GuardarCentroPlanillaDto } from './dto/guardar-centro-planilla.dto';

@Permiso('costos.ver')
@Controller('costos')
export class CostosController {
  constructor(private readonly costosService: CostosService) {}

  @Get('plantas')
  findPlantas(@CurrentSession() auth: CurrentAuth) {
    return this.costosService.findPlantas(auth);
  }

  @Permiso('costos.gestionar')
  @Post('plantas')
  createPlanta(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertPlantaDto,
  ) {
    return this.costosService.createPlanta(auth, payload);
  }

  @Permiso('costos.gestionar')
  @Put('plantas/:id')
  updatePlanta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertPlantaDto,
  ) {
    return this.costosService.updatePlanta(auth, id, payload);
  }

  @Permiso('costos.gestionar')
  @Patch('plantas/:id/toggle')
  togglePlanta(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.costosService.togglePlanta(auth, id);
  }

  @Get('centros-costo')
  findCentros(@CurrentSession() auth: CurrentAuth) {
    return this.costosService.findCentros(auth);
  }

  @Permiso('costos.gestionar')
  @Post('centros-costo/planilla')
  guardarCentroPlanilla(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: GuardarCentroPlanillaDto,
  ) {
    return this.costosService.guardarCentroPlanilla(auth, payload);
  }

  @Permiso('costos.gestionar')
  @Post('centros-costo')
  createCentro(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertCentroCostoDto,
  ) {
    return this.costosService.createCentro(auth, payload);
  }

  @Permiso('costos.gestionar')
  @Put('centros-costo/:id')
  updateCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertCentroCostoDto,
  ) {
    return this.costosService.updateCentro(auth, id, payload);
  }

  @Permiso('costos.gestionar')
  @Patch('centros-costo/:id/toggle')
  toggleCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.toggleCentro(auth, id, periodo);
  }

  @Permiso('costos.gestionar')
  @Delete('centros-costo/:id')
  eliminarCentro(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.costosService.eliminarCentro(auth, id);
  }

  @Get('centros-costo/:id/configuracion')
  getCentroConfiguracion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.getCentroConfiguracion(auth, id, periodo);
  }

  @Permiso('costos.gestionar')
  @Put('centros-costo/:id/configuracion-base')
  updateCentroConfiguracionBase(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.costosService.updateCentroConfiguracionBase(auth, id, payload);
  }

  @Get('centros-costo/resumen')
  getResumenCentros(
    @CurrentSession() auth: CurrentAuth,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.getResumenCentros(auth, periodo);
  }

  @Permiso('costos.gestionar')
  @Put('centros-costo/:id/lineas')
  replaceCentroLineas(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
    @Body() payload: ReplaceCentroLineasDto,
  ) {
    return this.costosService.replaceCentroLineas(auth, id, periodo, payload);
  }

  @Permiso('costos.gestionar')
  @Put('centros-costo/:id/capacidad')
  upsertCentroCapacidad(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
    @Body() payload: UpsertCentroCapacidadDto,
  ) {
    return this.costosService.upsertCentroCapacidad(auth, id, periodo, payload);
  }

  @Permiso('costos.gestionar')
  @Post('centros-costo/:id/calcular-tarifa')
  calcularTarifaCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.calcularTarifaCentro(auth, id, periodo);
  }

  @Permiso('costos.gestionar')
  @Post('centros-costo/:id/publicar-tarifa')
  publicarTarifaCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.publicarTarifaCentro(auth, id, periodo);
  }

  @Get('centros-costo/:id/tarifas')
  getCentroTarifas(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.costosService.getCentroTarifas(auth, id);
  }
}
