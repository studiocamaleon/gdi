import {
  esMejorResultado,
  contarPatronesResultado,
  minimoTeoricoPatrones,
} from './calidad-nesting';
export { esMejorResultado } from './calidad-nesting';
import {
  generarCarteraPatrones,
  materializarPatrones,
  type SeleccionPatrones,
  type Patron,
} from './cartera-patrones';
import {
  BibliotecaPatronesService,
  patronesDeResultado,
} from './biblioteca-patrones.service';
import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  NestingsGuardadosService,
  presupuestoExplorado,
  satisfaceBusqueda,
} from './nestings-guardados.service';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import {
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  VERSION_POLITICA_BUSQUEDA_GRAFONEST,
} from '../colas';
import {
  validarEntradaNestingOpenNest,
  validarResultadoNestingOpenNest,
} from './validar-nesting-opennest';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { optimizarCommonLines } from './common-line';
import { timeoutMaximoOpenNestMs } from './politica-busqueda';
import { EscritorCheckpoint } from './escritor-checkpoint';
import { seleccionInicialDeResultado } from './seleccion-inicial';
import {
  configuracionPackingSolver,
  convertirPackingSolver,
  instanciaPackingSolver,
  presupuestoPackingSolver,
  type CertificadoPackingSolver,
} from './packingsolver';

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

