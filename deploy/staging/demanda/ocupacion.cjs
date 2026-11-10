// Sólo lectura: no reclama tareas, no crea colas, no modifica datos.
// Se ejecuta mediante un token Fly limitado a este comando y a la API de staging.
const COLAS = ['grafo-geometry-v1', 'grafo-geometry-heavy-v1', 'grafo-quotes-v1', 'grafo-delivery-plans-v1', 'grafo-documentos-pdf-v1'];

function validarEntorno(env) {
  if (env.FLY_APP_NAME !== 'grafoprint-staging-api' || env.GRAFO_DEPLOY_ENV !== 'staging') {
    throw new Error('El control de ocupación sólo admite la API de staging.');
  }
  if (!env.DATABASE_URL || !env.REDIS_URL) throw new Error('Falta una conexión de staging.');
}

async function medir(redis, db) {
  const nombres = new Set(COLAS);
  let cursor = '0'; let vueltas = 0;
  do {
    const [siguiente, claves] = await redis.scan(cursor, 'MATCH', 'bull:*:meta', 'COUNT', 100);
    for (const clave of claves) nombres.add(clave.slice(5, -5));
    cursor = siguiente;
    if (++vueltas > 100) throw new Error('Inventario de colas incompleto.');
  } while (cursor !== '0');
  let redisPendientes = 0;
  for (const nombre of nombres) {
    const prefijo = `bull:${nombre}:`;
    const cantidades = await Promise.all([
      ...['active', 'wait', 'paused'].map((estado) => redis.llen(prefijo + estado)),
      ...['prioritized', 'delayed', 'waiting-children'].map((estado) => redis.zcard(prefijo + estado)),
    ]);
    if (cantidades.some((n) => !Number.isSafeInteger(n) || n < 0)) throw new Error('Conteo inválido.');
    redisPendientes += cantidades.reduce((a, b) => a + b, 0);
  }
  // También hay trabajos durables en PostgreSQL, fuera de BullMQ.
  const filas = await db.$queryRawUnsafe(`SELECT (
    (SELECT count(*) FROM "DocumentoPdf" WHERE estado IN ('PENDIENTE','PROCESANDO')) +
    (SELECT count(*) FROM "FacturacionLote" WHERE estado IN ('pendiente','procesando','esperando_envios')) +
    (SELECT count(*) FROM "InboxTrabajoEvento" WHERE estado = 'PENDIENTE') +
    (SELECT count(*) FROM "InboxAdjunto" WHERE estado IN ('PENDIENTE','DESCARGANDO') OR "bloqueoHasta" > now()) +
    (SELECT count(*) FROM "MetaAutorizacion" WHERE estado IN ('CANJEANDO','CANJEADA','VERIFICANDO') AND "venceEl" > now())
  )::integer AS pendientes`);
  const postgresPendientes = filas[0]?.pendientes;
  if (!Number.isSafeInteger(postgresPendientes) || postgresPendientes < 0) throw new Error('Conteo SQL inválido.');
  return { version: 1, redisPendientes, postgresPendientes, libre: redisPendientes + postgresPendientes === 0 };
}

async function main() {
  validarEntorno(process.env);
  // La imagen backend conserva el directorio del paquete de la API.
  const { createRequire } = require('node:module');
  const cargar = createRequire('/app/apps/api/package.json');
  const Redis = cargar('ioredis');
  const { PrismaClient } = cargar('@prisma/client');
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 5000, retryStrategy: () => null });
  redis.on('error', () => {});
  const db = new PrismaClient({ log: [] });
  const limite = setTimeout(() => { console.error('Control de ocupación sin respuesta.'); process.exit(1); }, 15000);
  try {
    await redis.connect();
    const resultado = await medir(redis, db);
    console.log(JSON.stringify(resultado));
  } finally {
    redis.disconnect();
    await db.$disconnect();
    clearTimeout(limite);
  }
}

module.exports = { validarEntorno, medir };
if (require.main === module) main().catch(() => { console.error('No se pudo comprobar la ocupación; conservar staging encendido.'); process.exitCode = 1; });
