/** Benchmark de integración. Requiere npm run build en apps/api y el runtime Python del worker.
 * node apps/api/scripts/nesting-lote-benchmark/verificar-worker.cjs [ruta-salida.json]
 * No toca catálogo, cotizaciones ni órdenes. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const { OpenNestService } = require(path.join(root, 'apps/api/dist/src/workers/geometria/opennest.service'));
const input = JSON.parse(fs.readFileSync(path.join(root, 'docs/benchmarks/exhibidor-50/entrada.json'), 'utf8'));
process.env.OPENNEST_PYTHON ||= path.join(root, 'apps/api/.venv-opennest/bin/python');
process.env.OPENNEST_RUNNER_PATH ||= path.join(root, 'apps/api/src/workers/geometria/python/opennest_runner.py');
(async () => {
  const r = await new OpenNestService().resolver({...input, timeoutMs:60000});
  assert.equal(r.cantidadColocada,450);
  assert.ok(r.placasUsadas <= 34);
  assert.equal(r.validacion.completa,true);
  assert.equal(r.validacion.sinSolapamientos,true);
  const resumen = { placas:r.placasUsadas, piezas:r.cantidadColocada, version:r.versionMotor, patrones:r.planPatrones, busqueda:r.busqueda, validacion:r.validacion, tiempoMs:r.duracionMs };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(resumen,null,2));
  console.log(JSON.stringify(resumen,null,2));
})().catch(e => {console.error(e.message);process.exitCode=1});