type OpcionesSubproceso<T = unknown> = {
  ejecutable: string;
  argumentos: string[];
  entrada: unknown;
  timeoutMs: number;
  graciaTerminacionMs?: number;
  maxSalidaBytes?: number;
  signal?: AbortSignal;
  /** Mensajes completos; el consumidor debe validarlos antes de conservarlos. */
  onCandidate?: (candidato: T) => void;
  onExit?: (detalle: {
    codigo: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
  }) => void;
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
  constructor(
    @Optional() private readonly guardados?: NestingsGuardadosService,
    @Optional() private readonly biblioteca?: BibliotecaPatronesService,
  ) {}

  protected ejecutarRunner(
    options: OpcionesSubproceso<RespuestaRunner>,
  ): Promise<RespuestaRunner> {
    return ejecutarSubprocesoJson<RespuestaRunner>(options);
  }

  protected ejecutarSelector(
    options: OpcionesSubproceso<SeleccionPatrones>,
  ): Promise<SeleccionPatrones> {
    return ejecutarSubprocesoJson<SeleccionPatrones>(options);
  }

  protected ejecutarPackingSolver(
    options: OpcionesSubproceso<CertificadoPackingSolver>,
  ): Promise<CertificadoPackingSolver> {
    return ejecutarSubprocesoJson<CertificadoPackingSolver>(options);
  }

  async resolver(
    input: NestingIrregularOpenNestData,
    options?: {
      signal?: AbortSignal;
      onCandidate?: () => Promise<void> | void;
    },
  ): Promise<NestingIrregularOpenNestResult> {
    validarEntradaNestingOpenNest(input);
    const existente = await this.guardados?.obtener(input, {
      biblioteca: this.biblioteca,
      signal: options?.signal,
    });
    if (existente && satisfaceBusqueda(input, existente)) {
      options?.signal?.throwIfAborted();
      await this.aprenderPatrones(input, existente);
      await options?.onCandidate?.();
      return existente;
    }
    let inicial = existente ?? undefined;
    let recuperado = false;
    try {
      const checkpoint = await this.guardados?.obtenerCheckpoint(input);
      if (checkpoint && (!inicial || esMejorResultado(checkpoint, inicial))) {
        inicial = checkpoint;
        recuperado = true;
      }
    } catch (error) {
      new Logger(OpenNestService.name).warn(
        `No se pudo recuperar el avance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const checkpoint = this.guardados
      ? new EscritorCheckpoint<NestingIrregularOpenNestResult>(
          (resultado) => this.guardados!.guardarCheckpoint(input, resultado),
          (error) =>
            new Logger(OpenNestService.name).warn(
              `No se pudo conservar el avance: ${error instanceof Error ? error.message : String(error)}`,
            ),
        )
      : undefined;
    try {
      const resultado = await this.buscar(
        input,
        {
          ...options,
          checkpoint,
          semillasRecuperadas: recuperado
            ? patronesDeResultado(input, inicial!)
            : [],
        },
        inicial,
      );
      await checkpoint?.vaciar();
      const conservado = this.guardados
        ? await this.guardados.conservarResultado(input, resultado)
        : resultado;
      await this.aprenderPatrones(input, conservado);
      return conservado;
    } finally {
      // También al cancelar: un candidato aceptado no se pierde por cerrar
      // el sheet mientras se terminaba su escritura.
      await checkpoint?.vaciar();
    }
  }

  private async aprenderPatrones(
    input: NestingIrregularOpenNestData,
    resultado: NestingIrregularOpenNestResult,
  ) {
    try {
      await this.biblioteca?.aprender(input, resultado);
    } catch (error) {
      // Una biblioteca no disponible no impide cotizar un resultado validado.
      new Logger(OpenNestService.name).warn(
        `No se pudo enriquecer la biblioteca: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async buscar(
    input: NestingIrregularOpenNestData,
    options?: {
      signal?: AbortSignal;
      onCandidate?: () => Promise<void> | void;
      checkpoint?: EscritorCheckpoint<NestingIrregularOpenNestResult>;
      semillasRecuperadas?: Patron[];
    },
    existente?: NestingIrregularOpenNestResult,
  ): Promise<NestingIrregularOpenNestResult> {
    const timeoutMs = Math.min(input.timeoutMs, timeoutMaximoOpenNestMs());
    const startedAt = Date.now();
    const fases: NonNullable<
      NonNullable<NestingIrregularOpenNestResult['busqueda']>['fases']
    > = [];
    const fase = (
      etapa: string,
      desde: number,
      resultado?: NestingIrregularOpenNestResult,
    ) => {
      fases.push({
        etapa,
        duracionMs: Date.now() - desde,
        transcurridoMs: Date.now() - startedAt,
        ...(resultado
          ? {
              placas: resultado.placasUsadas,
              patrones: contarPatronesResultado(resultado),
            }
          : {}),
      });
    };
    const origen = (
      etapa: NonNullable<
        NestingIrregularOpenNestResult['origenSolucion']
      >['etapa'],
    ) => ({
      etapa,
      encontradaEl: new Date().toISOString(),
      transcurridoMs: Date.now() - startedAt,
    });
    const planes = crearPlanesOrientacion(input).filter(cabeCadaPieza);
    const minimoPlacas = calcularMinimoTeoricoPlacas(input);
    let mejor:
      | {
          plan?: PlanOrientacionGrafoNest;
          resultado: NestingIrregularOpenNestResult;
        }
      | undefined = existente ? { resultado: existente } : undefined;
    let errorBase: unknown;
    try {
      const baseNativa = validarResultadoNestingOpenNest(
        input,
        resolverNestingBaseSeguro(input),
      );
      const base = input.commonLine?.habilitado
        ? validarResultadoNestingOpenNest(
            input,
            optimizarCommonLines(input, baseNativa),
          )
        : baseNativa;
      base.origenSolucion = origen('base');
      fase('base-validada', startedAt, base);
      if (!mejor || esMejorResultado(base, mejor.resultado))
        mejor = { resultado: base };
    } catch (error) {
      errorBase = error;
      fase('base-no-disponible', startedAt);
      // Las cajas pueden necesitar más placas que los contornos reales.
      // No confundir ese límite de la base con inviabilidad geométrica.
      if (!planes.length && !mejor) throw error;
    }
    const minimosAlcanzados = () =>
      Boolean(
        mejor &&
        mejor.resultado.placasUsadas <= minimoPlacas &&
        contarPatronesResultado(mejor.resultado) <=
          minimoTeoricoPatrones(input, mejor.resultado.placasUsadas),
      );
    const patronesDelMejor = () =>
      mejor ? patronesDeResultado(input, mejor.resultado) : [];
    const guardarAvance = () => {
      if (mejor)
        options?.checkpoint?.programar({
          ...mejor.resultado,
          versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
          duracionMs: Date.now() - startedAt,
        });
    };
    let intentos = 0;
    const motoresExplorados = new Set<'collision' | 'nfp' | 'packingsolver'>();
    const recursosNativos: NonNullable<
      NonNullable<NestingIrregularOpenNestResult['busqueda']>['recursosNativos']
    > = [];
    let candidatosValidos = 0;
    let motorNoDisponible = false;
    const descartes = { timeout: 0, resultadoInvalido: 0, errorMotor: 0 };
    const registrarDescarte = (error: unknown) => {
      if (
        error instanceof OpenNestSubprocessError &&
        error.codigo === 'TIMEOUT'
      )
        descartes.timeout++;
      else if (
        error instanceof Error &&
        error.name === 'NestingOpenNestInvalidoError'
      )
        descartes.resultadoInvalido++;
      else descartes.errorMotor++;
    };
    const seleccionar = async (
      cartera: Patron[],
      presupuestoMs: number,
      etapa: 'biblioteca' | 'cartera',
    ) => {
      if (presupuestoMs <= 1000 || !cartera.length) return;
      const inicioSeleccion = Date.now();
      const conservarSeleccion = (seleccion: SeleccionPatrones) => {
        try {
          const inicioValidacion = Date.now();
          const candidato = validarResultadoNestingOpenNest(
            input,
            materializarPatrones(input, cartera, seleccion),
          );
          fase(`${etapa}-validacion`, inicioValidacion, candidato);
          candidato.origenSolucion = origen(etapa);
          candidatosValidos += 1;
          if (
            !mejor ||
            esMejorResultado(candidato, mejor.resultado) ||
            (!esMejorResultado(mejor.resultado, candidato) &&
              candidato.planPatrones?.minimoPatronesEnCartera &&
              !mejor.resultado.planPatrones?.minimoPatronesEnCartera)
          ) {
            mejor = { resultado: candidato };
            guardarAvance();
          }
        } catch (error) {
          registrarDescarte(error);
        }
      };
      await this.ejecutarSelector({
        ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
        argumentos: [
          rutaRunnerOpenNest().replace(
            'opennest_runner.py',
            'patrones_runner.py',
          ),
        ],
        entrada: {
          patrones: cartera.map((p) => ({ counts: p.counts })),
          demanda: input.piezas.map((p) => p.cantidad),
          seleccionInicial: seleccionInicialDeResultado(
            input,
            cartera,
            mejor?.resultado,
          ),
          timeoutMs: presupuestoMs,
        },
        timeoutMs: presupuestoMs,
        signal: options?.signal,
        onCandidate: conservarSeleccion,
      }).finally(() =>
        fase(`${etapa}-seleccion`, inicioSeleccion, mejor?.resultado),
      );
    };
    let semillas: Patron[] = [];
    let planCompletoReutilizado = false;
    const inicioBiblioteca = Date.now();
    try {
      const familia = await this.biblioteca?.obtenerFamilia(input);
      semillas = familia?.patrones ?? [];
      for (const seleccion of familia?.planes ?? []) {
        options?.signal?.throwIfAborted();
        const placas = seleccion.seleccion.reduce(
          (s, p) => s + p.repeticiones,
          0,
        );
        if (
          mejor &&
          (placas > mejor.resultado.placasUsadas ||
            (placas === mejor.resultado.placasUsadas &&
              seleccion.seleccion.length >
                contarPatronesResultado(mejor.resultado)))
        )
          continue;
        const inicioPlan = Date.now();
        try {
          const candidato = validarResultadoNestingOpenNest(
            input,
            materializarPatrones(input, semillas, seleccion),
          );
          candidatosValidos++;
          candidato.origenSolucion = origen('biblioteca');
          if (!mejor || esMejorResultado(candidato, mejor.resultado)) {
            mejor = { resultado: candidato };
            planCompletoReutilizado = true;
          }
          fase('biblioteca-plan-completo', inicioPlan, candidato);
        } catch (error) {
          registrarDescarte(error);
        }
      }
    } catch (error) {
      new Logger(OpenNestService.name).warn(
        `No se pudo leer la biblioteca: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    fase('biblioteca-lectura', inicioBiblioteca);
    // Recuperar el avance aporta sus patrones al selector, además del límite
    // de placas. No publica esos candidatos en la biblioteca comercial.
    semillas = [...(options?.semillasRecuperadas ?? []), ...semillas];
    // Una receta completa reutilizada tiene el mismo contrato que el caché
    // exacto. Cotización la recibe ahora; preparar/mejorar conserva su búsqueda.
    const entregaReutilizada = planCompletoReutilizado && !input.buscarMejora;
    if (!entregaReutilizada && !minimosAlcanzados()) {
      guardarAvance();
      await options?.checkpoint?.vaciar();
    }
    // Resolver primero una cartera pequeña conocida evita reconstruir el
    // problema completo al cambiar de cantidad. La base aporta restos exactos.
    if (
      !entregaReutilizada &&
      !minimosAlcanzados() &&
      semillas.length &&
      timeoutMs >= 10000
    ) {
      try {
        const cartera = await generarCarteraPatrones(input, {
          plazo: Date.now() + Math.min(250, timeoutMs * 0.02),
          signal: options?.signal,
          maxIteraciones: 64,
          semillas: [...semillas, ...patronesDelMejor()],
        });
        await seleccionar(
          cartera,
          Math.min(3000, timeoutMs - (Date.now() - startedAt)),
          'biblioteca',
        );
        semillas = [...patronesDelMejor(), ...semillas];
      } catch (error) {
        registrarDescarte(error);
      }
    }

    // Motor alternativo activado explícitamente por despliegue. Comparte
    // presupuesto, validador, checkpoints y objetivo con el motor existente.
    if (!entregaReutilizada && !minimosAlcanzados()) {
      const inicioNativo = Date.now();
      const encontrados = new Map<string, Patron>();
      const nativoController = new AbortController();
      try {
        const presupuesto = presupuestoPackingSolver(
          input,
          timeoutMs - (Date.now() - startedAt),
        );
        const config =
          presupuesto >= 4000 && planes.length
            ? configuracionPackingSolver()
            : undefined;
        if (config && presupuesto >= 4000 && planes.length) {
          const cantidad = input.piezas.reduce((s, p) => s + p.cantidad, 0);
          const plan =
            cantidad >= 100
              ? (planes.find((p) => p.estrategia === 'cardinal') ??
                planes[planes.length - 1])
              : planes[planes.length - 1];
          intentos++;
          motoresExplorados.add('packingsolver');
          await this.ejecutarPackingSolver({
            ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
            argumentos: [
              rutaRunnerOpenNest().replace(
                'opennest_runner.py',
                'packingsolver_runner.py',
              ),
            ],
            entrada: {
              ...config,
              instancia: instanciaPackingSolver(plan.input),
              timeoutMs: presupuesto,
              padrePid: process.pid,
            },
            timeoutMs: presupuesto,
            onExit: ({ stderr }) => {
              for (const linea of stderr.trim().split('\n')) {
                try {
                  const d = JSON.parse(linea) as {
                    motor: string;
                    fin: string;
                    rssObservadoMb: number;
                    rssTotalObservadoMb?: number;
                  };
                  if (
                    d.motor === 'packingsolver' &&
                    typeof d.fin === 'string' &&
                    Number.isFinite(d.rssObservadoMb)
                  )
                    recursosNativos.push({
                      motor: 'packingsolver',
                      fin: d.fin,
                      rssMaxObservadoMb: d.rssObservadoMb,
                      ...(Number.isFinite(d.rssTotalObservadoMb)
                        ? { rssTotalMaxObservadoMb: d.rssTotalObservadoMb }
                        : {}),
                    });
                } catch {
                  /* stderr puede contener trazas del supervisor. */
                }
              }
            },
            signal: options?.signal
              ? AbortSignal.any([options.signal, nativoController.signal])
              : nativoController.signal,
            onCandidate: (certificado) => {
              try {
                const geometria = validarResultadoNestingOpenNest(
                  plan.input,
                  convertirPackingSolver(
                    plan.input,
                    certificado,
                    config.version,
                  ),
                );
                const candidato = plan.input.commonLine?.habilitado
                  ? validarResultadoNestingOpenNest(
                      plan.input,
                      optimizarCommonLines(plan.input, geometria),
                    )
                  : geometria;
                candidatosValidos++;
                candidato.origenSolucion = origen('motor');
                if (!mejor || esMejorResultado(candidato, mejor.resultado)) {
                  mejor = { plan, resultado: candidato };
                  guardarAvance();
                }
                for (const patron of patronesDeResultado(input, candidato)) {
                  const firma = patron.counts.join(',');
                  if (encontrados.size < 128 && !encontrados.has(firma))
                    encontrados.set(firma, patron);
                }
                if (minimosAlcanzados()) nativoController.abort();
              } catch {
                descartes.resultadoInvalido++;
              }
            },
          });
        }
      } catch (error) {
        if (options?.signal?.aborted) throw error;
        if (!nativoController.signal.aborted) registrarDescarte(error);
      } finally {
        if (process.env.GRAFONEST_PACKINGSOLVER_ENABLED === '1')
          fase('motor-packingsolver', inicioNativo, mejor?.resultado);
      }
      if (encontrados.size && !minimosAlcanzados()) {
        semillas = [
          ...patronesDelMejor(),
          ...encontrados.values(),
          ...semillas,
        ];
        try {
          // Combinar los patrones recién descubiertos antes de ampliar la
          // cartera. El número de placas mejora primero; luego los programas.
          const cartera = await generarCarteraPatrones(input, {
            plazo: Date.now(),
            maxIteraciones: 0,
            signal: options?.signal,
            semillas,
          });
          await seleccionar(
            cartera,
            Math.min(5000, timeoutMs - (Date.now() - startedAt)),
            'cartera',
          );
        } catch (error) {
          if (options?.signal?.aborted) throw error;
          registrarDescarte(error);
        }
      }
    }

    // Para lotes repetidos, primero optimizamos combinaciones enteras de
    // patrones. El tiempo consumido se descuenta del mismo presupuesto global.
    if (
      !entregaReutilizada &&
      !minimosAlcanzados() &&
      input.piezas.length > 1 &&
      input.piezas.length <= 30 &&
      input.piezas.reduce((s, p) => s + p.cantidad, 0) >= 20 &&
      timeoutMs >= 10000
    ) {
      try {
        const inicioCartera = Date.now();
        const cartera = await generarCarteraPatrones(input, {
          // La biblioteca y el generador nativo ya pueden haber consumido
          // tiempo. Esta fase recibe una fracción del presupuesto restante;
          // su plazo no puede quedar en el pasado al entrar.
          plazo:
            inicioCartera +
            Math.max(
              0,
              Math.min(6000, (timeoutMs - (inicioCartera - startedAt)) * 0.12),
            ),
          signal: options?.signal,
          semillas: [...patronesDelMejor(), ...semillas],
        });
        fase('cartera-generacion', inicioCartera);
        const restante = Math.min(
          60000,
          (timeoutMs - (Date.now() - startedAt)) * 0.6,
        );
        await seleccionar(cartera, restante, 'cartera');
      } catch (error) {
        if (options?.signal?.aborted)
          throw new OpenNestSubprocessError(
            'El cálculo fue cancelado.',
            'CANCELLED',
          );
        registrarDescarte(error);
        new Logger(OpenNestService.name).warn(
          `No se pudo completar la búsqueda por patrones: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Cada vuelta cambia la semilla. Los reintentos empiezan con todos los
    // ángulos y alternan motores; no terminamos por completar tres planes.
    for (let index = 0; planes.length > 0; index += 1) {
      await options?.checkpoint?.vaciar();
      if (options?.signal?.aborted)
        throw new OpenNestSubprocessError(
          'El cálculo de OpenNest fue cancelado.',
          'CANCELLED',
        );
      // La base o una receta conocida pueden haber alcanzado ambas cotas.
      // No iniciar un proceso costoso para certificar otra vez lo ya demostrado.
      if (entregaReutilizada || minimosAlcanzados()) break;
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
        mejor
          ? mejor.resultado.placasUsadas - (quitarPlaca ? 1 : 0)
          : input.placa.maxPlacas,
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
      const iteraciones =
        motor === 'collision' && vuelta < 2 ? 1000 : undefined;
      const presupuestoMs = Math.min(
        iteraciones ? 8000 : Infinity,
        presupuestoCandidatoMs({
          estrategia: plan.estrategia,
          restanteMs,
          totalMs: timeoutMs,
        }),
      );
      intentos += 1;
      motoresExplorados.add(motor);
      const inicioIntento = Date.now();
      try {
        const respuesta = await this.ejecutarRunner({
          ejecutable: process.env.OPENNEST_PYTHON?.trim() || 'python3',
          argumentos: [rutaRunnerOpenNest()],
          entrada: {
            ...plan.input,
            timeoutMs: presupuestoMs,
            ...(iteraciones ? { iteraciones } : {}),
          },
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
        const validado = plan.input.commonLine?.habilitado
          ? validarResultadoNestingOpenNest(
              plan.input,
              optimizarCommonLines(plan.input, validadoNativo),
            )
          : validadoNativo;
        candidatosValidos += 1;
        if (!mejor || esMejorResultado(validado, mejor.resultado)) {
          mejor = {
            plan,
            resultado: {
              ...validado,
              motor: input.motor,
              motorEjecutor: plan.input.motor,
              calidadSolucion: 'OPTIMIZADA',
              origenSolucion: origen('motor'),
            },
          };
          guardarAvance();
        }
        // Parar exige alcanzar ambas cotas: placas y patrones. No demuestra
        // un óptimo universal de retales o recorrido de corte.
        if (minimosAlcanzados()) break;
      } catch (error) {
        registrarDescarte(error);
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
      } finally {
        fase(
          `motor-${motor}-${plan.estrategia}`,
          inicioIntento,
          mejor?.resultado,
        );
      }
    }

    options?.signal?.throwIfAborted();
    if (!mejor)
      throw new Error(
        'No se encontró un plan completo dentro de las placas y el tiempo permitidos.' +
          (errorBase instanceof Error ? ` ${errorBase.message}` : ''),
      );
    await options?.onCandidate?.();
    const alcanzaMinimos = minimosAlcanzados();
    return {
      ...mejor.resultado,
      duracionMs: Date.now() - startedAt,
      versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
      presupuestoExploradoMs: Math.max(
        existente?.versionPoliticaBusqueda ===
          VERSION_POLITICA_BUSQUEDA_GRAFONEST
          ? presupuestoExplorado(existente)
          : 0,
        motorNoDisponible || entregaReutilizada ? 0 : timeoutMs,
      ),
      estrategiaOrientacion:
        mejor.plan?.estrategia ?? mejor.resultado.estrategiaOrientacion,
      rotacionesPermitidas:
        mejor.plan?.rotacionesMaximas ?? mejor.resultado.rotacionesPermitidas,
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      optimizacionAgotada: !alcanzaMinimos && !entregaReutilizada,
      busqueda: {
        motivoFin: motorNoDisponible
          ? 'MOTOR_NO_DISPONIBLE'
          : alcanzaMinimos
            ? 'MINIMO_PLACAS'
            : entregaReutilizada
              ? 'PLAN_REUTILIZADO'
              : 'PRESUPUESTO_AGOTADO',
        presupuestoMs: timeoutMs,
        intentos,
        candidatosValidos,
        motoresExplorados: [...motoresExplorados],
        ...(recursosNativos.length ? { recursosNativos } : {}),
        minimoTeoricoPlacas: minimoPlacas,
        descartes,
        fases,
      },
    };
  }
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
  const areas = input.piezas.map((pieza) => {
    const areaExterior = areaAnillo(pieza.contorno);
    const areaHuecos = (pieza.huecos ?? []).reduce(
      (area, hueco) => area + areaAnillo(hueco),
      0,
    );
    return {
      area: Math.max(0, areaExterior - areaHuecos),
      cantidad: pieza.cantidad,
    };
  });
  const areaPiezas = areas.reduce((total, p) => total + p.area * p.cantidad, 0);
  let minimo = Math.max(1, Math.ceil(areaPiezas / areaUtil - 1e-12));
  // Si cada pieza de un conjunto ocupa más de media placa, no pueden entrar
  // dos juntas. La misma demostración vale para tercios, cuartos, etc. Esta
  // cota por cantidad detecta casos que la suma total de áreas subestima.
  let cantidad = 0;
  for (const pieza of areas.sort((a, b) => b.area - a.area)) {
    if (pieza.area <= 0) continue;
    cantidad += pieza.cantidad;
    const maximoPorPlaca = Math.max(
      1,
      Math.floor(areaUtil / pieza.area + 1e-12),
    );
    minimo = Math.max(minimo, Math.ceil(cantidad / maximoPorPlaca));
  }
  return minimo;
}

function presupuestoCandidatoMs(input: {
  estrategia: EstrategiaOrientacion;
  restanteMs: number;
  totalMs: number;
}): number {
  // Los reintentos invierten el orden. El presupuesto pertenece a la
  // estrategia, no a su posición: la búsqueda libre no debe perder tiempo
  // al pasar de última a primera en la vuelta siguiente.
  if (input.estrategia === 'libre')
    return Math.max(100, Math.min(30_000, input.restanteMs));
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
  options: OpcionesSubproceso<T>,
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
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        ...(process.platform !== 'win32' ? { GRAFONEST_GUARD_FD: '3' } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });
    // El descriptor también se cierra al salir normalmente el runner. La
    // guardia termina cualquier descendiente que haya quedado detrás.
    const guardia = child.stdio[3] as import('node:stream').Writable;
    // Si Node queda suspendido (sin EOF), la guardia deja de recibir pulsos
    // y detiene el grupo antes de que venza el permiso compartido de 60 s.
    guardia.on('error', () => undefined); // El runner puede haber cerrado ya.
    const pulsoGuardia = setInterval(() => {
      if (!guardia.destroyed && !guardia.writableEnded) guardia.write('.');
    }, 5000);
    pulsoGuardia.unref();
    child.once('exit', () => {
      clearInterval(pulsoGuardia);
      guardia.destroy();
    });
    const maxOutput = options.maxSalidaBytes ?? 32 * 1024 * 1024;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let forcedError: OpenNestSubprocessError | undefined;
    let finished = false;
    let killTimer: NodeJS.Timeout | undefined;
    let inicioLinea = 0;

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
      clearInterval(pulsoGuardia);
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
      // Sólo se interpretan líneas completas: stdout puede partir un JSON o
      // un carácter UTF-8 en cualquier chunk. El límite total sigue vigente.
      if (options.onCandidate) {
        let finLinea: number;
        while ((finLinea = stdout.indexOf(10, inicioLinea)) !== -1) {
          const linea = stdout.subarray(inicioLinea, finLinea).toString('utf8');
          inicioLinea = finLinea + 1;
          const candidato = extraerRespuesta<T>(linea);
          if (candidato !== undefined) {
            try {
              options.onCandidate(candidato);
            } catch (error) {
              forceStop(
                new OpenNestSubprocessError(
                  error instanceof Error
                    ? error.message
                    : 'Candidato inválido.',
                  'INVALID_OUTPUT',
                ),
              );
              return;
            }
          }
        }
      }
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
        // La instrumentación no puede invalidar un candidato fabricable.
        try {
          options.onExit?.({
            codigo: code,
            signal,
            stderr: stderr.toString('utf8'),
          });
        } catch {
          /* sólo diagnóstico */
        }
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
