import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Inteligencia de NEGOCIO del ecosistema (tab "Negocio" del control plane).
 *
 * No es reconciliación financiera de cada tenant (eso vive en el Panel de cada
 * uno): es inteligencia de PRODUCTO para el equipo de Grafo — cuánto negocio
 * mueven juntas las imprentas sobre la plataforma, qué se vende y qué features
 * se adoptan, para decidir dónde invertir desarrollo.
 *
 * Corre SIN contexto de tenant (@SinTenant en el controller): los $queryRaw y
 * groupBy ven TODOS los tenants. Service propio, no reusa los de `reportes/`.
 *
 * Medida canónica de venta, idéntica a la del Panel del tenant:
 *   VENDIDO = SUM(OrdenTrabajoItem.subtotal) de OT con estado <> 'borrador',
 *   fechada por OrdenTrabajo.fechaEmision. Neto, sin IVA. No es la Cotización
 *   ni el Comprobante fiscal (esas son capas aparte: facturado y cobrado).
 * Ver docs/control-plane-negocio-diseno.md
 */

const DIA_MS = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type PeriodoClave = '30d' | '90d' | '12m';

type Ventana = {
  clave: PeriodoClave;
  etiqueta: string;
  desde: Date;
  hasta: Date;
  /** Inicio del período anterior de igual largo (para los deltas). */
  desdePrev: Date;
  /** Unidad de bucket de la serie temporal. */
  trunc: 'day' | 'week' | 'month';
};

export type NegocioPlataforma = {
  periodo: {
    clave: PeriodoClave;
    etiqueta: string;
    desde: string;
    hasta: string;
  };
  kpis: {
    ventas: number;
    ventasPrev: number;
    ordenes: number;
    ordenesPrev: number;
    ticketPromedio: number;
    facturado: number;
    facturadoPrev: number;
    cobrado: number;
    cobradoPrev: number;
    presupuestos: number;
  };
  serie: Array<{ periodo: string; ventas: number; facturado: number }>;
  porCategoria: Array<{
    categoria: string;
    ventas: number;
    ordenes: number;
    pct: number;
  }>;
  porTenant: Array<{
    tenantId: string;
    nombre: string;
    slug: string;
    ventas: number;
    ordenes: number;
    ticket: number;
    pct: number;
  }>;
  adopcion: {
    totalTenants: number;
    conVentas: number;
    conPresupuestos: number;
    conFacturacion: number;
  };
  // ── F2 ──────────────────────────────────────────────────────────────
  /** Mix por tecnología (láser/UV/DTF/eco…). Vive en el jobContext del ítem
   *  cotizado; los ítems sin cotización caen en "Sin especificar". */
  porTecnologia: Array<{ tecnologia: string; ventas: number; pct: number }>;
  /** Estándar vs a medida — sólo sobre ítems cotizados (con jobContext). */
  medidas: {
    estandar: number;
    personalizada: number;
    sinDato: number;
    pctEstandar: number | null;
  };
  /** Attach rate de adicionales/acabados opcionales. */
  adicionales: {
    itemsTotales: number;
    itemsCon: number;
    pctCon: number;
    top: Array<{ etiqueta: string; items: number; pctItems: number }>;
  };
  /** Embudo comercial agregado: benchmark de conversión y fugas del ecosistema. */
  embudo: {
    emitidas: number;
    aprobadas: number;
    produccion: number;
    entregadas: number;
    emitidasMonto: number;
    aprobadasMonto: number;
    tasaAprobacion: number | null;
    tasaEntrega: number | null;
    fugas: Array<{ motivo: string; cantidad: number }>;
  };
  // ── F3 ──────────────────────────────────────────────────────────────
  /** Lecturas accionables en lenguaje de producto (el "¿y entonces qué?"). */
  insights: Insight[];
  /** Histograma: cuántas imprentas caen en cada tramo de GMV. */
  distribucionTamano: Array<{ rango: string; tenants: number }>;
  /** Referencia del ecosistema: ticket mediano (para comparar imprentas). */
  medianaTicket: number;
};

