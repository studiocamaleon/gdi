/**
 * Aprobación interna por umbrales (F2 — docs/presupuestos-f2-aprobacion-plan.md).
 * Función PURA: evalúa las reglas configuradas contra el presupuesto y
 * devuelve los motivos disparados. Vacío = puede enviarse sin aprobación.
 * Reglas con campo null = desactivadas (default: nada cambia).
 */

export type ConfigAprobacion = {
  /** Total máximo que un operador puede enviar sin aprobación. */
  aprobacionMontoMax: number | null;
  /** Margen mínimo (%) por debajo del cual se exige aprobación. */
  aprobacionMargenMinPct: number | null;
};

export type ItemAprobacion = {
  subtotal: number;
  /** Costo del snapshot; null = no verificable. */
  costoTotal: number | null;
};

export type MotivoAprobacion = {
  regla: 'monto' | 'margen' | 'sin_costeo';
  detalle: string;
};

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const r1 = (n: number) => Math.round(n * 10) / 10;

export function evaluarAprobacion(
  config: ConfigAprobacion,
  presupuesto: { total: number; items: ItemAprobacion[] },
): MotivoAprobacion[] {
  const motivos: MotivoAprobacion[] = [];

  if (
    config.aprobacionMontoMax != null &&
    presupuesto.total > config.aprobacionMontoMax
  ) {
    motivos.push({
      regla: 'monto',
      detalle: `El total ${pesos(presupuesto.total)} supera el umbral de ${pesos(config.aprobacionMontoMax)}.`,
    });
  }

  if (config.aprobacionMargenMinPct != null) {
    const sinCosto = presupuesto.items.filter(
      (i) => i.costoTotal == null,
    ).length;
    if (sinCosto > 0) {
      // Sin costo verificable no se puede garantizar el margen mínimo.
      motivos.push({
        regla: 'sin_costeo',
        detalle: `${sinCosto} item${sinCosto === 1 ? '' : 's'} sin costeo verificable: el margen no se puede controlar.`,
      });
    }
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
