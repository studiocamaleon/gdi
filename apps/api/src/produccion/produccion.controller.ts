import { Controller, Get, Post, Put, Patch, Body, Param } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ProduccionService } from './produccion.service';
import { UpsertEstacionDto } from './dto/upsert-estacion.dto';

@Controller('produccion')
export class ProduccionController {
  constructor(private readonly service: ProduccionService) {}

  @Get('estaciones')
  findEstaciones(@CurrentSession() auth: CurrentAuth) {
    return this.service.findEstaciones(auth);
  }

  @Post('estaciones')
  createEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertEstacionDto,
  ) {
    return this.service.createEstacion(auth, payload);
  }

  @Put('estaciones/:id')
  updateEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertEstacionDto,
  ) {
    return this.service.updateEstacion(auth, id, payload);
  }

  @Patch('estaciones/:id/toggle')
  toggleEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.toggleEstacion(auth, id);
  }
}
