import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  findAll() {
    return this.clientesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Post()
  create(@Body() payload: UpsertClienteDto) {
    return this.clientesService.create(payload);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() payload: UpsertClienteDto) {
    return this.clientesService.update(id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.clientesService.remove(id);
  }
}
