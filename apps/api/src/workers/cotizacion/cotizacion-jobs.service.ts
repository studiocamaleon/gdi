import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Job, Queue, type JobState } from 'bullmq';
import type { CotizarInput, CotizarOutput } from '../../motor-universal/tipos';
import { conexionRedisApi } from '../redis';

export const COLA_COTIZACIONES = 'grafo-quotes-v1';
export const TRABAJO_COTIZAR = 'quote.calculate.v1' as const;

export type CotizacionJobData = {
  schemaVersion: 1;
  solicitadoEl: string;
  correlationId: string;
  input: CotizarInput;
};

export type EstadoTrabajoCotizacion =
  | 'pendiente'
  | 'procesando'
  | 'completado'
  | 'fallido';

export type VistaTrabajoCotizacion = {
  id: string;
  tipo: typeof TRABAJO_COTIZAR;
  estado: EstadoTrabajoCotizacion;
  creadoEl: string;
  iniciadoEl?: string;
  finalizadoEl?: string;
  correlationId: string;
  progreso: {
    porcentaje: number;
    etapa: 'en_cola' | 'cotizando' | 'completado';
  };
  resultado?: CotizarOutput;
  error?: ErrorTrabajoCotizacion;
};

export type AccionErrorTrabajoCotizacion = {
  tipo:
    | 'REINTENTAR'
    | 'REVISAR_DATOS'
    | 'GENERAR_NESTING'
    | 'ABRIR_CONFIGURACION'
    | 'ABRIR_PUBLICACION';
  etiqueta: string;
  href?: string;
};

export type ErrorTrabajoCotizacion = {
  codigo:
    | 'RECETA_DESACTUALIZADA'
    | 'RECETA_NO_PUBLICADA'
    | 'CONFIGURACION_INCOMPLETA'
    | 'DATOS_INCOMPLETOS'
    | 'NESTING_FALLIDO'
    | 'SERVICIO_NO_DISPONIBLE'
    | 'CALCULO_FALLIDO';
  mensaje: string;
  sugerencia: string;
  accion: AccionErrorTrabajoCotizacion;
};

type QuoteJob = Job<CotizacionJobData, CotizarOutput, typeof TRABAJO_COTIZAR>;

@Injectable()
export class CotizacionJobsService implements OnApplicationShutdown {
  private readonly logger = new Logger(CotizacionJobsService.name);
  private queue?: Queue<
    CotizacionJobData,
    CotizarOutput,
    typeof TRABAJO_COTIZAR
  >;

