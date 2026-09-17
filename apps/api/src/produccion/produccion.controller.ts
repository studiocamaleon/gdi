import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ProduccionService } from './produccion.service';
import { UpsertEstacionDto } from './dto/upsert-estacion.dto';
import { CrearDiaNoLaborableDto } from './dto/crear-dia-no-laborable.dto';
import { ActualizarConfiguracionProduccionDto } from './dto/actualizar-configuracion-produccion.dto';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('produccion.ver')
@Controller('produccion')
export class ProduccionController {
  constructor(private readonly service: ProduccionService) {}

  @Get('estaciones')
  findEstaciones(@CurrentSession() auth: CurrentAuth) {
    return this.service.findEstaciones(auth.tenantId);
  }

  /** Referencias operativas del editor, sin exigir Registros ni Costos. */
  @Permiso('produccion.configurar')
  @Get('estaciones-recursos')
  recursosEstaciones(@CurrentSession() auth: CurrentAuth) {
    return this.service.recursosEstaciones(auth.tenantId);
  }

  /** Catálogo de familias de pasos + qué estación tiene tomada cada una. */
  @Get('familias-pasos')
  findFamiliasPasos(@CurrentSession() auth: CurrentAuth) {
    return this.service.findFamiliasPasos(auth);
  }

  /**
   * Mediana histórica de duración real por familia (fallback de la cola en
   * horas del tablero). Ver docs/capacidad-estaciones-diseno.md D6.
   */
  @Get('duraciones-familias')
  findDuracionesFamilias(@CurrentSession() auth: CurrentAuth) {
    return this.service.findDuracionesFamilias(auth.tenantId);
  }

  /**
   * Estructura del bastidor de un ítem (cartelería), para el visor 3D del tab
   * de Producción. Sale del snapshot del ítem: es lo cotizado, con overrides.
   */
  @Get('estructura-bastidor/:itemId')
  estructuraBastidor(
    @CurrentSession() auth: CurrentAuth,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.estructuraBastidor(auth, itemId);
  }

  // ── Configuración de producción (margen de la ETA sugerida) ───────────

  @Get('configuracion')
  getConfiguracion(@CurrentSession() auth: CurrentAuth) {
    return this.service.getConfiguracion(auth.tenantId);
  }

  @Permiso('produccion.configurar')
  @Put('configuracion')
  actualizarConfiguracion(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: ActualizarConfiguracionProduccionDto,
  ) {
    return this.service.actualizarConfiguracion(auth, payload);
  }

  // ── Días no laborables (feriados y cierres del taller) ────────────────

  @Get('dias-no-laborables')
  findDiasNoLaborables(@CurrentSession() auth: CurrentAuth) {
    return this.service.findDiasNoLaborables(auth.tenantId);
  }

  @Permiso('produccion.configurar')
  @Post('dias-no-laborables')
  crearDiaNoLaborable(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearDiaNoLaborableDto,
  ) {
    return this.service.crearDiaNoLaborable(auth, payload);
  }

  @Permiso('produccion.configurar')
  @Delete('dias-no-laborables/:id')
  eliminarDiaNoLaborable(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.eliminarDiaNoLaborable(auth, id);
  }

  @Permiso('produccion.configurar')
  @Post('estaciones')
  createEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertEstacionDto,
  ) {
    return this.service.createEstacion(auth, payload);
  }

  @Permiso('produccion.configurar')
  @Put('estaciones/:id')
  updateEstacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertEstacionDto,
  ) {
    return this.service.updateEstacion(auth, id, payload);
  }

  @Permiso('produccion.configurar')
  @Patch('estaciones/:id/toggle')
  toggleEstacion(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.toggleEstacion(auth, id);
  }

  @Permiso('produccion.configurar')
  @Delete('estaciones/:id')
  deleteEstacion(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.deleteEstacion(auth, id);
  }
}
