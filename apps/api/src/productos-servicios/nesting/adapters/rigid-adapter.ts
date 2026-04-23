/**
 * Adapter para el motor rigid-printed.
 *
 * Mapea Input/Output del shape legacy (`NestingInput` / `NestingResult`
 * de motors/rigid-printed.calculations.ts y `CosteoInput` / `CosteoResult`)
 * al/desde los tipos universales del módulo `nesting/`.
 *
 * Mantiene 100% el shape legacy de retorno para que los call-sites del
 * service y otros consumidores no se enteren de la migración.
 *
 * Este adapter desaparece cuando rigid-printed.calculations.ts pase a
 * usar los tipos universales directamente (Fase 2).
 */

import type { Piece, SheetSubstrate, NestingResult as UniversalNestingResult } from '../types';
import { nestGrid2DSingle } from '../algorithms/grid-2d-single';
import { applyCostingStrategy } from '../costing';
import type { CostingInput, CostingStrategyKind } from '../costing/types';

// ─── Shapes legacy (re-declarados acá para no tener import circular) ─

interface LegacyNestingInput {
  piezaAnchoMm: number;
  piezaAltoMm: number;
  placaAnchoMm: number;
  placaAltoMm: number;
  separacionHMm: number;
  separacionVMm: number;
  margenMm: number;
  permitirRotacion: boolean;
}

interface LegacyNestingPiecePosition {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  rotada: boolean;
}

interface LegacyNestingResult {
  piezasPorPlaca: number;
  columnas: number;
  filas: number;
  rotada: boolean;
  posiciones: LegacyNestingPiecePosition[];
  aprovechamientoPct: number;
  largoConsumidoMm: number;
  areaUtilMm2: number;
  areaTotalMm2: number;
}

interface LegacyCosteoInput {
  estrategia: 'm2_exacto' | 'largo_consumido' | 'segmentos_placa';
  precioPlaca: number;
  placaAnchoMm: number;
  placaAltoMm: number;
  nesting: LegacyNestingResult;
  placasNecesarias: number;
  piezasUltimaPlaca: number;
  segmentosPlaca: number[];
  cantidadTotal: number;
  piezaAnchoMm: number;
  piezaAltoMm: number;
}

interface LegacyCosteoResult {
  estrategia: 'm2_exacto' | 'largo_consumido' | 'segmentos_placa';
  costoTotal: number;
  detalle: {
    precioPlaca: number;
    precioM2: number;
    placasCompletas: number;
    costoPlacasCompletas: number;
    ultimaPlaca: {
      ocupacionPct: number;
      segmentoAplicado: number | null;
      costo: number;
    } | null;
  };
}

// ─── Conversiones ────────────────────────────────────────────────

function toUniversalPiece(input: LegacyNestingInput): Piece {
  return {
    id: 'pieza',
    widthMm: input.piezaAnchoMm,
    heightMm: input.piezaAltoMm,
    quantity: 1,
  };
}

function toUniversalSubstrate(input: LegacyNestingInput): SheetSubstrate {
  return {
    kind: 'sheet',
    widthMm: input.placaAnchoMm,
    heightMm: input.placaAltoMm,
    margins: {
      leftMm: input.margenMm,
      rightMm: input.margenMm,
      topMm: input.margenMm,
      bottomMm: input.margenMm,
    },
  };
}

function fromUniversalNestingResult(universal: UniversalNestingResult): LegacyNestingResult {
  return {
    piezasPorPlaca: universal.metrics.piezasPorSustrato ?? 0,
    columnas: universal.metrics.columnas ?? 0,
    filas: universal.metrics.filas ?? 0,
    rotada: universal.metrics.rotada ?? false,
    posiciones: universal.placements.map((p) => ({
      x: p.xMm,
      y: p.yMm,
      anchoMm: p.widthMm,
      altoMm: p.heightMm,
      rotada: p.rotated,
    })),
    aprovechamientoPct: universal.metrics.aprovechamientoPct,
    largoConsumidoMm: universal.metrics.largoConsumidoMm ?? 0,
    areaUtilMm2: universal.metrics.areaUtilMm2,
    areaTotalMm2: universal.metrics.areaTotalMm2,
  };
}