export type Insight = {
  clave: string;
  severidad: 'riesgo' | 'oportunidad' | 'positivo' | 'info';
  titulo: string;
  detalle: string;
};

/** Etiquetas legibles para armar las frases de los insights (backend). */
const TEC_LABEL: Record<string, string> = {
  dtf_textil: 'DTF textil',
  dtf_uv: 'DTF UV',
  uv: 'UV',
  offset: 'offset',
  laser: 'láser',
  inkjet: 'inkjet',
  eco: 'ecosolvente',
  ecosolvente: 'ecosolvente',
  solvente: 'solvente',
  sublimacion: 'sublimación',
};
const FUGA_LABEL: Record<string, string> = {
  precio: 'precio',
  plazo: 'plazo',
  sin_respuesta: 'sin respuesta',
  competencia: 'competencia',
  otro: 'otro',
  vencido: 'vencidas',
};

@Injectable()
export class NegocioService {
  constructor(private readonly prisma: PrismaService) {}

  private ventana(clave: PeriodoClave): Ventana {
    const hasta = new Date();
    const dias = clave === '30d' ? 30 : clave === '90d' ? 90 : 365;
    const desde = new Date(hasta.getTime() - dias * DIA_MS);
    const desdePrev = new Date(hasta.getTime() - 2 * dias * DIA_MS);
    const etiqueta =
      clave === '30d'
        ? 'Últimos 30 días'
        : clave === '90d'
          ? 'Últimos 90 días'
          : 'Últimos 12 meses';
    const trunc = clave === '30d' ? 'day' : clave === '90d' ? 'week' : 'month';
    return { clave, etiqueta, desde, hasta, desdePrev, trunc };
  }

  async negocio(claveInput?: string): Promise<NegocioPlataforma> {
    const clave: PeriodoClave =
      claveInput === '90d' || claveInput === '12m'
        ? claveInput
        : claveInput === '30d'
          ? '30d'
          : '30d';
    const v = this.ventana(clave);

    const [
      kpisVentas,
      kpisFacturado,
      kpisCobrado,
      presupuestos,
      serieVentas,
      serieFacturado,
      porCategoria,
      porTenant,
      adopcion,
      porTecnologia,
      medidas,
      adicionales,
      embudo,
    ] = await Promise.all([
      this.kpisVentas(v),
      this.kpisFacturado(v),
      this.kpisCobrado(v),
      this.presupuestos(v),
      this.serieVentas(v),
      this.serieFacturado(v),
      this.porCategoria(v),
      this.porTenant(v),
      this.adopcion(v),
      this.porTecnologia(v),
      this.medidas(v),
      this.adicionales(v),
      this.embudo(v),
    ]);

    const serie = this.zipSerie(serieVentas, serieFacturado);
    const totalCat = porCategoria.reduce((a, c) => a + c.ventas, 0);
    const totalTen = porTenant.reduce((a, t) => a + t.ventas, 0);

    const kpis = {
      ventas: r2(kpisVentas.ventas),
      ventasPrev: r2(kpisVentas.ventasPrev),
      ordenes: kpisVentas.ordenes,
      ordenesPrev: kpisVentas.ordenesPrev,
      ticketPromedio:
        kpisVentas.ordenes > 0 ? r2(kpisVentas.ventas / kpisVentas.ordenes) : 0,
      facturado: r2(kpisFacturado.facturado),
      facturadoPrev: r2(kpisFacturado.facturadoPrev),
      cobrado: r2(kpisCobrado.cobrado),
      cobradoPrev: r2(kpisCobrado.cobradoPrev),
      presupuestos,
    };
    const catConPct = porCategoria.map((c) => ({
      ...c,
      ventas: r2(c.ventas),
      pct: totalCat > 0 ? r2((c.ventas / totalCat) * 100) : 0,
    }));
    const tenConPct = porTenant.map((t) => ({
      ...t,
      ventas: r2(t.ventas),
      ticket: t.ordenes > 0 ? r2(t.ventas / t.ordenes) : 0,
      pct: totalTen > 0 ? r2((t.ventas / totalTen) * 100) : 0,
    }));

    // F3: la inteligencia se deriva de lo ya agregado (sin más queries).
    const insights = this.construirInsights({
      kpis,
      porCategoria: catConPct,
      porTecnologia,
      medidas,
      adicionales,
      embudo,
      adopcion,
      porTenant: tenConPct,
    });

    return {
      periodo: {
        clave: v.clave,
        etiqueta: v.etiqueta,
        desde: v.desde.toISOString(),
        hasta: v.hasta.toISOString(),
      },
      kpis,
      serie,
      porCategoria: catConPct,
      porTenant: tenConPct,
      adopcion,
      porTecnologia,
      medidas,
      adicionales,
      embudo,
      insights,
      distribucionTamano: this.distribucionTamano(tenConPct),
      medianaTicket: this.mediana(
        tenConPct.map((t) => t.ticket).filter((n) => n > 0),
      ),
    };
  }

