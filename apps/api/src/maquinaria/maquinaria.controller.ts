import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { UpsertMaquinaDto } from './dto/upsert-maquina.dto';
import { MaquinariaService } from './maquinaria.service';

@Controller('maquinaria')
export class MaquinariaController {
  constructor(private readonly maquinariaService: MaquinariaService) {}

  @Get()
  findAll(@CurrentSession() auth: CurrentAuth) {
    return this.maquinariaService.findAll(auth);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.maquinariaService.findOne(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertMaquinaDto,
  ) {
    return this.maquinariaService.create(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertMaquinaDto,
  ) {
    return this.maquinariaService.update(auth, id, payload);
  }

  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.maquinariaService.toggle(auth, id);
  }
}
