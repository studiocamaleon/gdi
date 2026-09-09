/* Comparación secuencial y fría con el mismo presupuesto por variante.
 * No usa base de datos ni modifica los nestings comerciales.
 * PACKINGSOLVER_BIN=... node .../grafonest-corpus.cjs exhibidor.json salida [ms]
 * GRAFONEST_CORPUS_CASOS permite seleccionar nombres separados por coma.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validarEntradaNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const out = path.resolve(process.argv[3]);
const budget = Number(process.argv[4] || 15000);
const exhibidor = JSON.parse(fs.readFileSync(process.argv[2]));
const puma = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/workers/geometria/fixtures/puma-200cm.json'))).entrada;
if (!process.env.PACKINGSOLVER_BIN) throw new Error('Falta PACKINGSOLVER_BIN.');
const puntos = (a) => a.map(([x, y]) => ({ x, y }));
const base = (name, piezas, placa = {}) => ({ schemaVersion: 1, tenantId: 'corpus-aislado',
  correlationId: name, solicitadoEl: '2026-09-09', motor: 'collision', semilla: 7,
  timeoutMs: budget, separacionMm: 0, placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 100, ...placa }, piezas });
const triangles = (cantidad = 1) => ['a', 'b'].map((id) => ({ id, cantidad, rotaciones: 4,
  contorno: puntos([[0, 0], [100, 0], [0, 100]]) }));
const cases = new Map([['puma', puma]]);
for (const n of [1, 25, 50, 100, 101, 200]) cases.set(`exhibidor-${n}`, {
  ...exhibidor, piezas: exhibidor.piezas.map((p) => ({ ...p, cantidad: p.cantidad * n / 100 })),
});
cases.set('concavidad', base('concavidad', ['a', 'b'].map((id) => ({ id, cantidad: 3, rotaciones: 4,
  contorno: puntos([[0, 0], [100, 0], [100, 30], [30, 30], [30, 100], [0, 100]]) }))));
cases.set('hueco-ocupado', { ...base('hueco-ocupado', [
  { id: 'marco', cantidad: 1, rotaciones: 4, contorno: puntos([[0, 0], [60, 0], [60, 60], [0, 60]]),
    huecos: [puntos([[5, 5], [55, 5], [55, 55], [5, 55]])] },
  { id: 'interior', cantidad: 1, rotaciones: 4, contorno: puntos([[0, 0], [44, 0], [44, 44], [0, 44]]) },
], { anchoMm: 80, altoMm: 80, margenMm: 2 }), separacionMm: 1 });
cases.set('giro-fijo-separacion', { ...base('giro-fijo-separacion', triangles(4).map((p) => ({ ...p, rotaciones: 1 })),
  { anchoMm: 230, altoMm: 140, margenMm: 5 }), separacionMm: 3 });
cases.set('limite-una-placa', base('limite-una-placa', triangles(), { maxPlacas: 1 }));
cases.set('common-line', { ...base('common-line', triangles(4), { anchoMm: 204, altoMm: 104, margenMm: 1 }),
  separacionMm: 1, commonLine: { habilitado: true, anchoCorteMm: 1, longitudMinimaMm: 10, toleranciaMm: 0.01 } });
cases.set('200-formas-unicas', base('200-formas-unicas', Array.from({ length: 200 }, (_, i) => {
  const w = 13 + i * 0.023, h = 18 + (i % 31) * 0.1;
  return { id: `unica-${i}`, cantidad: 1, rotaciones: 4,
    contorno: puntos([[0, 0], [w, 0], [w, h * 0.35], [w * 0.4, h * 0.35], [w * 0.4, h], [0, h]]) };
}), { anchoMm: 300, altoMm: 200, margenMm: 2 }));
fs.mkdirSync(out, { recursive: true });
const selected = process.env.GRAFONEST_CORPUS_CASOS?.split(',');
const results = [];
for (const [index, [name, raw]] of [...cases].entries()) {
  if (selected && !selected.includes(name)) continue;
  const input = { ...raw, timeoutMs: budget };
  validarEntradaNestingOpenNest(input);
  const folder = path.join(out, name);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'entrada.json');
  fs.writeFileSync(file, JSON.stringify(input));
  const row = { caso: name, presupuestoMs: budget, variantes: {} };
  // Alternar el orden evita que una variante siempre corra después de la otra.
  for (const variant of index % 2 ? ['actual', 'nativo'] : ['nativo', 'actual']) {
    const log = fs.openSync(path.join(folder, `${variant}.log`), 'w');
    const child = spawnSync(process.execPath, [path.join(__dirname, 'grafonest-portafolio.cjs'), file,
      path.join(folder, variant), String(budget)], { env: { ...process.env,
      GRAFONEST_PACKINGSOLVER_ENABLED: variant === 'nativo' ? '1' : '0' },
      stdio: ['ignore', log, log], timeout: budget + 60000 });
    fs.closeSync(log);
    const measured = path.join(folder, variant, 'mediciones.json');
    row.variantes[variant] = child.status === 0 && fs.existsSync(measured)
      ? JSON.parse(fs.readFileSync(measured)) : { error: child.error?.message || `Salida ${child.status}, señal ${child.signal}` };
    console.log(JSON.stringify({ caso: name, variante: variant, ...row.variantes[variant] }));
  }
  const a = row.variantes.actual, b = row.variantes.nativo;
  row.comparacion = a.error && !b.error && name === 'limite-una-placa' ? 'resuelto-por-nativo'
    : a.error || b.error ? 'error' : b.placas < a.placas || b.placas === a.placas && b.patrones < a.patrones
    ? 'mejora' : b.placas === a.placas && b.patrones === a.patrones ? 'empate' : 'regresion';
  results.push(row);
  fs.writeFileSync(path.join(out, 'comparacion.json'), JSON.stringify(results, null, 2));
}
if (results.some((r) => r.comparacion === 'error')) process.exitCode = 1;