const LEGACY_TO_UNIVERSAL_STRATEGY: Record<LegacyCosteoInput['estrategia'], CostingStrategyKind> = {
  m2_exacto: 'm2-exact',
  largo_consumido: 'consumed-length',
  segmentos_placa: 'plate-segments',
};

const UNIVERSAL_TO_LEGACY_STRATEGY: Record<CostingStrategyKind, LegacyCosteoInput['estrategia']> = {
  'm2-exact': 'm2_exacto',
  'consumed-length': 'largo_consumido',
  'plate-segments': 'segmentos_placa',
};

function toUniversalCostingInput(legacy: LegacyCosteoInput): CostingInput {
  // Reconstruimos un NestingResult universal mínimo desde el legacy nesting.
  const universalNesting: UniversalNestingResult = {
    algorithm: 'grid-2d-single',
    substrates: [
      {
        kind: 'sheet',
        count: 1,
        widthMm: legacy.placaAnchoMm,
        heightMm: legacy.placaAltoMm,
      },
    ],
    placements: legacy.nesting.posiciones.map((p) => ({
      pieceId: 'pieza',
      xMm: p.x,
      yMm: p.y,
      widthMm: p.anchoMm,
      heightMm: p.altoMm,
      rotated: p.rotada,
    })),
    metrics: {
      columnas: legacy.nesting.columnas,
      filas: legacy.nesting.filas,
      rotada: legacy.nesting.rotada,
      piezasPorSustrato: legacy.nesting.piezasPorPlaca,
      aprovechamientoPct: legacy.nesting.aprovechamientoPct,
      areaUtilMm2: legacy.nesting.areaUtilMm2,
      areaTotalMm2: legacy.nesting.areaTotalMm2,
      largoConsumidoMm: legacy.nesting.largoConsumidoMm,
    },
  };

  return {
    strategy: LEGACY_TO_UNIVERSAL_STRATEGY[legacy.estrategia],
    nesting: universalNesting,
    unitPrice: legacy.precioPlaca,
    totalPieces: legacy.cantidadTotal,
    unitsNeeded: legacy.placasNecesarias,
    pieceWidthMm: legacy.piezaAnchoMm,
    pieceHeightMm: legacy.piezaAltoMm,
    segmentSteps: legacy.segmentosPlaca,
  };
}

function fromUniversalCostingResult(
  universal: ReturnType<typeof applyCostingStrategy>,
): LegacyCosteoResult {
  return {
    estrategia: UNIVERSAL_TO_LEGACY_STRATEGY[universal.strategy],
    costoTotal: universal.totalCost,
    detalle: {
      precioPlaca: universal.breakdown.unitPrice,
      precioM2: universal.breakdown.pricePerM2,
      placasCompletas: universal.breakdown.fullUnits,
      costoPlacasCompletas: universal.breakdown.fullUnitsCost,
      ultimaPlaca: universal.breakdown.lastUnit
        ? {
            ocupacionPct: universal.breakdown.lastUnit.occupationPct,
            segmentoAplicado: universal.breakdown.lastUnit.segmentApplied,
            costo: universal.breakdown.lastUnit.cost,
          }
        : null,
    },
  };
}

// ─── API pública del adapter ─────────────────────────────────────

/** Wrapper que devuelve resultado en shape legacy de rigid-printed. */
export function nestRectangularGridV2(input: LegacyNestingInput): LegacyNestingResult {
  const piece = toUniversalPiece(input);
  const substrate = toUniversalSubstrate(input);
  const result = nestGrid2DSingle(piece, substrate, {
    separationHMm: input.separacionHMm,
    separationVMm: input.separacionVMm,
    allowRotation: input.permitirRotacion,
  });
  return fromUniversalNestingResult(result);
}

/** Wrapper que devuelve resultado de costeo en shape legacy de rigid-printed. */
export function calcularCosteoMaterialV2(input: LegacyCosteoInput): LegacyCosteoResult {
  const universalInput = toUniversalCostingInput(input);
  const universalResult = applyCostingStrategy(universalInput);
  return fromUniversalCostingResult(universalResult);
}
