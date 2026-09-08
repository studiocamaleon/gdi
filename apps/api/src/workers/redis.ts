import type { ConnectionOptions } from 'bullmq';

const REDIS_URL_LOCAL = 'redis://127.0.0.1:6379';

/**
 * El worker es un proceso opt-in: arrancarlo expresa que Redis debe existir.
 * La API web no importa este archivo y sigue funcionando sin Redis en local.
 */
export function conexionRedisWorker(): ConnectionOptions {
  const url = urlRedisWorkers();
  return {
    url,
    // BullMQ necesita una conexión bloqueante sin límite de reintentos por
    // petición. El timeout de cada cálculo se controla en el procesador.
    maxRetriesPerRequest: null,
    connectTimeout: enteroPositivo(
      process.env.WORKER_REDIS_CONNECT_TIMEOUT_MS,
      5_000,
    ),
  };
}

/** La API falla rápido si Redis no está disponible; nunca bloquea HTTP. */
export function conexionRedisApi(): ConnectionOptions {
  const url = urlRedisWorkers();
  return {
    url,
    maxRetriesPerRequest: 1,
    connectTimeout: enteroPositivo(
      process.env.WORKER_REDIS_CONNECT_TIMEOUT_MS,
      5_000,
    ),
  };
}

export function urlRedisWorkers(): string {
  const url = process.env.REDIS_URL?.trim() || REDIS_URL_LOCAL;
  const parsed = new URL(url);
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL debe usar redis:// o rediss://.');
  }
  return url;
}

export function concurrenciaGeometria(): number {
  return enteroPositivo(process.env.WORKER_GEOMETRY_CONCURRENCY, 1);
}

export function timeoutConexionWorkerMs(): number {
  return enteroPositivo(process.env.WORKER_REDIS_READY_TIMEOUT_MS, 10_000);
}

function enteroPositivo(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}
