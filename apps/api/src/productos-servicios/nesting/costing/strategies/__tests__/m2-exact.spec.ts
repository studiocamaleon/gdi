import { costingM2Exact } from '../m2-exact';

describe('costingM2Exact', () => {
  it('en placa deriva el precio/m² del sustrato y cobra el área de las piezas', () => {
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

    // 0,25 m² × $1000/m² — el 75% de placa sobrante no se cobra.
    expect(result.totalCost).toBe(250);
    expect(result.breakdown.pricePerM2).toBe(1000);
  });

  it('en ROLLO con pricePerM2Override cobra sólo los m² de las piezas (sin desperdicio)', () => {
    // Rollo de 1500 mm de ancho; el acomodo consumió 2000 mm de largo
    // (3 m² consumidos) pero las piezas suman 1 m². Con override de
    // $800/m², "no cobrar el desperdicio" = $800.
    const result = costingM2Exact({
      strategy: 'm2-exact',
      unitPrice: 12, // por metro lineal — NO debe usarse para el /m²
      totalPieces: 2,
      unitsNeeded: 1,
      pricePerM2Override: 800,
      nesting: {
        algorithm: 'shelf-rollo',
        substrates: [{ kind: 'roll', widthMm: 1500, lengthMm: 2000 }],
        placements: [
          {
            pieceId: 'pieza_0',
            substrateIndex: 0,
            xMm: 0,
            yMm: 0,
            widthMm: 1000,
            heightMm: 500,
            rotated: false,
          },
          {
            pieceId: 'pieza_1',
            substrateIndex: 0,
            xMm: 0,
            yMm: 500,
            widthMm: 1000,
            heightMm: 500,
            rotated: false,
          },
        ],
        metrics: {
          aprovechamientoPct: 33.3,
          areaUtilMm2: 1_000_000,
          areaTotalMm2: 3_000_000,
        },
      },
    });

    expect(result.totalCost).toBe(800);
    expect(result.breakdown.pricePerM2).toBe(800);
  });

  it('en ROLLO con medidas reales de pieza usa piezas × medida (sin demasía)', () => {
    const result = costingM2Exact({
      strategy: 'm2-exact',
      unitPrice: 12,
      totalPieces: 4,
      unitsNeeded: 1,
      pricePerM2Override: 1000,
      pieceWidthMm: 500,
      pieceHeightMm: 500,
      nesting: {
        algorithm: 'maxrects-rollo',
        substrates: [{ kind: 'roll', widthMm: 1500, lengthMm: 1200 }],
        // los placements traen demasía (520×520): NO deben usarse
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
          aprovechamientoPct: 60,
          areaUtilMm2: 1_000_000,
          areaTotalMm2: 1_800_000,
        },
      },
    });

    // 4 piezas × 0,25 m² × $1000/m²
    expect(result.totalCost).toBe(1000);
  });

  it('en ROLLO sin override sigue rechazando (comportamiento previo)', () => {
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
