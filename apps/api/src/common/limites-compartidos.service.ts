import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
  type ThrottlerOptionsFactory,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

// Redis decide el tiempo y ejecuta el límite de forma atómica. La ventana
// móvil guarda a lo sumo `limit` entradas; un rechazo no alarga el bloqueo.
const INCREMENTAR = `
local bloqueo = redis.call('GET', KEYS[2])
if bloqueo then
  return {tonumber(bloqueo), 0, 1, math.max(1, math.ceil(redis.call('PTTL', KEYS[2]) / 1000))}
end
local reloj = redis.call('TIME')
local ahora = tonumber(reloj[1]) * 1000 + math.floor(tonumber(reloj[2]) / 1000)
local ttl, limite, duracion = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ahora - ttl)
local cantidad = redis.call('ZCARD', KEYS[1]) + 1
if cantidad > limite then
  redis.call('SET', KEYS[2], cantidad, 'PX', duracion)
  redis.call('DEL', KEYS[1])
  return {cantidad, 0, 1, math.ceil(duracion / 1000)}
end
redis.call('ZADD', KEYS[1], ahora, ARGV[4])
redis.call('PEXPIRE', KEYS[1], ttl)
local primero = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
return {cantidad, math.max(1, math.ceil((tonumber(primero[2]) + ttl - ahora) / 1000)), 0, 0}
`;

@Injectable()
export class LimitesCompartidosService
  implements
    ThrottlerStorage,
    ThrottlerOptionsFactory,
    OnModuleInit,
    OnApplicationShutdown
{
  private readonly logger = new Logger(LimitesCompartidosService.name);
  private readonly redis?: Redis;
  private readonly local?: ThrottlerStorageService;
  private readonly prefijo: string;
  private ultimoAviso = 0;
  private inicio?: Promise<void>;

  constructor() {
    const produccion = process.env.NODE_ENV === 'production';
    const url = process.env.REDIS_URL?.trim();
    this.prefijo =
      process.env.API_LIMITES_PREFIJO?.trim() ||
      `grafo:${process.env.STAGING_PRIVATE === 'true' ? 'staging' : (process.env.NODE_ENV ?? 'development')}:limites:v1`;
    if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(this.prefijo))
      throw new Error('API_LIMITES_PREFIJO no es válido.');
    if (!url) {
      if (produccion)
        throw new Error(
          'La API de producción requiere REDIS_URL para compartir sus límites.',
        );
      this.local = new ThrottlerStorageService();
      return;
    }
    let valida = false;
    try {
      valida = ['redis:', 'rediss:'].includes(new URL(url).protocol);
    } catch {
      /* Mensaje sin exponer la URL. */
    }
    if (!valida) throw new Error('REDIS_URL debe usar redis:// o rediss://.');
    this.redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      commandTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: (intento) => Math.min(200 * intento, 2_000),
    });
    // ioredis incluye destinos en sus errores: no imprimirlos ni enviarlos al cliente.
    this.redis.on('error', () => this.avisar());
  }

  createThrottlerOptions(): ThrottlerModuleOptions {
    return {
      storage: this,
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    };
  }
  onModuleInit() {
    if (!this.redis) return;
    // Nest expone el mismo objeto como factory y storage. Inicializar una vez.
    this.inicio ??= this.redis.connect().catch(() => {
      this.avisar();
    });
    return this.inicio;
  }
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    if (this.local)
      return this.local.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    const identificador = createHash('sha256')
      .update(`${throttlerName}:${key}`)
      .digest('hex');
    const base = `${this.prefijo}:{${identificador}}`;
    try {
      const respuesta: unknown = await this.redis!.eval(
        INCREMENTAR,
        2,
        `${base}:hits`,
        `${base}:bloqueo`,
        ttl,
        limit,
        blockDuration,
        randomUUID(),
      );
      if (
        !Array.isArray(respuesta) ||
        respuesta.length !== 4 ||
        !respuesta.every(
          (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
        )
      )
        throw new Error('Respuesta inválida');
      const [totalHits, timeToExpire, bloqueo, timeToBlockExpire] =
        respuesta as number[];
      return {
        totalHits,
        timeToExpire,
        isBlocked: bloqueo === 1,
        timeToBlockExpire,
      };
    } catch {
      this.avisar();
      // Sin contador compartido se rechaza; nunca se vuelve a memoria local.
      throw new ServiceUnavailableException(
        'El servicio está temporalmente ocupado. Intentá nuevamente en unos instantes.',
      );
    }
  }
  private avisar() {
    if (Date.now() - this.ultimoAviso < 60_000) return;
    this.ultimoAviso = Date.now();
    this.logger.error(
      'No se pudo consultar el límite compartido; las solicitudes protegidas se rechazan temporalmente.',
    );
  }
  onApplicationShutdown() {
    this.redis?.disconnect();
    this.local?.onApplicationShutdown();
  }
}
