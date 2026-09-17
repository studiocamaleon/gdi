import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { conexionRedisApi } from '../workers/redis';
import { PLAN_SIN_PULSO_MS } from './planificacion-vida';
import {
  COLA_PLANES_ENTREGA,
  type TrabajoPlanEntrega,
} from './planificacion-cola';

/** La solicitud persistida funciona como outbox; Redis sólo transporta sus IDs. */
@Injectable()
export class PlanificacionEntregasDispatcher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PlanificacionEntregasDispatcher.name);
  private queue?: Queue<TrabajoPlanEntrega>;
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.despachar(), 10_000);
    this.timer.unref();
    void this.despachar();
  }
  async despachar() {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      // Una interrupción larga o pérdida de Redis nunca deja un cálculo
      // activo indefinidamente. El token invalida también al worker anterior.
      await this.db.planEntregaRevision.updateMany({
        where: {
          estado: 'CALCULANDO',
          updatedAt: { lt: new Date(Date.now() - PLAN_SIN_PULSO_MS) },
        },
        data: {
          estado: 'FALLIDA',
          ejecucionId: null,
          error: 'El cálculo se interrumpió. Volvé a solicitar la propuesta.',
        },
      });
      // Barrido de infraestructura entre tenants, sin devolver datos al cliente.
      const pendientes = await this.db.planEntregaRevision.findMany({
        where: { estado: 'SOLICITADA' },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, tenantId: true },
      });
      if (!pendientes.length) return;
      if (!this.queue) {
        this.queue = new Queue(COLA_PLANES_ENTREGA, {
          connection: conexionRedisApi(),
        });
        this.queue.on('error', (error) => this.logger.warn(error.message));
      }
      for (const r of pendientes)
        await this.queue.add(
          'delivery.plan',
          { tenantId: r.tenantId, revisionId: r.id },
          {
            jobId: r.id,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 86400, count: 2000 },
            removeOnFail: { age: 604800, count: 2000 },
          },
        );
    } catch (error) {
      this.logger.warn(
        `Las propuestas pendientes se reintentarán: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ejecutando = false;
    }
  }
  constructor(private readonly db: PrismaService) {}
  async onApplicationShutdown() {
    clearInterval(this.timer);
    await this.queue?.close();
  }
}
