import { costingM2Exact } from '../m2-exact';

describe('costingM2Exact', () => {
  it('cobra el área de las piezas × precio/m² derivado de la placa', () => {
    const result = costingM2Exact({
      strategy: 'm2-exact',
      unitPrice: 1000, // la placa de 1 m² cuesta $1000 → $1000/m²
      totalPieces: 1,
      unitsNeeded: 1,
      nesting: {
        algorithm: 'grid-2d-single',
        substrates: [{ kind: 'sheet', count: 1, widthMm: 1000, heightMm: 1000 }],
        placements: [
          {
            pieceId: 'pieza_0',
            substrateIndex: 0,
            xMm: 0,
            yMm: 0,
            widthMm: 500,
            heightMm: 500,
            rotated: false,
          },
        ],
        metrics: {
          aprovechamientoPct: 25,
          areaUtilMm2: 250_000,
          areaTotalMm2: 1_000_000,
        },
      },
    });

    // 0,25 m² × $1000/m² — el 75% restante de la placa no se cobra.
    expect(result.totalCost).toBe(250);
    expect(result.breakdown.pricePerM2).toBe(1000);
  });

  it('con medidas reales de pieza ignora la demasía de los placements', () => {
    const result = costingM2Exact({
      strategy: 'm2-exact',
      unitPrice: 1000,
      totalPieces: 4,
      unitsNeeded: 1,
      pieceWidthMm: 500,
      pieceHeightMm: 500,
      nesting: {
        algorithm: 'grid-2d-single',
        substrates: [{ kind: 'sheet', count: 1, widthMm: 2000, heightMm: 1000 }],
        // el placement trae demasía (520×520): NO debe usarse para el área
        placements: [
          {
            pieceId: 'pieza_0',
            substrateIndex: 0,
            xMm: 0,
            yMm: 0,
            widthMm: 520,
            heightMm: 520,
            rotated: false,
          },
        ],
        metrics: {
          aprovechamientoPct: 50,
          areaUtilMm2: 1_000_000,
          areaTotalMm2: 2_000_000,
        },
      },
    });

    // 4 piezas × 0,25 m² × $500/m² (placa de 2 m² a $1000)
    expect(result.totalCost).toBe(500);
  });

  it('rechaza sustratos que no son placa: en rollo el costeo lo define el consumo', () => {
    expect(() =>
      costingM2Exact({
        strategy: 'm2-exact',
        unitPrice: 12,
        totalPieces: 1,
        unitsNeeded: 1,
        nesting: {
          algorithm: 'shelf-rollo',
          substrates: [{ kind: 'roll', widthMm: 1500, lengthMm: 1000 }],
          placements: [],
          metrics: {
            aprovechamientoPct: 0,
            areaUtilMm2: 0,
            areaTotalMm2: 1_500_000,
          },
        },
      }),
    ).toThrow('sheet substrate');
  });
});
