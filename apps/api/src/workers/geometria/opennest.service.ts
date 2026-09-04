import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../colas';
import {
  validarEntradaNestingOpenNest,
  validarResultadoNestingOpenNest,
} from './validar-nesting-opennest';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';

type ResultadoRunner = Omit<NestingIrregularOpenNestResult, 'validacion'>;

type EstrategiaOrientacion = NonNullable<
  NestingIrregularOpenNestResult['estrategiaOrientacion']
>;

export type PlanOrientacionGrafoNest = {
  estrategia: EstrategiaOrientacion;
  rotacionesMaximas: number;
  input: NestingIrregularOpenNestData;
};

type RespuestaRunner =
  | { ok: true; result: ResultadoRunner }
  | { ok: false; error: { code?: string; message?: string } };

type OpcionesSubproceso = {
  ejecutable: string;
  argumentos: string[];
  entrada: unknown;
  timeoutMs: number;
  graciaTerminacionMs?: number;
  maxSalidaBytes?: number;
  signal?: AbortSignal;
};

const SENTINEL = 'GRAFO_OPENNEST_RESULT:';

export class OpenNestSubprocessError extends Error {
  constructor(
    message: string,
    readonly codigo:
      | 'TIMEOUT'
      | 'OUTPUT_LIMIT'
      | 'SPAWN_ERROR'
      | 'RUNNER_ERROR'
      | 'INVALID_OUTPUT'
      | 'CANCELLED',
  ) {
    super(message);
    this.name = 'OpenNestSubprocessError';
  }
}

@Injectable()
export class OpenNestService {
  protected ejecutarRunner(
    options: OpcionesSubproceso,
  ): Promise<RespuestaRunner> {
    return ejecutarSubprocesoJson<RespuestaRunner>(options);
  }

  async resolver(
    input: NestingIrregularOpenNestData,
    options?: {
      signal?: AbortSignal;
      onCandidate?: () => Promise<void> | void;
    },
  ): Promise<NestingIrregularOpenNestResult> {
    validarEntradaNestingOpenNest(input);
    const timeoutMs = Math.min(input.timeoutMs, timeoutMaximoOpenNestMs());
    const startedAt = Date.now();
    const planes = crearPlanesOrientacion(input);
    const minimoPlacas = calcularMinimoTeoricoPlacas(input);
    const base = validarResultadoNestingOpenNest(
      input,
      resolverNestingBaseSeguro(input),
    );
    let mejor: {
      plan?: PlanOrientacionGrafoNest;
      resultado: NestingIrregularOpenNestResult;
    } = { resultado: base };
    let ultimoError: unknown;

    for (let index = 0; index < planes.length; index += 1) {
      if (options?.signal?.aborted)
        throw new OpenNestSubprocessError(
          'El cálculo de OpenNest fue cancelado.',
          'CANCELLED',
        );
      const restanteMs = timeoutMs - (Date.now() - startedAt);
      if (restanteMs < 100) break;
      const plan = planes[index];
      const presupuestoMs = presupuestoCandidatoMs({
        estrategia: plan.estrategia,
        restanteMs,
        totalMs: timeoutMs,
        esUltimo: index === planes.length - 1,
      });
      try {
        const respuesta = await this.ejecutarRunner({
          ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
          argumentos: [rutaRunnerOpenNest()],
          entrada: { ...plan.input, timeoutMs: presupuestoMs },
          timeoutMs: presupuestoMs,
          graciaTerminacionMs: 250,
          maxSalidaBytes: 32 * 1024 * 1024,
          signal: options?.signal,
        });
        if (!respuesta.ok) {
          throw new OpenNestSubprocessError(
            respuesta.error?.message || 'OpenNest no pudo resolver el nesting.',
            'RUNNER_ERROR',
          );
        }
        const validado = validarResultadoNestingOpenNest(
          plan.input,
          respuesta.result,
        );
        if (
          validado.placasUsadas < mejor.resultado.placasUsadas ||
          (validado.placasUsadas === mejor.resultado.placasUsadas &&
            mejor.resultado.calidadSolucion === 'BASE_SEGURA')
        ) {
          mejor = {
            plan,
            resultado: { ...validado, calidadSolucion: 'OPTIMIZADA' },
          };
        }
        // La base sólo garantiza un layout válido mediante cajas envolventes.
        // Incluso si ya usa el mínimo de placas, el primer candidato nativo
        // debe ejecutarse para aprovechar concavidades y huecos reales. Los
        // planes están ordenados desde la orientación más uniforme hacia la
        // más libre, por lo que al alcanzar el límite matemático conservamos
        // la alternativa visualmente más estable.
        if (validado.placasUsadas <= minimoPlacas) break;
      } catch (error) {
        if (
          error instanceof OpenNestSubprocessError &&
          error.codigo === 'CANCELLED'
        )
          throw error;
        ultimoError = error;
      }
    }

    await options?.onCandidate?.();
    return {
      ...mejor.resultado,
      duracionMs: Date.now() - startedAt,
      estrategiaOrientacion: mejor.plan?.estrategia,
      rotacionesPermitidas: mejor.plan?.rotacionesMaximas,
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      optimizacionAgotada:
        ultimoError != null &&
        mejor.resultado.calidadSolucion === 'BASE_SEGURA',
    };
  }
}

