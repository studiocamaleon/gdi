/**
 * Estrategia simple ("materia prima completa"): le imputa al trabajo TODAS
 * las unidades (placa/hoja/pliego) que tocó, incluida la última aunque se
 * haya usado a medias — la promesa literal del editor.
 *
 * Existía como concepto en la UI pero el motor la salteaba (caía a la
 * fórmula del slot, que en montaje cuenta piezas, no hojas): un cartel que
 * tocaba 2 hojas cobraba 1. Ahora es una estrategia de primera clase.
 */

import type { CostingInput, CostingResult } from '../types';
import { round2, pricePerM2 } from './shared';

export function costingSimple<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  const substrate = input.nesting.substrates[0];
  if (!substrate || substrate.kind !== 'sheet') {
    throw new Error('costingSimple requires a sheet substrate.');
  }

  // Sin redondear: donde la fórmula del slot ya contaba unidades enteras
  // (papel simple faz), esta estrategia tiene que dar EL MISMO número al
  // centésimo de centavo — el golden master compara exacto.
  const fullUnits = Math.max(0, Math.ceil(input.unitsNeeded));
  const totalCost = fullUnits * input.unitPrice;

  return {
    strategy: 'simple',
    totalCost,
    breakdown: {
      unitPrice: input.unitPrice,
      pricePerM2: round2(
        pricePerM2(input.unitPrice, substrate.widthMm, substrate.heightMm),
      ),
      fullUnits,
      fullUnitsCost: totalCost,
      lastUnit: null,
      units: Array.from({ length: fullUnits }, (_, index) => ({
        index,
        occupationPct: 100,
        segmentApplied: 100,
        cost: input.unitPrice,
      })),
    },
  };
}
