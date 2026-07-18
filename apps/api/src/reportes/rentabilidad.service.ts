import { Injectable } from '@nestjs/common';
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

export type CategoriaGasto = { categoria: string; monto: number; pct: number };

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
  gastoPorCategoria: CategoriaGasto[];
  itemsSinCosto: number;
};

@Injectable()
export class RentabilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async periodo(tenantId: string, rango: Rango): Promise<RentabilidadPeriodo> {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);

    const [ventasCosto, variables, gastosFijos] = await Promise.all([
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
      // Costos FIJOS de estructura (gastos fijos recurrentes con vigencia).
      // Fuente única del pool del punto de equilibrio; se prorratean por rango
      // en JS según los meses en que cada gasto está vigente.
      this.prisma.gastoFijoEstructura.findMany({
        where: { tenantId, activo: true },
        select: {
          categoria: true,
          importeMensual: true,
          vigenteDesde: true,
          vigenteHasta: true,
        },
      }),
    ]);

    const ventas = ventasCosto[0]?.ventas ?? 0;
    const costoTotal = ventasCosto[0]?.costo ?? 0;
    const itemsSinCosto = ventasCosto[0]?.items_sin_costo ?? 0;
    const costosVariables = variables[0]?.variables ?? 0;

    // Costos fijos prorrateados por rango y agrupados por categoría (donut).
    // Cada gasto suma en los meses del rango en que está vigente.
    const meses = mesesDelRango(rango);
    const porCategoria = new Map<string, number>();
    let costosFijos = 0;
    for (const gasto of gastosFijos) {
      const importe = Number(gasto.importeMensual);
      for (const mes of meses) {
        const vigente =
          gasto.vigenteDesde <= mes &&
          (gasto.vigenteHasta === null || mes <= gasto.vigenteHasta);
        if (!vigente) continue;
        const proporcion = importe * fraccionMesEnRango(mes, rango);
        costosFijos += proporcion;
        porCategoria.set(gasto.categoria, (porCategoria.get(gasto.categoria) ?? 0) + proporcion);
      }
    }

    const margenBruto = ventas - costoTotal;
    const contribucion = ventas - costosVariables;
    const contribFrac = ventas > 0 ? contribucion / ventas : 0;
    const puntoEquilibrio =
      costosFijos > 0 && contribFrac > 0 ? costosFijos / contribFrac : null;
    const avancePct =
      puntoEquilibrio && puntoEquilibrio > 0 ? (ventas / puntoEquilibrio) * 100 : null;

    const gastoPorCategoria: CategoriaGasto[] = [...porCategoria.entries()]
      .map(([categoria, monto]) => ({
        categoria,
        monto: r2(monto),
        pct: costosFijos > 0 ? r2((monto / costosFijos) * 100) : 0,
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
      gastoPorCategoria,
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
      l.push('Sin gastos fijos de estructura vigentes: sin punto de equilibrio.');
    } else if (p.puntoEquilibrio === null) {
      l.push('Contribución no positiva: punto de equilibrio indefinido.');
    }
    return l;
  }
}
