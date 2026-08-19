/**
 * Tipos del submódulo de costeo de material.
 *
 * Las estrategias consumen un `NestingResult` (ya calculado) y un
 * precio de sustrato para producir un costo total con desglose.
 *
 * Hoy hay 3 estrategias portadas de rigid-printed:
 *   - m2-exact: cobra área exacta de las piezas × precio/m².
 *   - consumed-length: placas/pliegos llenos completos + último parcial
 *     proporcional al largo consumido.
 *   - plate-segments: cada placa cobra según el primer escalón ≥ % de
 *     ocupación (escalonado).
 *
 * Diseñado para reutilización futura por otros motores. Hoy solo rigid
 * usa estas estrategias; el contrato es genérico para que cualquier
 * sustrato `sheet` con un `NestingResult` pueda costearse.
 */

import type { NestingResult } from '../types';

export type CostingStrategyKind =
  | 'simple'
  | 'm2-exact'
  | 'consumed-length'
  | 'plate-segments';

export interface CostingInput<T = unknown> {
  strategy: CostingStrategyKind;
  /** Resultado del nesting que se va a costear. */
  nesting: NestingResult<T>;
  /** Precio del sustrato por unidad (placa, pliego, etc.). */
  unitPrice: number;
  /** Cantidad total de piezas a producir (puede exceder piezasPorSustrato). */
  totalPieces: number;
  /** Cantidad de sustratos necesarios para producir totalPieces. */
  unitsNeeded: number;
  /**
   * Para m2-exact: medidas REALES de la pieza (sin demasía/sangrado),
   * para calcular el área que se cobra.
   * Si no se proveen, se infiere desde el primer placement (que puede
   * tener demasía aplicada — atención).
   */
  pieceWidthMm?: number;
  pieceHeightMm?: number;
  /** Para plate-segments: escalones de % ocupación (default [25, 50, 75, 100]). */
  segmentSteps?: number[];
}

export interface CostingResult {
  strategy: CostingStrategyKind;
  totalCost: number;
  breakdown: {
    unitPrice: number;
    pricePerM2: number;
    fullUnits: number;
    fullUnitsCost: number;
    lastUnit: {
      occupationPct: number;
      segmentApplied: number | null;
      cost: number;
    } | null;
    /** Desglose completo por hoja/placa cobrada. */
    units: Array<{
      index: number;
      occupationPct: number;
      segmentApplied: number | null;
      cost: number;
    }>;
  };
}
