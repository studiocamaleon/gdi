import { Controller, Get, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
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
  constructor(
    private readonly service: ReportesService,
    private readonly rentabilidad: RentabilidadService,
  ) {}

  @Get('resumen')
  async resumen(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const { actual, sinComparativa, deltas } = await this.rentabilidad.bloque(
      auth.tenantId,
      rango,
      anterior,
    );
    return {
      meta: this.service.metaBase(rango, anterior, 'Órdenes emitidas', {
        limites: this.rentabilidad.limites(actual),
        sinComparativa,
      }),
      rentabilidad: {
        ventas: actual.ventas,
        ventasDeltaPct: deltas.ventasPct,
        margenBruto: actual.margenBruto,
        margenBrutoPct: actual.margenBrutoPct,
        margenBrutoDeltaPts: deltas.margenBrutoPts,
        contribucion: actual.contribucion,
        contribucionPct: actual.contribucionPct,
        contribucionDeltaPts: deltas.contribucionPts,
        puntoEquilibrio: actual.puntoEquilibrio,
        avancePct: actual.avancePct,
      },
      // OTD y carga del taller se suman con produccion.service.
      pendiente: ['otd', 'cargaTaller', 'topClientes', 'topProductos', 'alertas'],
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
  async finanzas(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const { actual, sinComparativa, deltas } = await this.rentabilidad.bloque(
      auth.tenantId,
      rango,
      anterior,
    );
    return {
      meta: this.service.metaBase(rango, anterior, 'Comprobantes y costos', {
        limites: this.rentabilidad.limites(actual),
        sinComparativa,
      }),
      rentabilidad: {
        ventas: actual.ventas,
        ventasDeltaPct: deltas.ventasPct,
        costoTotal: actual.costoTotal,
        margenBruto: actual.margenBruto,
        margenBrutoPct: actual.margenBrutoPct,
        costosVariables: actual.costosVariables,
        contribucion: actual.contribucion,
        contribucionPct: actual.contribucionPct,
        costosFijos: actual.costosFijos,
        puntoEquilibrio: actual.puntoEquilibrio,
        avancePct: actual.avancePct,
        gastoPorCentro: actual.gastoPorCentro,
      },
      // Aging, DSO, costo de cobrar, cheques, deudores, fondos: cobranza.service.
      pendiente: ['aging', 'dso', 'costoCobrar', 'cheques', 'deudores', 'fondos'],
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
