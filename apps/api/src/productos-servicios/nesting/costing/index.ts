/** Barrel export del submódulo de costing. */

export * from './types';
export { costingM2Exact } from './strategies/m2-exact';
export { costingConsumedLength } from './strategies/consumed-length';
export { costingPlateSegments } from './strategies/plate-segments';

import type { CostingInput, CostingResult } from './types';
import { costingM2Exact } from './strategies/m2-exact';
import { costingConsumedLength } from './strategies/consumed-length';
import { costingPlateSegments } from './strategies/plate-segments';

export function applyCostingStrategy<T = unknown>(
  input: CostingInput<T>,
): CostingResult {
  switch (input.strategy) {
    case 'm2-exact':
      return costingM2Exact(input);
    case 'consumed-length':
      return costingConsumedLength(input);
    case 'plate-segments':
      return costingPlateSegments(input);
    default: {
      const exhaustive: never = input.strategy;
      void exhaustive;
      throw new Error('Unknown costing strategy');
    }
  }
}
