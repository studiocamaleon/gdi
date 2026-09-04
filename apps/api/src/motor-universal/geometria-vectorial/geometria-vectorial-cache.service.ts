import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import type { JobContext } from '../tipos';
import { urlRedisWorkers } from '../../workers/redis';
import { analizarSvgFabricacion } from './svg-parser';
import { aplicarCapasAGeometria } from './capas-vectoriales';
import { NestingIrregularError } from './nesting-irregular';
import type {
  ConfiguracionCapasVectoriales,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
} from './tipos';
import type { ConfiguracionEncastresVectoriales } from './segmentacion-encastres';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../../workers/colas';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
  type SolucionNesting,
} from './contrato-nesting';

const CACHE_TTL_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const CACHE_REDIS_PREFIX = 'grafo:geometry:analysis:v3';
const CACHE_INTERNO = Symbol('geometria-vectorial-cache');
type AnalisisSvgResultado = ReturnType<typeof analizarSvgFabricacion>;

export interface ParametrosNestingVectorialCache {
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm: number;
  separacionMm: number;
  permitirRotacion: boolean;
  permitirSegmentacion?: boolean;
  preservarComposicionOriginalSiEntra: boolean;
  configuracionEncastres: ConfiguracionEncastresVectoriales;
}

export interface EntradaGeometriaVectorialCache {
  cacheKey: string;
  tenantId: string;
  sourceHash: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  analisis: AnalisisSvgResultado;
  geometriaFabricacion: GeometriaVectorialCanonica;
  nesting: NestingIrregularResult;
  solucionNesting: SolucionNesting;
  configuracionCapas?: ConfiguracionCapasVectoriales;
  parametros: ParametrosNestingVectorialCache;
  expiresAt: number;
}

type JobContextConCache = JobContext & {
  [CACHE_INTERNO]?: {
    entry: EntradaGeometriaVectorialCache;
    nestingReutilizado: boolean;
  };
};

@Injectable()
export class GeometriaVectorialCacheService implements OnApplicationShutdown {
  private readonly logger = new Logger(GeometriaVectorialCacheService.name);
  private readonly cacheTtlMs = cacheTtlMs();
  private readonly entries = new Map<string, EntradaGeometriaVectorialCache>();
  private redis?: Redis;

  analizar(input: {
    tenantId: string;
    svg: string;
    anchoFinalMm: number;
    altoFinalMm?: number;
    configuracionCapas?: ConfiguracionCapasVectoriales;
    parametros: ParametrosNestingVectorialCache;
  }): { entry: EntradaGeometriaVectorialCache; cacheHit: boolean } {
    const sourceHash = hash(input.svg);
    const cacheKey = this.calcularCacheKey({
      tenantId: input.tenantId,
      sourceHash,
      anchoFinalMm: input.anchoFinalMm,
      altoFinalMm: input.altoFinalMm,
      configuracionCapas: input.configuracionCapas,
      parametros: input.parametros,
    });
    const existing = this.get(input.tenantId, cacheKey);
    if (existing) return { entry: existing, cacheHit: true };

    const analisis = analizarSvgFabricacion({
      svg: input.svg,
      anchoFinalMm: input.anchoFinalMm,
      altoFinalMm: input.altoFinalMm,
    });
    const geometriaFabricacion = aplicarCapasAGeometria(
      analisis.geometria,
      input.configuracionCapas,
    );
    if (geometriaFabricacion.piezas.length === 0) {
      throw new NestingIrregularError(
        'El diseño no tiene piezas configuradas para cortar. Marcá al menos un objeto como pieza o encastre.',
      );
    }
    const problema = crearProblemaNestingIrregular({
      demandas: crearDemandasDesdeGeometriaVectorial({
        geometria: geometriaFabricacion,
        cantidad: input.parametros.cantidad,
      }),
      anchoPlacaMm: input.parametros.anchoPlacaMm,
      altoPlacaMm: input.parametros.altoPlacaMm,
      margenMm: input.parametros.margenMm,
      separacionMm: input.parametros.separacionMm,
      permitirRotacion: input.parametros.permitirRotacion,
      permitirSegmentacion: input.parametros.permitirSegmentacion,
      preservarComposicionOriginalSiEntra:
        input.parametros.preservarComposicionOriginalSiEntra,
      configuracionEncastres: input.parametros.configuracionEncastres,
    });
    const solucionNesting = resolverProblemaNestingIrregular(problema);
    const nesting = solucionNesting.resultado;
    const entry: EntradaGeometriaVectorialCache = {
      cacheKey,
      tenantId: input.tenantId,
      sourceHash,
      anchoFinalMm: input.anchoFinalMm,
      altoFinalMm: analisis.geometria.altoMm,
      analisis,
      geometriaFabricacion,
      nesting,
      solucionNesting,
      configuracionCapas: input.configuracionCapas,
      parametros: input.parametros,
      expiresAt: Date.now() + this.cacheTtlMs,
    };
    this.entries.set(this.scopedKey(input.tenantId, cacheKey), entry);
    this.prune();
    return { entry, cacheHit: false };
  }

  calcularCacheKey(input: {
    tenantId: string;
    sourceHash: string;
    anchoFinalMm: number;
    altoFinalMm?: number;
    configuracionCapas?: ConfiguracionCapasVectoriales;
    parametros: ParametrosNestingVectorialCache;
  }): string {
    return hash(
      JSON.stringify({
        versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
        tenantId: input.tenantId,
        sourceHash: input.sourceHash,
        anchoFinalMm: input.anchoFinalMm,
        altoFinalMm: input.altoFinalMm,
        configuracionCapas: input.configuracionCapas,
        ...input.parametros,
      }),
    );
  }

