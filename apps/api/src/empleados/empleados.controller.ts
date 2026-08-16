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
import { EmpleadosService } from './empleados.service';
import {
  EstadoEmpleadoDto,
  EstadoEmpleadosDto,
  ImportarEmpleadosDto,
  UpdateEmpleadoDto,
  UpsertEmpleadoDto,
} from './dto/upsert-empleado.dto';
import { EmpleadosQueryDto } from './dto/empleados-query.dto';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('registros.ver')
@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() pagination: EmpleadosQueryDto,
  ) {
    return this.empleadosService.findAll(auth, pagination);
  }

  @Get('opciones')
  opciones(@CurrentSession() auth: CurrentAuth) {
    return this.empleadosService.opciones(auth);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.empleadosService.findOne(auth, id);
  }

  @Permiso('registros.gestionar_empleados')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertEmpleadoDto,
  ) {
    return this.empleadosService.create(auth, payload);
  }

  @Permiso('registros.gestionar_empleados')
  @Post('importar')
  importar(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: ImportarEmpleadosDto,
  ) {
    return this.empleadosService.importar(auth, payload.empleados);
  }

  @Permiso('registros.gestionar_empleados')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateEmpleadoDto,
  ) {
    return this.empleadosService.update(auth, id, payload);
  }

  @Permiso('registros.gestionar_empleados')
  @Patch('estado')
  estadoMuchos(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: EstadoEmpleadosDto,
  ) {
    return this.empleadosService.fijarEstadoMuchos(
      auth,
      payload.ids,
      payload.activo,
      payload.motivo,
    );
  }

  @Permiso('registros.gestionar_empleados')
  @Patch(':id/estado')
  estado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EstadoEmpleadoDto,
  ) {
    return this.empleadosService.fijarActivo(
      auth,
      id,
      payload.activo,
      payload.motivo,
    );
  }

  @Permiso('registros.gestionar_empleados')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.empleadosService.remove(auth, id);
  }
}
