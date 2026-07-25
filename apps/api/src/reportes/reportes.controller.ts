import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ReportesService } from './reportes.service';
import { RentabilidadService } from './rentabilidad.service';
import { CobranzaService } from './cobranza.service';
import { VentasService } from './ventas.service';
import { ProductoService } from './producto.service';
import { ReporteProduccionService } from './produccion.service';
import { AlertasService } from './alertas.service';
import { ClientesService } from './clientes.service';
import { EquipoService } from './equipo.service';
import { EmbudoService } from './embudo.service';
import { RangoReporteDto } from './dto/rango-reporte.dto';
import { MixCategoriaDto } from './dto/mix-categoria.dto';
import { ActualizarUmbralesDto } from './dto/actualizar-umbrales.dto';
import { Permiso } from '../auth/permiso.decorator';

/**
 * Panel general (Inteligencia de negocio) — un endpoint por TAB. Los
 * cimientos: cada endpoint ya resuelve el rango y devuelve la `meta`
 * honesta; el cuerpo de cada tab se completa cuando aterriza su service
 * de dominio (rentabilidad → cobranza → ventas → producto → producción).
 * Ver docs/reportes-plan-backend.md §7.
 */
@Permiso('panel.ver')
@Controller('reportes/panel')
export class ReportesController {
  constructor(
    private readonly service: ReportesService,
    private readonly rentabilidad: RentabilidadService,
    private readonly cobranza: CobranzaService,
    private readonly ventas: VentasService,
    private readonly productos: ProductoService,
    private readonly produccionSvc: ReporteProduccionService,
    private readonly alertas: AlertasService,
    private readonly clientesSvc: ClientesService,
    private readonly equipoSvc: EquipoService,
    private readonly embudoSvc: EmbudoService,
  ) {}

  @Get('resumen')
  async resumen(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const [{ actual, sinComparativa, deltas }, topClientes, topProductos, prodKpis, alertas, serie] =
      await Promise.all([
        this.rentabilidad.bloque(auth.tenantId, rango, anterior),
        this.ventas.topClientes(auth.tenantId, rango, 5),
        this.productos.topProductos(auth.tenantId, rango, 5),
        this.produccionSvc.resumenKpis(auth.tenantId, rango),
        this.alertas.activas(auth.tenantId, rango),
        this.ventas.serie(auth.tenantId, rango),
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
        costoTotal: actual.costoTotal,
        contribucion: actual.contribucion,
        contribucionPct: actual.contribucionPct,
        contribucionDeltaPts: deltas.contribucionPts,
        costosFijos: actual.costosFijos,
        puntoEquilibrio: actual.puntoEquilibrio,
        avancePct: actual.avancePct,
      },
      produccion: prodKpis,
      serie,
      topClientes,
      topProductos,
      alertas: alertas.slice(0, 5),
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

  @Get('embudo')
  async embudo(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const { otManualesFuera, ...embudo } = await this.embudoSvc.embudo(
      auth.tenantId,
      rango,
      anterior,
    );
    return {
      meta: this.service.metaBase(rango, anterior, 'Presupuestos emitidos (cohorte)', {
        limites: this.embudoSvc.limites(otManualesFuera),
        sinComparativa: embudo.sinComparativa,
      }),
      ...embudo,
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
        gastoPorCategoria: actual.gastoPorCategoria,
      },
      cobranza,
    };
  }

  @Get('produccion')
  async produccion(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const prod = await this.produccionSvc.produccion(auth.tenantId, rango);
    return {
      meta: this.service.metaBase(rango, anterior, 'Pasos de producción', {
        limites: this.produccionSvc.limites(prod),
      }),
      ...prod,
    };
  }

  @Get('alertas')
  async alertasActivas(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const activas = await this.alertas.activas(auth.tenantId, rango);
    return {
      meta: this.service.metaBase(rango, anterior, 'Reglas sobre los agregados del período'),
      activas,
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

  @Get('producto/mix-categoria')
  async mixCategoria(@CurrentSession() auth: CurrentAuth, @Query() query: MixCategoriaDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const drill = await this.productos.mixCategoria(auth.tenantId, rango, query.categoria);
    return {
      meta: this.service.metaBase(rango, anterior, 'Snapshot de cotización'),
      ...drill,
    };
  }

  @Get('clientes')
  async clientes(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const clientes = await this.clientesSvc.clientes(auth.tenantId, rango, anterior);
    return {
      meta: this.service.metaBase(rango, anterior, 'Órdenes emitidas (historial completo)', {
        limites: this.clientesSvc.limites(clientes.rfm.diasActivo),
        sinComparativa: clientes.sinComparativa,
      }),
      ...clientes,
    };
  }

  @Get('equipo')
  async equipo(@CurrentSession() auth: CurrentAuth, @Query() query: RangoReporteDto) {
    const { rango, anterior } = this.service.resolverRango(query);
    const equipo = await this.equipoSvc.equipo(auth.tenantId, rango);
    return {
      meta: this.service.metaBase(rango, anterior, 'Tramos de trabajo y pasos completados', {
        limites: this.equipoSvc.limites(),
      }),
      ...equipo,
    };
  }

  /**
   * "Mi desempeño": SIEMPRE scoped al usuario logueado (auth.userId) —
   * la vista del propio operario, ventana fija de 8 semanas.
   */
  @Get('mi-desempeno')
  async miDesempeno(@CurrentSession() auth: CurrentAuth) {
    const datos = await this.equipoSvc.miDesempeno(auth.tenantId, auth.userId);
    return {
      limites: this.equipoSvc.limitesMiDesempeno(),
      ...datos,
    };
  }

  @Get('umbrales')
  getUmbrales(@CurrentSession() auth: CurrentAuth) {
    return this.alertas.getUmbrales(auth.tenantId);
  }

  @Put('umbrales')
  actualizarUmbrales(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: ActualizarUmbralesDto,
  ) {
    return this.alertas.actualizarUmbrales(auth.tenantId, payload);
  }
}
