/**
 * Estrategia plate-segments (escalonado): cada placa/pliego cobra
 * según el primer escalón ≥ % de ocupación.
 *
 * Ejemplo con escalones [25, 50, 75, 100]:
 *   Placa al 60% de ocupación → cobra 75% del precio.
 *   Placa al 30% → cobra 50% del precio.
 *   Placa al 100% → cobra 100% del precio.
 *
 * Ported (1:1) desde rigid-printed.calculations.ts:costeoSegmentosPlaca.
 */

import type { CostingInput, CostingResult } from '../types';
import { round2, pricePerM2 } from './shared';

const DEFAULT_SEGMENTS = [25, 50, 75, 100];

export function costingPlateSegments<T = unknown>(input: CostingInput<T>): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingPlateSegments requires a sheet substrate.');
  }

  const { metrics } = input.nesting;
  const piezasPorSustrato = metrics.piezasPorSustrato ?? 0;
  const segmentSteps = (input.segmentSteps && input.segmentSteps.length > 0)
    ? [...input.segmentSteps].sort((a, b) => a - b)
    : DEFAULT_SEGMENTS;

  if (piezasPorSustrato <= 0) {
    return {
      strategy: 'plate-segments',
      totalCost: 0,
      breakdown: {
        unitPrice: input.unitPrice,
        pricePerM2: 0,
        fullUnits: 0,
        fullUnitsCost: 0,
        lastUnit: null,
      },
    };
  }

  let totalCost = 0;
  let fullUnits = 0;
  let fullUnitsCost = 0;
  let lastOccupationPct = 0;
  let lastSegmentApplied = 100;
  let lastUnitCost = 0;

  let piezasRestantes = input.totalPieces;

  for (let i = 0; i < input.unitsNeeded; i++) {
    const piezasEnEsteSustrato = Math.min(piezasRestantes, piezasPorSustrato);
    piezasRestantes -= piezasEnEsteSustrato;

    const occupation = (piezasEnEsteSustrato / piezasPorSustrato) * 100;
    const segment = segmentSteps.find((s) => s >= occupation) ?? 100;
    const cost = round2(input.unitPrice * (segment / 100));

    totalCost += cost;

    if (piezasEnEsteSustrato === piezasPorSustrato) {
      fullUnits++;
      fullUnitsCost += cost;
    } else {
      lastOccupationPct = round2(occupation);
      lastSegmentApplied = segment;
      lastUnitCost = cost;
    }
  }

  return {
    strategy: 'plate-segments',
    totalCost: round2(totalCost),
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(pricePerM2(input.unitPrice, substrate.widthMm, substrate.heightMm)),
      fullUnits,
      fullUnitsCost: round2(fullUnitsCost),
      lastUnit: input.unitsNeeded > fullUnits
        ? { occupationPct: lastOccupationPct, segmentApplied: lastSegmentApplied, cost: lastUnitCost }
        : null,
    },
  };
}
