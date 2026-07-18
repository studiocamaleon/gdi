import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { granularidad, type Granularidad, type Rango } from './periodo';

/**
 * Ventas & Producto — la inteligencia comercial profunda. Ventas por
 * categoría (con margen) y producto, y lo que ningún ERP chico cruza:
 * consumo de PAPEL/material y de tintas (del snapshot de cada orden) y
 * las MEDIDAS que más se venden (m² por tamaño). Todo sobre órdenes
 * emitidas del rango. Ver docs/reportes-plan-backend.md §4.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

function finExclusivo(rango: Rango): Date {
  return new Date(
    rango.hasta.getFullYear(),
    rango.hasta.getMonth(),
    rango.hasta.getDate() + 1,
  );
}

export type ProductoMargen = {
  nombre: string;
  ventas: number;
  costo: number;
  margen: number;
  margenPct: number;
  /** Costos variables (material + consumibles de máquina). */
  costosVariables: number;
  /** Margen de contribución = ventas − costos variables. */
  contribucion: number;
  contribucionPct: number;
  items: number;
};
export type MaterialUso = {
  material: string;
  /** Unidad canónica: unidad, hoja, m2, metro_lineal, ml, gramo. */
  unidad: string;
  /** Formato comercial de la hoja/pliego (SRA3, A3+…) si la variante lo trae. */
  formato: string | null;
  cantidad: number;
  costo: number;
  items: number;
};
export type MedidasModoProducto = {
  nombre: string;
  items: number;
  estandar: number;
  personalizada: number;
  pctEstandar: number;
};
export type MedidasResumen = {
  /** Items con modo de medida conocido. */
  items: number;
  estandar: number;
  personalizada: number;
  pctEstandar: number | null;
  /** Items viejos sin medidaModo en el jobContext (fuera del %). */
  sinDato: number;
  porProducto: MedidasModoProducto[];
  /** Medidas predefinidas más usadas, por nombre. */
  topEstandar: Array<{ nombre: string; items: number }>;
};
/** Punto de la serie evolutiva de una dimensión (categoría o producto). */
export type PuntoMix = { fecha: string; nombre: string; monto: number };
export type AdicionalUso = { etiqueta: string; items: number; pctItems: number; ventas: number };
export type ProductoAdicionales = {
  nombre: string;
  items: number;
  itemsCon: number;
  pctCon: number;
};
export type ResumenAdicionales = {
  itemsTotales: number;
  itemsCon: number;
  pctCon: number;
  /** Subtotal promedio POR ITEM, con vs. sin adicionales. */
  ticketItemCon: number;
  ticketItemSin: number;
  porAdicional: AdicionalUso[];
  porProducto: ProductoAdicionales[];
};

const TRUNC: Record<Granularidad, string> = { dia: 'day', semana: 'week', mes: 'month' };

@Injectable()
export class ProductoService {
  constructor(private readonly prisma: PrismaService) {}

  async producto(tenantId: string, rango: Rango) {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);
    const filtro = { tenantId, desde, hastaExcl };

    const [categoria, producto, papel, tintas, medidas, totalM2, tecnologia, mixEvolutivo, adicionales] =
      await Promise.all([
        this.margenPor(filtro, `COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría')`),
        this.margenPor(filtro, `oti.nombre`, 20),
        this.materialesPorTipo(filtro, 'MATERIAL'),
        this.materialesPorTipo(filtro, 'CONSUMIBLE_MAQUINA'),
        this.medidasModo(filtro),
        this.totalM2(filtro),
        this.tecnologia(filtro),
        this.serieMix(filtro, granularidad(rango)),
        this.adicionales(filtro),
      ]);

