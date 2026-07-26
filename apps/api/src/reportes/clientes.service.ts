import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from './alertas.service';
import { claveFechaEnZona, instanteDe } from '../common/zona';
import { finExclusivo, granularidad, type Granularidad, type Rango } from './periodo';

/**
 * Clientes — el eje que el Panel no tenía: concentración de cartera,
 * retención, frecuencia de recompra, segmentos RFM y margen por cliente.
 * Todo sobre la historia de órdenes emitidas; los segmentos usan el
 * umbral de "cliente dormido" configurable (ConfiguracionInsights).
 * Ver docs/metricas-avanzadas-panel-estudio.md §3/§4.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const MS_DIA = 86_400_000;
const TRUNC: Record<Granularidad, string> = { dia: 'day', semana: 'week', mes: 'month' };

export type SegmentoRfm =
  | 'campeones'
  | 'leales'
  | 'nuevos'
  | 'en_riesgo'
  | 'perdidos'
  | 'ocasionales';

export type ClienteRfm = {
  clienteId: string;
  cliente: string;
  ordenes: number;
  facturadoHistorico: number;
  ultimaCompra: string;
  diasSinComprar: number;
};

export type MargenCliente = {
  clienteId: string | null;
  cliente: string;
  ordenes: number;
  ventas: number;
  /** Margen sólo sobre los items CON costo snapshoteado. */
  margen: number;
  margenPct: number | null;
  itemsSinCosto: number;
};

