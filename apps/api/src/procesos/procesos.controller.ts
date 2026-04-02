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
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EvaluarProcesoCostoDto } from './dto/evaluar-proceso-costo.dto';
import { BulkAssignEstacionPlantillasDto } from './dto/bulk-assign-estacion-plantillas.dto';
import { UpsertProcesoOperacionPlantillaDto } from './dto/upsert-proceso-operacion-plantilla.dto';
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
}
