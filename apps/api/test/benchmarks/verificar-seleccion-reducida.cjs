/* Reconstruye el plan del selector con las poses y los contornos reales.
 * Verifica además el certificado por BigInt, independiente de NumPy/HiGHS.
 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Module = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const base = path.join(root, 'output/grafonest-transformacion-2026-09-09/validacion-patrones');
const dir = path.join(base, 'selector-condicional');
const read = f => JSON.parse(fs.readFileSync(f));
const input = read(path.join(root, 'output/grafonest-mejoras-2026-09-09/entrada-100.json'));
const matrix = read(path.join(base, 'matriz-nativa.json'));
const cartera = read(path.join(base, 'cartera-nativa.json'));
const plan = read(path.join(dir, 'selector-nativo-15000-0-actual.json'));
const diagnostic = fs.readFileSync(path.join(dir, 'selector-nativo-15000-0-actual.stderr'), 'utf8')
  .split('\n').filter(l => l.startsWith('{')).map(JSON.parse).find(d => d.fase === 'reduccion-certificada');
assert.ok(diagnostic);
const weights = diagnostic.pesosNumeradores.map(n => { assert.ok(Number.isSafeInteger(n)); return BigInt(n); });
const scale = BigInt(diagnostic.escala);
const dot = counts => counts.reduce((s, n, i) => s + BigInt(n) * weights[i], 0n);
const bound = dot(matrix.demanda), gap = scale * BigInt(diagnostic.placas) - bound;
assert.equal(bound, BigInt(diagnostic.cotaNumerador));
assert.equal((bound + scale - 1n) / scale, BigInt(plan.placas));
const allowed = new Set();
matrix.patrones.forEach((p, j) => {
  const residue = scale - dot(p.counts);
  assert.ok(residue >= 0n);
  if (residue <= gap) allowed.add(j);
  assert.deepEqual(p.counts, cartera[j].counts);
});
assert.equal(allowed.size, diagnostic.despues);
for (const p of plan.seleccion) assert.ok(allowed.has(p.patron));
function previous(snapshot, original) {
  const file = path.join(root, 'apps/api/dist/src/workers/geometria', original);
  const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(fs.readFileSync(path.join(base, snapshot), 'utf8'), file); return m.exports;
}
const { materializarPatrones } = require('../../dist/src/workers/geometria/cartera-patrones');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const result = materializarPatrones(input, cartera, plan);
assert.deepEqual(result, previous('cartera-anterior.js', 'cartera-patrones.js').materializarPatrones(input, cartera, plan));
const old = previous('validador-anterior.js', 'validar-nesting-opennest.js').validarResultadoNestingOpenNest(input, result);
const validated = validarResultadoNestingOpenNest(input, result);
assert.deepEqual(validated, old);
assert.equal(validated.cantidadColocada, 900);
assert.equal(validated.placasUsadas, 64);
assert.equal(plan.seleccion.length, 5);
fs.writeFileSync(path.join(dir, 'resultado-geometrico.json'), JSON.stringify(validated));
const acceptance = { piezas: 900, placas: 64, patrones: 5, certificadoEnteroIndependiente: true,
  materializacionIdentica: true, validadorAnterior: 'aprobado', validadorActual: 'aprobado',
  carteraAntes: matrix.patrones.length, carteraDespues: allowed.size,
  minimoGeometricoGlobalDemostrado: false, datosComercialesModificados: false };
fs.writeFileSync(path.join(dir, 'aceptacion-geometrica.json'), JSON.stringify(acceptance, null, 2));
console.log(JSON.stringify(acceptance));
