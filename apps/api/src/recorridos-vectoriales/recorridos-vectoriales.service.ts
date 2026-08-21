import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ResultadoRecorridoCorte,
  SolicitudRecorridoCorte,
} from './recorridos-vectoriales.types';

/**
 * Motor de recorridos vectoriales.
 *
 * CORTE sigue contornos y crea conexiones continuas. GRABADO no debe entrar
 * en esta estrategia: requerirá un futuro motor de barrido/raster separado.
 * El postprocesador traduce el recorrido neutro al dialecto de cada máquina.
 */
@Injectable()
export class RecorridosVectorialesService {
  protected loadLinker() {
    return import('@grafo/hotwire-linker');
  }

  async generar(
    input: SolicitudRecorridoCorte,
  ): Promise<ResultadoRecorridoCorte> {
    if (input.modo !== 'CORTE') {
      throw new BadRequestException(
        'El modo solicitado no está soportado por el motor de corte.',
      );
    }
    if (input.perfil.postprocesador !== 'HOTWIRE_TAP_V1') {
      throw new BadRequestException(
        'El postprocesador de máquina solicitado no está disponible.',
      );
    }
    if (!(input.perfil.velocidadMmMin > 0)) {
      throw new BadRequestException(
        'La velocidad de corte debe ser mayor que cero.',
      );
    }

    try {
      // El linker es ESM puro; la carga dinámica mantiene compatible el API
      // Nest compilado a CommonJS sin duplicar ni transpilar su motor.
      const module = await this.loadLinker();
      const generateHotwireJob =
        module.generateHotwireJob ??
        (
          module as unknown as {
            default?: typeof module;
          }
        ).default?.generateHotwireJob;
      if (!generateHotwireJob) {
        throw new Error('El motor de recorridos no está disponible.');
      }
      const job = generateHotwireJob({
        svg: input.svg,
        sourceName: input.nombreFuente,
        originCorner: input.perfil.origen ?? 'bottom-left',
        originStrategy: input.perfil.estrategiaOrigen ?? 'geometry-bounds',
        strictBounds: input.perfil.strictBounds ?? true,
        profile: {
          id: input.perfil.id,
          name: input.perfil.nombre,
          bedWidthMm: input.perfil.anchoUtilMm,
          bedHeightMm: input.perfil.altoUtilMm,
          feedRateMmPerMin: input.perfil.velocidadMmMin,
          decimals: input.perfil.decimales ?? 6,
          originLeadInMm: input.perfil.entradaMm ?? 8,
        },
      });

      return {
        modo: 'CORTE',
        engine: { id: '@grafo/hotwire-linker', version: '1.0.0' },
        postprocesador: input.perfil.postprocesador,
        perfil: input.perfil,
        origenSvg: job.originSvg,
        recorridoSvg: job.routeSvg,
        recorridoMaquina: job.routeMachine,
        metricas: {
          longitudContornosMm: job.metrics.contourLengthMm,
          longitudConexionesIdaMm: job.metrics.bridgeOneWayLengthMm,
          longitudConexionesRecorridaMm: job.metrics.bridgeTravelLengthMm,
          longitudTotalMm: job.metrics.totalLengthMm,
          tiempoEstimadoSeg: job.metrics.estimatedSeconds,
          cantidadContornos: job.metrics.contourCount,
          cantidadPiezas: job.metrics.pieceCount,
          cantidadConexiones: job.metrics.bridgeCount,
        },
        conexiones: job.bridges,
        svgVinculado: job.linkedSvg,
        tap: job.tap,
        informe: job.report,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo generar el recorrido de corte.';
      throw new BadRequestException(message);
    }
  }
}
