/* Motor integrado real, sin persistencia comercial. Cada corrida nace fría.
 * GRAFONEST_PACKINGSOLVER_ENABLED=1 PACKINGSOLVER_BIN=/ruta/binario
 * node .../grafonest-portafolio.cjs entrada.json salida [presupuestoMs]
 */
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { OpenNestService } = require('../../dist/src/workers/geometria/opennest.service');
const { contarPatronesResultado } = require('../../dist/src/workers/geometria/calidad-nesting');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const raw = JSON.parse(fs.readFileSync(process.argv[2]));
const input = { ...(raw.entrada || raw), timeoutMs: Number(process.argv[4] || 120000), buscarMejora: true };
const dir = path.resolve(process.argv[3]);
const started = performance.now(), candidates = [];
fs.mkdirSync(dir, { recursive: true });
process.env.OPENNEST_PYTHON ||= path.resolve(__dirname, '../../.venv-opennest/bin/python');
class Medicion extends OpenNestService {
  async ejecutarPackingSolver(options) {
    return super.ejecutarPackingSolver({ ...options, onCandidate: (candidate) => {
      candidates.push({ recibidoMs: performance.now() - started, ...candidate });
      options.onCandidate?.(candidate);
    } });
  }
}
(async () => {
  const result = await new Medicion().resolver(input);
  const retornoMs = performance.now() - started;
  validarResultadoNestingOpenNest(input, result);
  for (const [i, candidate] of candidates.entries()) fs.writeFileSync(path.join(dir, `candidato-${i}.json`), JSON.stringify(candidate));
  fs.writeFileSync(path.join(dir, 'entrada.json'), JSON.stringify(input));
  fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(result));
  const row = { retornoMs, piezas: result.cantidadColocada, placas: result.placasUsadas,
    patrones: contarPatronesResultado(result), algoritmo: result.algoritmo, version: result.versionMotor,
    nativosRecibidos: candidates.length, origen: result.origenSolucion, busqueda: result.busqueda,
    memoriaNodeRssBytes: process.memoryUsage().rss };
  fs.writeFileSync(path.join(dir, 'mediciones.json'), JSON.stringify(row, null, 2));
  console.log(JSON.stringify(row));
})().catch((e) => { console.error(e); process.exitCode = 1; });
