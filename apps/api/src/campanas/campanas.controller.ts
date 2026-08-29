import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { CampanasService } from './campanas.service';
import {
  CampanasOpcionesQueryDto,
  CampanasQueryDto,
  CambiarEstadoCampanaDto,
  CrearCampanaDto,
  CrearHitoDto,
  EditarCampanaDto,
  EditarHitoDto,
  ReemplazarEquipoDto,
} from './dto/campanas.dto';

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('campanas')
export class CampanasController {
  constructor(private readonly service: CampanasService) {}

  @Get()
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: CampanasQueryDto,
  ) {
    return this.service.listar(auth, query);
  }

  @Get('opciones')
  opciones(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: CampanasOpcionesQueryDto,
  ) {
    return this.service.opciones(auth, query);
  }

  @Get(':id')
  detalle(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Post()
  crear(@CurrentSession() auth: CurrentAuth, @Body() dto: CrearCampanaDto) {
    return this.service.crear(auth, dto);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarCampanaDto,
  ) {
    return this.service.editar(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/estado')
  cambiarEstado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoCampanaDto,
  ) {
    return this.service.cambiarEstado(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Put(':id/equipo')
  reemplazarEquipo(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReemplazarEquipoDto,
  ) {
    return this.service.reemplazarEquipo(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/hitos')
  crearHito(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearHitoDto,
  ) {
    return this.service.crearHito(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/hitos/:hitoId')
  editarHito(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hitoId', ParseUUIDPipe) hitoId: string,
    @Body() dto: EditarHitoDto,
  ) {
    return this.service.editarHito(auth, id, hitoId, dto);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/cotizaciones/:cotizacionId')
  vincularCotizacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cotizacionId', ParseUUIDPipe) cotizacionId: string,
  ) {
    return this.service.vincularCotizacion(auth, id, cotizacionId);
  }

  @Permiso('comercial.gestionar')
  @Delete(':id/cotizaciones/:cotizacionId')
  desvincularCotizacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cotizacionId', ParseUUIDPipe) cotizacionId: string,
  ) {
    return this.service.desvincularCotizacion(auth, id, cotizacionId);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/ordenes/:ordenId')
  vincularOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ordenId', ParseUUIDPipe) ordenId: string,
  ) {
    return this.service.vincularOrden(auth, id, ordenId);
  }

  @Permiso('comercial.gestionar')
  @Delete(':id/ordenes/:ordenId')
  desvincularOrden(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ordenId', ParseUUIDPipe) ordenId: string,
  ) {
    return this.service.desvincularOrden(auth, id, ordenId);
  }
}