type HistoriaCliente = {
  id: string;
  nombre: string;
  ordenes: number;
  facturado: number;
  primera: Date;
  ultima: Date;
  ordenesRango: number;
  facturadoRango: number;
  ordenesAnterior: number;
};

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertas: AlertasService,
  ) {}

  async clientes(tenantId: string, rango: Rango, anterior: Rango, hoy: Date = new Date()) {
    const gran = granularidad(rango);
    const hastaExcl = finExclusivo(rango);
    const antHastaExcl = finExclusivo(anterior);

    const [umbrales, historia, frecuenciaRows, serieNR, margenClientes] = await Promise.all([
      this.alertas.getUmbrales(tenantId),
      this.prisma.$queryRaw<HistoriaCliente[]>`
        SELECT ot."clienteId" AS id, COALESCE(c.nombre, 'Sin cliente') AS nombre,
               COUNT(DISTINCT ot.id)::int AS ordenes,
               COALESCE(SUM(oti.subtotal), 0)::float8 AS facturado,
               MIN(ot."fechaEmision") AS primera, MAX(ot."fechaEmision") AS ultima,
               COUNT(DISTINCT ot.id) FILTER (
                 WHERE ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${hastaExcl}
               )::int AS "ordenesRango",
               COALESCE(SUM(oti.subtotal) FILTER (
                 WHERE ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${hastaExcl}
               ), 0)::float8 AS "facturadoRango",
               COUNT(DISTINCT ot.id) FILTER (
                 WHERE ot."fechaEmision" >= ${anterior.desde} AND ot."fechaEmision" < ${antHastaExcl}
               )::int AS "ordenesAnterior"
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        LEFT JOIN "Cliente" c ON c.id = ot."clienteId"
        WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
          AND ot."clienteId" IS NOT NULL AND ot."fechaEmision" IS NOT NULL
        GROUP BY ot."clienteId", c.nombre
      `,
      // Mediana histórica de días entre compras (clientes con 2+ órdenes).
      this.prisma.$queryRaw<Array<{ mediana: number | null; muestras: number }>>`
        WITH ord AS (
          SELECT DISTINCT ot."clienteId" AS cid, ot.id, ot."fechaEmision" AS f
          FROM "OrdenTrabajo" ot
          WHERE ot."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."clienteId" IS NOT NULL AND ot."fechaEmision" IS NOT NULL
        ), gaps AS (
          SELECT EXTRACT(EPOCH FROM f - LAG(f) OVER (PARTITION BY cid ORDER BY f)) / 86400 AS dias
          FROM ord
        )
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY dias)::float8 AS mediana,
               COUNT(*)::int AS muestras
        FROM gaps WHERE dias IS NOT NULL
      `,
      // Serie del rango: venta de clientes NUEVOS (adquiridos en ese
      // bucket) vs. RECURRENTES. La primera compra se busca en TODA la
      // historia, no sólo en el rango.
      this.prisma.$queryRaw<Array<{ fecha: string; nuevos: number; recurrentes: number }>>`
        WITH ord AS (
          SELECT ot.id, ot."clienteId" AS cid, ot."fechaEmision" AS f,
                 -- La misma fecha en el reloj del TENANT: los buckets y la
                 -- "primera compra" se comparan en su pared, no en UTC.
                 (ot."fechaEmision" AT TIME ZONE 'UTC') AT TIME ZONE ${rango.zona} AS fl,
                 SUM(oti.subtotal) AS total
          FROM "OrdenTrabajoItem" oti
          JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
          WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
            AND ot."clienteId" IS NOT NULL AND ot."fechaEmision" IS NOT NULL
          GROUP BY ot.id, ot."clienteId", ot."fechaEmision"
        ), marcada AS (
          SELECT *, MIN(fl) OVER (PARTITION BY cid) AS primera FROM ord
        )
        SELECT to_char(date_trunc(${Prisma.raw(`'${TRUNC[gran]}'`)}, fl), 'YYYY-MM-DD') AS fecha,
               COALESCE(SUM(total) FILTER (
                 WHERE date_trunc(${Prisma.raw(`'${TRUNC[gran]}'`)}, primera)
                     = date_trunc(${Prisma.raw(`'${TRUNC[gran]}'`)}, fl)
               ), 0)::float8 AS nuevos,
               COALESCE(SUM(total) FILTER (
                 WHERE date_trunc(${Prisma.raw(`'${TRUNC[gran]}'`)}, primera)
                     < date_trunc(${Prisma.raw(`'${TRUNC[gran]}'`)}, fl)
               ), 0)::float8 AS recurrentes
        FROM marcada
        WHERE f >= ${rango.desde} AND f < ${hastaExcl}
        GROUP BY 1 ORDER BY 1
      `,
      // Margen por cliente del rango. El margen se calcula SOLO sobre
      // items con costo snapshoteado (los sin cotización se declaran).
      this.prisma.$queryRaw<
        Array<{
          id: string | null;
          nombre: string;
          ordenes: number;
          ventas: number;
          ventasconcosto: number;
          costo: number;
          sincosto: number;
        }>
      >`
        SELECT ot."clienteId" AS id, COALESCE(c.nombre, 'Sin cliente') AS nombre,
               COUNT(DISTINCT ot.id)::int AS ordenes,
               COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
               COALESCE(SUM(oti.subtotal) FILTER (WHERE ci.id IS NOT NULL), 0)::float8 AS ventasconcosto,
               COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo,
               COUNT(*) FILTER (WHERE ci.id IS NULL)::int AS sincosto
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        LEFT JOIN "Cliente" c ON c.id = ot."clienteId"
        WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado NOT IN ('borrador', 'cancelada')
          AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${hastaExcl}
        GROUP BY ot."clienteId", c.nombre
        ORDER BY ventas DESC
        LIMIT 10
      `,
    ]);

    const diasActivo = umbrales.diasClienteDormido;
    // La medianoche de HOY en la zona del tenant, no la del proceso.
    const hoyMid = instanteDe(claveFechaEnZona(hoy, rango.zona), '00:00', rango.zona);

    // Actividad del rango vs. el período anterior (retención simple).
    const activos = historia.filter((h) => h.ordenesRango > 0);
    const activosAnterior = historia.filter((h) => h.ordenesAnterior > 0);
    const retenidos = activos.filter((h) => h.ordenesAnterior > 0).length;
    const nuevos = activos.filter(
      (h) => h.primera >= rango.desde && h.primera < hastaExcl,
    ).length;

    // Pareto de cartera del rango.
    const totalRango = activos.reduce((a, h) => a + h.facturadoRango, 0);
    const ordenados = [...activos].sort((a, b) => b.facturadoRango - a.facturadoRango);
    let acumulado = 0;
    const pareto = ordenados.slice(0, 10).map((h) => {
      acumulado += h.facturadoRango;
      return {
        clienteId: h.id,
        cliente: h.nombre,
        ordenes: h.ordenesRango,
        facturado: r2(h.facturadoRango),
        pct: totalRango > 0 ? r2((h.facturadoRango / totalRango) * 100) : 0,
        pctAcumulado: totalRango > 0 ? r2((acumulado / totalRango) * 100) : 0,
      };
    });
    const top3 = ordenados.slice(0, 3).reduce((a, h) => a + h.facturadoRango, 0);

    // Segmentos RFM sobre TODO el historial. Reglas declaradas (v1):
    // activo = compró hace ≤ diasActivo; perdido = > 3× diasActivo.
    const segmentos: Record<SegmentoRfm, { clientes: number; facturado: number }> = {
      campeones: { clientes: 0, facturado: 0 },
      leales: { clientes: 0, facturado: 0 },
      nuevos: { clientes: 0, facturado: 0 },
      en_riesgo: { clientes: 0, facturado: 0 },
      perdidos: { clientes: 0, facturado: 0 },
      ocasionales: { clientes: 0, facturado: 0 },
    };
    const enRiesgo: ClienteRfm[] = [];
    for (const h of historia) {
      const dias = Math.floor((hoyMid.getTime() - h.ultima.getTime()) / MS_DIA);
      let seg: SegmentoRfm;
      if (dias <= diasActivo) {
        seg = h.ordenes >= 4 ? 'campeones' : h.ordenes >= 2 ? 'leales' : 'nuevos';
      } else if (h.ordenes >= 2) {
        seg = dias <= diasActivo * 3 ? 'en_riesgo' : 'perdidos';
      } else {
        seg = 'ocasionales';
      }
      segmentos[seg].clientes += 1;
      segmentos[seg].facturado += h.facturado;
      if (seg === 'en_riesgo') {
        enRiesgo.push({
          clienteId: h.id,
          cliente: h.nombre,
          ordenes: h.ordenes,
          facturadoHistorico: r2(h.facturado),
          ultimaCompra: claveFechaEnZona(h.ultima, rango.zona),
          diasSinComprar: dias,
        });
      }
    }
    enRiesgo.sort((a, b) => b.facturadoHistorico - a.facturadoHistorico);

    const frecuencia = frecuenciaRows[0] ?? { mediana: null, muestras: 0 };

    return {
      kpis: {
        activos: activos.length,
        nuevos,
        recurrentes: activos.length - nuevos,
        /** % de clientes del período anterior que volvieron a comprar. */
        retencionPct:
          activosAnterior.length > 0
            ? r2((retenidos / activosAnterior.length) * 100)
            : null,
        frecuenciaMedianaDias:
          frecuencia.muestras >= 5 && frecuencia.mediana != null
            ? r2(frecuencia.mediana)
            : null,
        concentracionTop3Pct: totalRango > 0 ? r2((top3 / totalRango) * 100) : null,
      },
      pareto,
      serieNuevosRecurrentes: serieNR.map((s) => ({
        fecha: s.fecha,
        nuevos: r2(s.nuevos),
        recurrentes: r2(s.recurrentes),
      })),
      rfm: {
        diasActivo,
        segmentos: (Object.keys(segmentos) as SegmentoRfm[]).map((seg) => ({
          segmento: seg,
          clientes: segmentos[seg].clientes,
          facturado: r2(segmentos[seg].facturado),
        })),
        enRiesgo: enRiesgo.slice(0, 8),
      },
      margenClientes: margenClientes.map<MargenCliente>((m) => {
        const margen = m.ventasconcosto - m.costo;
        return {
          clienteId: m.id,
          cliente: m.nombre,
          ordenes: m.ordenes,
          ventas: r2(m.ventas),
          margen: r2(margen),
          margenPct: m.ventasconcosto > 0 ? r2((margen / m.ventasconcosto) * 100) : null,
          itemsSinCosto: m.sincosto,
        };
      }),
      granularidad: gran,
      sinComparativa: activosAnterior.length === 0,
    };
  }

  limites(diasActivo: number): string[] {
    return [
      `Segmentos: activo = compró hace ≤${diasActivo} días (umbral configurable); perdido = más de ${diasActivo * 3} días.`,
      'Retención: clientes del período anterior equivalente que volvieron a comprar en éste.',
      'Margen por cliente: sólo sobre items con costo snapshoteado (los manuales sin cotización se cuentan aparte).',
    ];
  }
}
