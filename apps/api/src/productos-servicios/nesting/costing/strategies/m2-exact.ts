/**
 * Estrategia m2-exact: cobra el área EXACTA de las piezas × precio/m²
 * del sustrato. No considera desperdicio.
 *
 * Ported (1:1) desde rigid-printed.calculations.ts:costeoM2Exacto.
 * Extensión 2026-07-30: también acepta sustratos ROLLO cuando el caller
 * provee `pricePerM2Override` (en rollo el precio/m² no se deriva del
 * sustrato sino del material) — "no cobrar el desperdicio del acomodo".
 */

import type { CostingInput, CostingResult } from '../types';
import { round2, pricePerM2 } from './shared';

export function costingM2Exact<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate) {
    throw new Error('costingM2Exact requires a substrate.');
  }
  if (substrate.kind !== 'sheet' && input.pricePerM2Override == null) {
    throw new Error(
      'costingM2Exact requires a sheet substrate (or pricePerM2Override).',
    );
  }

  const pricePerM2Value =
    input.pricePerM2Override ??
    pricePerM2(
      input.unitPrice,
      substrate.kind === 'sheet' ? substrate.widthMm : 0,
      substrate.kind === 'sheet' ? substrate.heightMm : 0,
    );
  const pieceWidthMm = input.pieceWidthMm;
  const pieceHeightMm = input.pieceHeightMm;
  const areaPiezasM2 =
    pieceWidthMm && pieceHeightMm
      ? (pieceWidthMm * pieceHeightMm * input.totalPieces) / 1_000_000
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
    },
  };
}
