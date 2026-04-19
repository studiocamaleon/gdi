import {
  BadRequestException,
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
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EvaluarProcesoCostoDto } from './dto/evaluar-proceso-costo.dto';
import { BulkAssignEstacionPlantillasDto } from './dto/bulk-assign-estacion-plantillas.dto';
import { UpsertProcesoOperacionPlantillaDto } from './dto/upsert-proceso-operacion-plantilla.dto';
import { UpsertProcesoOperacionAlternativaDto } from './dto/upsert-proceso-operacion-alternativa.dto';
import { UpsertProcesoOperacionMaterialDto } from './dto/upsert-proceso-operacion-material.dto';
import { UpdateProcesoOperacionDto } from './dto/update-proceso-operacion.dto';
import { UpsertProcesoDto } from './dto/upsert-proceso.dto';
import { ProcesosService } from './procesos.service';

@Controller('procesos')
export class ProcesosController {
  constructor(private readonly procesosService: ProcesosService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: PaginationDto,
  ) {
    return this.procesosService.findAll(auth, pagination);
  }

  @Get('biblioteca-operaciones')
  findAllBiblioteca(@CurrentSession() auth: CurrentAuth) {
    return this.procesosService.findAllBibliotecaOperaciones(auth);
  }

  @Post('biblioteca-operaciones')
  createBiblioteca(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    return this.procesosService.createBibliotecaOperacion(auth, payload);
  }

  @Put('biblioteca-operaciones/:id')
  updateBiblioteca(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    return this.procesosService.updateBibliotecaOperacion(auth, id, payload);
  }

  @Patch('biblioteca-operaciones/:id/toggle')
  toggleBiblioteca(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.procesosService.toggleBibliotecaOperacion(auth, id);
  }

  @Patch('biblioteca-operaciones/bulk-assign-estacion')
  bulkAssignEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: BulkAssignEstacionPlantillasDto,
  ) {
    return this.procesosService.bulkAssignEstacionPlantillas(auth, payload);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.procesosService.findOne(auth, id);
  }

  @Get(':id/versiones')
  getVersiones(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.procesosService.getVersiones(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProcesoDto,
  ) {
    return this.procesosService.create(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProcesoDto,
  ) {
    return this.procesosService.update(auth, id, payload);
  }

  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.procesosService.toggle(auth, id);
  }

  @Post(':id/snapshot-costo')
  snapshotCosto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Query('periodo') periodo: string,
  ) {
    return this.procesosService.snapshotCosto(auth, id, periodo);
  }

  @Post(':id/evaluar-costo')
  evaluarCosto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EvaluarProcesoCostoDto,
  ) {
    return this.procesosService.evaluarCosto(auth, id, payload);
  }

  // P1.3.b — CRUD de alternativas máquina+perfil por paso de ruta
  @Get('operaciones/:operacionId/alternativas')
  listAlternativas(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
  ) {
    return this.procesosService.listAlternativas(auth, operacionId);
  }

  @Post('operaciones/:operacionId/alternativas')
  createAlternativa(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Body() payload: UpsertProcesoOperacionAlternativaDto,
  ) {
    return this.procesosService.createAlternativa(auth, operacionId, payload);
  }

  @Put('operaciones/:operacionId/alternativas/:alternativaId')
  updateAlternativa(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Param('alternativaId') alternativaId: string,
    @Body() payload: UpsertProcesoOperacionAlternativaDto,
  ) {
    return this.procesosService.updateAlternativa(
      auth,
      operacionId,
      alternativaId,
      payload,
    );
  }

  @Delete('operaciones/:operacionId/alternativas/:alternativaId')
  deleteAlternativa(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Param('alternativaId') alternativaId: string,
  ) {
    return this.procesosService.deleteAlternativa(
      auth,
      operacionId,
      alternativaId,
    );
  }

  // P1.4 — CRUD de materiales declarativos (ProcesoOperacionMaterial)
  @Get('operaciones/:operacionId/materiales')
  listMateriales(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
  ) {
    return this.procesosService.listMateriales(auth, operacionId);
  }

  @Post('operaciones/:operacionId/materiales')
  createMaterial(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Body() payload: UpsertProcesoOperacionMaterialDto,
  ) {
    return this.procesosService.createMaterial(auth, operacionId, payload);
  }

  @Put('operaciones/:operacionId/materiales/:materialId')
  updateMaterial(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Param('materialId') materialId: string,
    @Body() payload: UpsertProcesoOperacionMaterialDto,
  ) {
    return this.procesosService.updateMaterial(
      auth,
      operacionId,
      materialId,
      payload,
    );
  }

  @Delete('operaciones/:operacionId/materiales/:materialId')
  deleteMaterial(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.procesosService.deleteMaterial(auth, operacionId, materialId);
  }

  // P1.5 — Update parcial y reorden de pasos
  @Patch('operaciones/:operacionId')
  updateOperacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Body() payload: UpdateProcesoOperacionDto,
  ) {
    return this.procesosService.updateOperacion(auth, operacionId, payload);
  }

  @Post('operaciones/:operacionId/move')
  moveOperacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('operacionId') operacionId: string,
    @Query('direction') direction: 'up' | 'down',
  ) {
    if (direction !== 'up' && direction !== 'down') {
      throw new BadRequestException('direction debe ser "up" o "down".');
    }
    return this.procesosService.moveOperacion(auth, operacionId, direction);
  }
}
