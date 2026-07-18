import { Controller, Get, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
import { CobranzaService } from './cobranza.service';
import { VentasService } from './ventas.service';
import { ProductoService } from './producto.service';
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
    private readonly cobranza: CobranzaService,
    private readonly ventas: VentasService,
    private readonly productos: ProductoService,
  ) {}

  @Get('resumen')
  async resumen(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const [{ actual, sinComparativa, deltas }, topClientes] = await Promise.all([
      this.rentabilidad.bloque(auth.tenantId, rango, anterior),
      this.ventas.topClientes(auth.tenantId, rango, 5),
    ]);
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
      topClientes,
      // OTD y carga del taller (produccion.service), top productos
      // (producto.service) y alertas (alertas.service) se suman después.
      pendiente: ['otd', 'cargaTaller', 'topProductos', 'alertas'],
    };
  }

  @Get('comercial')
  async comercial(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const comercial = await this.ventas.comercial(auth.tenantId, rango, anterior);
    return {
      meta: this.service.metaBase(rango, anterior, 'Órdenes emitidas', {
        limites: ['Clientes dormidos y nuevos: sobre todo el historial, no el rango.'],
        sinComparativa: comercial.sinComparativa,
      }),
      ...comercial,
    };
  }

  @Get('finanzas')
  async finanzas(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const [{ actual, sinComparativa, deltas }, cobranza] = await Promise.all([
      this.rentabilidad.bloque(auth.tenantId, rango, anterior),
      this.cobranza.finanzas(auth.tenantId, rango),
    ]);
    return {
      meta: this.service.metaBase(rango, anterior, 'Comprobantes y costos', {
        limites: [...this.rentabilidad.limites(actual), ...this.cobranza.limites()],
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
      cobranza,
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
  async producto(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const producto = await this.productos.producto(auth.tenantId, rango);
    return {
      meta: this.service.metaBase(rango, anterior, 'Snapshot de cotización', {
        limites: this.productos.limites(),
      }),
      ...producto,
    };
  }
}