    return {
      porCategoria: categoria,
      porProducto: producto,
      porPapel: papel,
      consumoTintas: tintas,
      medidas,
      totalM2,
      porTecnologia: tecnologia,
      mixEvolutivo,
      adicionales,
    };
  }

  /**
   * Drill del mix evolutivo: dentro de UNA categoría, la serie por
   * producto y su tabla de margen del período.
   */
  async mixCategoria(tenantId: string, rango: Rango, categoria: string) {
    const filtro = { tenantId, desde: rango.desde, hastaExcl: finExclusivo(rango) };
    const [serie, productos] = await Promise.all([
      this.serieMix(filtro, granularidad(rango), categoria),
      this.margenPor(filtro, `oti.nombre`, 20, categoria),
    ]);
    return { categoria, serie, productos };
  }

  /**
   * Serie evolutiva del mix: monto por bucket × categoría (o × producto
   * dentro de una categoría, cuando `categoria` viene). El front pivota.
   */
  private async serieMix(
    f: { tenantId: string; desde: Date; hastaExcl: Date },
    gran: Granularidad,
    categoria?: string,
  ): Promise<PuntoMix[]> {
    const dimension = categoria
      ? `oti.nombre`
      : `COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría')`;
    const rows = await this.prisma.$queryRawUnsafe<PuntoMix[]>(
      `
      SELECT to_char(date_trunc('${TRUNC[gran]}', ot."fechaEmision"), 'YYYY-MM-DD') AS fecha,
             ${dimension} AS nombre,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        ${categoria ? `AND COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría') = $4` : ''}
      GROUP BY 1, 2 ORDER BY 1, monto DESC
      `,
      ...(categoria
        ? [f.tenantId, f.desde, f.hastaExcl, categoria]
        : [f.tenantId, f.desde, f.hastaExcl]),
    );
    return rows.map((r) => ({ ...r, monto: r2(r.monto) }));
  }

  /**
   * Adicionales vendidos (etiquetas de `adicionalesJson` del item): attach
   * rate por adicional y por producto, y ticket por item con vs. sin.
   * v1 sin economía por adicional (el precio individual no se persiste
   * en columna — ver docs/metricas-avanzadas-panel-estudio.md §2.2).
   */
  private async adicionales(f: {
    tenantId: string;
    desde: Date;
    hastaExcl: Date;
  }): Promise<ResumenAdicionales> {
    const esArray = `jsonb_typeof(oti."adicionalesJson") = 'array'`;
    const conAdic = `(${esArray} AND jsonb_array_length(oti."adicionalesJson") > 0)`;
    const [resumenRows, porAdicional, porProducto] = await Promise.all([
      this.prisma.$queryRawUnsafe<
        Array<{ items: number; con: number; ticketcon: number; ticketsin: number }>
      >(
        `
        SELECT COUNT(*)::int AS items,
               COUNT(*) FILTER (WHERE ${conAdic})::int AS con,
               COALESCE(AVG(oti.subtotal) FILTER (WHERE ${conAdic}), 0)::float8 AS ticketcon,
               COALESCE(AVG(oti.subtotal) FILTER (WHERE NOT ${conAdic}), 0)::float8 AS ticketsin
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        `,
        f.tenantId,
        f.desde,
        f.hastaExcl,
      ),
      this.prisma.$queryRawUnsafe<Array<{ etiqueta: string; items: number; ventas: number }>>(
        `
        SELECT et.etiqueta, COUNT(*)::int AS items,
               COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        CROSS JOIN LATERAL jsonb_array_elements_text(oti."adicionalesJson") et(etiqueta)
        WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
          AND ${esArray}
        GROUP BY 1 ORDER BY items DESC, ventas DESC
        `,
        f.tenantId,
        f.desde,
        f.hastaExcl,
      ),
      this.prisma.$queryRawUnsafe<Array<{ nombre: string; items: number; con: number }>>(
        `
        SELECT oti.nombre, COUNT(*)::int AS items,
               COUNT(*) FILTER (WHERE ${conAdic})::int AS con
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        GROUP BY 1 ORDER BY items DESC LIMIT 12
        `,
        f.tenantId,
        f.desde,
        f.hastaExcl,
      ),
    ]);
    const resumen = resumenRows[0] ?? { items: 0, con: 0, ticketcon: 0, ticketsin: 0 };
    return {
      itemsTotales: resumen.items,
      itemsCon: resumen.con,
      pctCon: resumen.items > 0 ? r2((resumen.con / resumen.items) * 100) : 0,
      ticketItemCon: r2(resumen.ticketcon),
      ticketItemSin: r2(resumen.ticketsin),
      porAdicional: porAdicional.map((a) => ({
        etiqueta: a.etiqueta,
        items: a.items,
        pctItems: resumen.items > 0 ? r2((a.items / resumen.items) * 100) : 0,
        ventas: r2(a.ventas),
      })),
      porProducto: porProducto.map((p) => ({
        nombre: p.nombre,
        items: p.items,
        itemsCon: p.con,
        pctCon: p.items > 0 ? r2((p.con / p.items) * 100) : 0,
      })),
    };
  }

  /** Top productos por facturación (para el Resumen). */
  async topProductos(tenantId: string, rango: Rango, limite = 5): Promise<ProductoMargen[]> {
    return this.margenPor(
      { tenantId, desde: rango.desde, hastaExcl: finExclusivo(rango) },
      'oti.nombre',
      limite,
    );
  }

  /** Ventas + costo + margen por una dimensión SQL (categoría o producto). */
  private async margenPor(
    f: { tenantId: string; desde: Date; hastaExcl: Date },
    dimensionSql: string,
    limite?: number,
    categoria?: string,
  ): Promise<ProductoMargen[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ nombre: string; ventas: number; costo: number; variables: number; items: number }>
    >(
      `
      SELECT ${dimensionSql} AS nombre,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
             COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo,
             COALESCE(SUM(v.variables), 0)::float8 AS variables,
             COUNT(*)::int AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      -- Costos variables por item (material + consumibles): escalar por LATERAL
      -- para no multiplicar filas al agregar ventas/costo.
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM((mat->>'costoTotal')::numeric), 0) AS variables
        FROM jsonb_array_elements(ci."trazabilidadJson"->'pasos') paso
        CROSS JOIN jsonb_array_elements(COALESCE(paso->'materiales', '[]'::jsonb)) mat
        WHERE mat->>'tipoLineaCosto' IN ('MATERIAL', 'CONSUMIBLE_MAQUINA')
      ) v ON true
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        ${categoria ? `AND COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría') = $4` : ''}
      GROUP BY 1
      ORDER BY ventas DESC
      ${limite ? `LIMIT ${limite}` : ''}
      `,
      ...(categoria
        ? [f.tenantId, f.desde, f.hastaExcl, categoria]
        : [f.tenantId, f.desde, f.hastaExcl]),
    );
    return rows.map((r) => {
      const margen = r.ventas - r.costo;
      const contribucion = r.ventas - r.variables;
      return {
        nombre: r.nombre,
        ventas: r2(r.ventas),
        costo: r2(r.costo),
        margen: r2(margen),
        margenPct: r.ventas > 0 ? r2((margen / r.ventas) * 100) : 0,
        costosVariables: r2(r.variables),
        contribucion: r2(contribucion),
        contribucionPct: r.ventas > 0 ? r2((contribucion / r.ventas) * 100) : 0,
        items: r.items,
      };
    });
  }

  /** Consumo de material por tipo de línea (papel = MATERIAL, tinta = CONSUMIBLE). */
  private async materialesPorTipo(
    f: { tenantId: string; desde: Date; hastaExcl: Date },
    tipoLinea: 'MATERIAL' | 'CONSUMIBLE_MAQUINA',
  ): Promise<MaterialUso[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ material: string; unidad: string; formato: string | null; cantidad: number; costo: number; items: number }>
    >(
      `
      SELECT COALESCE(mat->>'materiaPrimaNombre', 'Sin identificar') AS material,
             -- Unidad canónica: la trazabilidad mezcla sinónimos históricos.
             CASE WHEN mat->>'unidad' IN ('metro_lineal', 'm_lineales') THEN 'metro_lineal'
                  WHEN mat->>'unidad' IN ('hoja', 'pliegos') THEN 'hoja'
                  ELSE COALESCE(mat->>'unidad', '') END AS unidad,
             -- El formato comercial de la variante desambigua "hojas ¿de qué?".
             CASE WHEN mat->>'unidad' IN ('hoja', 'pliegos')
                  THEN mat->'atributosVarianteJson'->>'formatoComercial' END AS formato,
             COALESCE(SUM((mat->>'cantidad')::numeric), 0)::float8 AS cantidad,
             COALESCE(SUM((mat->>'costoTotal')::numeric), 0)::float8 AS costo,
             COUNT(DISTINCT oti.id)::int AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      CROSS JOIN LATERAL jsonb_array_elements(ci."trazabilidadJson"->'pasos') paso
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(paso->'materiales', '[]'::jsonb)) mat
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        AND mat->>'tipoLineaCosto' = $4
      GROUP BY 1, 2, 3
      ORDER BY costo DESC
      `,
      f.tenantId,
      f.desde,
      f.hastaExcl,
      tipoLinea,
    );
    return rows.map((r) => ({
      material: r.material,
      unidad: r.unidad,
      formato: r.formato,
      cantidad: r2(r.cantidad),
      costo: r2(r.costo),
      items: r.items,
    }));
  }

  /**
   * Medida estándar vs. a medida: `jobContext.medidaModo` dice cómo se
   * cotizó cada item (predefinida del producto o personalizada). Split
   * global, por producto, y ranking de medidas predefinidas por nombre.
   */
  private async medidasModo(f: {
    tenantId: string;
    desde: Date;
    hastaExcl: Date;
  }): Promise<MedidasResumen> {
    const [porProductoRows, topEstandar] = await Promise.all([
      this.prisma.$queryRawUnsafe<
        Array<{ nombre: string; modo: string | null; items: number }>
      >(
        `
        SELECT oti.nombre, ci."jobContextJson"->>'medidaModo' AS modo, COUNT(*)::int AS items
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        GROUP BY 1, 2
        `,
        f.tenantId,
        f.desde,
        f.hastaExcl,
      ),
      this.prisma.$queryRawUnsafe<Array<{ nombre: string; items: number }>>(
        `
        SELECT ci."jobContextJson"->>'medidaPredefinidaNombre' AS nombre, COUNT(*)::int AS items
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
          AND ci."jobContextJson"->>'medidaModo' = 'predefinida'
          AND COALESCE(ci."jobContextJson"->>'medidaPredefinidaNombre', '') <> ''
        GROUP BY 1 ORDER BY items DESC LIMIT 6
        `,
        f.tenantId,
        f.desde,
        f.hastaExcl,
      ),
    ]);

    const porProductoMap = new Map<string, MedidasModoProducto>();
    let estandar = 0, personalizada = 0, sinDato = 0;
    for (const r of porProductoRows) {
      if (r.modo !== 'predefinida' && r.modo !== 'personalizada') {
        sinDato += r.items;
        continue;
      }
      const p = porProductoMap.get(r.nombre) ?? {
        nombre: r.nombre, items: 0, estandar: 0, personalizada: 0, pctEstandar: 0,
      };
      p.items += r.items;
      if (r.modo === 'predefinida') { p.estandar += r.items; estandar += r.items; }
      else { p.personalizada += r.items; personalizada += r.items; }
      porProductoMap.set(r.nombre, p);
    }
    const porProducto = [...porProductoMap.values()]
      .map((p) => ({ ...p, pctEstandar: r2((p.estandar / p.items) * 100) }))
      .sort((a, b) => b.items - a.items)
      .slice(0, 8);
    const items = estandar + personalizada;

    return {
      items,
      estandar,
      personalizada,
      pctEstandar: items > 0 ? r2((estandar / items) * 100) : null,
      sinDato,
      porProducto,
      topEstandar,
    };
  }

  /** m² vendidos del período (piezas del jobContext), para el subtítulo. */
  private async totalM2(f: {
    tenantId: string;
    desde: Date;
    hastaExcl: Date;
  }): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ m2: number }>>(
      `
      SELECT COALESCE(SUM((pieza->>'anchoMm')::numeric * (pieza->>'altoMm')::numeric
                          * COALESCE((pieza->>'cantidad')::numeric, 1)) / 1e6, 0)::float8 AS m2
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ci."jobContextJson"->'piezas', '[]'::jsonb)) pieza
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        AND pieza->>'anchoMm' IS NOT NULL AND pieza->>'altoMm' IS NOT NULL
      `,
      f.tenantId,
      f.desde,
      f.hastaExcl,
    );
    return r2(rows[0]?.m2 ?? 0);
  }

  private async tecnologia(f: {
    tenantId: string;
    desde: Date;
    hastaExcl: Date;
  }): Promise<Array<{ nombre: string; monto: number; pct: number }>> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ nombre: string; monto: number }>>(
      `
      SELECT COALESCE(ci."jobContextJson"->>'tecnologia', 'Sin especificar') AS nombre,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS monto
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
      GROUP BY 1 ORDER BY monto DESC
      `,
      f.tenantId,
      f.desde,
      f.hastaExcl,
    );
    const total = rows.reduce((a, r) => a + r.monto, 0);
    return rows.map((r) => ({
      nombre: r.nombre,
      monto: r2(r.monto),
      pct: total > 0 ? r2((r.monto / total) * 100) : 0,
    }));
  }

  limites(): string[] {
    return [
      'Consumo de papel y tintas: teórico, del snapshot de cada orden (no de stock real).',
      'Adicionales: frecuencia y ticket con/sin — el precio de cada adicional individual no se persiste todavía.',
      'Medidas: estándar vs. a medida según cómo se cotizó cada item; los items sin ese dato quedan fuera del porcentaje.',
    ];
  }
}
