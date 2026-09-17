/* Prueba destructiva sólo sobre procesos y tenant de prueba creados aquí.
 * Interrumpe un worker con SIGKILL después de guardar el candidato real 64/5.
 * Reinicia otro proceso y verifica que termina conservando esa geometría.
 * El runner se controla para situar la caída; no es un benchmark del solver.
 * node apps/api/test/benchmarks/checkpoint-recuperacion.cjs [carpeta-salida]
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { snapshotsExtension } = require('../../dist/src/prisma/snapshots.extension');
const { OpenNestService } = require('../../dist/src/workers/geometria/opennest.service');
const { NestingsGuardadosService } = require('../../dist/src/workers/geometria/nestings-guardados.service');
const { contarPatronesResultado } = require('../../dist/src/workers/geometria/calidad-nesting');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const root = path.resolve(__dirname, '../../../..');
const datasourceUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public';
if (!new URL(datasourceUrl).pathname.endsWith('_test')) throw new Error('Se requiere una base terminada en _test.');
const db = new PrismaClient({ datasourceUrl }).$extends(snapshotsExtension);
const guardados = new NestingsGuardadosService(db);

async function hijo(modo, carpeta) {
  const a = JSON.parse(fs.readFileSync(path.join(carpeta, 'entrada.json')));
  const r = JSON.parse(fs.readFileSync(path.join(carpeta, 'referencia.json')));
  let entregado = false, llamadas = 0;
  class GuardadosConBarrera extends NestingsGuardadosService {
    async guardarCheckpoint(input, resultado) {
      await super.guardarCheckpoint(input, resultado);
      if (modo === 'interrumpir' && resultado.placasUsadas === 64) {
        // Barrera después del commit, antes de devolver control a la búsqueda.
        // No depende de cuánto CPU consumió la validación en esta máquina.
        // Una promesa pendiente no mantiene vivo Node por sí sola. Mantener
        // este hijo de prueba activo hasta que el padre envíe SIGKILL.
        setInterval(() => {}, 1000);
        process.send({ etapa: 'avance-durable', placas: resultado.placasUsadas, patrones: contarPatronesResultado(resultado) });
        await new Promise(() => {});
      }
    }
  }
  class WorkerControlado extends OpenNestService {
    async ejecutarRunner(options) {
      llamadas++;
      if (modo === 'interrumpir') {
        if (entregado) {
          throw new Error('Se avanzó sin esperar la escritura del checkpoint.');
        }
        const giros = new Map(options.entrada.piezas.map((p) => [p.id, p.rotaciones]));
        if (!r.placements.every((p) => Number.isInteger(p.rotacionGrados * giros.get(p.piezaId) / 360)))
          return { ok: false, error: { message: 'Este candidato requiere otros giros.' } };
        entregado = true;
        return { ok: true, result: { ...r, motor: options.entrada.motor } };
      }
      await new Promise((resolve) => setTimeout(resolve, options.timeoutMs));
      return { ok: false, error: { message: 'No se mejora el checkpoint durante esta prueba.' } };
    }
  }
  const result = await new WorkerControlado(new GuardadosConBarrera(db)).resolver({ ...a, timeoutMs: modo === 'interrumpir' ? 9000 : 5000 });
  assert.equal(modo, 'recuperar', 'El primer worker debía permanecer activo hasta SIGKILL.');
  fs.writeFileSync(path.join(carpeta, 'resultado-recuperado.json'), JSON.stringify(result));
  process.send({ etapa: 'completado', placas: result.placasUsadas, patrones: contarPatronesResultado(result), llamadas });
}

async function principal() {
  const carpeta = path.resolve(process.argv[2] || path.join(root, 'output/grafonest-transformacion-2026-09-09/checkpoint-recuperacion'));
  fs.mkdirSync(carpeta, { recursive: true });
  const tenantId = randomUUID();
  let activo;
  const ejecutar = (modo) => {
    const child = fork(__filename, ['--hijo', modo, carpeta], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, TEST_DATABASE_URL: datasourceUrl } });
    activo = child;
    const log = fs.createWriteStream(path.join(carpeta, `${modo}.log`));
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.once('exit', () => log.end());
    const cerrado = once(child, 'exit');
    const mensaje = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('El worker no alcanzó la barrera de aceptación.')), 30000);
      child.once('message', (value) => { clearTimeout(timer); resolve(value); });
      child.once('error', (e) => { clearTimeout(timer); reject(e); });
      child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Worker terminó antes de la barrera: ${code}/${signal}`)); });
    });
    return { child, cerrado, mensaje };
  };
  try {
    await db.tenant.create({ data: { id: tenantId, nombre: 'SIGKILL recuperación', slug: tenantId } });
    const a = { ...JSON.parse(fs.readFileSync(path.join(root, 'output/grafonest-mejoras-2026-09-09/entrada-100.json'))), tenantId, correlationId: randomUUID(), timeoutMs: 9000 };
    const r = JSON.parse(fs.readFileSync(path.join(root, 'output/grafonest-transformacion-2026-09-09/biblioteca-patrones-nativos/resultado-100.json')));
    validarResultadoNestingOpenNest(a, r);
    fs.writeFileSync(path.join(carpeta, 'entrada.json'), JSON.stringify(a));
    fs.writeFileSync(path.join(carpeta, 'referencia.json'), JSON.stringify(r));
    const primero = ejecutar('interrumpir');
    const durable = await primero.mensaje;
    assert.equal(durable.etapa, 'avance-durable');
    assert.equal(durable.patrones, 5);
    assert.equal(await guardados.obtener(a), null, 'Un avance no debe aparecer como una cotización terminada.');
    const filaCheckpoint = await db.nestingCheckpoint.findFirstOrThrow({ where: { tenantId } });
    const bytesCheckpoint = Buffer.byteLength(JSON.stringify(filaCheckpoint.resultadoJson));
    const bytesGeometriaCompleta = Buffer.byteLength(JSON.stringify(r));
    primero.child.kill('SIGKILL');
    const cierre = await primero.cerrado;
    assert.equal(cierre[1], 'SIGKILL');
    const persistido = await guardados.obtenerCheckpoint(a);
    assert.equal(persistido.placasUsadas, 64);
    assert.equal(persistido.presupuestoExploradoMs, 0);
    const segundo = ejecutar('recuperar');
    const recuperado = await segundo.mensaje;
    assert.equal((await segundo.cerrado)[0], 0);
    assert.equal(recuperado.etapa, 'completado');
    assert.equal(recuperado.placas, 64); assert.equal(recuperado.patrones, 5);
    const final = await guardados.obtener(a);
    assert.equal(final.cantidadColocada, 900);
    assert.equal(final.placasUsadas, 64);
    assert.equal(contarPatronesResultado(final), 5);
    assert.equal(await guardados.obtenerCheckpoint(a), null);
    const resumen = { interrupcion: cierre[1], durable, recuperado, piezas: final.cantidadColocada, checkpointLimpio: true, cacheNoPublicadoAntesDeTerminar: true,
      bytesCheckpoint, bytesGeometriaCompleta, reduccionBytesPct: (1 - bytesCheckpoint / bytesGeometriaCompleta) * 100 };
    fs.writeFileSync(path.join(carpeta, 'aceptacion.json'), JSON.stringify(resumen, null, 2));
    console.log(JSON.stringify(resumen));
  } finally {
    if (activo && activo.exitCode === null && activo.signalCode === null) {
      const cerrado = once(activo, 'exit'); activo.kill('SIGKILL'); await cerrado;
    }
    await db.tenant.deleteMany({ where: { id: tenantId } });
  }
}
(process.argv[2] === '--hijo' ? hijo(process.argv[3], process.argv[4]) : principal())
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); if (process.send) process.disconnect(); });
