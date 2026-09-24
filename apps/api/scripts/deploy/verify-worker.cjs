const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Queue, QueueEvents } = require('bullmq');
const { client, fail } = require('./target.cjs');
const { COLA_GEOMETRIA, TRABAJO_NESTING_IRREGULAR_OPENNEST } = require('../../dist/src/workers/colas.js');
const { conexionRedisWorker } = require('../../dist/src/workers/redis.js');

async function main() {
  if (process.env.DEPLOY_DATABASE_NAME !== 'grafoprint_staging_test' || process.env.REDIS_URL !== 'redis://redis:6379') {
    throw new Error('Sólo el ensayo aislado de Docker.');
  }
  const prisma = client('DATABASE_URL');
  const id = randomUUID();
  const connection = conexionRedisWorker();
  const queue = new Queue(COLA_GEOMETRIA, { connection });
  const events = new QueueEvents(COLA_GEOMETRIA, { connection });
  let tenant;
  try {
    // Fixture temporal sin plan comercial: el acceso legacy permite ensayar
    // el motor sin crear precios ni usar el seed destructivo de desarrollo.
    tenant = await prisma.tenant.create({ data: { nombre: 'Ensayo de geometría', slug: `deploy-test-${id}` } });
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
    const job = await queue.add(TRABAJO_NESTING_IRREGULAR_OPENNEST, {
      schemaVersion: 1, tenantId: tenant.id, correlationId: id, solicitadoEl: new Date().toISOString(),
      motor: 'collision', placa: { anchoMm: 100, altoMm: 60, margenMm: 2, maxPlacas: 3 },
      separacionMm: 3, timeoutMs: 10000, semilla: 7,
      piezas: [{ id: 'rectangulo', cantidad: 3, rotaciones: 4, contorno: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }] },
        { id: 'triangulo', cantidad: 2, rotaciones: 8, contorno: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 16 }] }],
    }, { jobId: `deploy-test-${id}`, attempts: 1, removeOnComplete: true, removeOnFail: true });
    const result = await job.waitUntilFinished(events, 60000);
    assert.equal(result.cantidadColocada, 5);
    assert.ok(result.validacion.completa && result.validacion.sinSolapamientos && result.validacion.separacionRespetada);
    console.log(`OK: worker procesó 5 piezas, sin solapamientos; motor ${result.motor}.`);
  } finally {
    await Promise.allSettled([events.close(), queue.close()]);
    if (tenant) await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}

main().catch(fail);
