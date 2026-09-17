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
import {
  consumedLengthAlongPlateLongAxis,
  inferPlateTrailingMarginMm,
  resolvePlateAxes,
} from '../../helpers/plate-axis';
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
  const { longAxis: substrateLongAxis, longSideMm: substrateLongSideMm } =
    resolvePlateAxes(substrate);

  const pricePerM2Value = pricePerM2(
    input.unitPrice,
    substrate.widthMm,
    substrate.heightMm,
  );

  // Multi-medida: no existe una capacidad uniforme por placa. Se cobra el
  // rectángulo realmente alcanzado por los placements de cada sustrato.
  if (piezasPorSustrato <= 0) {
    const units: CostingResult['breakdown']['units'] = [];
    for (let index = 0; index < input.unitsNeeded; index++) {
      const candidateSubstrate = input.nesting.substrates[index];
      const unitSubstrate =
        candidateSubstrate?.kind === 'sheet' ? candidateSubstrate : substrate;
      const placements = input.nesting.placements.filter(
        (placement) => (placement.substrateIndex ?? 0) === index,
      );
      const trailingMarginMm =
        metrics.trailingMarginMm ??
        inferPlateTrailingMarginMm(placements, unitSubstrate);
      const consumedLengthMm = placements.length
        ? consumedLengthAlongPlateLongAxis({
            placements,
            sheet: unitSubstrate,
            trailingMarginMm,
          })
        : 0;
      const { longSideMm } = resolvePlateAxes(unitSubstrate);
      const occupationPct = round2((consumedLengthMm / longSideMm) * 100);
      const cost = round2(input.unitPrice * (consumedLengthMm / longSideMm));
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
      inferPlateTrailingMarginMm(placementsParciales, substrate);
    const largoConsumido = placementsParciales.length
      ? consumedLengthAlongPlateLongAxis({
          placements: placementsParciales,
          sheet: substrate,
          trailingMarginMm,
        })
      : largoConsumidoMmTotal > 0 && filas > 0
        ? substrateLongAxis === 'y'
          ? Math.ceil(piezasRestantes / columnas) *
            (largoConsumidoMmTotal / filas)
          : Math.min(piezasRestantes, columnas) *
            (largoConsumidoMmTotal / columnas)
        : 0;
    lastUnitCost = round2(
      input.unitPrice * (largoConsumido / substrateLongSideMm),
    );
    occupationPct = round2((largoConsumido / substrateLongSideMm) * 100);
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
