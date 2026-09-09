import {
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Redis from 'ioredis';
import { urlRedisWorkers } from '../redis';

export type ClaseCapacidad = 'normal' | 'intensiva';
export type RegistroCapacidad = {
  jobId: string;
  tenantId: string;
  clase: ClaseCapacidad;
  prioridad: number;
};
export type PermisoCapacidad = {
  jobId: string;
  propietario: string;
  duracionMs: number;
};
export type ConfiguracionCapacidad = {
  cpu: number;
  memoriaMb: number;
  normal: { cpu: number; memoriaMb: number; maximos: number };
  intensiva: { cpu: number; memoriaMb: number; maximos: number };
  leaseMs: number;
  esperaMs: number;
};
export type EstadoCapacidad = {
  cpuReservada: number;
  memoriaReservadaMb: number;
  normalesActivos: number;
  intensivosActivos: number;
  trabajosPendientes: number;
  permisosActivos: number;
};

export function configuracionCapacidad(): ConfiguracionCapacidad {
  const valor = (key: string, fallback: number, max: number) => {
    const raw = process.env[key];
    const n = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > max)
      throw new Error(`${key} debe estar entre 1 y ${max}.`);
    return n;
  };
  const config: ConfiguracionCapacidad = {
    cpu: valor('GRAFONEST_POOL_CPU', 4, 1024),
    memoriaMb: valor('GRAFONEST_POOL_MEMORY_MB', 4096, 1048576),
    normal: {
      cpu: valor('GRAFONEST_NORMAL_CPU', 1, 64),
      memoriaMb: valor('GRAFONEST_NORMAL_MEMORY_MB', 1024, 65536),
      maximos: valor('GRAFONEST_NORMAL_MAX_ACTIVE', 2, 1000),
    },
    intensiva: {
      cpu: valor('GRAFONEST_HEAVY_CPU', 2, 64),
      memoriaMb: valor('GRAFONEST_HEAVY_MEMORY_MB', 2048, 65536),
      maximos: valor('GRAFONEST_HEAVY_MAX_ACTIVE', 1, 1000),
    },
    leaseMs: 60000,
    // Es la presencia en el planificador, no la vida del job de BullMQ.
    // Los intentos la renuevan; un job borrado o un API caído no puede dejar
    // un turno fantasma bloqueando a las otras fábricas durante horas.
    esperaMs: 30_000,
  };
  for (const clase of ['normal', 'intensiva'] as const)
    if (
      config[clase].cpu > config.cpu ||
      config[clase].memoriaMb > config.memoriaMb
    )
      throw new Error(
        `La reserva ${clase} excede la capacidad total del pool.`,
      );
  return config;
}

/** Admisión compartida entre réplicas. Reserva capacidad declarada; no sustituye
 * las cuotas de CPU/memoria del sistema operativo ni mide consumo instantáneo. */
@Injectable()
export class CapacidadGeometriaService implements OnApplicationShutdown {
  private readonly logger = new Logger(CapacidadGeometriaService.name);
  private readonly config = configuracionCapacidad();
  private readonly prefix = `grafo:geometry:capacity:v1:{${createHash('sha256')
    .update(process.env.GRAFONEST_POOL_ID?.trim() || 'principal')
    .digest('hex')}}`;
  private readonly lua = readFileSync(
    join(__dirname, 'capacidad-geometria.lua'),
    'utf8',
  );
  private redis?: Redis;

  registrar(input: RegistroCapacidad, confirmado = true): Promise<void> {
    return this.operar('registrar', {
      ...input,
      confirmado,
      tenant: createHash('sha256').update(input.tenantId).digest('hex'),
    }).then(() => undefined);
  }

  confirmar(jobId: string): Promise<void> {
    return this.operar('confirmar', { jobId }).then(() => undefined);
  }

  async adquirir(input: RegistroCapacidad): Promise<PermisoCapacidad | null> {
    const propietario = `${process.pid}:${randomUUID()}`;
    const result = await this.operar('adquirir', {
      ...input,
      confirmado: true,
      tenant: createHash('sha256').update(input.tenantId).digest('hex'),
      propietario,
    });
    return result === 1
      ? { jobId: input.jobId, propietario, duracionMs: this.config.leaseMs }
      : null;
  }

  async renovar(permiso: PermisoCapacidad): Promise<boolean> {
    return (await this.operar('renovar', permiso)) === 1;
  }

  async liberar(
    permiso: PermisoCapacidad,
    reintentar = false,
  ): Promise<boolean> {
    return (await this.operar('liberar', { ...permiso, reintentar })) === 1;
  }

  cancelar(jobId: string): Promise<void> {
    return this.operar('cancelar', { jobId }).then(() => undefined);
  }

  async siguiente(clase: ClaseCapacidad): Promise<string | null> {
    const id = await this.operar('siguiente', { clase });
    return typeof id === 'string' ? id : null;
  }

  async estado(): Promise<EstadoCapacidad> {
    return JSON.parse(
      String(await this.operar('estado', {})),
    ) as EstadoCapacidad;
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect(false);
    this.redis = undefined;
  }

  private operar(operacion: string, input: object): Promise<unknown> {
    if (!this.redis) {
      this.redis = new Redis(urlRedisWorkers(), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        commandTimeout: 5000,
      });
      this.redis.on('error', (e) =>
        this.logger.warn(`Redis de capacidad: ${e.message}`),
      );
    }
    return this.redis.eval(
      this.lua,
      1,
      this.prefix,
      JSON.stringify(this.config),
      operacion,
      JSON.stringify(input),
    );
  }
}

@Module({
  providers: [CapacidadGeometriaService],
  exports: [CapacidadGeometriaService],
})
export class CapacidadGeometriaModule {}
