/**
 * Estrategia m2-exact: cobra el área EXACTA de las piezas × precio/m²
 * del sustrato. No considera desperdicio.
 *
 * Ported (1:1) desde rigid-printed.calculations.ts:costeoM2Exacto.
 */

import type { CostingInput, CostingResult } from '../types';
import { round2, pricePerM2 } from './shared';

export function costingM2Exact<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingM2Exact requires a sheet substrate.');
  }

  const pricePerM2Value = pricePerM2(
    input.unitPrice,
    substrate.widthMm,
    substrate.heightMm,
  );
  const pieceWidthMm = input.pieceWidthMm;
  const pieceHeightMm = input.pieceHeightMm;
  const areaPiezasM2 =
    pieceWidthMm && pieceHeightMm
      ? (pieceWidthMm * pieceHeightMm * input.totalPieces) / 1_000_000
      : input.nesting.metrics.areaUtilMm2 > 0
        ? input.nesting.metrics.areaUtilMm2 / 1_000_000
        : input.nesting.placements.reduce(
            (acc, placement) =>
              acc + (placement.widthMm * placement.heightMm) / 1_000_000,
            0,
          );
  const totalCost = round2(areaPiezasM2 * pricePerM2Value);

  return {
    strategy: 'm2-exact',
    totalCost,
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(pricePerM2Value),
      fullUnits: input.unitsNeeded,
      fullUnitsCost: totalCost,
      lastUnit: null,
      units: [],
    },
  };
}