  async crear(input: {
    cotizacion: CotizarInput;
    claveSolicitud?: string;
  }): Promise<VistaTrabajoCotizacion> {
    const data: CotizacionJobData = {
      schemaVersion: 1,
      solicitadoEl: new Date().toISOString(),
      correlationId: randomUUID(),
      input: input.cotizacion,
    };
    const jobId = idTrabajoCotizacion(
      input.cotizacion.tenantId,
      input.claveSolicitud,
      input.cotizacion,
    );
    try {
      const queued = await this.getQueue().add(TRABAJO_COTIZAR, data, {
        jobId,
        attempts: 1,
        removeOnComplete: { age: 24 * 60 * 60, count: 2_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
      });
      const job = (await this.getQueue().getJob(jobId)) ?? queued;
      return this.vistaDesdeJob(job);
    } catch (error) {
      this.logger.warn(
        `No se pudo encolar cotización: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de cálculos está temporalmente no disponible.',
      );
    }
  }

  async consultar(
    tenantId: string,
    jobId: string,
  ): Promise<VistaTrabajoCotizacion> {
    exigirIdTrabajoCotizacion(jobId);
    try {
      const job = await this.getQueue().getJob(jobId);
      if (!job || job.data.input.tenantId !== tenantId)
        throw new NotFoundException('No se encontró el trabajo de cotización.');
      return this.vistaDesdeJob(job);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(
        `No se pudo consultar cotización job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de cálculos está temporalmente no disponible.',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const queue = this.queue;
    this.queue = undefined;
    if (queue) await queue.close();
  }

  private async vistaDesdeJob(job: QuoteJob): Promise<VistaTrabajoCotizacion> {
    const state = await job.getState();
    const estado = estadoPublico(state);
    const progress = job.progress;
    const porcentaje =
      progress && typeof progress === 'object' && 'porcentaje' in progress
        ? Number((progress as { porcentaje?: unknown }).porcentaje)
        : estado === 'procesando'
          ? 10
          : 0;
    return {
      id: String(job.id),
      tipo: TRABAJO_COTIZAR,
      estado,
      creadoEl: new Date(job.timestamp).toISOString(),
      ...(job.processedOn
        ? { iniciadoEl: new Date(job.processedOn).toISOString() }
        : {}),
      ...(job.finishedOn
        ? { finalizadoEl: new Date(job.finishedOn).toISOString() }
        : {}),
      correlationId: job.data.correlationId,
      progreso: {
        porcentaje:
          estado === 'completado'
            ? 100
            : Math.max(
                0,
                Math.min(99, Number.isFinite(porcentaje) ? porcentaje : 0),
              ),
        etapa:
          estado === 'completado'
            ? 'completado'
            : estado === 'procesando'
              ? 'cotizando'
              : 'en_cola',
      },
      ...(estado === 'completado' && job.returnvalue
        ? { resultado: job.returnvalue }
        : {}),
      ...(estado === 'fallido'
        ? {
            error: errorPublicoCotizacion(
              job.failedReason,
              job.data.input.productoId,
              job.data.input.rutaAlternativaId,
            ),
          }
        : {}),
    };
  }

  private getQueue() {
    if (this.queue) return this.queue;
    this.queue = new Queue<
      CotizacionJobData,
      CotizarOutput,
      typeof TRABAJO_COTIZAR
    >(COLA_COTIZACIONES, { connection: conexionRedisApi() });
    this.queue.on('error', (error) =>
      this.logger.warn(`Cola de cotizaciones: ${error.message}`),
    );
    return this.queue;
  }
}

/**
 * Los workers guardan solamente `Error.message` en BullMQ. Esta frontera
 * conserva los errores operables del dominio, oculta fallos internos y agrega
 * una acción que el cotizador puede ejecutar sin interpretar texto libre.
 */
export function errorPublicoCotizacion(
  reason: string | undefined,
  productoId: string,
  rutaAlternativaId?: string | null,
): ErrorTrabajoCotizacion {
  const mensaje = sanitizarRazonCotizacion(reason);
  const hrefProduccion = `/productos-servicios/${encodeURIComponent(productoId)}?tab=produccion&vista=operaciones${rutaAlternativaId ? `&rutaAltId=${encodeURIComponent(rutaAlternativaId)}` : ''}`;

  if (/cambios productivos sin publicar/i.test(mensaje)) {
    return {
      codigo: 'RECETA_DESACTUALIZADA',
      mensaje,
      sugerencia:
        'Publicá una nueva revisión de la receta y luego reintentá la cotización.',
      accion: {
        tipo: 'ABRIR_PUBLICACION',
        etiqueta: 'Revisar publicación',
        href: hrefProduccion,
      },
    };
  }

  if (
    /(?:sin|no (?:tiene|hay|existe)).{0,35}receta publicada|receta.{0,35}(?:sin publicar|no publicada)/i.test(
      mensaje,
    )
  ) {
    return {
      codigo: 'RECETA_NO_PUBLICADA',
      mensaje,
      sugerencia:
        'Creá o actualizá la receta productiva y publicala antes de cotizar.',
      accion: {
        tipo: 'ABRIR_PUBLICACION',
        etiqueta: 'Publicar receta',
        href: hrefProduccion,
      },
    };
  }

  if (
    /nesting|GrafoNest|OpenNest|geometr[ií]a|vector|SVG|DXF|placa|contorno/i.test(
      mensaje,
    )
  ) {
    return {
      codigo: 'NESTING_FALLIDO',
      mensaje: mensaje.replaceAll('OpenNest', 'GrafoNest'),
      sugerencia:
        'Revisá el archivo, las medidas y la placa; después volvé a generar el nesting.',
      accion: {
        tipo: 'GENERAR_NESTING',
        etiqueta: 'Volver a GrafoNest',
      },
    };
  }

  if (
    /ECONN|Redis|conexi[oó]n|servicio.{0,30}no disponible|socket|timed?\s*out/i.test(
      mensaje,
    )
  ) {
    return {
      codigo: 'SERVICIO_NO_DISPONIBLE',
      mensaje:
        'El servicio de cálculo no respondió y la cotización no llegó a procesarse.',
      sugerencia:
        'Esperá unos segundos y reintentá. Los datos cargados en el sheet no se perdieron.',
      accion: { tipo: 'REINTENTAR', etiqueta: 'Reintentar ahora' },
    };
  }

  if (
    /configur|tarifa|precio|centro de costo|m[aá]quina|perfil|material|sustrato|consumible|componente|paso/i.test(
      mensaje,
    )
  ) {
    return {
      codigo: 'CONFIGURACION_INCOMPLETA',
      mensaje,
      sugerencia:
        'Corregí la configuración productiva indicada y luego volvé a cotizar.',
      accion: {
        tipo: 'ABRIR_CONFIGURACION',
        etiqueta: 'Abrir configuración',
        href: hrefProduccion,
      },
    };
  }

  if (
    /cantidad|medida|ancho|alto|profundidad|seleccion|elegir|ingresar|completar|requerid|inv[aá]lid/i.test(
      mensaje,
    )
  ) {
    return {
      codigo: 'DATOS_INCOMPLETOS',
      mensaje,
      sugerencia: 'Revisá los datos solicitados en este sheet y reintentá.',
      accion: { tipo: 'REVISAR_DATOS', etiqueta: 'Revisar datos' },
    };
  }

  return {
    codigo: 'CALCULO_FALLIDO',
    mensaje:
      'El motor encontró un problema no clasificado y no pudo terminar esta cotización.',
    sugerencia:
      'Reintentá una vez. Si vuelve a ocurrir, usá la referencia visible para soporte.',
    accion: { tipo: 'REINTENTAR', etiqueta: 'Reintentar ahora' },
  };
}

function sanitizarRazonCotizacion(reason: string | undefined): string {
  const value = (reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 420);
  return value || 'No se recibió una causa específica del motor de cotización.';
}

export function idTrabajoCotizacion(
  tenantId: string,
  scope: string | undefined,
  input: CotizarInput,
): string {
  if (!scope) return `quote-${randomUUID()}`;
  const digest = createHash('sha256')
    .update(tenantId)
    .update('\0')
    .update(scope)
    .update('\0')
    .update(JSON.stringify(input))
    .digest('hex');
  return `quote-${digest}`;
}

function exigirIdTrabajoCotizacion(jobId: string): void {
  if (!/^quote-[a-f0-9-]{36,110}$/.test(jobId))
    throw new NotFoundException('No se encontró el trabajo de cotización.');
}

function estadoPublico(state: JobState | 'unknown'): EstadoTrabajoCotizacion {
  if (state === 'completed') return 'completado';
  if (state === 'failed') return 'fallido';
  if (state === 'active') return 'procesando';
  return 'pendiente';
}
