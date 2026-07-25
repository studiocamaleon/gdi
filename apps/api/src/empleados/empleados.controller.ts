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
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import { RolSistema } from '@prisma/client';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { InvitarAccesoDto } from './dto/invitar-acceso.dto';
import { EmpleadosService } from './empleados.service';
import { RemuneracionesService } from './remuneraciones.service';
import { UpsertEmpleadoDto } from './dto/upsert-empleado.dto';
import { UpsertRemuneracionDto } from './dto/remuneracion.dto';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('registros.ver')
@Controller('empleados')
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly remuneraciones: RemuneracionesService,
  ) {}

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

  @Permiso('registros.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertEmpleadoDto,
  ) {
    return this.empleadosService.create(auth, payload);
  }

  @Permiso('registros.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertEmpleadoDto,
  ) {
    return this.empleadosService.update(auth, id, payload);
  }

  @Permiso('registros.gestionar')
  @Delete(':id')
  @Roles(RolSistema.ADMINISTRADOR)
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.empleadosService.remove(auth, id);
  }

  // ── Remuneraciones ────────────────────────────────────────────────────────
  //
  // Permiso propio, no el del módulo: Registros es abierto —el Vendedor tiene
  // `registros.gestionar` porque carga clientes— y sin esta excepción vería lo
  // que gana cada compañero. Ver docs/legajos-nomina-diseno.md §12.4

  @Permiso('registros.ver_remuneraciones')
  @Get(':id/remuneraciones')
  listarRemuneraciones(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.remuneraciones.listar(auth, id);
  }

  @Permiso('registros.ver_remuneraciones')
  @Post(':id/remuneraciones')
  crearRemuneracion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertRemuneracionDto,
  ) {
    return this.remuneraciones.crear(auth, id, payload);
  }

  @Permiso('registros.ver_remuneraciones')
  @Put(':id/remuneraciones/:remuneracionId')
  actualizarRemuneracion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('remuneracionId') remuneracionId: string,
    @Body() payload: UpsertRemuneracionDto,
  ) {
    return this.remuneraciones.actualizar(auth, id, remuneracionId, payload);
  }

  @Permiso('registros.ver_remuneraciones')
  @Delete(':id/remuneraciones/:remuneracionId')
  @HttpCode(204)
  async eliminarRemuneracion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('remuneracionId') remuneracionId: string,
  ) {
    await this.remuneraciones.eliminar(auth, id, remuneracionId);
  }
}
