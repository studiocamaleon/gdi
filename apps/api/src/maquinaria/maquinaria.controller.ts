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
import { UpsertMaquinaDto } from './dto/upsert-maquina.dto';
import {
  ListMaquinasQueryDto,
  SetMaquinaActivaDto,
} from './dto/list-maquinas-query.dto';
import { MaquinariaService } from './maquinaria.service';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('costos.ver')
@Controller('maquinaria')
export class MaquinariaController {
  constructor(private readonly maquinariaService: MaquinariaService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: ListMaquinasQueryDto,
  ) {
    return this.maquinariaService.findAll(auth, pagination);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.maquinariaService.findOne(auth, id);
  }

  @Get(':id/historial')
  historial(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.maquinariaService.historial(auth, id);
  }

  @Permiso('costos.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMaquinaDto,
  ) {
    return this.maquinariaService.create(auth, payload);
  }

  @Permiso('costos.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMaquinaDto,
  ) {
    return this.maquinariaService.update(auth, id, payload);
  }

  @Permiso('costos.gestionar')
  @Patch(':id/activo')
  setActivo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: SetMaquinaActivaDto,
  ) {
    return this.maquinariaService.setActivo(auth, id, payload.activo);
  }

  /** Compatibilidad temporal para clientes antiguos. */
  @Permiso('costos.gestionar')
  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.maquinariaService.toggle(auth, id);
  }
}
