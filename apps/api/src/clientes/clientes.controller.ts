import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';
import { ClientesService } from './clientes.service';
import type { CurrentAuth } from '../auth/auth.types';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: PaginationDto,
  ) {
    return this.clientesService.findAll(auth, pagination);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.clientesService.findOne(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertClienteDto,
  ) {
    return this.clientesService.create(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertClienteDto,
  ) {
    return this.clientesService.update(auth, id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.clientesService.remove(auth, id);
  }
}
