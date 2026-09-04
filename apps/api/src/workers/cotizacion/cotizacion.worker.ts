import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Worker } from 'bullmq';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import type { CotizarOutput } from '../../motor-universal/tipos';
import { conexionRedisWorker } from '../redis';
import {
  COLA_COTIZACIONES,
  TRABAJO_COTIZAR,
  type CotizacionJobData,
} from './cotizacion-jobs.service';
import {
  limiteEntero,
  TenantConcurrencyService,
} from '../tenant-concurrency.service';

@Injectable()
export class CotizacionWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CotizacionWorker.name);
  private worker?: Worker<
    CotizacionJobData,
    CotizarOutput,
    typeof TRABAJO_COTIZAR
  >;

  constructor(
    private readonly motor: MotorUniversalService,
    private readonly tenantConcurrency: TenantConcurrencyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const concurrency = concurrenciaCotizaciones();
    this.worker = new Worker<
      CotizacionJobData,
      CotizarOutput,
      typeof TRABAJO_COTIZAR
    >(COLA_COTIZACIONES, (job) => this.procesar(job), {
      connection: conexionRedisWorker(),
      concurrency,
      name: `quotes-${process.pid}`,
      removeOnComplete: { age: 24 * 60 * 60, count: 2_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
    });
    await this.worker.waitUntilReady();
    this.worker.on('failed', (job, error) =>
      this.logger.error({
        event: 'quote_job_failed',
        jobId: job?.id,
        tenantId: job?.data.input.tenantId,
        message: error.message,
      }),
    );
    this.worker.on('completed', (job) =>
      this.logger.log({
        event: 'quote_job_completed',
        jobId: job.id,
        tenantId: job.data.input.tenantId,
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
        exitoso: job.returnvalue?.exitoso,
      }),
    );
    this.worker.on('stalled', (jobId) =>
      this.logger.warn({ event: 'quote_job_stalled', jobId }),
    );
    this.logger.log(
      `Worker de cotizaciones listo: cola=${COLA_COTIZACIONES}, concurrencia=${concurrency}.`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    const worker = this.worker;
    this.worker = undefined;
    if (worker) await worker.close();
  }

  private async procesar(
    job: Job<CotizacionJobData, CotizarOutput, typeof TRABAJO_COTIZAR>,
  ): Promise<CotizarOutput> {
    const jobId = String(job.id ?? 'sin-id');
    const lease = await this.tenantConcurrency.adquirir({
      tenantId: job.data.input.tenantId,
      categoria: 'cotizacion',
      jobId,
      limite: limiteEntero(process.env.WORKER_TENANT_QUOTE_CONCURRENCY, 2),
      duracionMs: 20 * 60 * 1_000,
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
      Math.floor(lease.duracionMs / 3),
    );
    renovacion.unref();
    try {
      await job.updateProgress({ porcentaje: 10, etapa: 'cotizando' });
      const result = await this.motor.cotizar(job.data.input);
      await job.updateProgress({ porcentaje: 100, etapa: 'completado' });
      return result;
    } finally {
      clearInterval(renovacion);
      await this.tenantConcurrency
        .liberar(lease)
        .catch((error: unknown) =>
          this.logger.warn(
            `No se pudo liberar concurrencia de cotización job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }
  }
}

function demoraReintentoTenantMs(): number {
  return 350 + Math.floor(Math.random() * 350);
}

function concurrenciaCotizaciones(): number {
  const value = Number(process.env.WORKER_QUOTE_CONCURRENCY ?? 4);
  return Number.isInteger(value) && value > 0 && value <= 50 ? value : 4;
}
