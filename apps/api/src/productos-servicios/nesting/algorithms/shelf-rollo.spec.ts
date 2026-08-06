import {
  evaluateGranFormatoMixedShelfLayout,
  MAX_PIEZAS_BUSQUEDA_EXHAUSTIVA,
  type EvaluateGranFormatoMixedShelfLayoutInput,
} from './shelf-rollo';
import { evaluateGranFormatoMaxRectsRollLayout } from './maxrects-rollo';

function input(
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>,
  permitirRotacion = true,
): EvaluateGranFormatoMixedShelfLayoutInput {
  return {
    printableWidthMm: 1290,
    marginLeftMm: 5,
    marginStartMm: 10,
    marginEndMm: 10,
    separacionHorizontalMm: 5,
    separacionVerticalMm: 5,
    permitirRotacion,
    medidas: medidas.map((m, i) => ({ id: `m${i}`, ...m })),
  };
}

describe('shelf-rollo a granel (camino greedy)', () => {
  it('5000 piezas homogéneas: termina en segundos y con densidad de grilla', () => {
    const t0 = Date.now();
    const result = evaluateGranFormatoMixedShelfLayout(
      input([{ anchoMm: 90, altoMm: 50, cantidad: 5000 }]),
    );
    const elapsedMs = Date.now() - t0;

    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(5000);
    // El beam (cuando terminaba) daba ~6,7 mm de largo por pieza acá; la
    // grilla uniforme óptima da ~4,1 (rotada, 23 por fila). Toleramos 5.
    const largoPorPieza = (result!.consumedLengthMm - 20) / 5000;
    expect(largoPorPieza).toBeLessThan(5);
    // Cota generosa: el beam tardaba minutos con esta cantidad.
    expect(elapsedMs).toBeLessThan(3000);
  });

  it('mezcla heterogénea sobre el tope: termina y coloca todas las piezas', () => {
    const medidas = [
      { anchoMm: 600, altoMm: 400, cantidad: 120 },
      { anchoMm: 300, altoMm: 200, cantidad: 150 },
      { anchoMm: 90, altoMm: 50, cantidad: 300 },
    ];
    const total = medidas.reduce((acc, m) => acc + m.cantidad, 0);
    expect(total).toBeGreaterThan(MAX_PIEZAS_BUSQUEDA_EXHAUSTIVA);

    const t0 = Date.now();
    const result = evaluateGranFormatoMixedShelfLayout(input(medidas));
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(total);
    // Ninguna pieza fuera del ancho útil.
    for (const p of result!.placements) {
      expect(p.centerXMm + p.widthMm / 2).toBeLessThanOrEqual(1290 + 5 + 0.01);
    }
  });

  it('caso chico: el greedy compite pero no rompe el resultado del beam', () => {
    // 6 piezas de 500×700 en rollo de 1290: entran 2 por fila (o rotadas no
    // entran mejor). El resultado debe seguir siendo un layout válido con
    // las 6 piezas y largo acotado.
    const result = evaluateGranFormatoMixedShelfLayout(
      input([{ anchoMm: 500, altoMm: 700, cantidad: 6 }]),
    );
    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(6);
    // Rotada (700 de ancho) entra UNA sola por fila (700+5+700 > 1290), así
    // que lo óptimo es sin rotar: 3 filas × 700 + 2×5 sep + 20 márgenes
    // = 2130 (igual que daba el beam solo).
    expect(result!.consumedLengthMm).toBeLessThanOrEqual(2130);
  });

  it('pieza que no entra al ancho ni rotada: devuelve null (sin colgarse)', () => {
    const result = evaluateGranFormatoMixedShelfLayout(
      input([{ anchoMm: 2000, altoMm: 1500, cantidad: 250 }]),
    );
    expect(result).toBeNull();
  });
});

describe('maxrects-rollo a granel', () => {
  it('sobre el tope devuelve null y deja que gane el shelf', () => {
    const result = evaluateGranFormatoMaxRectsRollLayout(
      input([{ anchoMm: 90, altoMm: 50, cantidad: 5000 }]),
    );
    expect(result).toBeNull();
  });

  it('bajo el tope sigue funcionando', () => {
    const result = evaluateGranFormatoMaxRectsRollLayout(
      input([{ anchoMm: 500, altoMm: 700, cantidad: 6 }]),
    );
    expect(result).not.toBeNull();
    expect(result!.placements).toHaveLength(6);
  });
});