  crearSourceHash(svg: string): string {
    return hash(svg);
  }

  /**
   * L2 compartido entre réplicas del API. Sólo se publica una entrada después
   * de que la solución del worker atravesó la validación geométrica estricta.
   */
  async guardarCompartido(
    entry: EntradaGeometriaVectorialCache,
  ): Promise<void> {
    this.guardarLocal(entry);
    await this.client().set(
      claveRedis(entry.tenantId, entry.cacheKey),
      JSON.stringify(entry),
      'EX',
      Math.ceil(this.cacheTtlMs / 1_000),
    );
  }

  async obtenerCompartido(
    tenantId: string,
    cacheKey: string,
  ): Promise<EntradaGeometriaVectorialCache | null> {
    const local = this.get(tenantId, cacheKey);
    if (local) return local;
    const raw = await this.client().get(claveRedis(tenantId, cacheKey));
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as EntradaGeometriaVectorialCache;
      if (
        entry.tenantId !== tenantId ||
        entry.cacheKey !== cacheKey ||
        entry.expiresAt <= Date.now()
      )
        return null;
      this.guardarLocal(entry);
      return entry;
    } catch {
      this.logger.warn(
        `Entrada vectorial inválida en Redis para cache=${cacheKey}.`,
      );
      return null;
    }
  }

  async obtenerParaCotizacionCompartido(input: {
    tenantId: string;
    cacheKey?: string;
    svg: string;
    anchoFinalMm: number;
    altoFinalMm?: number;
    configuracionCapas?: ConfiguracionCapasVectoriales;
  }): Promise<EntradaGeometriaVectorialCache | null> {
    if (!input.cacheKey) return null;
    const entry = await this.obtenerCompartido(input.tenantId, input.cacheKey);
    if (!entry) return null;
    if (
      entry.sourceHash !== hash(input.svg) ||
      entry.anchoFinalMm !== input.anchoFinalMm ||
      (input.altoFinalMm !== undefined &&
        entry.altoFinalMm !== input.altoFinalMm) ||
      JSON.stringify(entry.configuracionCapas) !==
        JSON.stringify(input.configuracionCapas)
    )
      return null;
    return entry;
  }

  obtenerParaCotizacion(input: {
    tenantId: string;
    cacheKey?: string;
    svg: string;
    anchoFinalMm: number;
    altoFinalMm?: number;
    configuracionCapas?: ConfiguracionCapasVectoriales;
  }): EntradaGeometriaVectorialCache | null {
    if (!input.cacheKey) return null;
    const entry = this.get(input.tenantId, input.cacheKey);
    if (!entry) return null;
    if (
      entry.sourceHash !== hash(input.svg) ||
      entry.anchoFinalMm !== input.anchoFinalMm ||
      (input.altoFinalMm !== undefined &&
        entry.altoFinalMm !== input.altoFinalMm) ||
      JSON.stringify(entry.configuracionCapas) !==
        JSON.stringify(input.configuracionCapas)
    )
      return null;
    return entry;
  }

  private get(
    tenantId: string,
    cacheKey: string,
  ): EntradaGeometriaVectorialCache | null {
    const scopedKey = this.scopedKey(tenantId, cacheKey);
    const entry = this.entries.get(scopedKey);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(scopedKey);
      return null;
    }
    this.entries.delete(scopedKey);
    this.entries.set(scopedKey, entry);
    return entry;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > CACHE_MAX_ENTRIES) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect(false);
    this.redis = undefined;
  }

  private guardarLocal(entry: EntradaGeometriaVectorialCache): void {
    const key = this.scopedKey(entry.tenantId, entry.cacheKey);
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune();
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
      this.logger.warn(`Redis del cache vectorial: ${error.message}`),
    );
    return this.redis;
  }

  private scopedKey(tenantId: string, cacheKey: string): string {
    return `${tenantId}:${cacheKey}`;
  }
}

function cacheTtlMs(): number {
  const segundos = Number(process.env.GRAFONEST_CACHE_TTL_SECONDS);
  if (
    Number.isInteger(segundos) &&
    segundos >= 60 &&
    segundos <= 90 * 24 * 60 * 60
  ) {
    return segundos * 1_000;
  }
  return CACHE_TTL_DEFAULT_MS;
}

export function adjuntarCacheVectorial(
  jobContext: JobContext,
  entry: EntradaGeometriaVectorialCache,
): void {
  Object.defineProperty(jobContext, CACHE_INTERNO, {
    configurable: true,
    enumerable: false,
    value: { entry, nestingReutilizado: false },
  });
}

export function obtenerCacheVectorial(
  jobContext: JobContext,
): EntradaGeometriaVectorialCache | null {
  return (jobContext as JobContextConCache)[CACHE_INTERNO]?.entry ?? null;
}

export function marcarNestingVectorialReutilizado(
  jobContext: JobContext,
): void {
  const state = (jobContext as JobContextConCache)[CACHE_INTERNO];
  if (state) state.nestingReutilizado = true;
}

export function nestingVectorialFueReutilizado(
  jobContext: JobContext,
): boolean {
  return Boolean(
    (jobContext as JobContextConCache)[CACHE_INTERNO]?.nestingReutilizado,
  );
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function claveRedis(tenantId: string, cacheKey: string): string {
  return `${CACHE_REDIS_PREFIX}:${hash(tenantId)}:${cacheKey}`;
}
