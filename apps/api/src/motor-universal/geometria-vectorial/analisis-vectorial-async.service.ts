import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { GeometriaJobsService } from '../../workers/geometria/geometria-jobs.service';
import type { VistaTrabajoGeometria } from '../../workers/geometria/geometria-jobs.service';
import { urlRedisWorkers } from '../../workers/redis';
import type { AnalizarSvgFabricacionDto } from './analizar-svg.dto';
import {
  GeometriaVectorialCacheService,
  type EntradaGeometriaVectorialCache,
  type ParametrosNestingVectorialCache,
} from './geometria-vectorial-cache.service';
import {
  entradaDesdeSolucion,
  finalizarAnalisisOpenNest,
  finalizarProblemaOpenNest,
  prepararAnalisisOpenNest,
  prepararProblemaOpenNest,
  type PreparacionAnalisisOpenNest,
} from './opennest-adapter';
import { resolverConfiguracionEncastresVectoriales } from './segmentacion-encastres';
import { MotorCotizacionError } from '../motor-error';
import type { ProblemaNesting, SolucionNesting } from './contrato-nesting';
import { timeoutOpenNestMs } from '../../workers/geometria/politica-busqueda';

const TTL_PREPARACION_SEGUNDOS = 24 * 60 * 60;
const PREFIX_PREPARACION = 'grafo:geometry:vector-analysis:v1';

export type ResultadoAnalisisVectorial = ReturnType<
  typeof respuestaDesdeEntrada
>;

export type VistaAnalisisVectorial = Omit<
  VistaTrabajoGeometria,
  'tipo' | 'resultado'
> & {
  tipo: 'analisis-vectorial-opennest';
  resultado?: ResultadoAnalisisVectorial;
};

@Injectable()
export class AnalisisVectorialAsyncService implements OnApplicationShutdown {
  private readonly logger = new Logger(AnalisisVectorialAsyncService.name);
  private redis?: Redis;

  constructor(
    private readonly jobs: GeometriaJobsService,
    private readonly cache: GeometriaVectorialCacheService,
  ) {}

  async iniciar(input: {
    tenantId: string;
    dto: AnalizarSvgFabricacionDto;
  }): Promise<VistaAnalisisVectorial> {
    const parametros = parametrosDesdeDto(input.dto);
    const sourceHash = this.cache.crearSourceHash(input.dto.svg);
    const cacheKey = this.cache.calcularCacheKey({
      tenantId: input.tenantId,
      sourceHash,
      anchoFinalMm: input.dto.anchoFinalMm,
      altoFinalMm: input.dto.altoFinalMm,
      configuracionCapas: input.dto.configuracionCapas,
      parametros,
    });
    // La geometría persistida es la fuente del mejor acomodo. Una entrada L2
    // de un análisis anterior podría ocultar una preparación más reciente.
    const preparacion = prepararAnalisisOpenNest({
      tenantId: input.tenantId,
      nombreArchivo: input.dto.nombreArchivo,
      cacheKey,
      sourceHash,
      svg: input.dto.svg,
      anchoFinalMm: input.dto.anchoFinalMm,
      altoFinalMm: input.dto.altoFinalMm,
      configuracionCapas: input.dto.configuracionCapas,
      parametros,
    });
    if (preparacion.solucionInmediata) {
      const entry = entradaDesdeSolucion({
        contexto: preparacion.contexto,
        solucion: preparacion.solucionInmediata,
      });
      await this.cache.guardarCompartido(entry);
      return vistaCache(entry, input.dto.nombreArchivo);
    }
    if (!preparacion.trabajo)
      throw new Error('No se generó el trabajo de nesting vectorial.');

    const trabajo = await this.jobs.crear({
      tenantId: input.tenantId,
      dto: {
        motor: preparacion.trabajo.motor,
        placa: preparacion.trabajo.placa,
        separacionMm: preparacion.trabajo.separacionMm,
        commonLine: preparacion.trabajo.commonLine,
        timeoutMs: preparacion.trabajo.timeoutMs,
        semilla: preparacion.trabajo.semilla,
        piezas: preparacion.trabajo.piezas.map((pieza) => ({
          ...pieza,
          huecos: pieza.huecos?.map((puntos) => ({ puntos })),
        })),
        claveSolicitud: input.dto.claveSolicitud,
      },
    });
    if (trabajo.estado === 'completado' && trabajo.resultado) {
      const entry = finalizarAnalisisOpenNest({
        contexto: preparacion.contexto,
        resultado: trabajo.resultado,
      });
      await this.cache.guardarCompartido(entry);
      return vistaCache(entry, input.dto.nombreArchivo);
    }
    await this.guardarPreparacion(trabajo.id, preparacion.contexto);
    return vistaDesdeTrabajo(trabajo);
  }

