import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  ForbiddenException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DelayedError, Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { runWithTenant } from '../common/tenant-context';
import { conLockDeCron } from '../common/cron-lock';
import { ArchivosService } from '../archivos/archivos.service';
import { PresupuestoRenderService } from '../presupuestos/pdf-piloto/presupuesto-render.service';
import { VERSION_PRESUPUESTO_HTML } from '../presupuestos/pdf-piloto/presupuesto-html';
import type { PresupuestoPdfDatos } from '../presupuestos/presupuesto-pdf.service';
import { conexionRedisApi, conexionRedisWorker } from '../workers/redis';
import {
  limiteEntero,
  TenantConcurrencyService,
} from '../workers/tenant-concurrency.service';
import { hashDatosPdf, MAX_INTENTOS_PDF } from './documentos-pdf.service';

export const COLA_PDF = 'grafo-documentos-pdf-v1';
export type PdfJob = {
  documentoId: string;
  tenantId: string;
  ronda: number;
  intentoAnterior: number;
};
const LEASE_MS = 120_000;
const MAX_COLA = 100;
const MAX_COLA_TENANT = 4;

@Injectable()
export class DocumentosPdfWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DocumentosPdfWorker.name);
  private queue?: Queue<PdfJob>;
  private worker?: Worker<PdfJob>;
  private timer?: NodeJS.Timeout;
  private despachando = false;
  private deteniendo = false;
  private readonly cola = process.env.PDF_QUEUE_NAME || COLA_PDF;

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PresupuestoRenderService,
    private readonly archivos: ArchivosService,
    private readonly tenants: TenantConcurrencyService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  onApplicationBootstrap() {
    if (!process.env.PDF_RENDER_URL?.trim())
      throw new Error(
        'PDF_RENDER_URL es obligatorio para el worker de documentos.',
      );
    this.queue = new Queue<PdfJob>(this.cola, {
      connection: { ...conexionRedisApi(), enableOfflineQueue: false },
    });
    this.queue.on('error', () =>
      this.logger.warn(
        'Redis PDF no disponible; los pendientes permanecen en la base.',
      ),
    );
    this.worker = new Worker<PdfJob>(this.cola, (job) => this.procesar(job), {
      connection: conexionRedisWorker(),
      concurrency: limiteEntero(process.env.WORKER_PDF_CONCURRENCY, 2),
      name: `pdf-${process.pid}`,
      lockDuration: LEASE_MS,
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 7 * 86400, count: 2000 },
    });
    this.worker.on('error', () =>
      this.logger.warn('Conexión del worker PDF interrumpida; se reintentará.'),
    );
    this.worker.on('failed', (job) =>
      this.logger.warn({
        event: 'pdf_job_failed',
        documentoId: job?.data.documentoId,
      }),
    );
    this.timer = setInterval(() => void this.despachar(), 2000);
    this.timer.unref();
    void this.despachar();
    this.logger.log(
      'Worker PDF iniciado. Snapshot y reintentos durables en PostgreSQL; transporte BullMQ.',
    );
  }

  async onApplicationShutdown() {
    if (this.deteniendo) return;
    this.deteniendo = true;
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Recupera pendientes incluso si Redis se reinició o el API murió tras el commit. */
  async despachar() {
    if (this.despachando || this.deteniendo || !this.queue) return;
    this.despachando = true;
    try {
      await conLockDeCron(
        this.prisma,
        `pdf-dispatch-${this.cola}`,
        120,
        async () => {
          const queue = this.queue!;
          await queue.setGlobalConcurrency(
            limiteEntero(process.env.WORKER_PDF_GLOBAL_CONCURRENCY, 2),
          );
          const ahora = new Date();
          await this.prisma.documentoPdf.updateMany({
            where: {
              estado: 'PROCESANDO',
              leaseHasta: { lte: ahora },
              intentos: { lt: MAX_INTENTOS_PDF },
            },
            data: {
              estado: 'PENDIENTE',
              proximoIntentoEl: new Date(0),
              encoladoEl: null,
              leaseToken: null,
              leaseHasta: null,
            },
          });
          await this.prisma.documentoPdf.updateMany({
            where: {
              estado: 'PROCESANDO',
              leaseHasta: { lte: ahora },
              intentos: { gte: MAX_INTENTOS_PDF },
            },
            data: {
              estado: 'FALLIDO',
              errorCodigo: 'INTERRUMPIDO',
              errorMensaje: 'No se pudo completar el PDF. Podés reintentar.',
              leaseToken: null,
              leaseHasta: null,
            },
          });
          const jobs = await queue.getJobs(
            ['wait', 'active', 'delayed', 'prioritized'],
            0,
            MAX_COLA,
          );
          if (jobs.length >= MAX_COLA) return;
          const porTenant = new Map<string, number>();
          for (const job of jobs)
            porTenant.set(
              job.data.tenantId,
              (porTenant.get(job.data.tenantId) ?? 0) + 1,
            );
          // Ventana por tenant: un lote grande de una empresa no tapa a las demás.
          const candidatos = await this.prisma.$queryRaw<
            Array<{
              id: string;
              tenantId: string;
              ronda: number;
              intentos: number;
            }>
          >`
        SELECT id, "tenantId", ronda, intentos FROM (
          SELECT id, "tenantId", ronda, intentos, "createdAt",
            ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS posicion
          FROM "DocumentoPdf" WHERE estado = 'PENDIENTE' AND "proximoIntentoEl" <= NOW()
            AND ("encoladoEl" IS NULL OR "encoladoEl" < NOW() - INTERVAL '30 seconds')
        ) candidatos WHERE posicion <= 4 ORDER BY posicion, "createdAt", id LIMIT 100`;
          let disponibles = MAX_COLA - jobs.length;
          for (const doc of candidatos) {
            if (!disponibles || this.deteniendo) break;
            if ((porTenant.get(doc.tenantId) ?? 0) >= MAX_COLA_TENANT) continue;
            const data: PdfJob = {
              documentoId: doc.id,
              tenantId: doc.tenantId,
              ronda: doc.ronda,
              intentoAnterior: doc.intentos,
            };
            const jobId = `pdf-${doc.id}-${doc.ronda}-${doc.intentos}`;
            const anterior = await queue.getJob(jobId);
            if (anterior) {
              const estado = await anterior.getState();
              if (estado === 'failed' || estado === 'completed')
                await anterior.remove();
              else continue;
            }
            await queue.add('render', data, {
              jobId,
              attempts: 1,
              removeOnComplete: { age: 86400, count: 1000 },
              removeOnFail: { age: 7 * 86400, count: 2000 },
            });
            await this.prisma.documentoPdf.updateMany({
              where: {
                id: doc.id,
                tenantId: doc.tenantId,
                estado: 'PENDIENTE',
                ronda: doc.ronda,
                intentos: doc.intentos,
              },
              data: { encoladoEl: new Date() },
            });
            porTenant.set(doc.tenantId, (porTenant.get(doc.tenantId) ?? 0) + 1);
            disponibles--;
          }
        },
      );
    } catch (error) {
      this.logger.warn({
        event: 'pdf_dispatch_unavailable',
        message: error instanceof Error ? error.name : 'Error',
      });
    } finally {
      this.despachando = false;
    }
  }

  async procesar(job: Job<PdfJob>): Promise<void> {
    const { tenantId, documentoId, ronda, intentoAnterior } = job.data;
    const lease = await this.tenants.adquirir({
      tenantId,
      categoria: 'pdf',
      jobId: String(job.id),
      limite: limiteEntero(process.env.WORKER_TENANT_PDF_CONCURRENCY, 1),
      duracionMs: LEASE_MS,
    });
    if (!lease) {
      if (!job.token) throw new Error('Trabajo PDF sin token.');
      await job.moveToDelayed(
        Date.now() + 500 + Math.floor(Math.random() * 500),
        job.token,
      );
      throw new DelayedError();
    }
    const token = randomUUID();
    let renovar: NodeJS.Timeout | undefined;
    let tomado = false;
    const inicio = Date.now();
    try {
      await runWithTenant(tenantId, async () => {
        const claim = await this.prisma.documentoPdf.updateMany({
          where: {
            id: documentoId,
            tenantId,
            ronda,
            intentos: intentoAnterior,
            estado: 'PENDIENTE',
          },
          data: {
            estado: 'PROCESANDO',
            intentos: { increment: 1 },
            leaseToken: token,
            leaseHasta: new Date(Date.now() + LEASE_MS),
          },
        });
        if (claim.count !== 1) return;
        tomado = true;
        const doc = await this.prisma.documentoPdf.findFirstOrThrow({
          where: { id: documentoId, tenantId },
        });
        renovar = setInterval(() => {
          void this.tenants
            .renovar(lease)
            .then(async (ok) => {
              if (!ok) return; // Sin lease distribuido no se extiende la capacidad de publicar.
              await this.prisma.documentoPdf.updateMany({
                where: {
                  id: documentoId,
                  tenantId,
                  estado: 'PROCESANDO',
                  leaseToken: token,
                },
                data: { leaseHasta: new Date(Date.now() + LEASE_MS) },
              });
            })
            .catch(() =>
              this.logger.warn({
                event: 'pdf_lease_renew_failed',
                documentoId,
              }),
            );
        }, LEASE_MS / 3);
        renovar.unref();
        await this.capacidades.exigir(tenantId, 'documentos_pdf');
        const datos = doc.datosJson as unknown as PresupuestoPdfDatos;
        if (doc.plantillaVersion !== VERSION_PRESUPUESTO_HTML)
          throw new Error('PDF_VERSION_NO_SOPORTADA');
        if (hashDatosPdf(datos) !== doc.datosHash)
          throw new Error('PDF_SNAPSHOT_INVALIDO');
        const pdf = await this.renderer.generar(datos);
        if (!(await this.tenants.renovar(lease)))
          throw new Error('PDF_LEASE_PERDIDO');
        await this.archivos.materializarVersionPdf({
          tenantId,
          documentoId,
          leaseToken: token,
          contenido: pdf,
        });
        this.logger.log({
          event: 'pdf_completed',
          tenantId,
          documentoId,
          revision: doc.revision,
          plantilla: doc.plantillaVersion,
          intentos: doc.intentos,
          bytes: pdf.length,
          esperaMs: inicio - doc.createdAt.getTime(),
          renderYStorageMs: Date.now() - inicio,
          rssMiB: Math.round(process.memoryUsage().rss / 1024 ** 2),
        });
      });
    } catch (error) {
      if (tomado) {
        const permanente =
          error instanceof ForbiddenException ||
          (error instanceof Error &&
            ['PDF_VERSION_NO_SOPORTADA', 'PDF_SNAPSHOT_INVALIDO'].includes(
              error.message,
            ));
        const agotado = intentoAnterior + 1 >= MAX_INTENTOS_PDF;
        const respuesta =
          error instanceof ForbiddenException ? error.getResponse() : null;
        const sinCapacidad =
          typeof respuesta === 'object' &&
          respuesta !== null &&
          'code' in respuesta &&
          respuesta.code === 'CAPACIDAD_NO_DISPONIBLE';
        const cuota = error instanceof ForbiddenException && !sinCapacidad;
        await this.prisma.documentoPdf.updateMany({
          where: {
            id: documentoId,
            tenantId,
            estado: 'PROCESANDO',
            leaseToken: token,
          },
          data: {
            estado: permanente || agotado ? 'FALLIDO' : 'PENDIENTE',
            proximoIntentoEl: new Date(
              Date.now() + 5000 * 2 ** intentoAnterior,
            ),
            encoladoEl: null,
            leaseToken: null,
            leaseHasta: null,
            errorCodigo: sinCapacidad
              ? 'CAPACIDAD_NO_DISPONIBLE'
              : cuota
                ? 'SIN_ESPACIO'
                : permanente
                  ? 'VERSION_INVALIDA'
                  : 'GENERACION_FALLIDA',
            errorMensaje: sinCapacidad
              ? 'La generación de PDF no está disponible en el plan actual. Reintentá cuando se habilite.'
              : cuota
                ? 'No hay espacio disponible. Liberá espacio o ampliá el plan y reintentá.'
                : 'No se pudo generar el PDF. Podés reintentar en unos instantes.',
          },
        });
      }
      throw error;
    } finally {
      if (renovar) clearInterval(renovar);
      await this.tenants
        .liberar(lease)
        .catch(() =>
          this.logger.warn({ event: 'pdf_lease_release_failed', documentoId }),
        );
    }
  }
}
