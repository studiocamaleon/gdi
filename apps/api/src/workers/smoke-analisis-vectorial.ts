import { randomUUID } from 'node:crypto';
import { Job, Queue, QueueEvents } from 'bullmq';
import {
  GeometriaVectorialCacheService,
  type ParametrosNestingVectorialCache,
} from '../motor-universal/geometria-vectorial/geometria-vectorial-cache.service';
import {
  finalizarAnalisisOpenNest,
  prepararAnalisisOpenNest,
} from '../motor-universal/geometria-vectorial/opennest-adapter';
import { CONFIGURACION_ENCASTRES_DEFAULT } from '../motor-universal/geometria-vectorial/segmentacion-encastres';
import {
  COLA_GEOMETRIA,
  TRABAJO_NESTING_IRREGULAR_OPENNEST,
  type NestingIrregularOpenNestData,
  type NestingIrregularOpenNestResult,
} from './colas';
import { conexionRedisWorker } from './redis';

const SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70">
    <path d="M 0 0 L 100 0 L 72 70 L 0 54 Z" />
  </svg>`;

async function main(): Promise<void> {
  const correlationId = randomUUID();
  const parametros: ParametrosNestingVectorialCache = {
    cantidad: 3,
    anchoPlacaMm: 300,
    altoPlacaMm: 200,
    margenMm: 5,
    separacionMm: 5,
    permitirRotacion: false,
    permitirSegmentacion: true,
    preservarComposicionOriginalSiEntra: false,
    configuracionEncastres: CONFIGURACION_ENCASTRES_DEFAULT,
  };
  const cache = new GeometriaVectorialCacheService();
  const sourceHash = cache.crearSourceHash(SVG);
  const cacheKey = cache.calcularCacheKey({
    tenantId: 'smoke-vectorial',
    sourceHash,
    anchoFinalMm: 100,
    parametros,
  });
  const preparacion = prepararAnalisisOpenNest({
    tenantId: 'smoke-vectorial',
    nombreArchivo: 'smoke-vectorial.svg',
    cacheKey,
    sourceHash,
    svg: SVG,
    anchoFinalMm: 100,
    parametros,
  });
  if (!preparacion.trabajo)
    throw new Error('El smoke esperaba un trabajo OpenNest.');
  const data: NestingIrregularOpenNestData = {
    ...preparacion.trabajo,
    tenantId: preparacion.contexto.tenantId,
    correlationId,
    solicitadoEl: new Date().toISOString(),
  };
  const connection = conexionRedisWorker();
  const queue = new Queue<
    NestingIrregularOpenNestData,
    NestingIrregularOpenNestResult,
    typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
  >(COLA_GEOMETRIA, { connection });
  const events = new QueueEvents(COLA_GEOMETRIA, { connection });
  let cacheRecuperado: GeometriaVectorialCacheService | undefined;
  try {
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
    const job: Job<
      NestingIrregularOpenNestData,
      NestingIrregularOpenNestResult,
      typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
    > = await queue.add(TRABAJO_NESTING_IRREGULAR_OPENNEST, data, {
      jobId: `smoke-vector-analysis-${correlationId}`,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });
    const result = await job.waitUntilFinished(events, data.timeoutMs + 5_000);
    const entry = finalizarAnalisisOpenNest({
      contexto: preparacion.contexto,
      resultado: result,
    });
    await cache.guardarCompartido(entry);
    // Fuerza una lectura L2: simula que la cotización llega a otra réplica.
    cache.onApplicationShutdown();
    cacheRecuperado = new GeometriaVectorialCacheService();
    const recovered = await cacheRecuperado.obtenerParaCotizacionCompartido({
      tenantId: preparacion.contexto.tenantId,
      cacheKey,
      svg: SVG,
      anchoFinalMm: 100,
      altoFinalMm: preparacion.contexto.analisis.geometria.altoMm,
    });
    if (
      !recovered ||
      (recovered.nesting.motorNesting !== 'opennest-v1' &&
        recovered.nesting.motorNesting !== 'grafonest-baseline-v1') ||
      recovered.nesting.placements.length !== 3 ||
      JSON.stringify(recovered.solucionNesting.resultado) !==
        JSON.stringify(recovered.nesting)
    ) {
      throw new Error('El resultado compartido no coincide con GrafoNest.');
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          jobId: job.id,
          cacheKey,
          motor: recovered.nesting.motorNesting,
          versionMotor: recovered.nesting.versionMotor,
          placas: recovered.nesting.placas,
          placements: recovered.nesting.placements.length,
          duracionMs: recovered.nesting.duracionMs,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    cache.onApplicationShutdown();
    cacheRecuperado?.onApplicationShutdown();
    await Promise.allSettled([events.close(), queue.close()]);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