  async consultar(
    tenantId: string,
    jobId: string,
  ): Promise<VistaAnalisisVectorial> {
    const trabajo = await this.jobs.consultar(tenantId, jobId);
    if (trabajo.estado !== 'completado' || !trabajo.resultado)
      return vistaDesdeTrabajo(trabajo);

    const contexto = await this.leerPreparacion(jobId);
    if (!contexto || contexto.tenantId !== tenantId) {
      throw new NotFoundException(
        'El contexto del análisis vectorial venció o no está disponible.',
      );
    }
    const entry = finalizarAnalisisOpenNest({
      contexto,
      resultado: trabajo.resultado,
    });
    await this.cache.guardarCompartido(entry);
    return {
      ...vistaDesdeTrabajo(trabajo),
      resultado: respuestaDesdeEntrada(entry, contexto.nombreArchivo, false),
    };
  }

  async cancelar(
    tenantId: string,
    jobId: string,
  ): Promise<VistaAnalisisVectorial> {
    return vistaDesdeTrabajo(await this.jobs.cancelar(tenantId, jobId));
  }

  /**
   * Puente para cotizaciones compuestas: sus componentes heredan el SVG pero
   * recién al resolver cada receta conocemos su placa y política efectivas.
   * La espera no ejecuta geometría en el API; sólo observa el job del worker.
   */
  async resolverParaCotizacion(input: {
    tenantId: string;
    dto: AnalizarSvgFabricacionDto;
  }): Promise<SolucionNesting> {
    let vista = await this.iniciar(input);
    const limite = Date.now() + timeoutEsperaCotizacionMs();
    while (vista.estado === 'pendiente' || vista.estado === 'procesando') {
      if (Date.now() >= limite) {
        await this.cancelar(input.tenantId, vista.id).catch(() => undefined);
        throw errorCalculoNesting({
          estado: 'fallido',
          error: {
            codigo: 'TIMEOUT',
            mensaje: 'El nesting vectorial superó el tiempo máximo de cálculo.',
          },
        });
      }
      await esperar(250);
      vista = await this.consultar(input.tenantId, vista.id);
    }
    if (vista.estado === 'completado' && vista.resultado) {
      return vista.resultado.solucionNesting;
    }
    throw errorCalculoNesting(vista);
  }

  /**
   * Resuelve demandas ya normalizadas (por ejemplo, piezas de varios
   * componentes) en el mismo worker que procesa los SVG individuales.
   */
  async resolverProblemaParaCotizacion(input: {
    tenantId: string;
    problema: ProblemaNesting;
    claveSolicitud?: string;
  }): Promise<SolucionNesting> {
    const problemaHash = createHash('sha256')
      .update(JSON.stringify(input.problema))
      .digest('hex');
    const preparacion = prepararProblemaOpenNest({
      problema: input.problema,
      claveSemilla: problemaHash,
    });
    if (preparacion.solucionInmediata) {
      return preparacion.solucionInmediata;
    }
    if (!preparacion.trabajo) {
      throw errorCalculoNesting({ estado: 'fallido' });
    }
    let vista = await this.jobs.crear({
      tenantId: input.tenantId,
      dto: {
        motor: preparacion.trabajo.motor,
        placa: preparacion.trabajo.placa,
        separacionMm: preparacion.trabajo.separacionMm,
        commonLine: preparacion.trabajo.commonLine,
        timeoutMs: preparacion.trabajo.timeoutMs,
        semilla: preparacion.trabajo.semilla,
        piezas: preparacion.trabajo.piezas.map((pieza) => ({
          ...pieza,
          huecos: pieza.huecos?.map((puntos) => ({ puntos })),
        })),
        // Cada demanda tiene su propio scope: preparar 50 unidades no cancela
        // la preparación de 10 del mismo producto. La misma demanda se comparte.
        claveSolicitud: `${input.claveSolicitud ?? 'cotizacion-piezas'}-${problemaHash}`,
      },
    });
    const limite = Date.now() + timeoutEsperaCotizacionMs();
    while (vista.estado === 'pendiente' || vista.estado === 'procesando') {
      if (Date.now() >= limite) {
        await this.cancelar(input.tenantId, vista.id).catch(() => undefined);
        throw errorCalculoNesting({
          estado: 'fallido',
          error: {
            codigo: 'TIMEOUT',
            mensaje: 'El nesting vectorial superó el tiempo máximo de cálculo.',
          },
        });
      }
      await esperar(250);
      vista = await this.jobs.consultar(input.tenantId, vista.id);
    }
    if (vista.estado === 'completado' && vista.resultado) {
      return finalizarProblemaOpenNest({
        contexto: preparacion,
        resultado: vista.resultado,
      });
    }
    throw errorCalculoNesting(vista);
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect(false);
    this.redis = undefined;
  }

