import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { CostosService } from './costos.service';
import { UpsertAreaCostoDto } from './dto/upsert-area-costo.dto';
import { UpsertCentroCostoDto } from './dto/upsert-centro-costo.dto';
import { UpsertPlantaDto } from './dto/upsert-planta.dto';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';
import { ReplaceCentroRecursosDto } from './dto/replace-centro-recursos.dto';
import { ReplaceCentroComponentesCostoDto } from './dto/replace-centro-componentes-costo.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';

@Controller('costos')
export class CostosController {
  constructor(private readonly costosService: CostosService) {}

  @Get('plantas')
  findPlantas(@CurrentSession() auth: CurrentAuth) {
    return this.costosService.findPlantas(auth);
  }

  @Post('plantas')
  createPlanta(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertPlantaDto,
  ) {
    return this.costosService.createPlanta(auth, payload);
  }

  @Put('plantas/:id')
  updatePlanta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertPlantaDto,
  ) {
    return this.costosService.updatePlanta(auth, id, payload);
  }

  @Patch('plantas/:id/toggle')
  togglePlanta(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.costosService.togglePlanta(auth, id);
  }

  @Get('areas')
  findAreas(@CurrentSession() auth: CurrentAuth) {
    return this.costosService.findAreas(auth);
  }

  @Post('areas')
  createArea(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertAreaCostoDto,
  ) {
    return this.costosService.createArea(auth, payload);
  }

  @Put('areas/:id')
  updateArea(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertAreaCostoDto,
  ) {
    return this.costosService.updateArea(auth, id, payload);
  }

  @Patch('areas/:id/toggle')
  toggleArea(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.costosService.toggleArea(auth, id);
  }

  @Get('centros-costo')
  findCentros(@CurrentSession() auth: CurrentAuth) {
    return this.costosService.findCentros(auth);
  }

  @Post('centros-costo')
  createCentro(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertCentroCostoDto,
  ) {
    return this.costosService.createCentro(auth, payload);
  }

  @Put('centros-costo/:id')
  updateCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertCentroCostoDto,
  ) {
    return this.costosService.updateCentro(auth, id, payload);
  }

  @Patch('centros-costo/:id/toggle')
  toggleCentro(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.costosService.toggleCentro(auth, id);
  }

  @Get('centros-costo/:id/configuracion')
  getCentroConfiguracion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.getCentroConfiguracion(auth, id, periodo);
  }

  @Put('centros-costo/:id/configuracion-base')
  updateCentroConfiguracionBase(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.costosService.updateCentroConfiguracionBase(auth, id, payload);
  }

  @Put('centros-costo/:id/recursos')
  replaceCentroRecursos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
    @Body() payload: ReplaceCentroRecursosDto,
  ) {
    return this.costosService.replaceCentroRecursos(auth, id, periodo, payload);
  }

  @Put('centros-costo/:id/componentes-costo')
  replaceCentroComponentesCosto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
    @Body() payload: ReplaceCentroComponentesCostoDto,
  ) {
    return this.costosService.replaceCentroComponentesCosto(
      auth,
      id,
      periodo,
      payload,
    );
  }

  @Put('centros-costo/:id/capacidad')
  upsertCentroCapacidad(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
    @Body() payload: UpsertCentroCapacidadDto,
  ) {
    return this.costosService.upsertCentroCapacidad(auth, id, periodo, payload);
  }

  @Post('centros-costo/:id/calcular-tarifa')
  calcularTarifaCentro(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.costosService.calcularTarifaCentro(auth, id, periodo);
  }

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
