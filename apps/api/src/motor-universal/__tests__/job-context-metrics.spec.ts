import { calcularPerimetroPiezasM } from '../job-context-metrics';

describe('calcularPerimetroPiezasM', () => {
  it('calcula el perímetro rectangular total de piezas en metros', () => {
    expect(
      calcularPerimetroPiezasM({
        piezas: [
          { cantidad: 2, anchoMm: 1000, altoMm: 500 },
          { cantidad: 1, anchoMm: 200, altoMm: 300 },
        ],
      }),
    ).toBeCloseTo(7, 6);
  });

  it('respeta un perímetro explícito por pieza cuando existe', () => {
    expect(
      calcularPerimetroPiezasM({
        piezas: [{ cantidad: 3, anchoMm: 1000, altoMm: 500, perimetroMm: 2500 }],
      }),
    ).toBeCloseTo(7.5, 6);
  });
});
