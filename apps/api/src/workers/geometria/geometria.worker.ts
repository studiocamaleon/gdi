import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Worker } from 'bullmq';
import {
  COLA_GEOMETRIA,
  COLA_GEOMETRIA_INTENSIVA,
  TRABAJO_MEDIR_POLIGONO,
  TRABAJO_NESTING_IRREGULAR_OPENNEST,
  type MedirPoligonoData,
  type NestingIrregularOpenNestData,
  type TrabajoGeometriaData,
  type TrabajoGeometriaNombre,
  type TrabajoGeometriaResult,
} from '../colas';
import {
  concurrenciaGeometria,
  conexionRedisWorker,
  timeoutConexionWorkerMs,
} from '../redis';
import { medirPoligono } from './medir-poligono';
import { OpenNestService } from './opennest.service';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import {
  limiteEntero,
  TenantConcurrencyService,
} from '../tenant-concurrency.service';

@Injectable()
export class GeometriaWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(GeometriaWorker.name);
  constructor(
    private readonly openNestService: OpenNestService,
    private readonly control: ControlTrabajosGeometriaService,
    private readonly tenantConcurrency: TenantConcurrencyService,
  ) {}

  private workers: Array<
    Worker<TrabajoGeometriaData, TrabajoGeometriaResult, TrabajoGeometriaNombre>
  > = [];

  async onApplicationBootstrap(): Promise<void> {
    const configuraciones = [
      { nombre: COLA_GEOMETRIA, concurrencia: concurrenciaGeometria() },
      {
        nombre: COLA_GEOMETRIA_INTENSIVA,
        concurrencia: concurrenciaGeometriaIntensiva(),
      },
    ];
    this.workers = configuraciones.map(({ nombre, concurrencia }) => {
      const worker = new Worker<
        TrabajoGeometriaData,
        TrabajoGeometriaResult,
        TrabajoGeometriaNombre
      >(nombre, (job) => this.procesar(job), {
        connection: conexionRedisWorker(),
        concurrency: concurrencia,
        name: `geometry-${process.pid}`,
        removeOnComplete: { age: 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
      });
      this.conectarEventos(worker);
      return worker;
    });
    try {
      await Promise.all(
        this.workers.map((worker) =>
          conTimeout(
            worker.waitUntilReady(),
            timeoutConexionWorkerMs(),
            `El worker de geometría no pudo conectarse a Redis (${worker.name}).`,
          ),
        ),
      );
    } catch (error) {
      await Promise.all(
        this.workers.map((worker) => worker.close(true).catch(() => undefined)),
      );
      this.workers = [];
      throw error;
    }
    this.logger.log(
      `Workers listos: ${configuraciones.map((item) => `${item.nombre}=${item.concurrencia}`).join(', ')}.`,
    );
  }

  private conectarEventos(
    worker: Worker<
      TrabajoGeometriaData,
      TrabajoGeometriaResult,
      TrabajoGeometriaNombre
    >,
  ): void {
    worker.on('completed', (job) => {
      const resultado = job.returnvalue;
      this.logger.log({
        event: 'worker_job_completed',
        queue: job.queueName,
        jobId: job.id,
        jobName: job.name,
        tenantId: job.data.tenantId,
        claseComplejidad:
          'claseComplejidad' in job.data
            ? job.data.claseComplejidad
            : undefined,
        attemptsStarted: job.attemptsStarted,
        pesoEstimado:
          'pesoEstimado' in job.data ? job.data.pesoEstimado : undefined,
        esperaColaMs: job.processedOn
          ? Math.max(0, job.processedOn - job.timestamp)
          : undefined,
        ejecucionMs:
          job.finishedOn && job.processedOn
            ? Math.max(0, job.finishedOn - job.processedOn)
            : undefined,
        totalMs: job.finishedOn
          ? Math.max(0, job.finishedOn - job.timestamp)
          : undefined,
        algoritmo:
          resultado && 'algoritmo' in resultado
            ? resultado.algoritmo
            : undefined,
        calidadSolucion:
          resultado && 'calidadSolucion' in resultado
            ? resultado.calidadSolucion
            : undefined,
        placasUsadas:
          resultado && 'placasUsadas' in resultado
            ? resultado.placasUsadas
            : undefined,
      });
    });
    worker.on('failed', (job, error) => {
      const detail = {
        event: 'worker_job_failed',
        queue: job?.queueName,
        jobId: job?.id,
        jobName: job?.name,
        tenantId: job?.data.tenantId,
        claseComplejidad:
          job && 'claseComplejidad' in job.data
            ? job.data.claseComplejidad
            : undefined,
        attemptsStarted: job?.attemptsStarted,
        message: error.message,
      };
      if (error.message.includes('cancelado')) this.logger.log(detail);
      else this.logger.error(detail);
    });
    worker.on('error', (error) => {
      this.logger.error({
        event: 'worker_connection_error',
        queue: worker.name,
        message: error.message,
      });
    });
    worker.on('stalled', (jobId) => {
      this.logger.warn({
        event: 'worker_job_stalled',
        queue: worker.name,
        jobId,
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    const workers = this.workers;
    this.workers = [];
    if (!workers.length) return;
    this.logger.log('Cerrando workers de geometría.');
    await Promise.all(workers.map((worker) => worker.close()));
  }

  private procesar(
    job: Job<
      TrabajoGeometriaData,
      TrabajoGeometriaResult,
      TrabajoGeometriaNombre
    >,
  ): Promise<TrabajoGeometriaResult> {
    switch (job.name) {
      case TRABAJO_MEDIR_POLIGONO:
        return Promise.resolve(medirPoligono(job.data as MedirPoligonoData));
      case TRABAJO_NESTING_IRREGULAR_OPENNEST:
        return this.procesarOpenNest(
          job as Job<
            NestingIrregularOpenNestData,
            TrabajoGeometriaResult,
            typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
          >,
        );
      default:
        throw new Error(
          `Trabajo geométrico no soportado: ${String(job.name)}.`,
        );
    }
  }

  private async procesarOpenNest(
    job: Job<
      NestingIrregularOpenNestData,
      TrabajoGeometriaResult,
      typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
    >,
  ): Promise<TrabajoGeometriaResult> {
    const jobId = String(job.id ?? 'sin-id');
    const intensiva = job.queueName === COLA_GEOMETRIA_INTENSIVA;
    const lease = await this.tenantConcurrency.adquirir({
      tenantId: job.data.tenantId,
      categoria: intensiva ? 'geometria-intensiva' : 'geometria',
      jobId,
      limite: limiteEntero(process.env.WORKER_TENANT_GEOMETRY_CONCURRENCY, 1),
      duracionMs: Math.max(60_000, job.data.timeoutMs + 30_000),
    });
    if (!lease) {
      if (!job.token)
        throw new Error('El trabajo no tiene token para reprogramarse.');
      await job.moveToDelayed(
        Date.now() + demoraReintentoTenantMs(),
        job.token,
      );
      throw new DelayedError();
    }
    const renovacion = setInterval(
      () => void this.tenantConcurrency.renovar(lease),
      Math.max(5_000, Math.floor(lease.duracionMs / 3)),
    );
    renovacion.unref();
    const controller = new AbortController();
    let consultando = false;
    const verificarCancelacion = async () => {
      if (consultando || controller.signal.aborted || !job.id) return;
      consultando = true;
      try {
        if (await this.control.leerCancelacion(job.id)) controller.abort();
      } catch (error) {
        this.logger.warn(
          `No se pudo consultar cancelación de job=${job.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        consultando = false;
      }
    };
    let timer: NodeJS.Timeout | undefined;
    try {
      await job.updateProgress({ porcentaje: 10, etapa: 'opennest' });
      await verificarCancelacion();
      timer = setInterval(() => void verificarCancelacion(), 250);
      timer.unref();
      const result = await this.openNestService.resolver(job.data, {
        signal: controller.signal,
        onCandidate: async () => {
          await verificarCancelacion();
          if (controller.signal.aborted)
            throw new Error('El cálculo de geometría fue cancelado.');
          await job.updateProgress({ porcentaje: 90, etapa: 'validando' });
        },
      });
      await verificarCancelacion();
      if (controller.signal.aborted)
        throw new Error('El cálculo de geometría fue cancelado.');
      await job.updateProgress({ porcentaje: 100, etapa: 'completado' });
      return result;
    } finally {
      if (timer) clearInterval(timer);
      clearInterval(renovacion);
      await this.tenantConcurrency
        .liberar(lease)
        .catch((error: unknown) =>
          this.logger.warn(
            `No se pudo liberar concurrencia de job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }
  }
}

function demoraReintentoTenantMs(): number {
  return 350 + Math.floor(Math.random() * 350);
}

function concurrenciaGeometriaIntensiva(): number {
  const value = Number(process.env.WORKER_GEOMETRY_HEAVY_CONCURRENCY ?? 1);
  return Number.isInteger(value) && value > 0 && value <= 8 ? value : 1;
}

async function conTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
