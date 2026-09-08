import { generarCarteraPatrones, materializarPatrones, type SeleccionPatrones } from './cartera-patrones';
import { Injectable, Logger } from '@nestjs/common';
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
import { optimizarCommonLines } from './common-line';
import { timeoutMaximoOpenNestMs } from './politica-busqueda';

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
    const planes = crearPlanesOrientacion(input).filter(cabeCadaPieza);
    const minimoPlacas = calcularMinimoTeoricoPlacas(input);
    const baseNativa = validarResultadoNestingOpenNest(
      input,
      resolverNestingBaseSeguro(input),
    );
    const base = validarResultadoNestingOpenNest(
      input,
      optimizarCommonLines(input, baseNativa),
    );
    let mejor: {
      plan?: PlanOrientacionGrafoNest;
      resultado: NestingIrregularOpenNestResult;
    } = { resultado: base };
    let intentos = 0;
    let candidatosValidos = 0;
    let motorNoDisponible = false;

    // Para lotes repetidos, primero optimizamos combinaciones enteras de
    // patrones. El tiempo consumido se descuenta del mismo presupuesto global.
    if (input.piezas.length > 1 && input.piezas.length <= 30 && base.cantidadSolicitada >= 20 && timeoutMs >= 10000) {
      try {
        const cartera = await generarCarteraPatrones(input, { plazo: Math.min(startedAt + timeoutMs * 0.12, Date.now() + 6000), signal: options?.signal });
        const restante = Math.min(60000, (timeoutMs - (Date.now() - startedAt)) * 0.6);
        if (restante > 1000 && cartera.length) {
          const seleccion = await ejecutarSubprocesoJson<SeleccionPatrones>({
            ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
            argumentos: [rutaRunnerOpenNest().replace('opennest_runner.py', 'patrones_runner.py')],
            entrada: { patrones: cartera.map(p => ({ counts: p.counts })), demanda: input.piezas.map(p => p.cantidad), timeoutMs: restante },
            timeoutMs: restante, signal: options?.signal,
          });
          const candidato = validarResultadoNestingOpenNest(input, materializarPatrones(input, cartera, seleccion));
          candidatosValidos += 1;
          if (candidato.placasUsadas <= mejor.resultado.placasUsadas) mejor = { resultado: candidato };
        }
      } catch (error) {
        if (options?.signal?.aborted) throw new OpenNestSubprocessError('El cálculo fue cancelado.', 'CANCELLED');
        new Logger(OpenNestService.name).warn(`No se pudo completar la búsqueda por patrones: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Cada vuelta cambia la semilla. Los reintentos empiezan con todos los
    // ángulos y alternan motores; no terminamos por completar tres planes.
    for (let index = 0; planes.length > 0; index += 1) {
      if (options?.signal?.aborted)
        throw new OpenNestSubprocessError(
          'El cálculo de OpenNest fue cancelado.',
          'CANCELLED',
        );
      const restanteMs = timeoutMs - (Date.now() - startedAt);
      if (restanteMs < 100) break;
      const vuelta = Math.floor(index / planes.length);
      const indicePlan = index % planes.length;
      const original =
        vuelta === 0
          ? planes[indicePlan]
          : planes[planes.length - 1 - indicePlan];
      const motor =
        vuelta % 3 === 2
          ? input.motor === 'collision'
            ? 'nfp'
            : 'collision'
          : input.motor;
      const semilla =
        vuelta === 0
          ? input.semilla
          : (30 + Math.imul(vuelta - 1, 104729)) & 0x7fffffff;
      // Obligar al solver a intentar una placa menos evita que se conforme
      // con dejar una pieza aislada. El primer intento y las vueltas del
      // motor alternativo también mejoran el acomodo con las placas actuales.
      // Una solución parcial jamás se acepta.
      const quitarPlaca = index !== 0 && vuelta % 3 !== 2;
      const maxPlacas = Math.max(
        minimoPlacas,
        mejor.resultado.placasUsadas - (quitarPlaca ? 1 : 0),
      );
      const plan: PlanOrientacionGrafoNest = {
        ...original,
        input: {
          ...original.input,
          motor,
          semilla,
          placa: {
            ...input.placa,
            maxPlacas: Math.min(input.placa.maxPlacas, maxPlacas),
          },
        },
      };
      const iteraciones = motor === 'collision' && vuelta < 2 ? 1000 : undefined;
      const presupuestoMs = Math.min(iteraciones ? 8000 : Infinity, presupuestoCandidatoMs({
        estrategia: plan.estrategia,
        restanteMs,
        totalMs: timeoutMs,
      }));
      intentos += 1;
      try {
        const respuesta = await this.ejecutarRunner({
          ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
          argumentos: [rutaRunnerOpenNest()],
          entrada: { ...plan.input, timeoutMs: presupuestoMs, ...(iteraciones ? { iteraciones } : {}) },
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
        const validadoNativo = validarResultadoNestingOpenNest(
          plan.input,
          respuesta.result,
        );
        const validado = validarResultadoNestingOpenNest(
          plan.input,
          optimizarCommonLines(plan.input, validadoNativo),
        );
        candidatosValidos += 1;
        if (esMejorResultado(validado, mejor.resultado)) {
          mejor = {
            plan,
            resultado: { ...validado, calidadSolucion: 'OPTIMIZADA' },
          };
        }
        // Este límite prueba el mínimo de PLACAS, no un óptimo universal
        // de orientación, retales o recorrido de corte.
        if (mejor.resultado.placasUsadas <= minimoPlacas) break;
      } catch (error) {
        if (
          error instanceof OpenNestSubprocessError &&
          error.codigo === 'CANCELLED'
        )
          throw error;
        if (
          error instanceof OpenNestSubprocessError &&
          error.codigo === 'SPAWN_ERROR'
        ) {
          motorNoDisponible = true;
          break;
        }
      }
    }

    await options?.onCandidate?.();
    return {
      ...mejor.resultado,
      duracionMs: Date.now() - startedAt,
      estrategiaOrientacion: mejor.plan?.estrategia,
      rotacionesPermitidas: mejor.plan?.rotacionesMaximas,
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      optimizacionAgotada: mejor.resultado.placasUsadas > minimoPlacas,
      busqueda: {
        motivoFin: motorNoDisponible
          ? 'MOTOR_NO_DISPONIBLE'
          : mejor.resultado.placasUsadas <= minimoPlacas
            ? 'MINIMO_PLACAS'
            : 'PRESUPUESTO_AGOTADO',
        presupuestoMs: timeoutMs,
        intentos,
        candidatosValidos,
        minimoTeoricoPlacas: minimoPlacas,
      },
    };
  }
}

export function esMejorResultado(
  candidato: NestingIrregularOpenNestResult,
  actual: NestingIrregularOpenNestResult,
): boolean {
  if (candidato.placasUsadas !== actual.placasUsadas)
    return candidato.placasUsadas < actual.placasUsadas;
  const ahorro = longitudCommonLine(candidato) - longitudCommonLine(actual);
  if (Math.abs(ahorro) > 0.01) return ahorro > 0;
  const area = areaEnvolvente(candidato) - areaEnvolvente(actual);
  if (Math.abs(area) > 0.01) return area < 0;
  return actual.calidadSolucion === 'BASE_SEGURA';
}

function areaEnvolvente(result: NestingIrregularOpenNestResult): number {
  const placas = new Map<
    number,
    { minX: number; minY: number; maxX: number; maxY: number }
  >();
  for (const p of result.placements) {
    const caja = placas.get(p.placa) ?? {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    for (const punto of p.contorno) {
      caja.minX = Math.min(caja.minX, punto.x);
      caja.maxX = Math.max(caja.maxX, punto.x);
      caja.minY = Math.min(caja.minY, punto.y);
      caja.maxY = Math.max(caja.maxY, punto.y);
    }
    placas.set(p.placa, caja);
  }
  return [...placas.values()].reduce(
    (area, c) => area + (c.maxX - c.minX) * (c.maxY - c.minY),
    0,
  );
}

function cabeCadaPieza(plan: PlanOrientacionGrafoNest): boolean {
  const { placa, piezas } = plan.input;
  return piezas.every((pieza) => {
    for (let i = 0; i < pieza.rotaciones; i += 1) {
      const angulo = (i * 2 * Math.PI) / pieza.rotaciones;
      const cos = Math.cos(angulo),
        sin = Math.sin(angulo);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of pieza.contorno) {
        const x = p.x * cos - p.y * sin,
          y = p.x * sin + p.y * cos;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (
        maxX - minX <= placa.anchoMm - 2 * placa.margenMm + 0.001 &&
        maxY - minY <= placa.altoMm - 2 * placa.margenMm + 0.001
      )
        return true;
    }
    return false;
  });
}

function longitudCommonLine(result: NestingIrregularOpenNestResult): number {
  return result.commonLine?.longitudCompartidaMm ?? 0;
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
}): number {
  // Los reintentos invierten el orden. El presupuesto pertenece a la
  // estrategia, no a su posición: la búsqueda libre no debe perder tiempo
  // al pasar de última a primera en la vuelta siguiente.
  if (input.estrategia === 'libre') return Math.max(100, Math.min(30_000, input.restanteMs));
  const proporcion = input.estrategia === 'uniforme' ? 0.2 : 0.3;
  return Math.max(
    100,
    Math.min(
      input.restanteMs,
      input.estrategia === 'uniforme' ? 8_000 : 20_000,
      Math.max(2_000, input.totalMs * proporcion),
    ),
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
