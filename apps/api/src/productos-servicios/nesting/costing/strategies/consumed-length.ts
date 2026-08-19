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

  // Multi-medida: no existe una capacidad uniforme por placa. Se cobra el
  // rectángulo realmente alcanzado por los placements de cada sustrato.
  if (piezasPorSustrato <= 0) {
    const units: CostingResult['breakdown']['units'] = [];
    for (let index = 0; index < input.unitsNeeded; index++) {
      const placements = input.nesting.placements.filter(
        (placement) => (placement.substrateIndex ?? 0) === index,
      );
      const trailingMarginMm =
        metrics.trailingMarginMm ??
        placements.reduce(
          (min, placement) => Math.min(min, placement.yMm),
          placements[0]?.yMm ?? 0,
        );
      const consumedLengthMm = placements.length
        ? placements.reduce(
            (max, placement) =>
              Math.max(max, placement.yMm + placement.heightMm),
            0,
          ) + trailingMarginMm
        : 0;
      const occupationPct = round2((consumedLengthMm / sustratoAltoMm) * 100);
      const cost = round2(
        input.unitPrice * (consumedLengthMm / sustratoAltoMm),
      );
      units.push({ index, occupationPct, segmentApplied: null, cost });
    }
    const totalCost = round2(
      units.reduce((total, unit) => total + unit.cost, 0),
    );
    return {
      strategy: 'consumed-length',
      totalCost,
      breakdown: {
        unitPrice: input.unitPrice,
        pricePerM2: round2(pricePerM2Value),
        fullUnits: units.filter((unit) => unit.occupationPct >= 100).length,
        fullUnitsCost: round2(
          units
            .filter((unit) => unit.occupationPct >= 100)
            .reduce((total, unit) => total + unit.cost, 0),
        ),
        lastUnit: units.length
          ? {
              occupationPct: units[units.length - 1].occupationPct,
              segmentApplied: null,
              cost: units[units.length - 1].cost,
            }
          : null,
        units,
      },
    };
  }

  // Sustratos completos
  const fullUnits =
    piezasPorSustrato > 0
      ? Math.floor(input.totalPieces / piezasPorSustrato)
      : 0;
  const fullUnitsCost = fullUnits * input.unitPrice;
  const units: CostingResult['breakdown']['units'] = Array.from(
    { length: fullUnits },
    (_, index) => ({
      index,
      occupationPct: 100,
      segmentApplied: null,
      cost: input.unitPrice,
    }),
  );

  // Último sustrato parcial: cobra ancho × largo consumido
  const piezasRestantes = input.totalPieces - fullUnits * piezasPorSustrato;
  let lastUnitCost = 0;
  let occupationPct = 0;

  if (piezasRestantes > 0 && columnas > 0) {
    const placementsParciales = input.nesting.placements.slice(
      0,
      piezasRestantes,
    );
    const trailingMarginMm =
      metrics.trailingMarginMm ??
      placementsParciales.reduce(
        (min, placement) => Math.min(min, placement.yMm),
        placementsParciales[0]?.yMm ?? 0,
      );
    const largoConsumido = placementsParciales.length
      ? placementsParciales.reduce(
          (max, placement) => Math.max(max, placement.yMm + placement.heightMm),
          0,
        ) + trailingMarginMm
      : largoConsumidoMmTotal > 0 && filas > 0
        ? Math.ceil(piezasRestantes / columnas) *
          (largoConsumidoMmTotal / filas)
        : 0;
    lastUnitCost = round2(input.unitPrice * (largoConsumido / sustratoAltoMm));
    occupationPct = round2((largoConsumido / sustratoAltoMm) * 100);
    units.push({
      index: fullUnits,
      occupationPct,
      segmentApplied: null,
      cost: lastUnitCost,
    });
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
      units,
    },
  };
}