  private async guardarPreparacion(
    jobId: string,
    contexto: PreparacionAnalisisOpenNest,
  ): Promise<void> {
    await this.client().set(
      clavePreparacion(jobId),
      JSON.stringify(contexto),
      'EX',
      TTL_PREPARACION_SEGUNDOS,
    );
  }

  private async leerPreparacion(
    jobId: string,
  ): Promise<PreparacionAnalisisOpenNest | null> {
    const raw = await this.client().get(clavePreparacion(jobId));
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as PreparacionAnalisisOpenNest;
      return value.schemaVersion === 1 ? value : null;
    } catch {
      this.logger.warn(`Preparación vectorial inválida para job=${jobId}.`);
      return null;
    }
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
      this.logger.warn(`Redis del análisis vectorial: ${error.message}`),
    );
    return this.redis;
  }
}

function parametrosDesdeDto(
  dto: AnalizarSvgFabricacionDto,
): ParametrosNestingVectorialCache {
  return {
    cantidad: dto.cantidad,
    anchoPlacaMm: dto.anchoPlacaMm,
    altoPlacaMm: dto.altoPlacaMm,
    margenMm: dto.margenMm ?? 0,
    separacionMm: dto.separacionMm ?? 0,
    permitirRotacion: dto.permitirRotacion !== false,
    permitirSegmentacion: dto.permitirSegmentacion !== false,
    preservarComposicionOriginalSiEntra:
      dto.preservarComposicionOriginalSiEntra === true,
    configuracionEncastres: resolverConfiguracionEncastresVectoriales(
      dto.configuracionEncastres,
    ),
    commonLine: dto.commonLine?.habilitado ? dto.commonLine : undefined,
  };
}

function respuestaDesdeEntrada(
  entry: EntradaGeometriaVectorialCache,
  nombreArchivo: string,
  cacheHit: boolean,
) {
  return {
    nombreArchivo,
    cacheKey: entry.cacheKey,
    cacheHit,
    geometria: entry.analisis.geometria,
    nesting: entry.nesting,
    solucionNesting: entry.solucionNesting,
    configuracionCapas: entry.configuracionCapas,
    configuracionEncastres: entry.parametros.configuracionEncastres,
    commonLine: entry.parametros.commonLine,
    diagnosticos: entry.analisis.diagnosticos,
  };
}

function vistaCache(
  entry: EntradaGeometriaVectorialCache,
  nombreArchivo: string,
): VistaAnalisisVectorial {
  const ahora = new Date().toISOString();
  return {
    id: `cache-${entry.cacheKey}`,
    tipo: 'analisis-vectorial-opennest',
    estado: 'completado',
    creadoEl: ahora,
    iniciadoEl: ahora,
    finalizadoEl: ahora,
    correlationId: entry.cacheKey,
    progreso: { porcentaje: 100, etapa: 'completado' },
    resultado: respuestaDesdeEntrada(entry, nombreArchivo, true),
  };
}

function vistaDesdeTrabajo(
  trabajo: VistaTrabajoGeometria,
): VistaAnalisisVectorial {
  const { resultado, tipo, ...rest } = trabajo;
  void resultado;
  void tipo;
  return { ...rest, tipo: 'analisis-vectorial-opennest' };
}

function clavePreparacion(jobId: string): string {
  return `${PREFIX_PREPARACION}:${jobId}`;
}

function timeoutEsperaCotizacionMs(): number {
  const value = Number(process.env.OPENNEST_QUOTE_WAIT_TIMEOUT_MS ?? 900_000);
  const configurado =
    Number.isInteger(value) && value >= 1_000 && value <= 60 * 60 * 1_000
      ? value
      : 900_000;
  return Math.max(configurado, timeoutOpenNestMs() + 60_000);
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Los fallos del worker no significan que la geometría no entre en la placa. */
function errorCalculoNesting(
  vista: Pick<VistaTrabajoGeometria, 'estado' | 'error'>,
): MotorCotizacionError {
  const motivo =
    vista.estado === 'cancelado'
      ? 'cancelado'
      : vista.error?.codigo === 'TIMEOUT'
        ? 'tiempo_agotado'
        : 'fallido';
  return new MotorCotizacionError(
    `nesting_calculo_${motivo}`,
    vista.error?.mensaje ??
      (motivo === 'cancelado'
        ? 'El nesting vectorial fue cancelado.'
        : 'No se pudo completar el nesting vectorial.'),
    'Reintentá la cotización. Los datos cargados se conservan.',
    { codigoGeometria: vista.error?.codigo },
  );
}
