import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ProduccionService } from './produccion.service';
import { UpsertEstacionDto } from './dto/upsert-estacion.dto';
import { CrearDiaNoLaborableDto } from './dto/crear-dia-no-laborable.dto';
import { ActualizarConfiguracionProduccionDto } from './dto/actualizar-configuracion-produccion.dto';

@Controller('produccion')
export class ProduccionController {
  constructor(private readonly service: ProduccionService) {}

  @Get('estaciones')
  findEstaciones(@CurrentSession() auth: CurrentAuth) {
    return this.service.findEstaciones(auth);
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
    return this.service.findDuracionesFamilias(auth);
  }

  /** Cola real del simulador de impresión (por área, en frontera). */
  @Get('simulador')
  simulador(@CurrentSession() auth: CurrentAuth) {
    return this.service.simulador(auth);
  }

  // ── Configuración de producción (margen de la ETA sugerida) ───────────

  @Get('configuracion')
  getConfiguracion(@CurrentSession() auth: CurrentAuth) {
    return this.service.getConfiguracion(auth);
  }

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
    return this.service.findDiasNoLaborables(auth);
  }

  @Post('dias-no-laborables')
  crearDiaNoLaborable(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CrearDiaNoLaborableDto,
  ) {
    return this.service.crearDiaNoLaborable(auth, payload);
  }

  @Delete('dias-no-laborables/:id')
  eliminarDiaNoLaborable(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.eliminarDiaNoLaborable(auth, id);
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
  toggleEstacion(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.toggleEstacion(auth, id);
  }

  @Delete('estaciones/:id')
  deleteEstacion(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.deleteEstacion(auth, id);
  }
}
