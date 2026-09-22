import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Worker, type MinimalQueue } from 'bullmq';
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
import {
  CapacidadGeometriaService,
  type PermisoCapacidad,
} from './capacidad-geometria.service';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import {
  limiteEntero,
  TenantConcurrencyService,
  type LeaseTenant,
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
    private readonly capacidad: CapacidadGeometriaService,
    private readonly capacidadesPlan: CapacidadesEmpresaService,
  ) {}

  private workers: Array<
    Worker<TrabajoGeometriaData, TrabajoGeometriaResult, TrabajoGeometriaNombre>
  > = [];

  async onApplicationBootstrap(): Promise<void> {
    // Configuraciones incompatibles entre réplicas fallan antes de tomar jobs.
    await this.capacidad.estado();
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
      >(
        nombre,
        (job): Promise<TrabajoGeometriaResult> => this.procesar(job, worker),
        {
          connection: conexionRedisWorker(),
          concurrency: concurrencia,
          name: `geometry-${process.pid}`,
          removeOnComplete: { age: 60 * 60, count: 1_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
        },
      );
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
      if (job?.id)
        void this.capacidad
          .cancelar(job.id)
          .catch((e: unknown) =>
            this.logger.warn(
              `No se pudo retirar el turno fallido ${job.id}: ${String(e)}`,
            ),
          );
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
    cola?: MinimalQueue,
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
          cola,
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
    cola?: MinimalQueue,
  ): Promise<TrabajoGeometriaResult> {
    const jobId = String(job.id ?? 'sin-id');
    const intensiva = job.queueName === COLA_GEOMETRIA_INTENSIVA;
    if (await this.control.leerCancelacion(jobId)) {
      await this.capacidad.cancelar(jobId);
      throw new Error('El cálculo de geometría fue cancelado.');
    }
    try {
      await this.capacidadesPlan.exigirTodas(job.data.tenantId,
        job.data.calculoCotizacion
          ? ['nesting_irregular']
          : ['analisis_vectorial', 'aprovechamiento_cotizacion', 'nesting_irregular'],
      );
    } catch (error) {
      await this.capacidad.cancelar(jobId);
      throw error;
    }
    let lease: LeaseTenant | null;
    try {
      lease = await this.tenantConcurrency.adquirir({
        tenantId: job.data.tenantId,
        categoria: intensiva ? 'geometria-intensiva' : 'geometria',
        jobId,
        limite: limiteEntero(process.env.WORKER_TENANT_GEOMETRY_CONCURRENCY, 1),
        // La renovación sostiene búsquedas largas. Una caída libera la cuota
        // en un minuto, sin retenerla durante todo el presupuesto del nesting.
        duracionMs: 60_000,
      });
    } catch (error) {
      return this.reprogramarAdmision(job, error);
    }
    if (!lease) {
      if (!job.token)
        throw new Error('El trabajo no tiene token para reprogramarse.');
      await job.moveToDelayed(
        Date.now() + demoraReintentoTenantMs(),
        job.token,
      );
      throw new DelayedError();
    }
    let permisoCapacidad: PermisoCapacidad | null;
    try {
      permisoCapacidad = await this.capacidad.adquirir({
        tenantId: job.data.tenantId,
        jobId,
        clase: intensiva ? 'intensiva' : 'normal',
        prioridad: job.opts.priority ?? (intensiva ? 20 : 5),
      });
    } catch (error) {
      await this.tenantConcurrency.liberar(lease).catch(() => undefined);
      return this.reprogramarAdmision(job, error);
    }
    if (!permisoCapacidad) {
      await this.tenantConcurrency.liberar(lease);
      if (!job.token)
        throw new Error('El trabajo no tiene token para esperar capacidad.');
      await job.updateProgress({ porcentaje: 0, etapa: 'en_cola' });
      await job.moveToDelayed(
        Date.now() + demoraReintentoTenantMs(),
        job.token,
      );
      throw new DelayedError();
    }
    const controller = new AbortController();
    let permisoPerdido = false;
    let capacidadLiberada = false;
    let renovando = false;
    let cerrado = false;
    const renovarPermiso = async () => {
      if (renovando || cerrado || controller.signal.aborted) return;
      renovando = true;
      try {
        const renovaciones = await Promise.all([
          this.tenantConcurrency.renovar(lease),
          this.capacidad.renovar(permisoCapacidad),
        ]);
        if (renovaciones.some((r) => !r)) {
          permisoPerdido = true;
          controller.abort();
        }
      } catch (error) {
        // Si no se puede verificar la exclusión, no seguir consumiendo CPU
        // mientras otra réplica podría haber adquirido la misma cuota.
        permisoPerdido = true;
        controller.abort();
        this.logger.warn(
          `Se interrumpió la renovación de job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        renovando = false;
      }
    };
    let renovacionPendiente: Promise<void> | undefined;
    const renovacion = setInterval(
      () => {
        if (!renovacionPendiente)
          renovacionPendiente = renovarPermiso().finally(() => {
            renovacionPendiente = undefined;
          });
      },
      Math.max(5_000, Math.floor(lease.duracionMs / 3)),
    );
    renovacion.unref();
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
      // No competir con una renovación en vuelo al liberar el mismo permiso.
      cerrado = true;
      clearInterval(renovacion);
      await renovacionPendiente;
      if (controller.signal.aborted)
        throw new Error('El cálculo de geometría fue cancelado.');
      // Liberar con el propietario correcto antes de publicar el resultado.
      // Si venció, el job se reprograma con el checkpoint, sin aceptar un dueño viejo.
      try {
        capacidadLiberada = await this.capacidad.liberar(permisoCapacidad);
      } catch (error) {
        permisoPerdido = true;
        throw error;
      }
      if (!capacidadLiberada) {
        permisoPerdido = true;
        controller.abort();
        throw new Error('El permiso de capacidad venció antes de finalizar.');
      }
      await job.updateProgress({ porcentaje: 100, etapa: 'completado' });
      return result;
    } catch (error) {
      if (permisoPerdido && job.token) {
        // OpenNest ya esperó sus checkpoints y terminó el subproceso antes
        // de rechazar. Reprogramar sin consumir un intento fallido del cliente.
        await job.moveToDelayed(
          Date.now() + demoraReintentoTenantMs(),
          job.token,
        );
        this.logger.warn({
          event: 'nesting_reprogramado_permiso_perdido',
          jobId,
          tenantId: job.data.tenantId,
        });
        throw new DelayedError();
      }
      throw error;
    } finally {
      cerrado = true;
      if (timer) clearInterval(timer);
      clearInterval(renovacion);
      await renovacionPendiente;
      if (!capacidadLiberada)
        await this.capacidad
          .liberar(permisoCapacidad, permisoPerdido)
          .catch((error: unknown) =>
            this.logger.warn(
              `No se pudo liberar capacidad de job=${jobId}: ${String(error)}`,
            ),
          );
      await this.tenantConcurrency
        .liberar(lease)
        .catch((error: unknown) =>
          this.logger.warn(
            `No se pudo liberar concurrencia de job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      if (cola)
        await this.despertarSiguiente(cola, intensiva ? 'intensiva' : 'normal');
    }
  }

  private async despertarSiguiente(
    cola: MinimalQueue,
    clase: 'normal' | 'intensiva',
  ): Promise<void> {
    try {
      // La demora evita sondeo agresivo mientras otro solver trabaja. Al
      // terminar, despertar al próximo evita pagar esa demora por cada pieza.
      for (let n = 0; n < 3; n++) {
        const id = await this.capacidad.siguiente(clase);
        if (!id) return;
        const siguiente = await Job.fromId(cola, id);
        if (!siguiente) {
          await this.capacidad.cancelar(id);
          continue;
        }
        if ((await siguiente.getState()) === 'delayed') {
          // Otra réplica puede promoverlo entre getState y promote.
          await siguiente.promote().catch(() => undefined);
        }
        return;
      }
    } catch (error) {
      // La promoción es una aceleración; el reintento acotado sigue vigente.
      this.logger.warn(
        `No se pudo despertar el siguiente nesting: ${String(error)}`,
      );
    }
  }

  private async reprogramarAdmision(job: Job, error: unknown): Promise<never> {
    const message = error instanceof Error ? error.message : String(error);
    // Un despliegue incompatible necesita corregirse, no un bucle de reintentos.
    if (
      /GRAFONEST_POOL_CONFIG_MISMATCH|Identidad de capacidad incompatible/.test(
        message,
      ) ||
      !job.token
    )
      throw error;
    this.logger.warn({
      event: 'nesting_espera_admision',
      jobId: job.id,
      message,
    });
    await job.moveToDelayed(
      Date.now() + 1000 + demoraReintentoTenantMs(),
      job.token,
    );
    throw new DelayedError();
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
