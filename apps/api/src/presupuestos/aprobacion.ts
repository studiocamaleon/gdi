/**
 * Aprobación interna por umbrales (F2 — docs/presupuestos-f2-aprobacion-plan.md).
 * Función PURA: evalúa las reglas configuradas contra el presupuesto y
 * devuelve los motivos disparados. Vacío = puede enviarse sin aprobación.
 * Reglas con campo null = desactivadas (default: nada cambia).
 */

import { formatearMoneda, monedaDe, type Moneda } from '../common/moneda';

export type ConfigAprobacion = {
  /** Total máximo que un operador puede enviar sin aprobación. */
  aprobacionMontoMax: number | null;
  /** Margen mínimo (%) por debajo del cual se exige aprobación. */
  aprobacionMargenMinPct: number | null;
  /** Descuento máximo (%) que se puede aplicar sin aprobación (F3 descuentos). */
  aprobacionDescuentoMaxPct?: number | null;
  requiereAprobacionSinCosteo?: boolean;
};

export type ItemAprobacion = {
  subtotal: number;
  /** Costo del snapshot; null = no verificable. */
  costoTotal: number | null;
};

export type MotivoAprobacion = {
  regla: 'monto' | 'margen' | 'sin_costeo' | 'descuento';
  detalle: string;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function evaluarAprobacion(
  config: ConfigAprobacion,
  presupuesto: {
    total: number;
    items: ItemAprobacion[];
    /**
     * Mayor % de descuento comercial entre las líneas (sobre el neto de
     * lista); 0/ausente = sin descuento. Con descuento de orden prorrateado
     * cada línea trae el mismo %, así que el máximo representa bien el eje.
     */
    descuentoMaxPct?: number;
  },
  moneda: Moneda = monedaDe(null),
): MotivoAprobacion[] {
  const motivos: MotivoAprobacion[] = [];
  const dinero = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });

  if (
    config.aprobacionMontoMax != null &&
    presupuesto.total > config.aprobacionMontoMax
  ) {
    motivos.push({
      regla: 'monto',
      detalle: `El total ${dinero(presupuesto.total)} supera el umbral de ${dinero(config.aprobacionMontoMax)}.`,
    });
  }

  if (config.aprobacionDescuentoMaxPct != null) {
    const maxPct = presupuesto.descuentoMaxPct ?? 0;
    if (maxPct > config.aprobacionDescuentoMaxPct) {
      motivos.push({
        regla: 'descuento',
        detalle: `El descuento del ${r1(maxPct)}% supera el máximo del ${r1(config.aprobacionDescuentoMaxPct)}% permitido sin aprobación.`,
      });
    }
  }

  const sinCosto = presupuesto.items.filter((i) => i.costoTotal == null).length;
  if (
    sinCosto > 0 &&
    (config.requiereAprobacionSinCosteo ||
      config.aprobacionMargenMinPct != null)
  ) {
    motivos.push({
      regla: 'sin_costeo',
      detalle: `${sinCosto} item${sinCosto === 1 ? '' : 's'} sin costeo verificable: el margen no se puede controlar.`,
    });
  }

  if (config.aprobacionMargenMinPct != null) {
    const neto = presupuesto.items.reduce((a, i) => a + i.subtotal, 0);
    const costo = presupuesto.items.reduce(
      (a, i) => a + (i.costoTotal ?? 0),
      0,
    );
    if (sinCosto === 0 && neto > 0) {
      const margenPct = ((neto - costo) / neto) * 100;
      if (margenPct < config.aprobacionMargenMinPct) {
        motivos.push({
          regla: 'margen',
          detalle: `El margen ${r1(margenPct)}% está debajo del mínimo del ${r1(config.aprobacionMargenMinPct)}%.`,
        });
      }
    }
  }

  return motivos;
}
