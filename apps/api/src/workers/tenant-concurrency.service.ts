import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { urlRedisWorkers } from './redis';

export type LeaseTenant = {
  clave: string;
  propietario: string;
  duracionMs: number;
};

/**
 * Semáforo distribuido por tenant. Evita que una ráfaga de una sola empresa
 * ocupe toda la capacidad cuando existen varias réplicas del worker.
 */
@Injectable()
export class TenantConcurrencyService implements OnApplicationShutdown {
  private readonly logger = new Logger(TenantConcurrencyService.name);
  private redis?: Redis;

  async adquirir(input: {
    tenantId: string;
    categoria: 'cotizacion' | 'geometria' | 'geometria-intensiva';
    jobId: string;
    limite: number;
    duracionMs: number;
  }): Promise<LeaseTenant | null> {
    const propietario = `${process.pid}:${input.jobId}:${randomUUID()}`;
    const limite = Math.max(1, Math.min(20, Math.trunc(input.limite)));
    const duracionMs = Math.max(10_000, Math.trunc(input.duracionMs));
    for (let slot = 0; slot < limite; slot += 1) {
      const clave = claveSlot(input.tenantId, input.categoria, slot);
      const result = await this.client().set(
        clave,
        propietario,
        'PX',
        duracionMs,
        'NX',
      );
      if (result === 'OK') return { clave, propietario, duracionMs };
    }
    return null;
  }

  async renovar(lease: LeaseTenant): Promise<boolean> {
    const result = await this.client().eval(
      [
        "if redis.call('GET', KEYS[1]) == ARGV[1] then",
        "  return redis.call('PEXPIRE', KEYS[1], ARGV[2])",
        'end',
        'return 0',
      ].join('\n'),
      1,
      lease.clave,
      lease.propietario,
      String(lease.duracionMs),
    );
    return result === 1;
  }

  async liberar(lease: LeaseTenant): Promise<void> {
    await this.client().eval(
      [
        "if redis.call('GET', KEYS[1]) == ARGV[1] then",
        "  return redis.call('DEL', KEYS[1])",
        'end',
        'return 0',
      ].join('\n'),
      1,
      lease.clave,
      lease.propietario,
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
      this.logger.warn(`Redis de concurrencia por tenant: ${error.message}`),
    );
    return this.redis;
  }
}

function claveSlot(tenantId: string, categoria: string, slot: number): string {
  const tenantHash = createHash('sha256').update(tenantId).digest('hex');
  return `grafo:worker:v1:tenant:${tenantHash}:${categoria}:${slot}`;
}

export function limiteEntero(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 20
    ? parsed
    : fallback;
}
