import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Worker } from 'bullmq';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { conexionRedisWorker } from '../workers/redis';
import {
  limiteEntero,
  TenantConcurrencyService,
} from '../workers/tenant-concurrency.service';
import { PlanificacionEntregasService } from './planificacion.service';
import { LEASE_PLAN_MS, RENOVACION_PLAN_MS } from './planificacion-vida';
import {
  COLA_PLANES_ENTREGA,
  type TrabajoPlanEntrega,
} from './planificacion-cola';

@Injectable()
export class PlanificacionEntregasWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PlanificacionEntregasWorker.name);
  private worker?: Worker<TrabajoPlanEntrega>;
  constructor(
    private readonly planes: PlanificacionEntregasService,
    private readonly motor: MotorUniversalService,
    private readonly concurrency: TenantConcurrencyService,
  ) {}
  async onApplicationBootstrap() {
    this.worker = new Worker<TrabajoPlanEntrega>(
      COLA_PLANES_ENTREGA,
      (job) => this.procesar(job),
      {
        connection: conexionRedisWorker(),
        concurrency: limiteEntero(process.env.WORKER_DELIVERY_CONCURRENCY, 1),
        name: `delivery-plans-${process.pid}`,
      },
    );
    this.worker.on('error', (e) => this.logger.error(e.message));
    this.worker.on('failed', (job, e) =>
      this.logger.error(`Plan ${job?.id}: ${e.message}`),
    );
    await this.worker.waitUntilReady();
    this.logger.log('Worker de propuestas de entregas listo.');
  }
  async procesar(job: Job<TrabajoPlanEntrega>) {
    const lease = await this.concurrency.adquirir({
      tenantId: job.data.tenantId,
      categoria: 'cotizacion',
      jobId: String(job.id),
      limite: limiteEntero(process.env.WORKER_TENANT_QUOTE_CONCURRENCY, 2),
      duracionMs: LEASE_PLAN_MS,
    });
    if (!lease) {
      if (!job.token)
        throw new Error('El trabajo no tiene token para reprogramarse.');
      await job.moveToDelayed(Date.now() + 2000, job.token);
      throw new DelayedError();
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error(
            'El cálculo superó el tiempo disponible. Probá una distribución más simple.',
          ),
        ),
      45 * 60_000,
    );
    const renovacion = setInterval(() => {
      void this.concurrency
        .renovar(lease)
        .then((ok) => {
          if (!ok)
            controller.abort(
              new Error(
                'Se perdió el turno de cálculo. Volvé a solicitar el plan.',
              ),
            );
        })
        .catch(() =>
          controller.abort(
            new Error('No se pudo renovar el turno de cálculo.'),
          ),
        );
    }, RENOVACION_PLAN_MS);
    timeout.unref();
    renovacion.unref();
    try {
      await this.planes.calcular(
        job.data.tenantId,
        job.data.revisionId,
        (input) => this.motor.cotizar(input),
        controller.signal,
      );
    } finally {
      clearTimeout(timeout);
      clearInterval(renovacion);
      await this.concurrency
        .liberar(lease)
        .catch((e: unknown) => this.logger.warn(String(e)));
    }
  }
  async onApplicationShutdown() {
    await this.worker?.close();
  }
}
