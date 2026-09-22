import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { esPreparacionNesting, timeoutOpenNestMs } from './politica-busqueda';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Job, Queue, type JobState } from 'bullmq';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import {
  COLA_GEOMETRIA,
  COLA_GEOMETRIA_INTENSIVA,
  TRABAJO_NESTING_IRREGULAR_OPENNEST,
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  VERSION_POLITICA_BUSQUEDA_GRAFONEST,
  type NestingIrregularOpenNestData,
  type NestingIrregularOpenNestResult,
} from '../colas';
import { conexionRedisApi } from '../redis';
import {
  NestingsGuardadosService,
  firmaNesting,
  satisfaceBusqueda,
} from './nestings-guardados.service';
import { BibliotecaPatronesService } from './biblioteca-patrones.service';
import { CapacidadGeometriaService } from './capacidad-geometria.service';
import type { CrearTrabajoNestingOpenNestDto } from './geometria-jobs.dto';
import {
  NestingOpenNestInvalidoError,
  validarEntradaNestingOpenNest,
} from './validar-nesting-opennest';

export type EstadoTrabajoGeometria =
  | 'pendiente'
  | 'procesando'
  | 'completado'
  | 'fallido'
  | 'cancelado';

export type VistaTrabajoGeometria = {
  id: string;
  tipo: typeof TRABAJO_NESTING_IRREGULAR_OPENNEST;
  estado: EstadoTrabajoGeometria;
  creadoEl: string;
  iniciadoEl?: string;
  finalizadoEl?: string;
  correlationId: string;
  progreso: {
    porcentaje: number;
    etapa: 'en_cola' | 'opennest' | 'validando' | 'completado';
  };
  resultado?: NestingIrregularOpenNestResult;
  error?: { codigo: string; mensaje: string };
  cancelacion?: {
    motivo: 'usuario' | 'obsoleto';
    solicitadaEl: string;
    reemplazadoPor?: string;
  };
};

type GeometryJob = Job<
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
>;

@Injectable()
export class GeometriaJobsService implements OnApplicationShutdown {
  private readonly logger = new Logger(GeometriaJobsService.name);
  private readonly queues = new Map<string, GeometryQueue>();

  constructor(
    private readonly control: ControlTrabajosGeometriaService,
    private readonly capacidad: CapacidadGeometriaService,
    private readonly capacidadesPlan: CapacidadesEmpresaService,
    @Optional() private readonly guardados?: NestingsGuardadosService,
    @Optional() private readonly biblioteca?: BibliotecaPatronesService,
  ) {}

  async crear(input: {
    tenantId: string;
    dto: CrearTrabajoNestingOpenNestDto;
  }): Promise<VistaTrabajoGeometria> {
    await this.capacidadesPlan.exigirTodas(input.tenantId, [
      'analisis_vectorial',
      'aprovechamiento_cotizacion',
      'nesting_irregular',
    ]);
    return this.encolar(input, false);
  }

  /** El origen interno no concede la optimización irregular al contrato. */
  async crearParaCotizacion(input: {
    tenantId: string;
    dto: CrearTrabajoNestingOpenNestDto;
  }) {
    await this.capacidadesPlan.exigir(input.tenantId, 'nesting_irregular');
    return this.encolar(input, true);
  }

