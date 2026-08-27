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

export function costingPlateSegments<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingPlateSegments requires a sheet substrate.');
  }

  const { metrics } = input.nesting;
  const piezasPorSustrato = metrics.piezasPorSustrato ?? 0;
  const segmentSteps =
    input.segmentSteps && input.segmentSteps.length > 0
      ? [...input.segmentSteps].sort((a, b) => a - b)
      : DEFAULT_SEGMENTS;

  if (piezasPorSustrato <= 0) {
    return costingPlateSegmentsByActualPlacements(input, segmentSteps);
  }

  const columnas = metrics.columnas ?? 0;
  const filas = metrics.filas ?? 0;
  const fullLayoutLengthMm = metrics.largoConsumidoMm ?? 0;
  const firstPlacement = input.nesting.placements[0];
  const inferredBottomMarginMm = firstPlacement?.yMm ?? 0;

  let totalCost = 0;
  let fullUnits = 0;
  let fullUnitsCost = 0;
  let lastUnit: CostingResult['breakdown']['lastUnit'] = null;
  const units: CostingResult['breakdown']['units'] = [];
  let piezasRestantes = input.totalPieces;

  for (let i = 0; i < input.unitsNeeded; i++) {
    const piezasEnEsteSustrato = Math.min(piezasRestantes, piezasPorSustrato);
    piezasRestantes -= piezasEnEsteSustrato;

    const placementsIndexadas = input.nesting.placements.filter(
      (placement) => placement.substrateIndex === i,
    );
    const placementsDeEstaUnidad =
      placementsIndexadas.length > 0
        ? placementsIndexadas
        : input.nesting.placements.slice(0, piezasEnEsteSustrato);
    const largoConsumido = placementsDeEstaUnidad.length
      ? consumedLengthFromPlacements(
          placementsDeEstaUnidad,
          metrics.trailingMarginMm ?? inferredBottomMarginMm,
        )
      : fullLayoutLengthMm > 0 && filas > 0 && columnas > 0
        ? Math.ceil(piezasEnEsteSustrato / columnas) *
          (fullLayoutLengthMm / filas)
        : 0;
    const occupation = round2((largoConsumido / substrate.heightMm) * 100);
    const segment = segmentSteps.find((s) => s >= occupation) ?? 100;
    const cost = round2(input.unitPrice * (segment / 100));

    totalCost += cost;
    units.push({
      index: i,
      occupationPct: occupation,
      segmentApplied: segment,
      cost,
    });

    if (segment === 100) {
      fullUnits++;
      fullUnitsCost += cost;
    } else {
      lastUnit = { occupationPct: occupation, segmentApplied: segment, cost };
    }
  }

  return {
    strategy: 'plate-segments',
    totalCost: round2(totalCost),
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(
        pricePerM2(input.unitPrice, substrate.widthMm, substrate.heightMm),
      ),
      fullUnits,
      fullUnitsCost: round2(fullUnitsCost),
      lastUnit,
      units,
    },
  };
}

function costingPlateSegmentsByActualPlacements<T = unknown>(
  input: CostingInput<T>,
  segmentSteps: number[],
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingPlateSegments requires a sheet substrate.');
  }

  if (substrate.heightMm <= 0) {
    return emptyResult(input.unitPrice);
  }

  const placementsBySubstrate = new Map<
    number,
    typeof input.nesting.placements
  >();
  for (const placement of input.nesting.placements) {
    const substrateIndex = placement.substrateIndex ?? 0;
    const current = placementsBySubstrate.get(substrateIndex) ?? [];
    current.push(placement);
    placementsBySubstrate.set(substrateIndex, current);
  }

  let totalCost = 0;
  let fullUnits = 0;
  let fullUnitsCost = 0;
  let lastUnit: CostingResult['breakdown']['lastUnit'] = null;
  const units: CostingResult['breakdown']['units'] = [];

  for (let i = 0; i < input.unitsNeeded; i++) {
    const placements = placementsBySubstrate.get(i) ?? [];
    const trailingMarginMm = inferTrailingMarginMm(placements);
    const largoConsumido = consumedLengthFromPlacements(
      placements,
      trailingMarginMm,
    );
    const occupation = round2((largoConsumido / substrate.heightMm) * 100);
    const segment = segmentSteps.find((s) => s >= occupation) ?? 100;
    const cost = round2(input.unitPrice * (segment / 100));
    totalCost += cost;
    units.push({
      index: i,
      occupationPct: occupation,
      segmentApplied: segment,
      cost,
    });

    if (segment === 100) {
      fullUnits++;
      fullUnitsCost += cost;
    } else {
      lastUnit = { occupationPct: occupation, segmentApplied: segment, cost };
    }
  }

  return {
    strategy: 'plate-segments',
    totalCost: round2(totalCost),
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(
        pricePerM2(input.unitPrice, substrate.widthMm, substrate.heightMm),
      ),
      fullUnits,
      fullUnitsCost: round2(fullUnitsCost),
      lastUnit,
      units,
    },
  };
}

function consumedLengthFromPlacements<T = unknown>(
  placements: CostingInput<T>['nesting']['placements'],
  trailingMarginMm: number,
): number {
  if (placements.length === 0) return 0;
  const maxBottom = placements.reduce(
    (max, placement) => Math.max(max, placement.yMm + placement.heightMm),
    0,
  );
  return maxBottom + trailingMarginMm;
}

function inferTrailingMarginMm<T = unknown>(
  placements: CostingInput<T>['nesting']['placements'],
): number {
  if (placements.length === 0) return 0;
  return placements.reduce(
    (min, placement) => Math.min(min, placement.yMm),
    placements[0].yMm,
  );
}

function emptyResult(unitPrice: number): CostingResult {
  return {
    strategy: 'plate-segments',
    totalCost: 0,
    breakdown: {
      unitPrice,
      pricePerM2: 0,
      fullUnits: 0,
      fullUnitsCost: 0,
      lastUnit: null,
      units: [],
    },
  };
}
