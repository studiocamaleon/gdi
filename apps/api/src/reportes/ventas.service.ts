import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { claveFechaEnZona, instanteDe } from '../common/zona';
import {
  finExclusivo,
  granularidad,
  mismoPeriodoAnioAnterior,
  type Granularidad,
  type Rango,
} from './periodo';

/**
 * Ventas — el eje comercial del Panel. Facturación, ticket, serie
 * temporal, rankings de clientes y vendedores, mix por categoría y
 * tecnología, y clientes DORMIDOS (recurrentes que dejaron de comprar).
 * "Venta" = neto (subtotal) de items de órdenes emitidas.
 * Ver docs/reportes-plan-backend.md §3.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const MS_DIA = 86_400_000;
/** Días sin comprar para considerar a un cliente recurrente "dormido". */
const DIAS_DORMIDO = 60;

const TRUNC: Record<Granularidad, string> = { dia: 'day', semana: 'week', mes: 'month' };

export type RankingItem = { id: string | null; nombre: string; ordenes: number; facturado: number };
export type MixItem = { nombre: string; monto: number; pct: number };
export type ClienteDormido = {
  clienteId: string | null;
  cliente: string;
  ultimaCompra: string;
  diasSinComprar: number;
  historico: number;
};
export type PuntoTicket = {
  fecha: string;
  ordenes: number;
  ticketPromedio: number;
  ticketMediana: number;
};
export type CeldaEstacionalidad = { categoria: string; mes: string; monto: number };

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serie temporal del rango: ventas y COSTO por bucket (para el gráfico
   * "Facturación, costo y margen"). `monto` = ventas, retrocompatible.
   */
  async serie(
    tenantId: string,
    rango: Rango,
  ): Promise<Array<{ fecha: string; monto: number; costo: number }>> {
    const truncUnit = Prisma.raw(`'${TRUNC[granularidad(rango)]}'`);
    // La columna es timestamp SIN zona con UTC adentro: primero se le declara
    // el UTC y recién ahí se lleva al reloj del tenant, para que el bucket
    // "día" sea el día de SU pared.
    const rows = await this.prisma.$queryRaw<Array<{ fecha: string; monto: number; costo: number }>>`
      SELECT to_char(date_trunc(${truncUnit}, (ot."fechaEmision" AT TIME ZONE 'UTC') AT TIME ZONE ${rango.zona}), 'YYYY-MM-DD') AS fecha,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS monto,
             COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
        AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${finExclusivo(rango)}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((s) => ({ fecha: s.fecha, monto: r2(s.monto), costo: r2(s.costo) }));
  }

  /** Top clientes del rango por facturación (para Resumen y Comercial). */
  async topClientes(tenantId: string, rango: Rango, limite = 5): Promise<RankingItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string | null; nombre: string; ordenes: number; facturado: number }>
    >`
      SELECT ot."clienteId" AS id, COALESCE(c.nombre, 'Sin cliente') AS nombre,
             COUNT(DISTINCT ot.id)::int AS ordenes,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS facturado
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "Cliente" c ON c.id = ot."clienteId"
      WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
        AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${finExclusivo(rango)}
      GROUP BY ot."clienteId", c.nombre
      ORDER BY facturado DESC
      LIMIT ${limite}
    `;
    return rows.map((r) => ({ ...r, facturado: r2(r.facturado) }));
  }

  /**
   * Evolución del ticket por bucket: promedio Y mediana del total por
   * orden (el promedio miente cuando dos órdenes grandes tapan cincuenta
   * chicas — la mediana lo dice).
   */
  async serieTicket(tenantId: string, rango: Rango): Promise<PuntoTicket[]> {
    const truncUnit = Prisma.raw(`'${TRUNC[granularidad(rango)]}'`);
    const rows = await this.prisma.$queryRaw<
      Array<{ fecha: string; ordenes: number; promedio: number; mediana: number }>
    >`
      WITH ordenes AS (
        SELECT ot.id, date_trunc(${truncUnit}, (ot."fechaEmision" AT TIME ZONE 'UTC') AT TIME ZONE ${rango.zona}) AS bucket,
               SUM(oti.subtotal) AS total
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
          AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${finExclusivo(rango)}
        GROUP BY ot.id, 2
      )
      SELECT to_char(bucket, 'YYYY-MM-DD') AS fecha, COUNT(*)::int AS ordenes,
             COALESCE(AVG(total), 0)::float8 AS promedio,
             COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY total), 0)::float8 AS mediana
      FROM ordenes GROUP BY bucket ORDER BY bucket
    `;
    return rows.map((r) => ({
      fecha: r.fecha,
      ordenes: r.ordenes,
      ticketPromedio: r2(r.promedio),
      ticketMediana: r2(r.mediana),
    }));
  }

  /**
   * Ventas por categoría × mes de los 12 meses que terminan en el rango:
   * la base del heatmap de estacionalidad. El índice estacional serio
   * llega cuando haya 2+ años de historia; hasta entonces esto muestra
   * "qué categoría vendió en qué mes" desde que hay datos.
   */
  async estacionalidad(tenantId: string, rango: Rango): Promise<CeldaEstacionalidad[]> {
    // Primer día del mes que arrancó 11 meses antes del fin del rango, en la
    // zona del tenant (aritmética por clave, sin el reloj del proceso).
    const [y, m] = claveFechaEnZona(rango.hasta, rango.zona).split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1 - 11, 1));
    const clave12 = `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const desde12 = instanteDe(clave12, '00:00', rango.zona);
    const rows = await this.prisma.$queryRaw<CeldaEstacionalidad[]>`
      SELECT COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría') AS categoria,
             to_char(date_trunc('month', (ot."fechaEmision" AT TIME ZONE 'UTC') AT TIME ZONE ${rango.zona}), 'YYYY-MM') AS mes,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
        AND ot."fechaEmision" >= ${desde12} AND ot."fechaEmision" < ${finExclusivo(rango)}
      GROUP BY 1, 2 ORDER BY 2, 1
    `;
    return rows.map((r) => ({ ...r, monto: r2(r.monto) }));
  }

  async comercial(tenantId: string, rango: Rango, anterior: Rango, hoy: Date = new Date()) {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);
    const gran = granularidad(rango);

    const [totalRows, prevRows, anualRows, serieRows, ticketRows, estacionalidadRows, clientes, vendedores, categoria, tecnologia, historia] =
      await Promise.all([
        this.totales(tenantId, rango),
        this.totales(tenantId, anterior),
        this.totales(tenantId, mismoPeriodoAnioAnterior(rango)),
        this.serie(tenantId, rango),
        this.serieTicket(tenantId, rango),
        this.estacionalidad(tenantId, rango),
        this.topClientes(tenantId, rango, 8),
        this.prisma.$queryRaw<Array<{ id: string | null; nombre: string; ordenes: number; facturado: number }>>`
          SELECT ot."vendedorEmpleadoId" AS id, COALESCE(e."nombreCompleto", 'Sin vendedor') AS nombre,
                 COUNT(DISTINCT ot.id)::int AS ordenes, COALESCE(SUM(oti.subtotal), 0)::float8 AS facturado
          FROM "OrdenTrabajoItem" oti
          JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
          LEFT JOIN "Empleado" e ON e.id = ot."vendedorEmpleadoId"
          WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."fechaEmision" >= ${desde} AND ot."fechaEmision" < ${hastaExcl}
          GROUP BY ot."vendedorEmpleadoId", e."nombreCompleto"
          ORDER BY facturado DESC
        `,
        this.prisma.$queryRaw<Array<{ nombre: string; monto: number }>>`
          SELECT COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría') AS nombre,
                 COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
          FROM "OrdenTrabajoItem" oti
          JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
          WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."fechaEmision" >= ${desde} AND ot."fechaEmision" < ${hastaExcl}
          GROUP BY 1 ORDER BY monto DESC
        `,
        this.prisma.$queryRaw<Array<{ nombre: string; monto: number }>>`
          SELECT COALESCE(ci."jobContextJson"->>'tecnologia', 'Sin especificar') AS nombre,
                 COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
          FROM "OrdenTrabajoItem" oti
          JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
          LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
          WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."fechaEmision" >= ${desde} AND ot."fechaEmision" < ${hastaExcl}
          GROUP BY 1 ORDER BY monto DESC
        `,
        // Historia por cliente (todo el tiempo) para nuevos y dormidos.
        this.prisma.$queryRaw<
          Array<{ id: string; nombre: string; ordenes: number; primera: Date; ultima: Date }>
        >`
          SELECT ot."clienteId" AS id, COALESCE(c.nombre, 'Sin cliente') AS nombre,
                 COUNT(DISTINCT ot.id)::int AS ordenes,
                 MIN(ot."fechaEmision") AS primera, MAX(ot."fechaEmision") AS ultima
          FROM "OrdenTrabajo" ot
          LEFT JOIN "Cliente" c ON c.id = ot."clienteId"
          WHERE ot."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."clienteId" IS NOT NULL AND ot."fechaEmision" IS NOT NULL
          GROUP BY ot."clienteId", c.nombre
        `,
      ]);

    const total = totalRows;
    const prev = prevRows;
    const mixCategoria = this.conPct(categoria);
    const mixTecnologia = this.conPct(tecnologia);

    // Nuevos (primera compra en el rango) y dormidos (recurrentes parados).
    // La medianoche de HOY en la zona del tenant, no la del proceso.
    const hoyMid = instanteDe(claveFechaEnZona(hoy, rango.zona), '00:00', rango.zona);
    let nuevosClientes = 0;
    const dormidos: ClienteDormido[] = [];
    for (const h of historia) {
      if (h.primera >= desde && h.primera < hastaExcl) nuevosClientes += 1;
      const dias = Math.floor((hoyMid.getTime() - h.ultima.getTime()) / MS_DIA);
      if (h.ordenes >= 2 && dias > DIAS_DORMIDO) {
        dormidos.push({
          clienteId: h.id,
          cliente: h.nombre,
          ultimaCompra: claveFechaEnZona(h.ultima, rango.zona),
          diasSinComprar: dias,
          historico: h.ordenes,
        });
      }
    }
    dormidos.sort((a, b) => b.diasSinComprar - a.diasSinComprar);

    const ticketPromedio = total.ordenes > 0 ? r2(total.ventas / total.ordenes) : 0;
    const itemsPorOrden = total.ordenes > 0 ? r2(total.items / total.ordenes) : 0;
    const sinComparativa = prev.ventas === 0;
    const anual = anualRows;

    return {
      kpis: {
        ventas: r2(total.ventas),
        ventasDeltaPct: prev.ventas > 0 ? r2(((total.ventas - prev.ventas) / prev.ventas) * 100) : null,
        /** vs. mismo período del año anterior; null hasta que exista esa historia. */
        ventasDeltaAnualPct:
          anual.ventas > 0 ? r2(((total.ventas - anual.ventas) / anual.ventas) * 100) : null,
        ordenes: total.ordenes,
        ordenesDeltaPct: prev.ordenes > 0 ? r2(((total.ordenes - prev.ordenes) / prev.ordenes) * 100) : null,
        ticketPromedio,
        itemsPorOrden,
        nuevosClientes,
        clientesDormidos: dormidos.length,
      },
      serie: serieRows,
      serieTicket: ticketRows,
      estacionalidad: estacionalidadRows,
      granularidad: gran,
      rankingClientes: clientes,
      rankingVendedores: vendedores.map((v) => ({ ...v, facturado: r2(v.facturado) })),
      mixCategoria,
      mixTecnologia,
      dormidos,
      sinComparativa,
    };
  }

  private async totales(tenantId: string, rango: Rango) {
    const rows = await this.prisma.$queryRaw<
      Array<{ ventas: number; ordenes: number; items: number }>
    >`
      SELECT COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
             COUNT(DISTINCT ot.id)::int AS ordenes,
             COUNT(*)::int AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
        AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${finExclusivo(rango)}
    `;
    return rows[0] ?? { ventas: 0, ordenes: 0, items: 0 };
  }

  private conPct(rows: Array<{ nombre: string; monto: number }>): MixItem[] {
    const total = rows.reduce((a, r) => a + r.monto, 0);
    return rows.map((r) => ({
      nombre: r.nombre,
      monto: r2(r.monto),
      pct: total > 0 ? r2((r.monto / total) * 100) : 0,
    }));
  }
}
