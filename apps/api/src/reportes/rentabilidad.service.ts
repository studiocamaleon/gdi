import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fraccionMesEnRango, mesesDelRango, type Rango } from './periodo';

/**
 * Rentabilidad — el corazón del Panel. Margen bruto, margen de
 * CONTRIBUCIÓN y PUNTO DE EQUILIBRIO, más el gasto estructural por centro.
 * Todo agregado en SQL sobre el snapshot de cada item (precio/costo) y los
 * componentes de costo por período. Ver docs/reportes-plan-backend.md §4.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

/** hasta inclusivo → límite superior EXCLUSIVO (día siguiente a medianoche). */
function finExclusivo(rango: Rango): Date {
  return new Date(
    rango.hasta.getFullYear(),
    rango.hasta.getMonth(),
    rango.hasta.getDate() + 1,
  );
}

export type CentroGasto = { centroId: string; centro: string; monto: number; pct: number };

export type RentabilidadPeriodo = {
  ventas: number;
  costoTotal: number;
  margenBruto: number;
  margenBrutoPct: number;
  costosVariables: number;
  contribucion: number;
  contribucionPct: number;
  costosFijos: number;
  /** null cuando no se puede calcular (sin fijos o contribución no positiva). */
  puntoEquilibrio: number | null;
  avancePct: number | null;
  gastoPorCentro: CentroGasto[];
  itemsSinCosto: number;
};

@Injectable()
export class RentabilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async periodo(tenantId: string, rango: Rango): Promise<RentabilidadPeriodo> {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);

    const [ventasCosto, variables, fijosRows] = await Promise.all([
      // Ventas (neto del OT item) + costo (snapshot de cotización).
      this.prisma.$queryRaw<
        Array<{ ventas: number; costo: number; items_sin_costo: number }>
      >`
        SELECT COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
               COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo,
               COUNT(*) FILTER (WHERE ci.id IS NULL)::int AS items_sin_costo
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        WHERE oti."tenantId" = ${tenantId}::uuid
          AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= ${desde}
          AND ot."fechaEmision" < ${hastaExcl}
      `,
      // Costos VARIABLES: líneas MATERIAL + CONSUMIBLE_MAQUINA de la
      // trazabilidad (papel + tintas) — lo que escala con cada trabajo.
      this.prisma.$queryRaw<Array<{ variables: number }>>`
        SELECT COALESCE(SUM((mat->>'costoTotal')::numeric), 0)::float8 AS variables
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        CROSS JOIN LATERAL jsonb_array_elements(ci."trazabilidadJson"->'pasos') paso
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(paso->'materiales', '[]'::jsonb)) mat
        WHERE oti."tenantId" = ${tenantId}::uuid
          AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= ${desde}
          AND ot."fechaEmision" < ${hastaExcl}
          AND mat->>'tipoLineaCosto' IN ('MATERIAL', 'CONSUMIBLE_MAQUINA')
      `,
      // Costos FIJOS por centro y mes (se prorratean por rango en JS).
      this.prisma.$queryRaw<
        Array<{ centroId: string; centro: string; periodo: string; monto: number }>
      >`
        SELECT c."centroCostoId" AS "centroId", cc.nombre AS centro,
               c.periodo, SUM(c."importeMensual")::float8 AS monto
        FROM "CentroCostoComponenteCostoPeriodo" c
        JOIN "CentroCosto" cc ON cc.id = c."centroCostoId"
        WHERE c."tenantId" = ${tenantId}::uuid
          AND c.periodo IN (${Prisma.join(mesesDelRango(rango))})
        GROUP BY c."centroCostoId", cc.nombre, c.periodo
      `,
    ]);

    const ventas = ventasCosto[0]?.ventas ?? 0;
    const costoTotal = ventasCosto[0]?.costo ?? 0;
    const itemsSinCosto = ventasCosto[0]?.items_sin_costo ?? 0;
    const costosVariables = variables[0]?.variables ?? 0;

    // Costos fijos prorrateados y agrupados por centro (para el donut).
    const porCentro = new Map<string, { centro: string; monto: number }>();
    let costosFijos = 0;
    for (const row of fijosRows) {
      const proporcion = row.monto * fraccionMesEnRango(row.periodo, rango);
      costosFijos += proporcion;
      const previo = porCentro.get(row.centroId);
      if (previo) previo.monto += proporcion;
      else porCentro.set(row.centroId, { centro: row.centro, monto: proporcion });
    }

    const margenBruto = ventas - costoTotal;
    const contribucion = ventas - costosVariables;
    const contribFrac = ventas > 0 ? contribucion / ventas : 0;
    const puntoEquilibrio =
      costosFijos > 0 && contribFrac > 0 ? costosFijos / contribFrac : null;
    const avancePct =
      puntoEquilibrio && puntoEquilibrio > 0 ? (ventas / puntoEquilibrio) * 100 : null;

    const gastoPorCentro: CentroGasto[] = [...porCentro.entries()]
      .map(([centroId, v]) => ({
        centroId,
        centro: v.centro,
        monto: r2(v.monto),
        pct: costosFijos > 0 ? r2((v.monto / costosFijos) * 100) : 0,
      }))
      .sort((a, b) => b.monto - a.monto);

    return {
      ventas: r2(ventas),
      costoTotal: r2(costoTotal),
      margenBruto: r2(margenBruto),
      margenBrutoPct: ventas > 0 ? r2((margenBruto / ventas) * 100) : 0,
      costosVariables: r2(costosVariables),
      contribucion: r2(contribucion),
      contribucionPct: r2(contribFrac * 100),
      costosFijos: r2(costosFijos),
      puntoEquilibrio: puntoEquilibrio !== null ? r2(puntoEquilibrio) : null,
      avancePct: avancePct !== null ? r2(avancePct) : null,
      gastoPorCentro,
      itemsSinCosto,
    };
  }

  /**
   * Bloque para el Panel: el período actual, sus deltas contra el anterior
   * (ventas en %, márgenes en puntos), y si hay comparativa. Lo consumen
   * las tabs Resumen y Finanzas.
   */
  async bloque(tenantId: string, rango: Rango, anterior: Rango) {
    const [actual, prev] = await Promise.all([
      this.periodo(tenantId, rango),
      this.periodo(tenantId, anterior),
    ]);
    const sinComparativa = prev.ventas === 0;
    return {
      actual,
      sinComparativa,
      deltas: {
        // Ventas: variación porcentual. Márgenes: variación en PUNTOS.
        ventasPct: prev.ventas > 0 ? r2(((actual.ventas - prev.ventas) / prev.ventas) * 100) : null,
        margenBrutoPts: sinComparativa ? null : r2(actual.margenBrutoPct - prev.margenBrutoPct),
        contribucionPts: sinComparativa ? null : r2(actual.contribucionPct - prev.contribucionPct),
      },
    };
  }

  /** Límites honestos para la meta del reporte, según lo que pasó. */
  limites(p: RentabilidadPeriodo): string[] {
    const l: string[] = [];
    if (p.itemsSinCosto > 0) {
      l.push(
        `${p.itemsSinCosto} item(s) sin snapshot de costo, excluidos del costo.`,
      );
    }
    if (p.costosFijos === 0) {
      l.push('Costos fijos no cargados en el período: sin punto de equilibrio.');
    } else if (p.puntoEquilibrio === null) {
      l.push('Contribución no positiva: punto de equilibrio indefinido.');
    }
    return l;
  }
}