/**
 * Construye una búsqueda progresiva. Nunca habilita un ángulo que la pieza no
 * tuviera permitido en el contrato original.
 */
export function crearPlanesOrientacion(
  input: NestingIrregularOpenNestData,
): PlanOrientacionGrafoNest[] {
  const candidatos: Array<{
    estrategia: EstrategiaOrientacion;
    rotaciones: (cantidad: number) => number;
  }> = [
    { estrategia: 'uniforme', rotaciones: () => 1 },
    {
      estrategia: 'cardinal',
      rotaciones: (cantidad) => {
        if (cantidad <= 1) return 1;
        if (cantidad % 4 === 0) return 4;
        if (cantidad % 2 === 0) return 2;
        return 1;
      },
    },
    { estrategia: 'libre', rotaciones: (cantidad) => cantidad },
  ];
  const firmas = new Set<string>();
  const planes: PlanOrientacionGrafoNest[] = [];
  for (const candidato of candidatos) {
    const piezas = input.piezas.map((pieza) => ({
      ...pieza,
      rotaciones: candidato.rotaciones(pieza.rotaciones),
    }));
    const firma = piezas.map((pieza) => pieza.rotaciones).join(',');
    if (firmas.has(firma)) continue;
    firmas.add(firma);
    planes.push({
      estrategia: candidato.estrategia,
      rotacionesMaximas: Math.max(...piezas.map((pieza) => pieza.rotaciones)),
      input: { ...input, piezas },
    });
  }
  return planes;
}

/** Límite inferior conservador: ignora separación y usa el área neta. */
export function calcularMinimoTeoricoPlacas(
  input: NestingIrregularOpenNestData,
): number {
  const anchoUtil = input.placa.anchoMm - input.placa.margenMm * 2;
  const altoUtil = input.placa.altoMm - input.placa.margenMm * 2;
  const areaUtil = anchoUtil * altoUtil;
  const areaPiezas = input.piezas.reduce((total, pieza) => {
    const areaExterior = areaAnillo(pieza.contorno);
    const areaHuecos = (pieza.huecos ?? []).reduce(
      (area, hueco) => area + areaAnillo(hueco),
      0,
    );
    return total + Math.max(0, areaExterior - areaHuecos) * pieza.cantidad;
  }, 0);
  return Math.max(1, Math.ceil(areaPiezas / areaUtil - 1e-12));
}

function presupuestoCandidatoMs(input: {
  estrategia: EstrategiaOrientacion;
  restanteMs: number;
  totalMs: number;
  esUltimo: boolean;
}): number {
  if (input.esUltimo) return Math.max(100, input.restanteMs);
  const proporcion = input.estrategia === 'uniforme' ? 0.2 : 0.3;
  return Math.max(
    100,
    Math.min(input.restanteMs, Math.max(2_000, input.totalMs * proporcion)),
  );
}

function areaAnillo(points: Array<{ x: number; y: number }>): number {
  let dobleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    dobleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(dobleArea) / 2;
}

/**
 * Ejecuta un protocolo stdin/stdout sin shell. El timeout termina el grupo de
 * procesos completo para no dejar código nativo consumiendo CPU en segundo plano.
 */
