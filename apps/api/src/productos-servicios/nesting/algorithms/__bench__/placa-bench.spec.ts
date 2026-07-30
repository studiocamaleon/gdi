/**
 * BENCHMARK de acomodo en PLACA/PLIEGO (no es un test de regresión).
 *
 * NO corre en la suite normal. Se activa a mano:
 *   BENCH_NESTING=1 npx jest src/productos-servicios/nesting/algorithms/__bench__ --silent=false
 *
 * Contexto histórico (2026-07-30): este bench nació para detectar por qué la
 * cotización era lenta. Midió `packingsolver-rectangle` contra `grid-2d-multi`
 * con las medidas reales del tenant y encontró:
 *
 *   grid-2d-single / grid-2d-multi        0-2 ms
 *   packingsolver-rectangle           2.000-3.200 ms (casos simples)
 *   packingsolver-rectangle             108.000 ms (7 medidas dispares)
 *
 * …con resultado IDÉNTICO en los 5 escenarios (mismas placas, mismo
 * aprovechamiento). El binario respetaba su `--time-limit` de 2 s: el costo
 * venía de `compactResultWithOpenDimensionY`, que re-invocaba el solver una
 * vez por placa y por cada combinación de redistribución. Por eso el
 * algoritmo se retiró y el acomodo en placa quedó en grid-2d-multi.
 */
import { nestGrid2DMulti } from '../grid-2d-multi';
import { nestGrid2DSingle } from '../grid-2d-single';

/** Placa real del tenant: PVC espumado 1220 × 2440 mm. */
const PLACA = {
  kind: 'sheet' as const,
  widthMm: 1220,
  heightMm: 2440,
  margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
};

const OPCIONES = {
  separationHMm: 3,
  separationVMm: 3,
  allowRotation: true,
};

function piezasUniformes(cantidad: number) {
  return [{ id: 'cartel', widthMm: 1000, heightMm: 700, quantity: cantidad }];
}

function piezasMixtas(cantidad: number) {
  return [
    { id: 'a', widthMm: 1000, heightMm: 700, quantity: cantidad },
    { id: 'b', widthMm: 600, heightMm: 400, quantity: cantidad },
    { id: 'c', widthMm: 300, heightMm: 300, quantity: cantidad * 2 },
  ];
}

/** Caso peor conocido: 7 medidas irregulares, 59 piezas. */
const DIFICIL = [
  { id: 'p1', widthMm: 980, heightMm: 660, quantity: 3 },
  { id: 'p2', widthMm: 470, heightMm: 830, quantity: 5 },
  { id: 'p3', widthMm: 310, heightMm: 290, quantity: 11 },
  { id: 'p4', widthMm: 725, heightMm: 190, quantity: 7 },
  { id: 'p5', widthMm: 155, heightMm: 1140, quantity: 4 },
  { id: 'p6', widthMm: 640, heightMm: 640, quantity: 6 },
  { id: 'p7', widthMm: 95, heightMm: 210, quantity: 23 },
];

function medir(nombre: string, fn: () => unknown) {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`  ${nombre.padEnd(34)} ${ms.toFixed(1).padStart(7)} ms`);
  return ms;
}

const describeBench = process.env.BENCH_NESTING ? describe : describe.skip;

describeBench('BENCH acomodo en placa — PVC 1220×2440', () => {
  jest.setTimeout(60_000);

  it('tiempo por escenario', () => {
    // eslint-disable-next-line no-console
    console.log('\n── tiempos ──');
    medir('single · 5 piezas iguales', () =>
      nestGrid2DSingle(
        { widthMm: 1000, heightMm: 700, quantity: 5 },
        PLACA,
        OPCIONES,
      ),
    );
    medir('multi · 5 piezas iguales', () =>
      nestGrid2DMulti(piezasUniformes(5), PLACA, OPCIONES),
    );
    medir('multi · 12 mixtas', () =>
      nestGrid2DMulti(piezasMixtas(3), PLACA, OPCIONES),
    );
    medir('multi · 50 iguales', () =>
      nestGrid2DMulti(piezasUniformes(50), PLACA, OPCIONES),
    );
    medir('multi · 59 piezas, 7 medidas', () =>
      nestGrid2DMulti(DIFICIL, PLACA, OPCIONES),
    );
  });

  it('calidad del acomodo (placas usadas y aprovechamiento)', () => {
    // eslint-disable-next-line no-console
    console.log('\n── calidad ──');
    const casos: Array<[string, ReturnType<typeof piezasMixtas>]> = [
      ['5 iguales', piezasUniformes(5)],
      ['12 mixtas', piezasMixtas(3)],
      ['50 iguales', piezasUniformes(50)],
      ['59 / 7 medidas', DIFICIL],
    ];
    for (const [nombre, piezas] of casos) {
      const multi = nestGrid2DMulti(piezas, PLACA, OPCIONES);
      const placas = multi.substrates.reduce((a, s) => a + s.count, 0);
      // eslint-disable-next-line no-console
      console.log(
        `  ${nombre.padEnd(18)} ${String(placas).padStart(2)} placas / ` +
          `${multi.metrics.aprovechamientoPct.toFixed(1)}%`,
      );
    }
  });
});
