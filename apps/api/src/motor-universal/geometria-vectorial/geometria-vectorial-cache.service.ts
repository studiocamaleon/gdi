import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { JobContext } from '../tipos';
import { analizarSvgFabricacion } from './svg-parser';
import { aplicarCapasAGeometria } from './capas-vectoriales';
import {
  NestingIrregularError,
  nestearGeometriaIrregular,
} from './nesting-irregular';
import type {
  ConfiguracionCapasVectoriales,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
} from './tipos';
import type { ConfiguracionEncastresVectoriales } from './segmentacion-encastres';

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const CACHE_INTERNO = Symbol('geometria-vectorial-cache');
type AnalisisSvgResultado = ReturnType<typeof analizarSvgFabricacion>;

export interface ParametrosNestingVectorialCache {
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm: number;
  separacionMm: number;
  permitirRotacion: boolean;
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
export class GeometriaVectorialCacheService {
  private readonly entries = new Map<string, EntradaGeometriaVectorialCache>();

  analizar(input: {
    tenantId: string;
    svg: string;
    anchoFinalMm: number;
    altoFinalMm?: number;
    configuracionCapas?: ConfiguracionCapasVectoriales;
    parametros: ParametrosNestingVectorialCache;
  }): { entry: EntradaGeometriaVectorialCache; cacheHit: boolean } {
    const sourceHash = hash(input.svg);
    const cacheKey = this.crearCacheKey({
      tenantId: input.tenantId,
      sourceHash,
      anchoFinalMm: input.anchoFinalMm,
      altoFinalMm: input.altoFinalMm,
      configuracionCapas: input.configuracionCapas,
      ...input.parametros,
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
    const nesting = nestearGeometriaIrregular({
      geometria: geometriaFabricacion,
      ...input.parametros,
    });
    const entry: EntradaGeometriaVectorialCache = {
      cacheKey,
      tenantId: input.tenantId,
      sourceHash,
      anchoFinalMm: input.anchoFinalMm,
      altoFinalMm: input.altoFinalMm,
      analisis,
      geometriaFabricacion,
      nesting,
      configuracionCapas: input.configuracionCapas,
      parametros: input.parametros,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.entries.set(this.scopedKey(input.tenantId, cacheKey), entry);
    this.prune();
    return { entry, cacheHit: false };
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
      entry.altoFinalMm !== input.altoFinalMm
      || JSON.stringify(entry.configuracionCapas) !==
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

  private crearCacheKey(input: Record<string, unknown>): string {
    return hash(JSON.stringify(input));
  }

  private scopedKey(tenantId: string, cacheKey: string): string {
    return `${tenantId}:${cacheKey}`;
  }
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
