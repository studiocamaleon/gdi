import { randomUUID } from 'node:crypto';
import { Job, Queue, QueueEvents } from 'bullmq';
import {
  COLA_GEOMETRIA,
  TRABAJO_NESTING_IRREGULAR_OPENNEST,
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  type NestingIrregularOpenNestData,
  type NestingIrregularOpenNestResult,
} from './colas';
import { conexionRedisWorker } from './redis';

async function main(): Promise<void> {
  const motor =
    process.env.OPENNEST_SMOKE_ENGINE === 'nfp' ? 'nfp' : 'collision';
  const connection = conexionRedisWorker();
  const queue = new Queue<
    NestingIrregularOpenNestData,
    NestingIrregularOpenNestResult,
    typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
  >(COLA_GEOMETRIA, { connection });
  const events = new QueueEvents(COLA_GEOMETRIA, { connection });
  try {
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]);
    const correlationId = randomUUID();
    const data: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'smoke-local',
      correlationId,
      solicitadoEl: new Date().toISOString(),
      motor,
      placa: { anchoMm: 100, altoMm: 60, margenMm: 2, maxPlacas: 3 },
      separacionMm: 3,
      timeoutMs: 10_000,
      semilla: 7,
      piezas: [
        {
          id: 'rectangulo',
          cantidad: 3,
          rotaciones: 4,
          contorno: [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 30, y: 20 },
            { x: 0, y: 20 },
          ],
        },
        {
          id: 'triangulo',
          cantidad: 2,
          rotaciones: 8,
          contorno: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 10, y: 16 },
          ],
        },
      ],
    };
    const job: Job<
      NestingIrregularOpenNestData,
      NestingIrregularOpenNestResult,
      typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
    > = await queue.add(TRABAJO_NESTING_IRREGULAR_OPENNEST, data, {
      jobId: `smoke-opennest-${correlationId}`,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });
    const result = await job.waitUntilFinished(events, data.timeoutMs + 5_000);
    if (
      result.cantidadColocada !== 5 ||
      (result.calidadSolucion === 'OPTIMIZADA' &&
        !result.estrategiaOrientacion) ||
      result.versionPoliticaOrientacion !==
        VERSION_POLITICA_ORIENTACION_GRAFONEST ||
      !result.validacion.completa ||
      !result.validacion.sinSolapamientos ||
      !result.validacion.separacionRespetada
    )
      throw new Error(
        `Resultado OpenNest inesperado: ${JSON.stringify(result)}`,
      );
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          queue: COLA_GEOMETRIA,
          jobId: job.id,
          motor: result.motor,
          algoritmo: result.algoritmo,
          calidadSolucion: result.calidadSolucion,
          optimizacionAgotada: result.optimizacionAgotada,
          versionMotor: result.versionMotor,
          cantidadColocada: result.cantidadColocada,
          placasUsadas: result.placasUsadas,
          duracionMs: result.duracionMs,
          estrategiaOrientacion: result.estrategiaOrientacion,
          rotacionesPermitidas: result.rotacionesPermitidas,
          versionPoliticaOrientacion: result.versionPoliticaOrientacion,
          validacion: result.validacion,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await Promise.allSettled([events.close(), queue.close()]);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n` +
      'Verificá Redis, el worker y OPENNEST_PYTHON.\n',
  );
  process.exitCode = 1;
});
