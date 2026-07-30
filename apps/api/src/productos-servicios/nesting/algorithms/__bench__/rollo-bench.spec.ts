/**
 * BENCHMARK rollo: shelf-rollo vs maxrects-rollo.
 *
 * Con `algorithm: 'auto'` el dispatcher corre LOS DOS y se queda con el
 * mejor (chooseBestRollLayout). La pregunta que responde este bench: ¿vale
 * pagar los dos, o uno gana siempre y el otro es peso muerto?
 *
 * NO corre en la suite normal. Se activa a mano:
 *   BENCH_NESTING=1 npx jest src/productos-servicios/nesting/algorithms/__bench__/rollo --silent=false
 */
import { evaluateGranFormatoMixedShelfLayout } from '../shelf-rollo';
import { evaluateGranFormatoMaxRectsRollLayout } from '../maxrects-rollo';
import type { EvaluateGranFormatoMixedShelfLayoutInput } from '../shelf-rollo';

/** Rollo de 1,50 m (lona/vinilo típico del tenant). */
function input(
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>,
  permitirRotacion = true,
): EvaluateGranFormatoMixedShelfLayoutInput {
  return {
    printableWidthMm: 1500,
    marginLeftMm: 0,
    marginStartMm: 0,
    marginEndMm: 0,
    separacionHorizontalMm: 5,
    separacionVerticalMm: 5,
    permitirRotacion,
    medidas,
  };
}

const CASOS: Array<{
  nombre: string;
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
}> = [
  {
    nombre: 'banner 100×200, x3',
    medidas: [{ anchoMm: 1000, altoMm: 2000, cantidad: 3 }],
  },
  {
    nombre: 'cartel chico 50×70, x20',
    medidas: [{ anchoMm: 500, altoMm: 700, cantidad: 20 }],
  },
  {
    nombre: 'mixto 2 medidas',
    medidas: [
      { anchoMm: 1000, altoMm: 700, cantidad: 4 },
      { anchoMm: 450, altoMm: 300, cantidad: 9 },
    ],
  },
  {
    nombre: 'mixto 4 medidas dispares',
    medidas: [
      { anchoMm: 1400, altoMm: 900, cantidad: 2 },
      { anchoMm: 620, altoMm: 480, cantidad: 7 },
      { anchoMm: 310, altoMm: 1100, cantidad: 5 },
      { anchoMm: 180, altoMm: 240, cantidad: 14 },
    ],
  },
  {
    nombre: 'pieza más ancha que el rollo (rota)',
    medidas: [{ anchoMm: 1800, altoMm: 600, cantidad: 4 }],
  },
  {
    nombre: 'volumen alto 30×40 x120',
    medidas: [{ anchoMm: 300, altoMm: 400, cantidad: 120 }],
  },
];

const describeBench = process.env.BENCH_NESTING ? describe : describe.skip;

describeBench('BENCH rollo — shelf vs maxrects (ancho 1500 mm)', () => {
  jest.setTimeout(120_000);

  it('compara largo consumido y tiempo', () => {
    // eslint-disable-next-line no-console
    console.log(
      '\n  caso                                shelf(mm)   maxrects(mm)   gana        Δ',
    );
    let ganaMaxrects = 0;
    let ganaShelf = 0;
    let empata = 0;
    let msShelfTotal = 0;
    let msMaxTotal = 0;

    for (const caso of CASOS) {
      const t0 = performance.now();
      const shelf = evaluateGranFormatoMixedShelfLayout(input(caso.medidas));
      const msShelf = performance.now() - t0;
      const t1 = performance.now();
      const max = evaluateGranFormatoMaxRectsRollLayout(input(caso.medidas));
      const msMax = performance.now() - t1;
      msShelfTotal += msShelf;
      msMaxTotal += msMax;

      const lShelf = shelf?.consumedLengthMm ?? null;
      const lMax = max?.consumedLengthMm ?? null;
      let gana = '—';
      let delta = '';
      if (lShelf != null && lMax != null) {
        const diff = lShelf - lMax;
        if (Math.abs(diff) <= 1) {
          gana = 'empate';
          empata++;
        } else if (diff > 0) {
          gana = 'maxrects';
          ganaMaxrects++;
          delta = `-${diff.toFixed(0)} mm`;
        } else {
          gana = 'SHELF';
          ganaShelf++;
          delta = `-${(-diff).toFixed(0)} mm`;
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `  ${caso.nombre.padEnd(34)} ${String(lShelf ?? '—').padStart(8)}   ` +
          `${String(lMax ?? '—').padStart(10)}   ${gana.padEnd(9)} ${delta}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      `\n  → gana maxrects: ${ganaMaxrects} · gana shelf: ${ganaShelf} · empatan: ${empata}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  → tiempo total  shelf: ${msShelfTotal.toFixed(0)} ms · maxrects: ${msMaxTotal.toFixed(0)} ms`,
    );
  });
});
