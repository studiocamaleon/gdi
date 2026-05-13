/**
 * Estrategia consumed-length: cobra placas/pliegos completos enteros +
 * la última placa parcial PROPORCIONAL al largo consumido (tipo rollo).
 *
 * Requiere que el `NestingResult.metrics` tenga `largoConsumidoMm`,
 * `columnas`, `filas` (lo provee `nestGrid2DSingle`).
 *
 * Ported (1:1) desde rigid-printed.calculations.ts:costeoLargoConsumido.
 */

import type { CostingInput, CostingResult } from '../types';
import { round2, pricePerM2 } from './shared';

export function costingConsumedLength<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingConsumedLength requires a sheet substrate.');
  }

  const { metrics } = input.nesting;
  const piezasPorSustrato = metrics.piezasPorSustrato ?? 0;
  const columnas = metrics.columnas ?? 0;
  const filas = metrics.filas ?? 0;
  const largoConsumidoMmTotal = metrics.largoConsumidoMm ?? 0;
  const sustratoAltoMm = substrate.heightMm;

  const pricePerM2Value = pricePerM2(
    input.unitPrice,
    substrate.widthMm,
    sustratoAltoMm,
  );

  // Sustratos completos
  const fullUnits =
    piezasPorSustrato > 0
      ? Math.floor(input.totalPieces / piezasPorSustrato)
      : 0;
  const fullUnitsCost = fullUnits * input.unitPrice;

  // Último sustrato parcial: cobra ancho × largo consumido
  const piezasRestantes = input.totalPieces - fullUnits * piezasPorSustrato;
  let lastUnitCost = 0;
  let occupationPct = 0;

  if (piezasRestantes > 0 && columnas > 0) {
    const filasNecesarias = Math.ceil(piezasRestantes / columnas);
    // Largo consumido proporcional al subset de filas que se usan
    const largoConsumido =
      largoConsumidoMmTotal > 0 && filas > 0
        ? (filasNecesarias / filas) * largoConsumidoMmTotal
        : filasNecesarias * (input.nesting.placements[0]?.heightMm ?? 0);
    lastUnitCost = round2(input.unitPrice * (largoConsumido / sustratoAltoMm));
    occupationPct = round2((largoConsumido / sustratoAltoMm) * 100);
  }

  return {
    strategy: 'consumed-length',
    totalCost: round2(fullUnitsCost + lastUnitCost),
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(pricePerM2Value),
      fullUnits,
      fullUnitsCost: round2(fullUnitsCost),
      lastUnit:
        piezasRestantes > 0
          ? { occupationPct, segmentApplied: null, cost: lastUnitCost }
          : null,
    },
  };
}
