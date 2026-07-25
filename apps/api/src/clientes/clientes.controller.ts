import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';
import { ClientesQueryDto } from './dto/clientes-query.dto';
import { ClientesService } from './clientes.service';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('registros.ver')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: ClientesQueryDto,
  ) {
    return this.clientesService.findAll(auth, query);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.clientesService.findOne(auth, id);
  }

  @Permiso('registros.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertClienteDto,
  ) {
    return this.clientesService.create(auth, payload);
  }

  @Permiso('registros.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertClienteDto,
  ) {
    return this.clientesService.update(auth, id, payload);
  }

  /** Inhabilitar o volver a habilitar: la salida para el que ya operó. */
  @Permiso('registros.gestionar')
  @Patch(':id/toggle')
  toggle(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.clientesService.alternarActivo(auth, id);
  }

  @Permiso('registros.gestionar')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.clientesService.remove(auth, id);
  }
}
