/** Barrel export del módulo de nesting universal. */

export * from './types';
export { nestGrid2DSingle } from './algorithms/grid-2d-single';
export { evaluateGranFormatoMaxRectsRollLayout } from './algorithms/maxrects-rollo';
export {
  applyCostingStrategy,
  costingM2Exact,
  costingConsumedLength,
  costingPlateSegments,
  type CostingInput,
  type CostingResult,
  type CostingStrategyKind,
} from './costing';
