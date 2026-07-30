/**
 * BENCHMARK (temporal, no es un test de regresión): mide cuánto tarda
 * cada algoritmo de acomodo con las medidas reales de los productos del
 * tenant. Se corre a mano:
 *
 *   npx jest src/productos-servicios/nesting/algorithms/__bench__ --silent=false
 *
 * Motivo: sospecha de que packingsolver-rectangle es el que hace lenta la
 * cotización en el sheet de agregar producto.
 */
import { nestPackingSolverRectangle } from '../packingsolver-rectangle';
import { nestGrid2DMulti } from '../grid-2d-multi';
import { nestGrid2DSingle } from '../grid-2d-single';

// Placa real del tenant: PVC espumado 1220 × 2440 mm.
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

/** Cartel típico de 100 × 70 cm. */
function piezasUniformes(cantidad: number) {
  return [
    { id: 'cartel', widthMm: 1000, heightMm: 700, quantity: cantidad },
  ];
}

/** Trabajo mezclado: tres medidas distintas (el caso de grid-2d-multi). */
function piezasMixtas(cantidad: number) {
  return [
    { id: 'a', widthMm: 1000, heightMm: 700, quantity: cantidad },
    { id: 'b', widthMm: 600, heightMm: 400, quantity: cantidad },
    { id: 'c', widthMm: 300, heightMm: 300, quantity: cantidad * 2 },
  ];
}

async function medir(nombre: string, fn: () => unknown | Promise<unknown>) {
  const t0 = performance.now();
  const resultado = await fn();
  const ms = performance.now() - t0;
  const nulo = resultado === null ? "  ⚠️ devolvió null" : "";
  // eslint-disable-next-line no-console
  console.log(`  ${nombre.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms${nulo}`);
  return ms;
}

// Sin BENCH_NESTING la suite lo saltea: el caso difícil tarda ~2 minutos.
const describeBench = process.env.BENCH_NESTING ? describe : describe.skip;

describeBench('BENCH acomodo — placa PVC 1220×2440', () => {
  jest.setTimeout(120_000);

  it('piezas uniformes (5 carteles de 100×70)', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── 5 piezas iguales ──');
    await medir('grid-2d-single', () =>
      nestGrid2DSingle(
        { widthMm: 1000, heightMm: 700, quantity: 5 },
        PLACA,
        OPCIONES,
      ),
    );
    await medir('grid-2d-multi', () =>
      nestGrid2DMulti(piezasUniformes(5), PLACA, OPCIONES),
    );
    await medir('packingsolver-rectangle', () =>
      nestPackingSolverRectangle(piezasUniformes(5), PLACA, OPCIONES),
    );
  });

  it('piezas mixtas (3 medidas)', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── piezas mixtas (12 unidades, 3 medidas) ──');
    await medir('grid-2d-multi', () =>
      nestGrid2DMulti(piezasMixtas(3), PLACA, OPCIONES),
    );
    await medir('packingsolver-rectangle', () =>
      nestPackingSolverRectangle(piezasMixtas(3), PLACA, OPCIONES),
    );
  });

  it('volumen alto (50 carteles → varias placas)', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── 50 piezas iguales ──');
    await medir('grid-2d-multi', () =>
      nestGrid2DMulti(piezasUniformes(50), PLACA, OPCIONES),
    );
    await medir('packingsolver-rectangle', () =>
      nestPackingSolverRectangle(piezasUniformes(50), PLACA, OPCIONES),
    );
  });

  it('CALIDAD: ¿packingsolver acomoda mejor que grid-2d-multi?', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── calidad: placas usadas y aprovechamiento ──');
    const casos: Array<[string, ReturnType<typeof piezasMixtas>]> = [
      ['5 iguales', piezasUniformes(5)],
      ['12 mixtas', piezasMixtas(3)],
      ['50 iguales', piezasUniformes(50)],
      ['40 mixtas', piezasMixtas(10)],
    ];
    for (const [nombre, piezas] of casos) {
      const multi = nestGrid2DMulti(piezas, PLACA, OPCIONES);
      const ps = await nestPackingSolverRectangle(piezas, PLACA, OPCIONES);
      const placasMulti = multi.substrates.reduce((a, s) => a + s.count, 0);
      const placasPs =
        ps?.substrates.reduce((a, s) => a + (s.kind === 'sheet' ? s.count : 0), 0) ??
        null;
      // eslint-disable-next-line no-console
      console.log(
        `  ${nombre.padEnd(12)} multi: ${String(placasMulti).padStart(2)} placas / ` +
          `${multi.metrics.aprovechamientoPct.toFixed(1).padStart(5)}%   ` +
          `packingsolver: ${String(placasPs ?? '—').padStart(2)} placas / ` +
          `${(ps?.metrics.aprovechamientoPct ?? 0).toFixed(1).padStart(5)}%`,
      );
    }
  });

  it('CALIDAD en caso DIFÍCIL (7 medidas dispares, donde un solver debería brillar)', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── caso difícil: 7 medidas irregulares ──');
    const dificil = [
      { id: 'p1', widthMm: 980, heightMm: 660, quantity: 3 },
      { id: 'p2', widthMm: 470, heightMm: 830, quantity: 5 },
      { id: 'p3', widthMm: 310, heightMm: 290, quantity: 11 },
      { id: 'p4', widthMm: 725, heightMm: 190, quantity: 7 },
      { id: 'p5', widthMm: 155, heightMm: 1140, quantity: 4 },
      { id: 'p6', widthMm: 640, heightMm: 640, quantity: 6 },
      { id: 'p7', widthMm: 95, heightMm: 210, quantity: 23 },
    ];
    const t0 = performance.now();
    const multi = nestGrid2DMulti(dificil, PLACA, OPCIONES);
    const msMulti = performance.now() - t0;
    const t1 = performance.now();
    const ps = await nestPackingSolverRectangle(dificil, PLACA, OPCIONES);
    const msPs = performance.now() - t1;
    const placasMulti = multi.substrates.reduce((a, s) => a + s.count, 0);
    const placasPs =
      ps?.substrates.reduce((a, s) => a + (s.kind === 'sheet' ? s.count : 0), 0) ?? 0;
    // eslint-disable-next-line no-console
    console.log(
      `  grid-2d-multi         ${placasMulti} placas / ` +
        `${multi.metrics.aprovechamientoPct.toFixed(1)}%  en ${msMulti.toFixed(0)} ms`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  packingsolver         ${placasPs} placas / ` +
        `${(ps?.metrics.aprovechamientoPct ?? 0).toFixed(1)}%  en ${msPs.toFixed(0)} ms`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  → packingsolver ahorra ${placasMulti - placasPs} placa(s) y cuesta ` +
        `${(msPs - msMulti).toFixed(0)} ms extra`,
    );
  });

  it('packingsolver con distintos time-limit', async () => {
    // eslint-disable-next-line no-console
    console.log('\n── packingsolver: efecto del --time-limit ──');
    for (const timeLimitSec of [0.2, 0.5, 1, 2]) {
      await medir(`time-limit ${timeLimitSec}s`, () =>
        nestPackingSolverRectangle(piezasMixtas(3), PLACA, {
          ...OPCIONES,
          timeLimitSec,
        }),
      );
    }
  });
});
