import { Controller, Get, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ReportesService } from './reportes.service';
import { RangoReporteDto } from './dto/rango-reporte.dto';

/**
 * Panel general (Inteligencia de negocio) — un endpoint por TAB. Los
 * cimientos: cada endpoint ya resuelve el rango y devuelve la `meta`
 * honesta; el cuerpo de cada tab se completa cuando aterriza su service
 * de dominio (rentabilidad → cobranza → ventas → producto → producción).
 * Ver docs/reportes-plan-backend.md §7.
 */
@Controller('reportes/panel')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('resumen')
  resumen(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    return {
      meta: this.service.metaBase(rango, anterior, 'Órdenes emitidas', {
        limites: ['Tab en construcción: KPIs se conectan por dominio.'],
      }),
      pendiente: true,
    };
  }

  @Get('comercial')
  comercial(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    return {
      meta: this.service.metaBase(rango, anterior, 'Órdenes emitidas', {
        limites: ['Tab en construcción.'],
      }),
      pendiente: true,
    };
  }

  @Get('finanzas')
  finanzas(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    return {
      meta: this.service.metaBase(rango, anterior, 'Comprobantes y costos', {
        limites: ['Tab en construcción.'],
      }),
      pendiente: true,
    };
  }

  @Get('produccion')
  produccion(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    return {
      meta: this.service.metaBase(rango, anterior, 'Pasos de producción', {
        limites: ['Tab en construcción.'],
      }),
      pendiente: true,
    };
  }

  @Get('producto')
  producto(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    return {
      meta: this.service.metaBase(rango, anterior, 'Snapshot de cotización', {
        limites: ['Tab en construcción.'],
      }),
      pendiente: true,
    };
  }
}
