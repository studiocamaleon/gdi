import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Rango } from './periodo';

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
  items: number;
};
export type MaterialUso = {
  material: string;
  unidad: string;
  cantidad: number;
  costo: number;
  items: number;
};
export type MedidaUso = {
  anchoMm: number;
  altoMm: number;
  unidades: number;
  m2: number;
  items: number;
};

@Injectable()
export class ProductoService {
  constructor(private readonly prisma: PrismaService) {}

  async producto(tenantId: string, rango: Rango) {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);
    const filtro = { tenantId, desde, hastaExcl };

    const [categoria, producto, papel, tintas, medidas, tecnologia] =
      await Promise.all([
        this.margenPor(filtro, `COALESCE(NULLIF(oti."categoriaComercial", ''), 'Sin categoría')`),
        this.margenPor(filtro, `oti.nombre`, 20),
        this.materialesPorTipo(filtro, 'MATERIAL'),
        this.materialesPorTipo(filtro, 'CONSUMIBLE_MAQUINA'),
        this.medidas(filtro),
        this.tecnologia(filtro),
      ]);

    const totalM2 = medidas.reduce((a, m) => a + m.m2, 0);

    return {
      porCategoria: categoria,
      porProducto: producto,
      porPapel: papel,
      consumoTintas: tintas,
      porMedida: medidas,
      totalM2: r2(totalM2),
      porTecnologia: tecnologia,
    };
  }

  /** Ventas + costo + margen por una dimensión SQL (categoría o producto). */
  private async margenPor(
    f: { tenantId: string; desde: Date; hastaExcl: Date },
    dimensionSql: string,
    limite?: number,
  ): Promise<ProductoMargen[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ nombre: string; ventas: number; costo: number; items: number }>
    >(
      `
      SELECT ${dimensionSql} AS nombre,
             COALESCE(SUM(oti.subtotal), 0)::float8 AS ventas,
             COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo,
             COUNT(*)::int AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
      GROUP BY 1
      ORDER BY ventas DESC
      ${limite ? `LIMIT ${limite}` : ''}
      `,
      f.tenantId,
      f.desde,
      f.hastaExcl,
    );
    return rows.map((r) => {
      const margen = r.ventas - r.costo;
      return {
        nombre: r.nombre,
        ventas: r2(r.ventas),
        costo: r2(r.costo),
        margen: r2(margen),
        margenPct: r.ventas > 0 ? r2((margen / r.ventas) * 100) : 0,
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
      Array<{ material: string; unidad: string; cantidad: number; costo: number; items: number }>
    >(
      `
      SELECT COALESCE(mat->>'materiaPrimaNombre', 'Sin identificar') AS material,
             COALESCE(mat->>'unidad', '') AS unidad,
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
      GROUP BY 1, 2
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
      cantidad: r2(r.cantidad),
      costo: r2(r.costo),
      items: r.items,
    }));
  }

  /** Medidas vendidas: por dimensión de pieza, unidades y m² (del jobContext). */
  private async medidas(f: {
    tenantId: string;
    desde: Date;
    hastaExcl: Date;
  }): Promise<MedidaUso[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ ancho: number; alto: number; unidades: number; m2: number; items: number }>
    >(
      `
      SELECT (pieza->>'anchoMm')::float8 AS ancho, (pieza->>'altoMm')::float8 AS alto,
             COALESCE(SUM((pieza->>'cantidad')::numeric), 0)::float8 AS unidades,
             COALESCE(SUM((pieza->>'anchoMm')::numeric * (pieza->>'altoMm')::numeric
                          * (pieza->>'cantidad')::numeric) / 1e6, 0)::float8 AS m2,
             COUNT(DISTINCT oti.id)::int AS items
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
      CROSS JOIN LATERAL jsonb_array_elements(ci."jobContextJson"->'piezas') pieza
      WHERE oti."tenantId" = $1::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= $2 AND ot."fechaEmision" < $3
        AND pieza->>'anchoMm' IS NOT NULL AND pieza->>'altoMm' IS NOT NULL
      GROUP BY 1, 2
      ORDER BY m2 DESC
      `,
      f.tenantId,
      f.desde,
      f.hastaExcl,
    );
    return rows.map((r) => ({
      anchoMm: r.ancho,
      altoMm: r.alto,
      unidades: r2(r.unidades),
      m2: r2(r.m2),
      items: r.items,
    }));
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
    ];
  }
}
