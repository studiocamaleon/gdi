import { costingConsumedLength } from '../consumed-length';

describe('costingConsumedLength', () => {
  it('mantiene completos los márgenes al costear la última fila parcial', () => {
    const result = costingConsumedLength({
      strategy: 'consumed-length',
      nesting: {
        algorithm: 'grid-2d-single',
        substrates: [{ kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 }],
        placements: [
          {
            pieceId: 'p',
            xMm: 0,
            yMm: 10,
            widthMm: 50,
            heightMm: 30,
            rotated: false,
          },
          {
            pieceId: 'p',
            xMm: 50,
            yMm: 10,
            widthMm: 50,
            heightMm: 30,
            rotated: false,
          },
          {
            pieceId: 'p',
            xMm: 0,
            yMm: 50,
            widthMm: 50,
            heightMm: 30,
            rotated: false,
          },
          {
            pieceId: 'p',
            xMm: 50,
            yMm: 50,
            widthMm: 50,
            heightMm: 30,
            rotated: false,
          },
        ],
        metrics: {
          columnas: 2,
          filas: 2,
          piezasPorSustrato: 4,
          aprovechamientoPct: 60,
          areaUtilMm2: 6000,
          areaTotalMm2: 10000,
          largoConsumidoMm: 90,
          trailingMarginMm: 10,
        },
      },
      unitPrice: 100,
      totalPieces: 2,
      unitsNeeded: 1,
    });

    // 10 mm iniciales + 30 de pieza + 10 finales = 50%.
    expect(result.totalCost).toBe(50);
    expect(result.breakdown.lastUnit?.occupationPct).toBe(50);
  });

  it('costea cada placa multi-medida desde sus placements y nunca cae a cero', () => {
    const result = costingConsumedLength({
      strategy: 'consumed-length',
      nesting: {
        algorithm: 'grid-2d-multi',
        substrates: [
          { kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 },
          { kind: 'sheet', count: 1, widthMm: 100, heightMm: 100 },
        ],
        placements: [
          {
            pieceId: 'a',
            substrateIndex: 0,
            xMm: 0,
            yMm: 10,
            widthMm: 80,
            heightMm: 50,
            rotated: false,
          },
          {
            pieceId: 'b',
            substrateIndex: 1,
            xMm: 0,
            yMm: 10,
            widthMm: 40,
            heightMm: 20,
            rotated: false,
          },
        ],
        metrics: {
          aprovechamientoPct: 24,
          areaUtilMm2: 4800,
          areaTotalMm2: 20000,
          trailingMarginMm: 10,
        },
      },
      unitPrice: 100,
      totalPieces: 2,
      unitsNeeded: 2,
    });

    expect(result.totalCost).toBe(110);
    expect(result.breakdown.units).toEqual([
      { index: 0, occupationPct: 70, segmentApplied: null, cost: 70 },
      { index: 1, occupationPct: 40, segmentApplied: null, cost: 40 },
    ]);
  });

  it('mide el largo consumido sobre el lado mayor de una placa apaisada', () => {
    const result = costingConsumedLength({
      strategy: 'consumed-length',
      nesting: {
        algorithm: 'grid-2d-multi',
        substrates: [{ kind: 'sheet', count: 1, widthMm: 1300, heightMm: 900 }],
        placements: [
          {
            pieceId: 'pieza',
            substrateIndex: 0,
            xMm: 5,
            yMm: 5,
            widthMm: 500,
            heightMm: 700,
            rotated: false,
          },
        ],
        metrics: {
          trailingMarginMm: 5,
          aprovechamientoPct: 0,
          areaUtilMm2: 350_000,
          areaTotalMm2: 1_170_000,
        },
      },
      unitPrice: 1000,
      totalPieces: 1,
      unitsNeeded: 1,
    });

    expect(result.breakdown.units).toEqual([
      {
        index: 0,
        occupationPct: 39.23,
        segmentApplied: null,
        cost: 392.31,
      },
    ]);
  });
});
