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

  it('asocia el escalón de cada placa con sus placements físicos', () => {
    const firstPlate = [
      [5, 5],
      [605, 5],
      [5, 405],
      [605, 405],
    ].map(([xMm, yMm], index) => ({
      pieceId: `pieza_${index}`,
      substrateIndex: 0,
      xMm,
      yMm,
      widthMm: 600,
      heightMm: 400,
      rotated: false,
    }));
    const result = costingPlateSegments({
      strategy: 'plate-segments',
      unitPrice: 1000,
      totalPieces: 5,
      unitsNeeded: 2,
      segmentSteps: [15, 30, 45, 60, 75, 90, 100],
      nesting: {
        algorithm: 'grid-2d-single',
        substrates: [
          { kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 },
          { kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 },
        ],
        placements: [
          ...firstPlate,
          {
            pieceId: 'pieza_4',
            substrateIndex: 1,
            xMm: 5,
            yMm: 5,
            widthMm: 600,
            heightMm: 400,
            rotated: false,
          },
        ],
        metrics: {
          columnas: 2,
          filas: 2,
          piezasPorSustrato: 4,
          trailingMarginMm: 5,
          aprovechamientoPct: 41.03,
          areaUtilMm2: 1_200_000,
          areaTotalMm2: 2_340_000,
        },
      },
    });

    expect(result.breakdown.units).toEqual([
      { index: 0, occupationPct: 90, segmentApplied: 90, cost: 900 },
      {
        index: 1,
        occupationPct: 45.56,
        segmentApplied: 60,
        cost: 600,
      },
    ]);
    expect(result.totalCost).toBe(1500);
  });
});