  /** Buckets de GMV por imprenta (histograma de tamaño del ecosistema). */
  private distribucionTamano(
    tenants: Array<{ ventas: number }>,
  ): Array<{ rango: string; tenants: number }> {
    const buckets = [
      { rango: '< $100k', max: 100_000 },
      { rango: '$100k–500k', max: 500_000 },
      { rango: '$500k–1M', max: 1_000_000 },
      { rango: '$1M–5M', max: 5_000_000 },
      { rango: '≥ $5M', max: Infinity },
    ];
    const out = buckets.map((b) => ({ rango: b.rango, tenants: 0 }));
    for (const t of tenants) {
      const i = buckets.findIndex((b) => t.ventas < b.max);
      if (i >= 0) out[i].tenants += 1;
    }
    return out;
  }

  private mediana(valores: number[]): number {
    if (valores.length === 0) return 0;
    const orden = [...valores].sort((a, b) => a - b);
    const mid = Math.floor(orden.length / 2);
    return orden.length % 2
      ? r2(orden[mid])
      : r2((orden[mid - 1] + orden[mid]) / 2);
  }

  /**
   * El motor de insights: reglas sobre lo ya agregado que producen lecturas
   * accionables PARA EL EQUIPO DE GRAFO (decisiones de producto, no del tenant).
   * Ordenadas por severidad y acotadas. Ver docs/control-plane-negocio-diseno.md
   */
  private construirInsights(d: {
    kpis: NegocioPlataforma['kpis'];
    porCategoria: NegocioPlataforma['porCategoria'];
    porTecnologia: NegocioPlataforma['porTecnologia'];
    medidas: NegocioPlataforma['medidas'];
    adicionales: NegocioPlataforma['adicionales'];
    embudo: NegocioPlataforma['embudo'];
    adopcion: NegocioPlataforma['adopcion'];
    porTenant: NegocioPlataforma['porTenant'];
  }): Insight[] {
    const out: Insight[] = [];
    const {
      kpis,
      porCategoria,
      porTecnologia,
      medidas,
      adicionales,
      embudo,
      adopcion,
      porTenant,
    } = d;

    // Crecimiento del GMV vs período anterior.
    if (kpis.ventasPrev > 0) {
      const delta = ((kpis.ventas - kpis.ventasPrev) / kpis.ventasPrev) * 100;
      if (delta <= -15) {
        out.push({
          clave: 'gmv_baja',
          severidad: 'riesgo',
          titulo: `El GMV del ecosistema cayó ${Math.round(Math.abs(delta))}%`,
          detalle:
            'Bajó respecto al período anterior. Vale identificar qué imprentas se enfriaron.',
        });
      } else if (delta >= 15) {
        out.push({
          clave: 'gmv_sube',
          severidad: 'positivo',
          titulo: `El GMV del ecosistema creció ${Math.round(delta)}%`,
          detalle:
            'El negocio que corre sobre la plataforma está en expansión: buen momento para invertir en capacidad.',
        });
      }
    }

    // Categoría dominante → dónde rinde invertir tooling.
    const cat0 = porCategoria.find((c) => c.categoria !== 'Sin categoría');
    if (cat0 && cat0.pct >= 35) {
      out.push({
        clave: 'cat_dom',
        severidad: 'oportunidad',
        titulo: `${cat0.pct}% del GMV es ${cat0.categoria}`,
        detalle: `Es la categoría dominante del ecosistema. Invertir en herramientas de esa vertical es lo que más mueve la aguja.`,
      });
    }

    // Tecnología dominante.
    const tec0 = porTecnologia.find(
      (t) => t.tecnologia !== 'Sin especificar' && t.tecnologia !== 'Otras',
    );
    if (tec0 && tec0.pct >= 30) {
      const nombre = TEC_LABEL[tec0.tecnologia] ?? tec0.tecnologia;
      out.push({
        clave: 'tec_dom',
        severidad: 'oportunidad',
        titulo: `${tec0.pct}% del GMV se produce en ${nombre}`,
        detalle: `Concentra la producción del ecosistema. Priorizar features de ${nombre} (simuladores, presets, nesting) rinde para casi todos.`,
      });
    }

    // Adopción de facturación electrónica.
    if (adopcion.totalTenants > 0) {
      const pct = (adopcion.conFacturacion / adopcion.totalTenants) * 100;
      if (pct < 60) {
        out.push({
          clave: 'adopcion_fact',
          severidad: 'oportunidad',
          titulo: `Solo ${Math.round(pct)}% de las imprentas factura electrónicamente`,
          detalle:
            'Mejorar el onboarding de facturación (AFIP) subiría la adopción y el valor percibido de la plataforma.',
        });
      }
    }

    // Activación: imprentas sin ventas.
    if (
      adopcion.totalTenants > 1 &&
      adopcion.conVentas < adopcion.totalTenants
    ) {
      const inactivas = adopcion.totalTenants - adopcion.conVentas;
      out.push({
        clave: 'activacion',
        severidad: 'riesgo',
        titulo: `${inactivas} de ${adopcion.totalTenants} imprentas no vendieron en el período`,
        detalle:
          'Señal de activación/retención floja. Conviene mirar el onboarding y el uso real de esas cuentas.',
      });
    }

    // Attach rate de adicionales.
    if (adicionales.itemsTotales >= 10 && adicionales.pctCon < 30) {
      out.push({
        clave: 'attach_bajo',
        severidad: 'oportunidad',
        titulo: `Attach rate de adicionales en ${adicionales.pctCon}%`,
        detalle:
          'Pocos ítems llevan acabados opcionales. Un sugeridor de adicionales podría subir el ticket del ecosistema.',
      });
    }

    // Embudo: conversión del ecosistema.
    if (embudo.tasaAprobacion != null && embudo.emitidas >= 5) {
      if (embudo.tasaAprobacion < 50) {
        out.push({
          clave: 'conv_baja',
          severidad: 'riesgo',
          titulo: `El ecosistema aprueba solo ${embudo.tasaAprobacion}% de los presupuestos`,
          detalle:
            'Conversión baja. Herramientas de seguimiento/recordatorio de presupuestos podrían recuperar ventas.',
        });
      } else if (embudo.tasaAprobacion >= 80) {
        out.push({
          clave: 'conv_alta',
          severidad: 'positivo',
          titulo: `Los presupuestos convierten al ${embudo.tasaAprobacion}%`,
          detalle: 'El pipeline comercial del ecosistema está sano.',
        });
      }
    }

    // Fuga dominante del embudo.
    const totalFugas = embudo.fugas.reduce((a, f) => a + f.cantidad, 0);
    if (totalFugas >= 3 && embudo.fugas[0].cantidad / totalFugas >= 0.4) {
      const motivo =
        FUGA_LABEL[embudo.fugas[0].motivo] ?? embudo.fugas[0].motivo;
      out.push({
        clave: 'fuga',
        severidad: 'info',
        titulo: `La principal causa de pérdida de presupuestos es "${motivo}"`,
        detalle:
          'Concentra la mayoría de las fugas del ecosistema: puede marcar dónde falla el pipeline comercial.',
      });
    }

    // Trabajo a medida.
    if (medidas.pctEstandar != null && medidas.pctEstandar < 50) {
      out.push({
        clave: 'a_medida',
        severidad: 'info',
        titulo: `${100 - Math.round(medidas.pctEstandar)}% de los ítems son a medida`,
        detalle:
          'El configurador y la herramienta de medidas son piezas críticas: buena parte del trabajo no es estándar.',
      });
    }

    // Concentración del GMV en una imprenta.
    if (porTenant.length >= 2 && porTenant[0].pct >= 50) {
      out.push({
        clave: 'concentracion',
        severidad: 'riesgo',
        titulo: `${porTenant[0].pct}% del GMV lo genera una sola imprenta`,
        detalle: `${porTenant[0].nombre} concentra el negocio del ecosistema. Diversificar la base reduce el riesgo de la plataforma.`,
      });
    }

    const rank = { riesgo: 0, oportunidad: 1, positivo: 2, info: 3 };
    return out
      .sort((a, b) => rank[a.severidad] - rank[b.severidad])
      .slice(0, 6);
  }

