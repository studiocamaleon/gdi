/** Prototipo de investigación. No está conectado a cotizaciones ni modifica productos.
 * Ejecutar desde la raíz: node apps/api/scripts/nesting-lote-benchmark/benchmark.cjs
 *   docs/benchmarks/exhibidor-50/entrada.json /tmp/benchmark-exhibidor
 * Requiere API compilada y OPENNEST_PYTHON (o .venv-opennest) con SciPy.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const dist = path.join(root, 'apps/api/dist/src');
const { nestGrid2DMulti } = require(path.join(dist, 'productos-servicios/nesting/algorithms/grid-2d-multi'));
const { nestearPatronRepetido } = require(path.join(dist, 'motor-universal/geometria-vectorial/nesting-patron-repetido'));
const { validarResultadoNestingOpenNest } = require(path.join(dist, 'workers/geometria/validar-nesting-opennest'));
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const output = path.resolve(process.argv[3]);
fs.mkdirSync(output, { recursive: true });
const started = Date.now();
const area = (ps) => Math.abs(ps.reduce((s, p, i) => {
  const q = ps[(i + 1) % ps.length];
  return s + p.x * q.y - q.x * p.y;
}, 0)) / 2;
const piezas = input.piezas.map((p) => ({
  ...p, anchoMm: Math.max(...p.contorno.map(q => q.x)) - Math.min(...p.contorno.map(q => q.x)),
  altoMm: Math.max(...p.contorno.map(q => q.y)) - Math.min(...p.contorno.map(q => q.y)),
  areaMm2: area(p.contorno) - (p.huecos || []).reduce((s, h) => s + area(h), 0),
  perimetroMm: 0,
  contornos: [{ puntos: p.contorno, esHueco: false }, ...(p.huecos || []).map(puntos => ({ puntos, esHueco: true }))],
}));
const m = input.placa.margenMm;
const sustrato = { kind: 'sheet', widthMm: input.placa.anchoMm, heightMm: input.placa.altoMm,
  margins: { leftMm: m, rightMm: m, topMm: m, bottomMm: m } };
// El generador rectangular usa una política común conservadora de giro.
// No habilita 90° si alguna pieza no lo permite. Las filas respetan cada contrato.
const allowRotation = piezas.every(p => p.rotaciones % 4 === 0);
const pool = new Map();
function add(ps, origen) {
  const counts = piezas.map(p => ps.filter(x => x.pieceId === p.id).length);
  if (!ps.length || counts.some((v, i) => v > piezas[i].cantidad)) return;
  const key = counts.join(',');
  // Para este objetivo todos los patrones con igual vector producen lo mismo.
  // Costos de corte/retales requerirían conservar varias geometrías por vector.
  if (!pool.has(key)) pool.set(key, { counts, origen, placements: ps });
}
function harvest(r, origen) {
  for (let b = 0; b < r.substrates.length; b++) add(r.placements.filter(p => p.substrateIndex === b), origen);
}
function grid(q) {
  return nestGrid2DMulti(piezas.map((p, i) => ({ id: p.id, widthMm: p.anchoMm,
    heightMm: p.altoMm, quantity: q[i] })), sustrato,
  { allowRotation, separationHMm: input.separacionMm, separationVMm: input.separacionMm });
}
harvest(grid(piezas.map(p => p.cantidad)), 'rectangulos-lote');
for (const p of piezas) {
  const r = nestearPatronRepetido({ pieza: p, cantidad: p.cantidad, sustrato,
    angulosPermitidos: [0, 90, 180, 270].filter(a => Number.isInteger(a * p.rotaciones / 360)),
    separacionMm: input.separacionMm });
  if (!r) continue;
  const ps = r.placements.filter(x => x.substrateIndex === 0);
  for (let n = 1; n <= ps.length; n++) add(ps.slice(0, n), 'silueta-repetida');
}
let seed = 71241;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const util = (sustrato.widthMm - 2 * m) * (sustrato.heightMm - 2 * m);
const maxima = piezas.map(p => Math.min(p.cantidad, Math.max(1, Math.floor(util / (p.anchoMm * p.altoMm)))));
const mayor = piezas.reduce((best, p, i) => p.areaMm2 > piezas[best].areaMm2 ? i : best, 0);
for (let iter = 0; iter < 9000; iter++) {
  const q = piezas.map((p, i) => random() < .18 ? 0 : Math.floor(random() * (maxima[i] + 1)));
  if (iter % 2 === 0) q[mayor] = maxima[mayor];
  harvest(grid(q), 'rectangulos-muestra');
}
// Derivar variantes quitando excedentes según las repeticiones de la pieza mayor.
// No hay nombres, posiciones ni cantidades de un exhibidor codificados aquí.
for (const t of [...pool.values()]) {
  const indices = piezas.map((p, i) => i).filter(i => t.counts[i] > 0);
  const grande = indices.reduce((best, i) => piezas[i].areaMm2 > piezas[best].areaMm2 ? i : best, indices[0]);
  const rep = Math.floor(piezas[grande].cantidad / t.counts[grande]);
  if (rep < 2) continue;
  const left = piezas.map((p, i) => Math.min(t.counts[i], Math.floor(p.cantidad / rep)));
  add(t.placements.filter(p => left[piezas.findIndex(x => x.id === p.pieceId)]-- > 0), 'equilibrio-demanda');
}
const patrones = [...pool.values()];
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value) + '\n');
write('cartera.json', patrones);
write('demanda.json', piezas.map(p => p.cantidad));
console.log(`Cartera: ${patrones.length} patrones; se eligen repeticiones enteras sin excedentes.`);
const python = process.env.OPENNEST_PYTHON || path.join(root, 'apps/api/.venv-opennest/bin/python');
const solved = spawnSync(python, [path.join(__dirname, 'elegir-patrones.py'), output],
  { encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
if (solved.status !== 0) throw new Error(solved.stderr || solved.error?.message || 'Falló la selección de patrones.');
console.log(solved.stdout.trim());
const plan = JSON.parse(fs.readFileSync(path.join(output, 'plan.json'), 'utf8'));
const plantillas = plan.seleccion.sort((a, b) => b.repeticiones - a.repeticiones).map((s, i) => ({
  ...s, nombre: String.fromCharCode(65 + i), origen: patrones[s.patron].origen,
  placements: patrones[s.patron].placements.map(p => {
    const pieza = piezas.find(x => x.id === p.pieceId);
    const rotacionGrados = p.meta?.rotacionGrados ?? (p.rotated ? 90 : 0);
    const rad = rotacionGrados * Math.PI / 180;
    const rotate = ps => ps.map(q => ({ x: q.x * Math.cos(rad) - q.y * Math.sin(rad), y: q.x * Math.sin(rad) + q.y * Math.cos(rad) }));
    const rot = rotate(pieza.contorno);
    const traslacion = p.meta?.traslacion ?? { x: p.xMm - Math.min(...rot.map(q => q.x)), y: p.yMm - Math.min(...rot.map(q => q.y)) };
    const move = ps => ps.map(q => ({ x: q.x + traslacion.x, y: q.y + traslacion.y }));
    return { piezaId: p.pieceId, rotacionGrados, traslacion, contorno: move(rot), huecos: (pieza.huecos || []).map(h => move(rotate(h))) };
  }),
}));
let placa = 0;
const copias = new Map(), placements = [];
for (const t of plantillas) for (let j = 0; j < t.repeticiones; j++) {
  for (const p of t.placements) {
    const copia = copias.get(p.piezaId) || 0;
    copias.set(p.piezaId, copia + 1);
    placements.push({ ...p, copia, placa });
  }
  placa++;
}
const result = validarResultadoNestingOpenNest(input, {
  schemaVersion: 1, algoritmo: 'grafonest-baseline-v1', motor: input.motor,
  versionMotor: 'prototipo-cartera-patrones-v1', cantidadSolicitada: piezas.reduce((s, p) => s + p.cantidad, 0),
  cantidadColocada: placements.length, placasUsadas: placa, duracionMs: Date.now() - started, placements,
});
write('plantillas.json', plantillas);
write('resultado.json', result);
write('resumen.json', { origen: 'Prototipo externo a cotización; MaxRects + filas de siluetas + MILP, no salida del motor nativo OpenNest.',
  placas: placa, cantidad: placements.length, cantidades: Object.fromEntries(copias), patrones: plantillas.length,
  cartera: patrones.length, duracionMs: result.duracionMs, validacion: result.validacion, optimizacion: plan });
console.log(JSON.stringify({ placas: placa, patrones: plantillas.length, cantidades: Object.fromEntries(copias), validacion: result.validacion }));
