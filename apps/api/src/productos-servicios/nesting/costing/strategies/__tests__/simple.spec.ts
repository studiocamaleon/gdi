import { costingSimple } from '../simple';
import type { CostingInput } from '../../types';
import type { NestingResult } from '../../../types';

/** "Materia prima completa": todas las unidades que tocó, la última entera. */
describe('costingSimple', () => {
  const nesting: NestingResult = {
    algorithm: 'grid-2d-multi',
    substrates: [{ kind: 'sheet', count: 2, widthMm: 1220, heightMm: 2440 }],
    placements: [],
    metrics: {
      piezasPorSustrato: 1,
      aprovechamientoPct: 50,
      areaUtilMm2: 0,
      areaTotalMm2: 0,
    },
  };

  const base: CostingInput = {
    strategy: 'simple',
    nesting,
    unitPrice: 61600,
    totalPieces: 2,
    unitsNeeded: 2,
  };

  it('cobra unidades enteras × precio unitario, sin prorratear la última', () => {
    const r = costingSimple(base);
    expect(r.strategy).toBe('simple');
    expect(r.totalCost).toBe(123200);
    expect(r.breakdown.fullUnits).toBe(2);
    expect(r.breakdown.fullUnitsCost).toBe(123200);
    expect(r.breakdown.lastUnit).toBeNull();
  });

  it('una hoja a medio usar se paga entera (el caso del backlight)', () => {
    const r = costingSimple({ ...base, totalPieces: 1, unitsNeeded: 1 });
    expect(r.totalCost).toBe(61600);
    expect(r.breakdown.fullUnits).toBe(1);
  });

  it('no redondea el costo: paridad exacta con la fórmula del slot', () => {
    const r = costingSimple({ ...base, unitPrice: 214.876033, unitsNeeded: 63 });
    expect(r.totalCost).toBe(63 * 214.876033);
  });

  it('exige un sustrato sheet', () => {
    expect(() =>
      costingSimple({
        ...base,
        nesting: { ...nesting, substrates: [] },
      }),
    ).toThrow(/sheet/);
  });
});
