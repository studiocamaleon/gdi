import { costingPlateSegments } from '../plate-segments';

describe('costingPlateSegments', () => {
  it('costea grid multi por largo consumido de cada placa', () => {
    const result = costingPlateSegments({
      strategy: 'plate-segments',
      unitPrice: 1000,
      totalPieces: 2,
      unitsNeeded: 2,
      segmentSteps: [25, 50, 75, 100],
      nesting: {
        algorithm: 'grid-2d-multi',
        substrates: [
          { kind: 'sheet', count: 1, widthMm: 1000, heightMm: 1000 },
          { kind: 'sheet', count: 1, widthMm: 1000, heightMm: 1000 },
        ],
        placements: [
          {
            pieceId: 'pieza_0',
            substrateIndex: 0,
            xMm: 0,
            yMm: 0,
            widthMm: 800,
            heightMm: 500,
            rotated: false,
          },
          {
            pieceId: 'pieza_1',
            substrateIndex: 1,
            xMm: 0,
            yMm: 0,
            widthMm: 300,
            heightMm: 500,
            rotated: false,
          },
        ],
        metrics: {
          aprovechamientoPct: 27.5,
          areaUtilMm2: 550_000,
          areaTotalMm2: 2_000_000,
        },
      },
    });

    expect(result.totalCost).toBe(1000);
    expect(result.breakdown.fullUnits).toBe(0);
    expect(result.breakdown.lastUnit).toMatchObject({
      occupationPct: 50,
      segmentApplied: 50,
      cost: 500,
    });
  });
});
