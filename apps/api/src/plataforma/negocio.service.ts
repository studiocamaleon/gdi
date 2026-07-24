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
  periodo: { clave: PeriodoClave; etiqueta: string; desde: string; hasta: string };
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
    ]);

    const serie = this.zipSerie(serieVentas, serieFacturado);
    const totalCat = porCategoria.reduce((a, c) => a + c.ventas, 0);
    const totalTen = porTenant.reduce((a, t) => a + t.ventas, 0);

    return {
      periodo: {
        clave: v.clave,
        etiqueta: v.etiqueta,
        desde: v.desde.toISOString(),
        hasta: v.hasta.toISOString(),
      },
      kpis: {
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
      },
      serie,
      porCategoria: porCategoria.map((c) => ({
        ...c,
        ventas: r2(c.ventas),
        pct: totalCat > 0 ? r2((c.ventas / totalCat) * 100) : 0,
      })),
      porTenant: porTenant.map((t) => ({
        ...t,
        ventas: r2(t.ventas),
        ticket: t.ordenes > 0 ? r2(t.ventas / t.ordenes) : 0,
        pct: totalTen > 0 ? r2((t.ventas / totalTen) * 100) : 0,
      })),
      adopcion,
    };
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
}