  /** Ventas y órdenes del período y del período anterior (un solo scan). */
  private async kpisVentas(v: Ventana) {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        ventas: number;
        ventasprev: number;
        ordenes: bigint;
        ordenesprev: bigint;
      }>
    >`
      SELECT
        COALESCE(SUM(oti.subtotal) FILTER (WHERE ot."fechaEmision" >= ${v.desde}), 0)::float8 AS ventas,
        COALESCE(SUM(oti.subtotal) FILTER (WHERE ot."fechaEmision" >= ${v.desdePrev} AND ot."fechaEmision" < ${v.desde}), 0)::float8 AS ventasprev,
        COUNT(DISTINCT ot.id) FILTER (WHERE ot."fechaEmision" >= ${v.desde}) AS ordenes,
        COUNT(DISTINCT ot.id) FILTER (WHERE ot."fechaEmision" >= ${v.desdePrev} AND ot."fechaEmision" < ${v.desde}) AS ordenesprev
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desdePrev} AND ot."fechaEmision" < ${v.hasta}
    `;
    return {
      ventas: row?.ventas ?? 0,
      ventasPrev: row?.ventasprev ?? 0,
      ordenes: Number(row?.ordenes ?? 0),
      ordenesPrev: Number(row?.ordenesprev ?? 0),
    };
  }

  /**
   * Facturación fiscal NETA: comprobantes emitidos, con las notas de crédito
   * restando (no anuladas). Por `Comprobante.fecha`.
   */
  private async kpisFacturado(v: Ventana) {
    const [row] = await this.prisma.$queryRaw<
      Array<{ facturado: number; facturadoprev: number }>
    >`
      SELECT
        COALESCE(SUM(CASE WHEN c.tipo = 'nota_credito' THEN -c.total ELSE c.total END)
                 FILTER (WHERE c.fecha >= ${v.desde}), 0)::float8 AS facturado,
        COALESCE(SUM(CASE WHEN c.tipo = 'nota_credito' THEN -c.total ELSE c.total END)
                 FILTER (WHERE c.fecha >= ${v.desdePrev} AND c.fecha < ${v.desde}), 0)::float8 AS facturadoprev
      FROM "Comprobante" c
      WHERE c.estado = 'emitido' AND c."anuladoEl" IS NULL
        AND c.fecha >= ${v.desdePrev} AND c.fecha < ${v.hasta}
    `;
    return {
      facturado: row?.facturado ?? 0,
      facturadoPrev: row?.facturadoprev ?? 0,
    };
  }

  /** Caja del ecosistema: cobros no anulados, por `Cobro.fecha`. */
  private async kpisCobrado(v: Ventana) {
    const [row] = await this.prisma.$queryRaw<
      Array<{ cobrado: number; cobradoprev: number }>
    >`
      SELECT
        COALESCE(SUM(cb."montoBruto") FILTER (WHERE cb.fecha >= ${v.desde}), 0)::float8 AS cobrado,
        COALESCE(SUM(cb."montoBruto") FILTER (WHERE cb.fecha >= ${v.desdePrev} AND cb.fecha < ${v.desde}), 0)::float8 AS cobradoprev
      FROM "Cobro" cb
      WHERE cb."anuladoEl" IS NULL
        AND cb.fecha >= ${v.desdePrev} AND cb.fecha < ${v.hasta}
    `;
    return { cobrado: row?.cobrado ?? 0, cobradoPrev: row?.cobradoprev ?? 0 };
  }

  /** Presupuestos formales enviados en el período (cohorte del embudo). */
  private async presupuestos(v: Ventana): Promise<number> {
    return this.prisma.cotizacion.count({
      where: {
        numero: { not: null },
        fechaEnvio: { gte: v.desde, lt: v.hasta },
      },
    });
  }

  private async serieVentas(v: Ventana) {
    const trunc = Prisma.raw(`'${v.trunc}'`);
    return this.prisma.$queryRaw<Array<{ periodo: string; monto: number }>>`
      SELECT to_char(date_trunc(${trunc}, ot."fechaEmision"), 'YYYY-MM-DD') AS periodo,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      GROUP BY 1 ORDER BY 1
    `;
  }

  private async serieFacturado(v: Ventana) {
    const trunc = Prisma.raw(`'${v.trunc}'`);
    return this.prisma.$queryRaw<Array<{ periodo: string; monto: number }>>`
      SELECT to_char(date_trunc(${trunc}, c.fecha), 'YYYY-MM-DD') AS periodo,
             COALESCE(SUM(CASE WHEN c.tipo = 'nota_credito' THEN -c.total ELSE c.total END), 0)::float8 AS monto
      FROM "Comprobante" c
      WHERE c.estado = 'emitido' AND c."anuladoEl" IS NULL
        AND c.fecha >= ${v.desde} AND c.fecha < ${v.hasta}
      GROUP BY 1 ORDER BY 1
    `;
  }

  private zipSerie(
    ventas: Array<{ periodo: string; monto: number }>,
    facturado: Array<{ periodo: string; monto: number }>,
  ): Array<{ periodo: string; ventas: number; facturado: number }> {
    const fMap = new Map(facturado.map((f) => [f.periodo, f.monto]));
    const claves = new Set<string>([
      ...ventas.map((s) => s.periodo),
      ...facturado.map((s) => s.periodo),
    ]);
    const vMap = new Map(ventas.map((s) => [s.periodo, s.monto]));
    return [...claves].sort().map((periodo) => ({
      periodo,
      ventas: r2(vMap.get(periodo) ?? 0),
      facturado: r2(fMap.get(periodo) ?? 0),
    }));
  }

  /** Mix de ventas por categoría comercial (denormalizada en el item). */
  private async porCategoria(v: Ventana) {
    const rows = await this.prisma.$queryRaw<
      Array<{ categoria: string; ventas: number; ordenes: bigint }>
    >`
      SELECT COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría') AS categoria,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
             COUNT(DISTINCT ot.id) AS ordenes
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      GROUP BY 1 ORDER BY 2 DESC
    `;
    return rows.map((c) => ({
      categoria: c.categoria,
      ventas: c.ventas,
      ordenes: Number(c.ordenes),
      pct: 0,
    }));
  }

  /** Ranking de imprentas por ventas del período. */
  private async porTenant(v: Ventana) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        tenantid: string;
        nombre: string;
        slug: string;
        ventas: number;
        ordenes: bigint;
      }>
    >`
      SELECT t.id AS tenantid, t.nombre, t.slug,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
             COUNT(DISTINCT ot.id) AS ordenes
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      JOIN "Tenant" t ON t.id = ot."tenantId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      GROUP BY t.id, t.nombre, t.slug
      ORDER BY ventas DESC
    `;
    return rows.map((t) => ({
      tenantId: t.tenantid,
      nombre: t.nombre,
      slug: t.slug,
      ventas: t.ventas,
      ordenes: Number(t.ordenes),
      ticket: 0,
      pct: 0,
    }));
  }

  /** Cuántos tenants usan cada capa del negocio (señal de adopción). */
  private async adopcion(v: Ventana) {
    const [totalTenants, conVentas, conPresupuestos, conFacturacion] =
      await Promise.all([
        this.prisma.tenant.count({ where: { activo: true } }),
        this.prisma.ordenTrabajo
          .findMany({
            where: {
              estado: { not: 'borrador' },
              fechaEmision: { gte: v.desde, lt: v.hasta },
            },
            distinct: ['tenantId'],
            select: { tenantId: true },
          })
          .then((r) => r.length),
        this.prisma.cotizacion
          .findMany({
            where: {
              numero: { not: null },
              fechaEnvio: { gte: v.desde, lt: v.hasta },
            },
            distinct: ['tenantId'],
            select: { tenantId: true },
          })
          .then((r) => r.length),
        this.prisma.comprobante
          .findMany({
            where: {
              estado: 'emitido',
              anuladoEl: null,
              fecha: { gte: v.desde, lt: v.hasta },
            },
            distinct: ['tenantId'],
            select: { tenantId: true },
          })
          .then((r) => r.length),
      ]);
    return { totalTenants, conVentas, conPresupuestos, conFacturacion };
  }

  /**
   * Mix por tecnología (láser/UV/DTF/eco…). Vive en el jobContext del ítem
   * cotizado; ítems sin cotización caen en "Sin especificar". Top 6 + resto.
   */
  private async porTecnologia(v: Ventana) {
    const rows = await this.prisma.$queryRaw<
      Array<{ tecnologia: string; ventas: number }>
    >`
      SELECT COALESCE(ci."jobContextJson"->>'tecnologia', 'Sin especificar') AS tecnologia,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      GROUP BY 1 ORDER BY ventas DESC
    `;
    const total = rows.reduce((a, r) => a + r.ventas, 0);
    const top = rows.slice(0, 6);
    const resto = rows.slice(6).reduce((a, r) => a + r.ventas, 0);
    const salida = top.map((r) => ({
      tecnologia: r.tecnologia,
      ventas: r2(r.ventas),
      pct: total > 0 ? r2((r.ventas / total) * 100) : 0,
    }));
    if (resto > 0) {
      salida.push({
        tecnologia: 'Otras',
        ventas: r2(resto),
        pct: total > 0 ? r2((resto / total) * 100) : 0,
      });
    }
    return salida;
  }

  /** Estándar vs a medida — sobre ítems cotizados (con jobContext). */
  private async medidas(v: Ventana) {
    const rows = await this.prisma.$queryRaw<
      Array<{ modo: string | null; items: bigint }>
    >`
      SELECT ci."jobContextJson"->>'medidaModo' AS modo, COUNT(*) AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      WHERE ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      GROUP BY 1
    `;
    let estandar = 0;
    let personalizada = 0;
    let sinDato = 0;
    for (const r of rows) {
      const n = Number(r.items);
      if (r.modo === 'predefinida') estandar += n;
      else if (r.modo === 'personalizada') personalizada += n;
      else sinDato += n;
    }
    const conDato = estandar + personalizada;
    return {
      estandar,
      personalizada,
      sinDato,
      pctEstandar: conDato > 0 ? r2((estandar / conDato) * 100) : null,
    };
  }

  /** Attach rate de adicionales/acabados opcionales, y el top de etiquetas. */
  private async adicionales(v: Ventana) {
    const [resumen, top] = await Promise.all([
      this.prisma.$queryRaw<Array<{ items: bigint; con: bigint }>>`
        SELECT COUNT(*) AS items,
               COUNT(*) FILTER (
                 WHERE jsonb_typeof(oti."adicionalesJson") = 'array'
                   AND jsonb_array_length(oti."adicionalesJson") > 0
               ) AS con
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        WHERE ot.estado <> 'borrador'
          AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
      `,
      this.prisma.$queryRaw<Array<{ etiqueta: string; items: bigint }>>`
        SELECT et.etiqueta, COUNT(*) AS items
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        CROSS JOIN LATERAL jsonb_array_elements_text(oti."adicionalesJson") et(etiqueta)
        WHERE ot.estado <> 'borrador'
          AND jsonb_typeof(oti."adicionalesJson") = 'array'
          AND ot."fechaEmision" >= ${v.desde} AND ot."fechaEmision" < ${v.hasta}
        GROUP BY 1 ORDER BY items DESC LIMIT 8
      `,
    ]);
    const itemsTotales = Number(resumen[0]?.items ?? 0);
    const itemsCon = Number(resumen[0]?.con ?? 0);
    return {
      itemsTotales,
      itemsCon,
      pctCon: itemsTotales > 0 ? r2((itemsCon / itemsTotales) * 100) : 0,
      top: top.map((a) => ({
        etiqueta: a.etiqueta,
        items: Number(a.items),
        pctItems:
          itemsTotales > 0 ? r2((Number(a.items) / itemsTotales) * 100) : 0,
      })),
    };
  }

  /**
   * Embudo comercial AGREGADO: benchmark de conversión del ecosistema sobre la
   * cohorte de presupuestos formales enviados en el período. Produccion y
   * entregadas salen de la OT convertida; fugas por motivo de pérdida.
   * Ver docs/embudo-comercial-panel-diseno.md
   */
  private async embudo(v: Ventana) {
    const [cohorte, avance, fugasRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          emitidas: bigint;
          emitidasmonto: number;
          aprobadas: bigint;
          aprobadasmonto: number;
        }>
      >`
        SELECT COUNT(*) AS emitidas,
               COALESCE(SUM(subtotal), 0)::float8 AS emitidasmonto,
               COUNT(*) FILTER (WHERE estado IN ('aprobado', 'convertido')) AS aprobadas,
               COALESCE(SUM(subtotal) FILTER (WHERE estado IN ('aprobado', 'convertido')), 0)::float8 AS aprobadasmonto
        FROM "Cotizacion"
        WHERE numero IS NOT NULL
          AND "fechaEnvio" >= ${v.desde} AND "fechaEnvio" < ${v.hasta}
      `,
      this.prisma.$queryRaw<Array<{ produccion: bigint; entregadas: bigint }>>`
        SELECT COUNT(*) FILTER (WHERE ot.estado IN ('produccion', 'finalizada', 'entregada')) AS produccion,
               COUNT(*) FILTER (WHERE ot.estado = 'entregada') AS entregadas
        FROM "Cotizacion" cz
        JOIN "OrdenTrabajo" ot ON ot.id = cz."convertidaOrdenId"
        WHERE cz.numero IS NOT NULL
          AND cz."fechaEnvio" >= ${v.desde} AND cz."fechaEnvio" < ${v.hasta}
      `,
      this.prisma.$queryRaw<Array<{ motivo: string; cantidad: bigint }>>`
        SELECT CASE WHEN estado = 'vencido' THEN 'vencido'
                    ELSE COALESCE(NULLIF("motivoPerdida", ''), 'otro') END AS motivo,
               COUNT(*) AS cantidad
        FROM "Cotizacion"
        WHERE numero IS NOT NULL
          AND estado IN ('rechazado', 'vencido')
          AND "fechaEnvio" >= ${v.desde} AND "fechaEnvio" < ${v.hasta}
        GROUP BY 1 ORDER BY cantidad DESC
      `,
    ]);
    const emitidas = Number(cohorte[0]?.emitidas ?? 0);
    const aprobadas = Number(cohorte[0]?.aprobadas ?? 0);
    const produccion = Number(avance[0]?.produccion ?? 0);
    const entregadas = Number(avance[0]?.entregadas ?? 0);
    return {
      emitidas,
      aprobadas,
      produccion,
      entregadas,
      emitidasMonto: r2(cohorte[0]?.emitidasmonto ?? 0),
      aprobadasMonto: r2(cohorte[0]?.aprobadasmonto ?? 0),
      tasaAprobacion: emitidas > 0 ? r2((aprobadas / emitidas) * 100) : null,
      tasaEntrega: emitidas > 0 ? r2((entregadas / emitidas) * 100) : null,
      fugas: fugasRows.map((f) => ({
        motivo: f.motivo,
        cantidad: Number(f.cantidad),
      })),
    };
  }
}
