import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { urlRedisWorkers } from './redis';

export type MotivoCancelacionGeometria = 'usuario' | 'obsoleto';

export type CancelacionTrabajoGeometria = {
  tenantId: string;
  solicitadaEl: string;
  motivo: MotivoCancelacionGeometria;
  reemplazadoPor?: string;
};

const PREFIX = 'grafo:geometry:v1';
const TTL_CANCELACION_SEGUNDOS = 7 * 24 * 60 * 60;
const TTL_SCOPE_SEGUNDOS = 24 * 60 * 60;

/**
 * Estado mínimo externo a BullMQ para conservar cancelaciones aunque un job
 * en espera se elimine y para invalidar cálculos activos desde otro proceso.
 */
@Injectable()
export class ControlTrabajosGeometriaService implements OnApplicationShutdown {
  private readonly logger = new Logger(ControlTrabajosGeometriaService.name);
  private redis?: Redis;

  async solicitarCancelacion(input: {
    jobId: string;
    tenantId: string;
    motivo: MotivoCancelacionGeometria;
    reemplazadoPor?: string;
  }): Promise<CancelacionTrabajoGeometria> {
    const cancelacion: CancelacionTrabajoGeometria = {
      tenantId: input.tenantId,
      solicitadaEl: new Date().toISOString(),
      motivo: input.motivo,
      ...(input.reemplazadoPor ? { reemplazadoPor: input.reemplazadoPor } : {}),
    };
    await this.client().set(
      claveCancelacion(input.jobId),
      JSON.stringify(cancelacion),
      'EX',
      TTL_CANCELACION_SEGUNDOS,
    );
    return cancelacion;
  }

  async leerCancelacion(
    jobId: string,
  ): Promise<CancelacionTrabajoGeometria | null> {
    const raw = await this.client().get(claveCancelacion(jobId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CancelacionTrabajoGeometria;
    } catch {
      this.logger.warn(`Cancelación inválida en Redis para job=${jobId}.`);
      return null;
    }
  }

  /** Registra la última solicitud de un scope y devuelve la anterior. */
  async activarScope(input: {
    tenantId: string;
    scope: string;
    jobId: string;
  }): Promise<string | null> {
    const result = await this.client().eval(
      [
        "local anterior = redis.call('GET', KEYS[1])",
        "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
        'return anterior',
      ].join('\n'),
      1,
      claveScope(input.tenantId, input.scope),
      input.jobId,
      String(TTL_SCOPE_SEGUNDOS),
    );
    return typeof result === 'string' ? result : null;
  }

  async liberarScopeSiActual(input: {
    tenantId: string;
    scope: string;
    jobId: string;
  }): Promise<void> {
    await this.client().eval(
      [
        "if redis.call('GET', KEYS[1]) == ARGV[1] then",
        "  return redis.call('DEL', KEYS[1])",
        'end',
        'return 0',
      ].join('\n'),
      1,
      claveScope(input.tenantId, input.scope),
      input.jobId,
    );
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect(false);
    this.redis = undefined;
  }

  private client(): Redis {
    if (this.redis) return this.redis;
    this.redis = new Redis(urlRedisWorkers(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: Number(
        process.env.WORKER_REDIS_CONNECT_TIMEOUT_MS ?? 5_000,
      ),
    });
    this.redis.on('error', (error) =>
      this.logger.warn(`Redis de control de geometría: ${error.message}`),
    );
    return this.redis;
  }
}

function claveCancelacion(jobId: string): string {
  return `${PREFIX}:cancel:${jobId}`;
}

function claveScope(tenantId: string, scope: string): string {
  const digest = createHash('sha256')
    .update(tenantId)
    .update('\0')
    .update(scope)
    .digest('hex');
  return `${PREFIX}:scope:${digest}`;
}
