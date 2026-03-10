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
import { EmpleadosService } from './empleados.service';
import { UpsertEmpleadoDto } from './dto/upsert-empleado.dto';

@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  findAll() {
    return this.empleadosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.empleadosService.findOne(id);
  }

  @Post()
  create(@Body() payload: UpsertEmpleadoDto) {
    return this.empleadosService.create(payload);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() payload: UpsertEmpleadoDto) {
    return this.empleadosService.update(id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.empleadosService.remove(id);
  }
}