export function ejecutarSubprocesoJson<T>(
  options: OpcionesSubproceso,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    if (options.signal?.aborted) {
      rejectPromise(
        new OpenNestSubprocessError(
          'El cálculo de OpenNest fue cancelado.',
          'CANCELLED',
        ),
      );
      return;
    }
    const child = spawn(options.ejecutable, options.argumentos, {
      detached: process.platform !== 'win32',
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const maxOutput = options.maxSalidaBytes ?? 32 * 1024 * 1024;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let forcedError: OpenNestSubprocessError | undefined;
    let finished = false;
    let killTimer: NodeJS.Timeout | undefined;

    const forceStop = (error: OpenNestSubprocessError) => {
      if (forcedError) return;
      forcedError = error;
      terminarProceso(child.pid, 'SIGTERM');
      killTimer = setTimeout(
        () => terminarProceso(child.pid, 'SIGKILL'),
        options.graciaTerminacionMs ?? 250,
      );
      killTimer.unref();
    };

    const timeout = setTimeout(() => {
      forceStop(
        new OpenNestSubprocessError(
          `OpenNest excedió el límite externo de ${options.timeoutMs} ms.`,
          'TIMEOUT',
        ),
      );
    }, options.timeoutMs);
    timeout.unref();
    const abortHandler = () =>
      forceStop(
        new OpenNestSubprocessError(
          'El cálculo de OpenNest fue cancelado.',
          'CANCELLED',
        ),
      );
    options.signal?.addEventListener('abort', abortHandler, { once: true });
    if (options.signal?.aborted) abortHandler();

    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      options.signal?.removeEventListener('abort', abortHandler);
      callback();
    };

    child.stdout.on('data', (chunk: Buffer) => {
      if (forcedError) return;
      if (stdout.length + chunk.length > maxOutput) {
        forceStop(
          new OpenNestSubprocessError(
            'OpenNest excedió el límite de salida permitido.',
            'OUTPUT_LIMIT',
          ),
        );
        return;
      }
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const maxStderr = 128 * 1024;
      if (stderr.length < maxStderr)
        stderr = Buffer.concat([
          stderr,
          chunk.subarray(0, maxStderr - stderr.length),
        ]);
    });
    child.on('error', (error) => {
      finish(() =>
        rejectPromise(
          new OpenNestSubprocessError(
            `No se pudo iniciar OpenNest: ${error.message}`,
            'SPAWN_ERROR',
          ),
        ),
      );
    });
    child.on('close', (code, signal) => {
      finish(() => {
        if (forcedError) return rejectPromise(forcedError);
        const response = extraerRespuesta<T>(stdout.toString('utf8'));
        if (!response) {
          const detail = stderr.toString('utf8').trim().slice(-1_000);
          return rejectPromise(
            new OpenNestSubprocessError(
              `OpenNest terminó sin respuesta válida (código=${String(code)}, señal=${String(signal)})${detail ? `: ${detail}` : '.'}`,
              'INVALID_OUTPUT',
            ),
          );
        }
        if (code !== 0) {
          const runner = response as unknown as RespuestaRunner;
          return rejectPromise(
            new OpenNestSubprocessError(
              !runner.ok && runner.error?.message
                ? runner.error.message
                : `OpenNest terminó con código ${String(code)}.`,
              'RUNNER_ERROR',
            ),
          );
        }
        resolvePromise(response);
      });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(JSON.stringify(options.entrada));
  });
}

function extraerRespuesta<T>(stdout: string): T | undefined {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.startsWith(SENTINEL));
  if (!line) return undefined;
  try {
    return JSON.parse(line.slice(SENTINEL.length)) as T;
  } catch {
    return undefined;
  }
}

function terminarProceso(
  pid: number | undefined,
  signal: NodeJS.Signals,
): void {
  if (!pid) return;
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, signal);
  } catch {
    // El proceso puede haber terminado entre el timeout y la señal.
  }
}

function rutaRunnerOpenNest(): string {
  const configured = process.env.OPENNEST_RUNNER_PATH?.trim();
  const candidates = [
    configured,
    join(__dirname, 'python', 'opennest_runner.py'),
    resolve(process.cwd(), 'src/workers/geometria/python/opennest_runner.py'),
    resolve(
      process.cwd(),
      'apps/api/src/workers/geometria/python/opennest_runner.py',
    ),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found)
    throw new OpenNestSubprocessError(
      'No se encontró el runner Python de OpenNest.',
      'SPAWN_ERROR',
    );
  return found;
}

function timeoutMaximoOpenNestMs(): number {
  const value = Number(process.env.OPENNEST_TIMEOUT_MAX_MS);
  return Number.isInteger(value) && value >= 100 ? value : 60_000;
}
