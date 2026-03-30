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
import { InvitarAccesoDto } from './dto/invitar-acceso.dto';
import { EmpleadosService } from './empleados.service';
import { UpsertEmpleadoDto } from './dto/upsert-empleado.dto';
import type { CurrentAuth } from '../auth/auth.types';

@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: PaginationDto,
  ) {
    return this.empleadosService.findAll(auth, pagination);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.empleadosService.findOne(auth, id);
  }

  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertEmpleadoDto,
  ) {
    return this.empleadosService.create(auth, payload);
  }

  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertEmpleadoDto,
  ) {
    return this.empleadosService.update(auth, id, payload);
  }

  @Post(':id/invitar-acceso')
  invitarAcceso(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: InvitarAccesoDto,
  ) {
    return this.empleadosService.invitarAcceso(auth, id, payload);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.empleadosService.remove(auth, id);
  }
}
