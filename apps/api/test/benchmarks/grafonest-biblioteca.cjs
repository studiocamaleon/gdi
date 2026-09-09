/* Reproducción real y aislada: usa gdi_saas_test, nunca la base comercial.
 * node apps/api/test/benchmarks/grafonest-biblioteca.cjs [carpeta-salida]
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../../../..');
const output = path.resolve(process.argv[2] || path.join(root, 'output/grafonest-transformacion-2026-09-09/biblioteca'));
const datasourceUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public';
if (!new URL(datasourceUrl).pathname.endsWith('_test')) throw new Error('El benchmark exige una base con nombre terminado en _test.');
process.env.DATABASE_URL = datasourceUrl;
process.env.OPENNEST_PYTHON = process.env.OPENNEST_PYTHON || path.join(root, 'apps/api/.venv-opennest/bin/python');
const { PrismaClient } = require('@prisma/client');
const { snapshotsExtension } = require('../../dist/src/prisma/snapshots.extension');
const { OpenNestService } = require('../../dist/src/workers/geometria/opennest.service');
const { BibliotecaPatronesService } = require('../../dist/src/workers/geometria/biblioteca-patrones.service');
const { contarPatronesResultado } = require('../../dist/src/workers/geometria/calidad-nesting');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const fuente = path.join(root, 'output/grafonest-mejoras-2026-09-09');
const original = JSON.parse(fs.readFileSync(path.join(fuente, 'entrada-100.json')));
const referencia = JSON.parse(fs.readFileSync(process.env.GRAFONEST_BENCH_REFERENCE || path.join(fuente, 'resultado-120000.json')));
const db = new PrismaClient({ datasourceUrl }).$extends(snapshotsExtension);
const tenantId = randomUUID();
const resumen = [];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await db.tenant.create({ data: { id: tenantId, nombre: 'Benchmark biblioteca', slug: `bench-${tenantId}` } });
  const biblioteca = new BibliotecaPatronesService(db);
  const origen = { ...original, tenantId };
  validarResultadoNestingOpenNest(origen, referencia);
  for (const cantidad of (process.env.GRAFONEST_BENCH_CANTIDADES || '1,25,50,100,101,200').split(',').map(Number)) {
    // Cada caso arranca de la misma biblioteca: sólo el plan conocido de 100.
    await db.carteraNestingGuardada.deleteMany({ where: { tenantId } });
    await biblioteca.aprender(origen, referencia);
    const input = { ...origen, correlationId: randomUUID(), timeoutMs: 10000,
      buscarMejora: process.env.GRAFONEST_BENCH_BUSCAR_MEJORA === '1',
      piezas: origen.piezas.map((p) => ({ ...p, cantidad: p.cantidad / 100 * cantidad })),
    };
    const inicio = performance.now();
    const result = await new OpenNestService(undefined, biblioteca).resolver(input);
    validarResultadoNestingOpenNest(input, result);
    const totalMs = Math.round(performance.now() - inicio);
    const fila = { cantidad, totalMs, placas: result.placasUsadas,
      patrones: contarPatronesResultado(result), piezas: result.cantidadColocada,
      origen: result.origenSolucion, busqueda: result.busqueda,
      memoriaNodeRssBytes: process.memoryUsage().rss,
    };
    resumen.push(fila);
    fs.writeFileSync(path.join(output, `resultado-${cantidad}.json`), JSON.stringify(result));
    fs.writeFileSync(path.join(output, 'mediciones.json'), JSON.stringify(resumen, null, 2));
    console.log(JSON.stringify(fila));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});