  private async encolar(
    input: { tenantId: string; dto: CrearTrabajoNestingOpenNestDto },
    calculoCotizacion: boolean,
  ): Promise<VistaTrabajoGeometria> {
    const correlationId = randomUUID();
    const data: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      calculoCotizacion,
      tenantId: input.tenantId,
      correlationId,
      solicitadoEl: new Date().toISOString(),
      motor: input.dto.motor ?? 'collision',
      placa: { ...input.dto.placa },
      separacionMm: input.dto.separacionMm,
      commonLine: input.dto.commonLine,
      timeoutMs: input.dto.timeoutMs ?? timeoutOpenNestMs(),
      ...(esPreparacionNesting() ? { buscarMejora: true } : {}),
      semilla: input.dto.semilla ?? 30,
      piezas: input.dto.piezas.map((pieza) => ({
        id: pieza.id,
        cantidad: pieza.cantidad,
        rotaciones: pieza.rotaciones,
        contorno: pieza.contorno.map(({ x, y }) => ({ x, y })),
        huecos: pieza.huecos?.map((hueco) =>
          hueco.puntos.map(({ x, y }) => ({ x, y })),
        ),
      })),
    };
    const complejidad = clasificarTrabajoGeometria(data);
    data.claseComplejidad = complejidad.clase;
    data.pesoEstimado = complejidad.peso;
    try {
      validarEntradaNestingOpenNest(data);
    } catch (error) {
      if (error instanceof NestingOpenNestInvalidoError)
        throw new BadRequestException(error.message);
      throw error;
    }
    // Cotizar mientras se mejora el mismo nesting no cancela la preparación.
    const scope =
      data.buscarMejora && input.dto.claveSolicitud
        ? `${input.dto.claveSolicitud}-preparacion-${data.timeoutMs}`
        : input.dto.claveSolicitud;
    let jobId = idTrabajo(input.tenantId, scope, data);
    let job: GeometryJob;
    try {
      const guardado = await this.guardados?.obtener(data, {
        biblioteca: this.biblioteca,
      });
      if (guardado && satisfaceBusqueda(data, guardado)) {
        // Promueve también los acomodos anteriores que el API devuelve sin
        // pasar por el worker: sus patrones sirven para otras cantidades.
        try {
          await this.biblioteca?.aprender(data, guardado);
        } catch (error) {
          this.logger.warn(
            `No se pudo enriquecer la biblioteca: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return {
          id: `nest-${firmaNesting(data).clave}`,
          tipo: TRABAJO_NESTING_IRREGULAR_OPENNEST,
          estado: 'completado',
          creadoEl: data.solicitadoEl,
          finalizadoEl: data.solicitadoEl,
          correlationId,
          progreso: { porcentaje: 100, etapa: 'completado' },
          resultado: guardado,
        };
      }
      if (await this.control.leerCancelacion(jobId))
        jobId = `${jobId}-${randomUUID()}`;
      const queue = this.getQueue(complejidad.clase);
      await this.capacidad.registrar(
        {
          jobId,
          tenantId: input.tenantId,
          clase: complejidad.clase === 'INTENSIVA' ? 'intensiva' : 'normal',
          prioridad: complejidad.prioridad,
        },
        false,
      );
      const queued = await queue.add(TRABAJO_NESTING_IRREGULAR_OPENNEST, data, {
        jobId,
        attempts: 1,
        priority: complejidad.prioridad,
        removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
      });
      job = (await queue.getJob(jobId)) ?? queued;
      // Reintentar desde el sheet debe volver a ejecutar un trabajo fallido,
      // no devolver durante siete días el mismo error guardado en Redis.
      if ((await job.getState()) === 'failed') {
        try {
          await job.retry('failed');
        } catch (error) {
          // Dos solicitudes pueden compartir el reintento ya puesto en cola.
          if ((await job.getState()) === 'failed') throw error;
        }
        job = (await queue.getJob(jobId)) ?? job;
      }
      await this.capacidad.confirmar(jobId);
      if (scope) {
        const anterior = await this.control.activarScope({
          tenantId: input.tenantId,
          scope,
          jobId,
        });
        if (anterior && anterior !== jobId) {
          await this.control.solicitarCancelacion({
            jobId: anterior,
            tenantId: input.tenantId,
            motivo: 'obsoleto',
            reemplazadoPor: jobId,
          });
          await this.removerSiEspera(anterior);
        }
      }
      return await this.vistaDesdeJob(job);
    } catch (error) {
      await this.capacidad.cancelar(jobId).catch(() => undefined);
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(
        `No se pudo encolar nesting: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de cálculos está temporalmente no disponible.',
      );
    }
  }

  async consultar(
    tenantId: string,
    jobId: string,
  ): Promise<VistaTrabajoGeometria> {
    exigirIdTrabajo(jobId);
    try {
      const cancelacion = await this.control.leerCancelacion(jobId);
      if (cancelacion) {
        if (cancelacion.tenantId !== tenantId) throw new NotFoundException();
        const job = await this.buscarJob(jobId);
        const data = job?.data;
        return {
          id: jobId,
          tipo: TRABAJO_NESTING_IRREGULAR_OPENNEST,
          estado: 'cancelado',
          creadoEl: data?.solicitadoEl ?? cancelacion.solicitadaEl,
          correlationId: data?.correlationId ?? jobId,
          progreso: { porcentaje: 0, etapa: 'en_cola' },
          cancelacion: {
            motivo: cancelacion.motivo,
            solicitadaEl: cancelacion.solicitadaEl,
            ...(cancelacion.reemplazadoPor
              ? { reemplazadoPor: cancelacion.reemplazadoPor }
              : {}),
          },
        };
      }
      const job = await this.buscarJob(jobId);
      if (!job || job.data.tenantId !== tenantId)
        throw new NotFoundException('No se encontró el trabajo de geometría.');
      return await this.vistaDesdeJob(job);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(
        `No se pudo consultar job=${jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de cálculos está temporalmente no disponible.',
      );
    }
  }

  async cancelar(
    tenantId: string,
    jobId: string,
  ): Promise<VistaTrabajoGeometria> {
    const current = await this.consultar(tenantId, jobId);
    if (
      current.estado === 'cancelado' ||
      current.estado === 'completado' ||
      current.estado === 'fallido'
    )
      return current;
    await this.control.solicitarCancelacion({
      jobId,
      tenantId,
      motivo: 'usuario',
    });
    await this.removerSiEspera(jobId);
    return this.consultar(tenantId, jobId);
  }

  async onApplicationShutdown(): Promise<void> {
    const queues = [...this.queues.values()];
    this.queues.clear();
    await Promise.all(queues.map((queue) => queue.close()));
  }

  private async vistaDesdeJob(
    job: GeometryJob,
  ): Promise<VistaTrabajoGeometria> {
    const state = await job.getState();
    if (state === 'completed' || state === 'failed')
      await this.capacidad.cancelar(String(job.id));
    const estado = estadoPublico(state);
    let resultado = job.returnvalue;
    if (estado === 'completado' && resultado) {
      // Un job antiguo de Redis nunca debe tapar una mejora persistida después.
      resultado = this.guardados
        ? await this.guardados.conservarResultado(job.data, resultado)
        : resultado;
    }
    const progreso = progresoPublico(job.progress, estado);
    return {
      id: job.id ?? '',
      tipo: TRABAJO_NESTING_IRREGULAR_OPENNEST,
      estado,
      creadoEl: new Date(job.timestamp).toISOString(),
      ...(job.processedOn
        ? { iniciadoEl: new Date(job.processedOn).toISOString() }
        : {}),
      ...(job.finishedOn
        ? { finalizadoEl: new Date(job.finishedOn).toISOString() }
        : {}),
      correlationId: job.data.correlationId,
      progreso,
      ...(estado === 'completado' && job.returnvalue ? { resultado } : {}),
      ...(estado === 'fallido'
        ? {
            error: errorPublico(job.failedReason),
          }
        : {}),
    };
  }

  private async removerSiEspera(jobId: string): Promise<void> {
    await this.capacidad.cancelar(jobId);
    const job = await this.buscarJob(jobId);
    if (!job) return;
    const state = await job.getState();
    if (
      state === 'waiting' ||
      state === 'delayed' ||
      state === 'prioritized' ||
      state === 'waiting-children'
    ) {
      await job.remove().catch(() => undefined);
    }
  }

  private async buscarJob(jobId: string): Promise<GeometryJob | undefined> {
    for (const nombre of [COLA_GEOMETRIA, COLA_GEOMETRIA_INTENSIVA]) {
      const job = await this.getQueuePorNombre(nombre).getJob(jobId);
      if (job) return job;
    }
    return undefined;
  }

  private getQueue(
    clase: NonNullable<NestingIrregularOpenNestData['claseComplejidad']>,
  ): GeometryQueue {
    return this.getQueuePorNombre(
      clase === 'INTENSIVA' ? COLA_GEOMETRIA_INTENSIVA : COLA_GEOMETRIA,
    );
  }

  private getQueuePorNombre(nombre: string): GeometryQueue {
    const existente = this.queues.get(nombre);
    if (existente) return existente;
    const queue = new Queue<
      NestingIrregularOpenNestData,
      NestingIrregularOpenNestResult,
      typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
    >(nombre, { connection: conexionRedisApi() });
    queue.on('error', (error) =>
      this.logger.warn(`Cola de geometría ${nombre}: ${error.message}`),
    );
    this.queues.set(nombre, queue);
    return queue;
  }
}

type GeometryQueue = Queue<
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  typeof TRABAJO_NESTING_IRREGULAR_OPENNEST
>;

export function clasificarTrabajoGeometria(
  data: NestingIrregularOpenNestData,
): {
  clase: NonNullable<NestingIrregularOpenNestData['claseComplejidad']>;
  peso: number;
  prioridad: number;
} {
  const instancias = data.piezas.reduce(
    (total, pieza) => total + pieza.cantidad,
    0,
  );
  const puntosExpandidos = data.piezas.reduce(
    (total, pieza) =>
      total +
      (pieza.contorno.length +
        (pieza.huecos ?? []).reduce(
          (subtotal, hueco) => subtotal + hueco.length,
          0,
        )) *
        pieza.cantidad,
    0,
  );
  const tipos = data.piezas.length;
  const rotaciones = data.piezas.length
    ? Math.max(...data.piezas.map((pieza) => pieza.rotaciones))
    : 1;
  const peso = Math.ceil(
    instancias +
      puntosExpandidos / 25 +
      tipos * 4 +
      Math.min(rotaciones, 72) * 2,
  );
  if (instancias > 200 || tipos > 40 || puntosExpandidos > 75_000) {
    return { clase: 'INTENSIVA', peso, prioridad: 20 };
  }
  if (instancias > 60 || tipos > 12 || puntosExpandidos > 15_000) {
    return { clase: 'ESTANDAR', peso, prioridad: 5 };
  }
  return { clase: 'RAPIDA', peso, prioridad: 1 };
}

function exigirIdTrabajo(jobId: string): void {
  if (!/^nest-[a-f0-9-]{36,110}$/.test(jobId))
    throw new NotFoundException('No se encontró el trabajo de geometría.');
}

function errorPublico(reason: string | undefined): {
  codigo: string;
  mensaje: string;
} {
  const value = reason ?? '';
  if (value.includes('excedió el límite externo'))
    return {
      codigo: 'TIMEOUT',
      mensaje: 'El nesting excedió el tiempo máximo configurado.',
    };
  if (
    value.includes('solapamiento') ||
    value.includes('separación') ||
    value.includes('fuera del área útil') ||
    value.includes('devolvió') ||
    value.includes('transformación geométrica')
  )
    return {
      codigo: 'SOLUCION_INVALIDA',
      mensaje: value.replaceAll('OpenNest', 'GrafoNest'),
    };
  if (
    value.includes('No module named') ||
    value.includes('No se pudo iniciar OpenNest')
  )
    return {
      codigo: 'MOTOR_NO_DISPONIBLE',
      mensaje: 'El motor de nesting no está disponible en este momento.',
    };
  return {
    codigo: 'CALCULO_FALLIDO',
    mensaje: 'No se pudo completar el nesting irregular.',
  };
}

export function estadoPublico(
  state: JobState | 'unknown',
): EstadoTrabajoGeometria {
  if (state === 'completed') return 'completado';
  if (state === 'failed') return 'fallido';
  if (state === 'active') return 'procesando';
  return 'pendiente';
}

function progresoPublico(
  progress: GeometryJob['progress'],
  estado: EstadoTrabajoGeometria,
): VistaTrabajoGeometria['progreso'] {
  if (estado === 'completado') return { porcentaje: 100, etapa: 'completado' };
  if (
    progress &&
    typeof progress === 'object' &&
    'porcentaje' in progress &&
    'etapa' in progress
  ) {
    const value = progress as { porcentaje?: unknown; etapa?: unknown };
    const porcentaje = Number(value.porcentaje);
    const etapa = value.etapa;
    if (
      Number.isFinite(porcentaje) &&
      (etapa === 'en_cola' ||
        etapa === 'opennest' ||
        etapa === 'validando' ||
        etapa === 'completado')
    )
      return {
        porcentaje: Math.max(0, Math.min(100, porcentaje)),
        etapa,
      };
  }
  return {
    porcentaje: estado === 'procesando' ? 10 : 0,
    etapa: estado === 'procesando' ? 'opennest' : 'en_cola',
  };
}

export function idTrabajo(
  tenantId: string,
  scope: string | undefined,
  data: NestingIrregularOpenNestData,
): string {
  if (!scope) return `nest-${randomUUID()}`;
  const digest = createHash('sha256')
    .update(tenantId)
    .update('\0')
    .update(scope)
    .update('\0')
    .update(
      JSON.stringify({
        calculoCotizacion: data.calculoCotizacion === true,
        versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
        versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
        motor: data.motor,
        placa: data.placa,
        separacionMm: data.separacionMm,
        commonLine: data.commonLine,
        timeoutMs: data.timeoutMs,
        buscarMejora: data.buscarMejora,
        semilla: data.semilla,
        piezas: data.piezas,
      }),
    )
    .digest('hex');
  return `nest-${digest}`;
}
