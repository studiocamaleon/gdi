/**
 * G-M1 — Dispatcher de nesting para el motor universal.
 *
 * FRONTERA-NESTING: este archivo entero es frontera (pasos-componibles-diseno
 * §3.4 Tipo B). El ruteo por familia hacia los runners (área, plotter,
 * laminado, pouch, montaje, hoja) son las primitivas de geometría del
 * sistema. Se unifica en un runner parametrizado recién en la Etapa B.
 *
 * Cuando un paso usa `mecanismoCantidad = CALCULADO_POR_PASO`, este dispatcher
 * elige el algoritmo de nesting correcto según la familia + sustrato del
 * material resuelto, lo ejecuta, y devuelve la cantidad efectiva (con
 * desperdicio) + los placements para visualización.
 *
 * Antes (placeholder MVP):
 *   `CALCULADO_POR_PASO` devolvía m² crudos sumando las piezas del JobContext,
 *   sin considerar cómo se acomodan en el rollo / pliego.
 *
 * Ahora:
 *   - `impresion_por_area` con sustrato rollo → `evaluateGranFormatoMixedShelfLayout`.
 *     Devuelve `consumedLengthMm` real con desperdicio.
 *   - `impresion_por_area` con mesa/placa → `nestGrid2DMulti`.
 *     Devuelve placas/pliegos consumidos para rígidos y mesa extensora.
 *   - `impresion_por_hoja` con sustrato sheet → `nestGrid2DSingle`.
 *     Devuelve `piezasPorSustrato`, motor calcula `pliegos = ceil(cantidad / piezasPorSustrato)`.
 *   - Familias no cubiertas → `null` (motor mantiene fallback de m² crudos).
 *
 * Pendiente (G-M2 + iteración futura):
 *   - Talonarios: requiere `posesXPliego` desde paso `pre_prensa` previo,
 *     que solo está disponible cuando G-M2 (outputs canónicos al JobContext)
 *     esté implementado. Por ahora devuelve null para esta familia.
 */

import {
  evaluateGranFormatoMixedShelfLayout,
  type EvaluateGranFormatoMixedShelfLayoutInput,
  type GranFormatoMixedShelfLayoutResult,
} from '../productos-servicios/nesting/algorithms/shelf-rollo';
import { evaluateGranFormatoMaxRectsRollLayout } from '../productos-servicios/nesting/algorithms/maxrects-rollo';
import { evaluateGranFormatoSequentialRollLayout } from '../productos-servicios/nesting/algorithms/secuencial-rollo';
import { nestGrid2DSingle } from '../productos-servicios/nesting/algorithms/grid-2d-single';
import {
  estrategiaNestingDeFamilia,
  fuentePiezasNestingDeFamilia,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import { nestGrid2DMulti } from '../productos-servicios/nesting/algorithms/grid-2d-multi';
import {
  calculateTalonarioGrouping,
  type TalonarioGroupingResult,
} from '../productos-servicios/nesting/helpers/talonario-grouping';
import { calculateSustratoToPliegoConversion } from '../productos-servicios/nesting/helpers/sustrato-to-pliego';
import {
  calcularCuadernilloCaballete,
  SELECCION_HOJAS_TODAS,
  type CuadernilloCaballeteResult,
  type SeleccionHojas,
} from '../productos-servicios/nesting/helpers/cuadernillo-imposicion';
import type {
  NestingResult,
  Placement,
  SubstrateUsage,
} from '../productos-servicios/nesting/types';
import {
  resolveNestingConfig,
  type NestingConfigResolved,
  type PrintSheetCandidateConfig,
  type PrintSheetCandidateMaterial,
} from './nesting-config';
import type { PasoCargado, JobContext, NestingVisualConfig } from './tipos';

/**
 * Resultado del dispatcher con TODO lo que el motor + viewer necesitan.
 */
export interface NestingDispatchResult {
  algorithm:
    | 'shelf-rollo'
    | 'maxrects-rollo'
    | 'secuencial-rollo'
    | 'grid-2d-single'
    | 'grid-2d-multi';
  /**
   * Cantidad CALCULADA del paso, en la unidad correcta:
   *  - Para shelf-rollo: metros lineales consumidos del rollo.
   *  - Para grid-2d-single y grid-2d-multi: pliegos/pouches necesarios.
   */
  cantidadCalculada: number;
  unidad: 'm_lineales' | 'pliegos' | 'pouches' | 'm2' | 'piezas';
  /** Aprovechamiento del sustrato (%). */
  aprovechamientoPct: number;
  /** Para visualización: bins/sustratos consumidos. */
  substrates: SubstrateUsage[];
  /** Para visualización: placements de cada pieza. */
  placements: Placement[];
  /** Métricas crudas heredadas del algoritmo (para trazabilidad). */
  metricasRaw: NestingResult['metrics'];
  /** Solo grid-2d-single: piezas por pliego (útil para outputs canónicos). */
  piezasPorPliego?: number;
  /** Solo plastificado_pouch: piezas por pouch. */
  piezasPorPouch?: number;
  /** Solo shelf-rollo: largo consumido del rollo en mm. */
  consumedLengthMm?: number;
  /** Cantidad de instancias de pieza efectivamente acomodadas. */
  piezasAcomodadas: number;
  /** Datos normalizados para que el SVG muestre márgenes, área útil y separación. */
  visualConfig?: NestingVisualConfig;
  /**
   * Solo cuando el paso corrió imposición de CUADERNILLO a caballete
   * (nestingConfig.imposicion.esquema='caballete'): hojas por libro, juegos,
   * blancas y el plan página→posición. Ver cuadernillo-imposicion.ts.
   */
  imposicionCuadernillo?: CuadernilloCaballeteResult;
  /**
   * Solo cuando se aplicó talonario-grouping (post-nesting):
   * info sobre tandas/pliegos efectivos vs pedidos según el modo
   * `aprovechar_pliego` vs `pose_completa` del paso.
   */
  talonarioGrouping?: TalonarioGroupingResult;
  pliegoImpresionSeleccionado?: {
    id: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
    /**
     * 'menor_costo_sustrato': proxy por área comprada (origen derivado).
     * 'menor_costo_real': $ reales de la MP de cada candidato.
     */
    criterio: 'menor_costo_sustrato' | 'menor_costo_real';
    candidatosEvaluados: number;
    /** Área comprada (mm²) en derivado; $ reales en por_candidato. */
    costoEstimadoMm2: number;
    pliegosImpresion: number;
    pliegosComprados: number;
    aprovechamientoPct: number;
    /** Solo 'por_candidato': MP propia del candidato ganador. */
    materiaPrima?: {
      varianteId: string;
      sku: string;
      nombre: string;
      precioReferencia: number | null;
    };
  };
}

/** Material resuelto que el motor pasa al dispatcher (subset de SlotCargado). */
export interface MaterialResueltoParaNesting {
  id: string;
  /** Atributos: anchoMm (rollo o pliego), largoMm (pliego), largoRolloMm (rollo). */
  atributosVarianteJson?: Record<string, unknown> | null;
  precioReferencia?: number | null;
  /** Subfamilia de la materia prima padre (SUSTRATO_ROLLO_FLEXIBLE, _HOJA,
   *  _RIGIDO…). Dice el FORMATO del sustrato — rollo vs hoja/placa — sin
   *  adivinarlo por los atributos. Reemplaza el sniffing de `isRollMaterial`. */
  subfamilia?: string | null;
}

/**
 * ¿El sustrato es un rollo? Lo dice la subfamilia de la materia prima, no los
 * atributos: hoy todo SUSTRATO_ROLLO_FLEXIBLE trae largo de rollo y ninguna
 * hoja/rígido lo trae, pero la subfamilia es la señal estructural y no depende
 * de que el atributo esté cargado. LAMINADO_FILM también es rollo (aunque
 * laminado rutea por su propia vía y no pasa por acá).
 */
export function esSustratoRollo(subfamilia: string | null | undefined): boolean {
  return (
    subfamilia === 'SUSTRATO_ROLLO_FLEXIBLE' || subfamilia === 'LAMINADO_FILM'
  );
}

/** Hooks async que el motor puede inyectar al dispatcher. */
export interface NestingDispatchOpts {
  /**
   * Carga la MP propia de un candidato de pliego (modo 'por_candidato').
   * Sin este hook los candidatos con MP declarada no se enriquecen y el
   * score cae al derivado.
   */
  loadPrintSheetMaterial?: (
    varianteId: string,
  ) => Promise<PrintSheetCandidateMaterial | null>;
}

/**
 * Decide qué algoritmo invocar según familia + sustrato y devuelve la
 * cantidad efectiva (con nesting real) + placements.
 *
 * Devuelve `null` si:
 *  - La familia no está cubierta por nesting.
 *  - Faltan datos críticos (sin piezas, sin material, sin medidas).
 *
 * En esos casos el motor sigue con su fallback (m² crudos / cantidad directa).
 */
export async function runNestingForPaso(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  opts?: NestingDispatchOpts,
): Promise<NestingDispatchResult | null> {
  const resultado = await despacharNesting(
    paso,
    jobContext,
    materialResuelto,
    opts,
  );
  if (!resultado) return null;
  // El agrupamiento de talonario es post-nesting y lo activa el paso que
  // declara `modoTalonarioIncompleto` — el del original. Para el resto es un
  // no-op. [antes colgaba del look-ahead de pre-prensa]
  return aplicarTalonarioGroupingSiCorresponde(resultado, paso, jobContext);
}

async function despacharNesting(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  opts?: NestingDispatchOpts,
): Promise<NestingDispatchResult | null> {
  const config = resolveNestingConfig(paso, jobContext, materialResuelto);

  // Modo 'por_candidato': enriquecer los candidatos de pliego con su MP
  // propia (precio real) antes de despachar. Sin loader, el score cae al
  // derivado (candidatos sin materiaPrima).
  if (
    config.printSheetMode === 'automatic' &&
    config.printSheetCostSource === 'por_candidato' &&
    opts?.loadPrintSheetMaterial
  ) {
    const loader = opts.loadPrintSheetMaterial;
    config.printSheetCandidates = await Promise.all(
      config.printSheetCandidates.map(async (candidate) =>
        candidate.materiaPrimaVarianteId
          ? {
              ...candidate,
              materiaPrima: await loader(candidate.materiaPrimaVarianteId),
            }
          : candidate,
      ),
    );
  }
  // ─── Dispatch por declaración ────────────────────────────────────
  // La familia declara su acomodado en `nestingConfig` (superficie +
  // estrategia opcional); acá ya no se rutea por `familiaCodigo` [Etapa F].
  // Sin declaración no hay nesting: el caller sigue con su fallback.
  const familiaResuelta = resolverFamilia(paso.familiaCodigo);
  const declaracion = familiaResuelta?.nestingConfig ?? null;
  if (!declaracion) return null;

  // Estrategia nombrada: comportamiento específico (antes casos 2-6).
  if (declaracion.estrategia) {
    const estrategia = ESTRATEGIAS_NESTING[declaracion.estrategia];
    if (!estrategia) return null;
    return await estrategia(paso, jobContext, materialResuelto, config);
  }

  // Sin estrategia, la superficie decide (familias de tenant y las del
  // sistema con acomodado estándar). `segun_material` resuelve en runtime
  // por máquina + subfamilia del material (impresión por área corre sobre
  // rollo Y placa).
  const superficie =
    declaracion.superficie === 'segun_material'
      ? resolverSuperficieDinamica(config, materialResuelto)
      : declaracion.superficie;
  if (superficie === 'rollo') {
    return runShelfRollo(
      paso,
      conLonaBrutaSiExiste(jobContext),
      materialResuelto,
      config,
    );
  }
  // Hoja/placa finita: la medida sale del material del slot (o de la mesa de
  // la máquina) vía resolveNestingConfig. Piezas uniformes caen solas a
  // grid-2d-single (poses + imposición completa) dentro del multi.
  return runGrid2DMultiForArea(paso, jobContext, config);
}

type EstrategiaNestingFn = (
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
) => NestingDispatchResult | null | Promise<NestingDispatchResult | null>;

/**
 * Registro de estrategias nombradas — mismo patrón que los derivadores: la
 * familia declara el código, el motor busca acá. Las condiciones de runtime
 * de cada comportamiento (modo HOJAS del plotter, caballete configurado)
 * viven dentro de su estrategia, no en el dispatch.
 */
const ESTRATEGIAS_NESTING: Record<string, EstrategiaNestingFn> = {
  /** Corte sobre rollo: shelf sin panelizado; en modo HOJAS no acomoda. */
  corte_rollo: (paso, jobContext, materialResuelto, config) => {
    if (getPlotterModoOperacion(paso) === 'HOJAS') {
      return null;
    }
    return runShelfRollo(
      paso,
      jobContext,
      materialResuelto,
      disablePanelizado(config),
    );
  },

  /** Laminado en rollo sobre pliegos ya impresos. */
  laminado_rollo: (paso, jobContext, materialResuelto, config) =>
    runLaminadoRollo(paso, jobContext, materialResuelto, config),

  /** Plastificado pouch sobre formato finito. */
  pouch: (_paso, jobContext, materialResuelto, config) =>
    runPlastificadoPouch(jobContext, materialResuelto, config),

  /** Montaje sobre otro sustrato. Reusa los algoritmos existentes, pero
   *  permite que las piezas vengan de la medida comercial o de outputs
   *  publicados por pasos anteriores. */
  montaje: (paso, jobContext, materialResuelto, config) =>
    runMontajeSobreSustrato(paso, jobContext, materialResuelto, config),

  /** Digital sobre pliego: grid 2D single; con imposición de cuadernillo
   *  (caballete) la pieza que se acomoda es el PAR de páginas y el resultado
   *  pasa por el agrupamiento del libro. */
  pliego_digital: (paso, jobContext, materialResuelto, config) => {
    if (getImposicionCaballeteConfig(paso)) {
      return runImposicionCaballete(paso, jobContext, config);
    }
    return runGrid2DSingle(paso, jobContext, materialResuelto, config);
  },
};

function getPlotterModoOperacion(paso: PasoCargado): string | null {
  const detalle =
    paso.perfil?.detalleJson &&
    typeof paso.perfil.detalleJson === 'object' &&
    !Array.isArray(paso.perfil.detalleJson)
      ? (paso.perfil.detalleJson as Record<string, unknown>)
      : null;
  const modoOperacion = detalle?.modoOperacion;
  return typeof modoOperacion === 'string'
    ? modoOperacion.trim().toUpperCase()
    : null;
}

// ────────────────────────────────────────────────────────────────────
// Implementaciones
// ────────────────────────────────────────────────────────────────────

/**
 * Superficie de un paso que declara `segun_material`: la decide la máquina y
 * la subfamilia del material. Gana el rollo — una impresora de rollo o un
 * material rollo (lona, vinilo) fuerzan rollo; una flatbed (MESA_EXTENSORA) o
 * un pliego con medidas sin ancho de rollo dan placa; el fallback es rollo.
 *
 * Reproduce la cascada que tenía `runImpresionPorArea`. Las ramas de algoritmo
 * explícito de aquella (shelf-rollo/grid) se retiraron: ningún paso fija
 * `nestingConfig.algorithm` (el selector se quitó), así que eran código muerto.
 */
export function resolverSuperficieDinamica(
  config: NestingConfigResolved,
  materialResuelto: MaterialResueltoParaNesting | null,
): 'rollo' | 'pliegos_multiples' {
  if (config.machineGeometry === 'ROLLO') return 'rollo';
  if (esSustratoRollo(materialResuelto?.subfamilia)) return 'rollo';
  if (config.machineGeometry === 'MESA_EXTENSORA') return 'pliegos_multiples';
  if (config.sheetWidthMm && config.sheetHeightMm && !config.rollWidthMm) {
    return 'pliegos_multiples';
  }
  return 'rollo';
}

function runLaminadoRollo(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  const contexto = buildJobContextPiezas(paso, jobContext);
  if (!contexto) return null;
  return runShelfRollo(paso, contexto, materialResuelto, config);
}

function runPlastificadoPouch(
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  if (!materialResuelto || !config.sheetWidthMm || !config.sheetHeightMm) {
    return null;
  }

  const result = runGrid2DSingleForArea(jobContext, config, 'Pouch');
  if (!result) return null;

  return {
    ...result,
    unidad: 'pouches',
    piezasPorPouch: result.piezasPorPliego,
  };
}

async function runMontajeSobreSustrato(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): Promise<NestingDispatchResult | null> {
  let montajeContext = buildJobContextPiezas(paso, jobContext);
  if (!montajeContext) return null;

  if (config.algorithm === 'shelf-rollo' || config.algorithm === 'maxrects-rollo') {
    return runShelfRollo(paso, montajeContext, materialResuelto, config);
  }

  // Panelizado sobre HOJA: una pieza más grande que la hoja (la chapa
  // trasera de un cartel de 2,5 m contra la hoja de 1,22×2,44) se divide en
  // paños que entren, y el nesting cuenta las hojas necesarias — igual que
  // el taller, que hace el fondo en partes.
  const piezasPaneladas = partirPiezasEnPanosDeHoja(
    montajeContext.piezas ?? [],
    config,
  );
  if (piezasPaneladas) {
    montajeContext = {
      ...montajeContext,
      cantidad: piezasPaneladas.reduce((acc, p) => acc + p.cantidad, 0),
      piezas: piezasPaneladas,
    };
  }

  if (config.algorithm === 'grid-2d-single') {
    return runGrid2DSingleForArea(montajeContext, config);
  }
  if (config.algorithm === 'grid-2d-multi') {
    return runGrid2DMultiForArea(paso, montajeContext, config);
  }

  if (esSustratoRollo(materialResuelto?.subfamilia)) {
    return runShelfRollo(paso, montajeContext, materialResuelto, config);
  }
  if (config.sheetWidthMm && config.sheetHeightMm) {
    return runGrid2DMultiForArea(paso, montajeContext, config);
  }
  return null;
}

/**
 * Divide las piezas que NO entran en la hoja útil en paños iguales que sí
 * entren, respetando el panelizado del paso (eje manual o automático, junta
 * `overlapMm` sumada a cada paño con corte). Devuelve null si el panelizado
 * está apagado, si todas las piezas ya entran, o si ni partiendo entra
 * (hoja demasiado chica) — el caller conserva su comportamiento y el guard
 * diagnostica.
 */
export function partirPiezasEnPanosDeHoja(
  piezas: Array<{ cantidad: number; anchoMm: number; altoMm: number }>,
  config: NestingConfigResolved,
): Array<{ cantidad: number; anchoMm: number; altoMm: number }> | null {
  if (!config.panelizado?.enabled) return null;
  const sheetW = config.sheetWidthMm ?? 0;
  const sheetH = config.sheetHeightMm ?? 0;
  if (sheetW <= 0 || sheetH <= 0 || piezas.length === 0) return null;
  const utilW = Math.max(
    0,
    sheetW - config.margins.leftMm - config.margins.rightMm,
  );
  const utilH = Math.max(
    0,
    sheetH - config.margins.topMm - config.margins.bottomMm,
  );
  if (utilW <= 0 || utilH <= 0) return null;

  const entra = (w: number, h: number) =>
    (w <= utilW && h <= utilH) ||
    (config.allowRotation && h <= utilW && w <= utilH);
  if (piezas.every((p) => entra(p.anchoMm, p.altoMm))) return null;

  const overlap = Math.max(0, config.panelizado.overlapMm ?? 0);
  const eje = config.panelizado.mode === 'manual' ? config.panelizado.axis : 'automatic';
  const resultado: Array<{ cantidad: number; anchoMm: number; altoMm: number }> = [];

  for (const pieza of piezas) {
    if (entra(pieza.anchoMm, pieza.altoMm)) {
      resultado.push(pieza);
      continue;
    }
    // Grilla mínima de paños iguales: menos paños primero, menos cortes
    // como desempate. Eje manual: vertical = cortes a lo ancho (columnas),
    // horizontal = cortes a lo alto (filas).
    let mejor: { nx: number; ny: number } | null = null;
    const maxDiv = 8;
    for (let nx = 1; nx <= (eje === 'horizontal' ? 1 : maxDiv); nx++) {
      for (let ny = 1; ny <= (eje === 'vertical' ? 1 : maxDiv); ny++) {
        const panoW = pieza.anchoMm / nx + (nx > 1 ? overlap : 0);
        const panoH = pieza.altoMm / ny + (ny > 1 ? overlap : 0);
        if (!entra(panoW, panoH)) continue;
        if (
          !mejor ||
          nx * ny < mejor.nx * mejor.ny ||
          (nx * ny === mejor.nx * mejor.ny && nx + ny < mejor.nx + mejor.ny)
        ) {
          mejor = { nx, ny };
        }
      }
    }
    if (!mejor) return null;
    resultado.push({
      cantidad: pieza.cantidad * mejor.nx * mejor.ny,
      anchoMm: pieza.anchoMm / mejor.nx + (mejor.nx > 1 ? overlap : 0),
      altoMm: pieza.altoMm / mejor.ny + (mejor.ny > 1 ? overlap : 0),
    });
  }
  return resultado;
}

/**
 * Piezas que el paso va a acomodar.
 *
 * Un paso puede acomodar las piezas del propio trabajo o heredar lo que
 * publicó un paso anterior — el laminado lamina el pliego impreso, no la
 * tarjeta. Qué claves del JobContext leer lo declara la familia
 * (`fuentesPiezasNesting`), no este archivo.
 * [Etapa A: eran dos tablas de claves cableadas, una acá y otra en
 * runLaminadoRollo, que hacían lo mismo]
 */
/**
 * Efecto POST de la lona: si un bastidor aguas arriba publicó `lonaBrutaMm`
 * (la lona con la demasía de agarre — docs/efectos-entre-pasos-diseno.md §8), la
 * impresión imprime ESA pieza, no la medida visible ni las `piezas` que la
 * demasía de tensado agrandó. Reemplaza las dimensiones conservando la cantidad
 * de carteles y **no muta el jobContext global** (regla de oro): las demás
 * piezas siguen midiendo lo visible. Sin bastidor que la publique → no-op.
 */
function conLonaBrutaSiExiste(jobContext: JobContext): JobContext {
  const bruta = jobContext.lonaBrutaMm;
  const piezas = jobContext.piezas ?? [];
  if (!bruta || !(bruta.anchoMm > 0) || !(bruta.altoMm > 0) || piezas.length === 0) {
    return jobContext;
  }
  return {
    ...jobContext,
    piezas: piezas.map((p) => ({
      ...p,
      anchoMm: bruta.anchoMm,
      altoMm: bruta.altoMm,
    })),
  };
}

/**
 * Normaliza un output geométrico del JobContext a piezas de nesting. Acepta un
 * rectángulo `{anchoMm, altoMm}` o una lista. Una TIRA `{largoMm, anchoMm}` se
 * lee con el largo como ancho de la pieza y el ancho de la tira como alto.
 * docs/fuente-de-medida-de-consumo-diseno.md §4.
 */
function normalizarPiezasDeOutput(
  valor: unknown,
): Array<{ cantidad: number; anchoMm: number; altoMm: number }> {
  if (!valor || typeof valor !== 'object') return [];
  const items = Array.isArray(valor) ? valor : [valor];
  const piezas: Array<{ cantidad: number; anchoMm: number; altoMm: number }> = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const esTira = it.largoMm != null;
    const anchoMm = Number(esTira ? it.largoMm : it.anchoMm);
    const altoMm = Number(esTira ? it.anchoMm : it.altoMm);
    const cantidad = Number(it.cantidad ?? 1);
    if (anchoMm > 0 && altoMm > 0 && cantidad > 0) {
      piezas.push({ cantidad, anchoMm, altoMm });
    }
  }
  return piezas;
}

/**
 * Fuente de medida EFECTIVA de un paso: el override por-SLOT (source-of-truth
 * nuevo, `slot.fuenteMedida` del slot SUSTRATO) gana sobre el param del paso
 * (`fuentePiezas`/`fuentePiezasMontaje`, legacy default). Fase 1: un solo
 * dispatch por paso — toma la del slot sustrato principal. El re-dispatch
 * per-slot (varios sustratos midiendo fuentes distintas) queda para fase 2.
 * docs/fuente-de-medida-de-consumo-diseno.md §8.
 */
export function fuenteMedidaEfectiva(paso: PasoCargado): string | null {
  const slotFuente = paso.slots?.find(
    (s) =>
      s.slotRol === 'SUSTRATO' &&
      typeof s.fuenteMedida === 'string' &&
      s.fuenteMedida.length > 0,
  )?.fuenteMedida;
  if (typeof slotFuente === 'string' && slotFuente.length > 0) {
    return slotFuente;
  }
  const params = asRecord(paso.paramsPasoJson);
  if (typeof params.fuentePiezas === 'string') return params.fuentePiezas;
  if (typeof params.fuentePiezasMontaje === 'string') {
    return params.fuentePiezasMontaje;
  }
  return null;
}

function buildJobContextPiezas(
  paso: PasoCargado,
  jobContext: JobContext,
): JobContext | null {
  const seleccion = fuenteMedidaEfectiva(paso);
  // Fuente builtin `piezas_visibles`: el paso trabaja sobre la MEDIDA
  // TERMINADA — la chapa trasera se corta al marco del cartel, no a la lona
  // que la demasía de tensado agrandó. Hermana de `piezas_jobcontext` (que
  // usa las piezas mutadas); si no hubo mutación, son lo mismo.
  if (seleccion === 'piezas_visibles') {
    const visibles = jobContext.piezasVisibles ?? [];
    const piezas =
      visibles.length > 0 ? visibles : getPiezasParaNesting(jobContext);
    if (piezas.length === 0) return null;
    return {
      ...jobContext,
      cantidad: piezas.reduce((acc, pieza) => acc + pieza.cantidad, 0),
      piezas,
    };
  }

  // Fuente de medida genérica: `output:<clave>` mide sobre una geometría que un
  // paso anterior publicó al JobContext (el bastidor: `fondoMm`, `cenefaTirasMm`,
  // `lonaBrutaMm`…). Es el núcleo del modelo de fuente de medida: cualquier paso
  // de nesting/montaje puede medir sobre un output previo, sin cablear por
  // familia. docs/fuente-de-medida-de-consumo-diseno.md §3.
  if (typeof seleccion === 'string' && seleccion.startsWith('output:')) {
    const clave = seleccion.slice('output:'.length);
    const piezas = normalizarPiezasDeOutput(
      (jobContext as Record<string, unknown>)[clave],
    );
    if (piezas.length === 0) return null;
    return {
      ...jobContext,
      cantidad: piezas.reduce((acc, p) => acc + p.cantidad, 0),
      piezas,
    };
  }

  const fuente = fuentePiezasNestingDeFamilia(paso.familiaCodigo, seleccion);

  if (fuente) {
    const ctx = jobContext as Record<string, unknown>;
    const cantidad = readPositiveNumberFromRecord(ctx, ...fuente.cantidadDesde);
    const anchoMm = readPositiveNumberFromRecord(ctx, fuente.anchoDesde);
    const altoMm = readPositiveNumberFromRecord(ctx, fuente.altoDesde);
    if (!cantidad || !anchoMm || !altoMm) return null;
    return {
      ...jobContext,
      cantidad: Math.ceil(cantidad),
      piezas: [{ cantidad: Math.ceil(cantidad), anchoMm, altoMm }],
    };
  }

  const piezas = getPiezasParaNesting(jobContext);
  if (piezas.length === 0) return null;
  return {
    ...jobContext,
    cantidad: piezas.reduce((acc, pieza) => acc + pieza.cantidad, 0),
    piezas,
  };
}

function runShelfRollo(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  const piezas = jobContext.piezas ?? [];
  if (piezas.length === 0) return null;

  void materialResuelto;
  const rollWidthMm = config.rollWidthMm;
  if (!rollWidthMm || rollWidthMm <= 0) return null;

  // v3.0 (doc §6): márgenes no imprimibles de la MÁQUINA reducen el ancho útil.
  // `margenesNoImprimiblesMm = { sup, inf, izq, der }`. Para shelf-rollo:
  //   - izq + der → restan al ancho útil del rollo.
  //   - sup → marginStartMm (inicio del rollo).
  //   - inf → marginEndMm (fin de cada trabajo).
  // El paso puede sobrescribir vía `paramsPasoJson`.
  const printableWidthMm =
    rollWidthMm - config.margins.leftMm - config.margins.rightMm;
  if (printableWidthMm <= 0) return null;

  const baseShelfInput: Omit<
    EvaluateGranFormatoMixedShelfLayoutInput,
    'panelizado'
  > = {
    printableWidthMm,
    marginLeftMm: config.margins.leftMm,
    marginStartMm: config.margins.startMm,
    marginEndMm: config.margins.endMm,
    separacionHorizontalMm: config.separationHMm,
    separacionVerticalMm: config.separationVMm,
    permitirRotacion: config.allowRotation,
    medidas: piezas.map((p, idx) => ({
      id: `pieza_${idx}`,
      cantidad: p.cantidad,
      anchoMm: p.anchoMm,
      altoMm: p.altoMm,
    })),
  };

  // Plotter CAD: imprime los planos de a uno, no combina piezas en el ancho
  // del rollo. Cada pieza va en su propia fila; solo se optimiza la
  // orientación para reducir el largo consumido (sin panelizado).
  const esPlotterCad =
    (paso.maquina?.plantilla ?? '').toLowerCase() === 'plotter_cad';
  const shelfInputs = esPlotterCad
    ? [baseShelfInput as EvaluateGranFormatoMixedShelfLayoutInput]
    : buildShelfInputsForPanelizado(baseShelfInput, config);
  const rollCandidates = shelfInputs
    .map((shelfInput) =>
      esPlotterCad
        ? evaluateSequentialRollCandidate(shelfInput)
        : evaluateRollLayoutForConfiguredAlgorithm(shelfInput, config.algorithm),
    )
    .filter(
      (
        candidate,
      ): candidate is {
        result: GranFormatoMixedShelfLayoutResult;
        algorithm: 'shelf-rollo' | 'maxrects-rollo' | 'secuencial-rollo';
      } => candidate != null,
    );
  const bestRollCandidate = chooseBestRollCandidate(rollCandidates);
  const result = bestRollCandidate?.result ?? null;
  const algorithm = bestRollCandidate?.algorithm ?? 'shelf-rollo';

  if (!result) return null;

  const consumedLengthMm = result.consumedLengthMm;
  const consumedLengthM = consumedLengthMm / 1000;
  const areaTotalMm2 = rollWidthMm * consumedLengthMm;
  const aprovechamientoPct =
    areaTotalMm2 > 0
      ? Math.round(((result.usefulAreaM2 * 1_000_000) / areaTotalMm2) * 10000) /
        100
      : 0;

  // Mapear placements del shape legacy → universal Placement
  const placements: Placement[] = result.placements.map((p) => ({
    pieceId: p.sourcePieceId ?? p.id,
    substrateIndex: 0,
    xMm: p.centerXMm - p.widthMm / 2,
    yMm: p.centerYMm - p.heightMm / 2,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    rotated: p.rotated,
    panelIndex: p.panelIndex ?? undefined,
    panelCount: p.panelCount ?? undefined,
    panelAxis: (p.panelAxis ?? undefined) as
      | 'vertical'
      | 'horizontal'
      | undefined,
    usefulWidthMm: p.usefulWidthMm,
    usefulHeightMm: p.usefulHeightMm,
    overlapStartMm: p.overlapStartMm,
    overlapEndMm: p.overlapEndMm,
    meta: { label: p.label },
  }));

  const substrates: SubstrateUsage[] = [
    { kind: 'roll', lengthMm: consumedLengthMm, widthMm: rollWidthMm },
  ];

  return {
    algorithm,
    cantidadCalculada: consumedLengthM,
    unidad: 'm_lineales',
    aprovechamientoPct,
    substrates,
    placements,
    metricasRaw: {
      aprovechamientoPct,
      areaUtilMm2: result.usefulAreaM2 * 1_000_000,
      areaTotalMm2,
      consumedLengthMm,
      wasteAreaM2: Math.max(
        0,
        (areaTotalMm2 - result.usefulAreaM2 * 1_000_000) / 1_000_000,
      ),
    },
    consumedLengthMm,
    piezasAcomodadas: result.placements.length,
    visualConfig: buildVisualConfig({
      maquina: maquinaVisualDe(paso),
      kind: 'roll',
      widthMm: rollWidthMm,
      heightMm: consumedLengthMm,
      margins: {
        leftMm: config.margins.leftMm,
        rightMm: config.margins.rightMm,
        topMm: config.margins.startMm,
        bottomMm: config.margins.endMm,
      },
      pieceBleedMm: config.pieceBleedMm,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      substrateLabel: 'Rollo',
      panelizado: {
        enabled: result.panelizado,
        mode: result.panelMode === 'manual' ? 'manual' : 'automatic',
        axis: result.panelAxis,
        overlapMm: result.panelOverlapMm,
        maxPanelWidthMm: result.panelMaxWidthMm,
        distribution: result.panelDistribution,
        widthInterpretation: result.panelWidthInterpretation,
        panelCount: result.panelCount,
      },
    }),
  };
}

function disablePanelizado(
  config: NestingConfigResolved,
): NestingConfigResolved {
  return {
    ...config,
    panelizado: {
      ...config.panelizado,
      enabled: false,
      manualLayout: null,
    },
  };
}

function buildShelfInputsForPanelizado(
  baseInput: Omit<EvaluateGranFormatoMixedShelfLayoutInput, 'panelizado'>,
  config: NestingConfigResolved,
): EvaluateGranFormatoMixedShelfLayoutInput[] {
  if (!config.panelizado.enabled) {
    return [baseInput];
  }
  const axisCandidates =
    config.panelizado.mode === 'manual'
      ? ([
          config.panelizado.axis === 'horizontal' ? 'horizontal' : 'vertical',
        ] as const)
      : config.panelizado.axis === 'automatic'
        ? (['automatic'] as const)
        : ([config.panelizado.axis] as const);

  return axisCandidates.map((axis) => ({
    ...baseInput,
    panelizado: {
      activo: true,
      mode: config.panelizado.mode === 'manual' ? 'manual' : 'automatico',
      axis,
      overlapMm: config.panelizado.overlapMm,
      maxPanelWidthMm: config.panelizado.maxPanelWidthMm,
      distribution: config.panelizado.distribution,
      widthInterpretation: config.panelizado.widthInterpretation,
      manualLayout: config.panelizado.manualLayout,
    },
  }));
}

function evaluateSequentialRollCandidate(
  shelfInput: EvaluateGranFormatoMixedShelfLayoutInput,
): {
  result: GranFormatoMixedShelfLayoutResult;
  algorithm: 'secuencial-rollo';
} | null {
  const result = evaluateGranFormatoSequentialRollLayout(shelfInput);
  if (!result) return null;
  return { result, algorithm: 'secuencial-rollo' };
}

/**
 * Corre el/los algoritmos de rollo y devuelve el mejor layout. Exportado para
 * que el SIMULADOR de producción acomode la tanda consolidada con este mismo
 * motor en vez de reimplementar un packer propio (que derivaba: ver
 * docs/simulador-impresion-diseno.md).
 */
export function evaluateRollLayoutForConfiguredAlgorithm(
  shelfInput: EvaluateGranFormatoMixedShelfLayoutInput,
  algorithm: NestingConfigResolved['algorithm'],
): {
  result: GranFormatoMixedShelfLayoutResult;
  algorithm: 'shelf-rollo' | 'maxrects-rollo';
} | null {
  const shelfResult =
    algorithm === 'maxrects-rollo'
      ? null
      : evaluateGranFormatoMixedShelfLayout(shelfInput);
  const maxRectsResult =
    algorithm === 'shelf-rollo'
      ? null
      : evaluateGranFormatoMaxRectsRollLayout({
          ...shelfInput,
          upperBoundConsumedLengthMm: shelfResult?.consumedLengthMm ?? null,
        });
  const result =
    algorithm === 'maxrects-rollo'
      ? maxRectsResult
      : algorithm === 'shelf-rollo'
        ? shelfResult
        : chooseBestRollLayout(shelfResult, maxRectsResult);
  if (!result) return null;
  return {
    result,
    algorithm: result === maxRectsResult ? 'maxrects-rollo' : 'shelf-rollo',
  };
}

function chooseBestRollCandidate(
  candidates: Array<{
    result: GranFormatoMixedShelfLayoutResult;
    algorithm: 'shelf-rollo' | 'maxrects-rollo' | 'secuencial-rollo';
  }>,
) {
  return (
    candidates.slice().sort((a, b) => {
      const best = chooseBestRollLayout(a.result, b.result);
      if (best === a.result) return -1;
      if (best === b.result) return 1;
      return 0;
    })[0] ?? null
  );
}

function chooseBestRollLayout(
  shelfResult: GranFormatoMixedShelfLayoutResult | null,
  maxRectsResult: GranFormatoMixedShelfLayoutResult | null,
): GranFormatoMixedShelfLayoutResult | null {
  if (!shelfResult) return maxRectsResult;
  if (!maxRectsResult) return shelfResult;
  const lengthDiff =
    shelfResult.consumedLengthMm - maxRectsResult.consumedLengthMm;
  if (Math.abs(lengthDiff) > 1) {
    return lengthDiff > 0 ? maxRectsResult : shelfResult;
  }
  const shelfOrientationPenalty = shelfResult.orientacion === 'mixta' ? 1 : 0;
  const maxRectsOrientationPenalty =
    maxRectsResult.orientacion === 'mixta' ? 1 : 0;
  if (shelfOrientationPenalty !== maxRectsOrientationPenalty) {
    return shelfOrientationPenalty < maxRectsOrientationPenalty
      ? shelfResult
      : maxRectsResult;
  }
  return maxRectsResult.usefulAreaM2 >= shelfResult.usefulAreaM2
    ? maxRectsResult
    : shelfResult;
}

function runGrid2DMultiForArea(
  paso: PasoCargado,
  jobContext: JobContext,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  const piezas = getPiezasParaNesting(jobContext);
  if (piezas.length === 0) return null;
  void paso;
  if (!config.sheetWidthMm || !config.sheetHeightMm) return null;

  const medidasDistintas = new Set(
    piezas.map((p) => `${p.anchoMm}x${p.altoMm}`),
  );
  if (medidasDistintas.size <= 1) {
    return runGrid2DSingleForArea(jobContext, config);
  }

  const result = nestGrid2DMulti(
    piezas.map((p, idx) => ({
      id: `pieza_${idx}`,
      widthMm: p.anchoMm,
      heightMm: p.altoMm,
      quantity: p.cantidad,
    })),
    {
      kind: 'sheet',
      widthMm: config.sheetWidthMm,
      heightMm: config.sheetHeightMm,
      margins: {
        leftMm: config.margins.leftMm,
        rightMm: config.margins.rightMm,
        topMm: config.margins.topMm,
        bottomMm: config.margins.bottomMm,
      },
    },
    {
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
    },
  );

  if (result.placements.length === 0) return null;

  return {
    algorithm: 'grid-2d-multi',
    cantidadCalculada: result.substrates.length,
    unidad: 'pliegos',
    aprovechamientoPct: result.metrics.aprovechamientoPct,
    substrates: result.substrates,
    placements: result.placements,
    metricasRaw: result.metrics,
    piezasAcomodadas: result.placements.length,
    visualConfig: buildVisualConfig({
      kind: 'sheet',
      widthMm: config.sheetWidthMm,
      heightMm: config.sheetHeightMm,
      margins: {
        leftMm: config.margins.leftMm,
        rightMm: config.margins.rightMm,
        topMm: config.margins.topMm,
        bottomMm: config.margins.bottomMm,
      },
      pieceBleedMm: config.pieceBleedMm,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      substrateLabel: 'Placa',
    }),
  };
}

function runGrid2DSingleForArea(
  jobContext: JobContext,
  config: NestingConfigResolved,
  substrateLabel = 'Placa',
): NestingDispatchResult | null {
  const piezas = getPiezasParaNesting(jobContext);
  const pieza = piezas[0];
  if (!pieza || !config.sheetWidthMm || !config.sheetHeightMm) return null;

  const sustrato = {
    kind: 'sheet' as const,
    widthMm: config.sheetWidthMm,
    heightMm: config.sheetHeightMm,
    margins: {
      leftMm: config.margins.leftMm,
      rightMm: config.margins.rightMm,
      topMm: config.margins.topMm,
      bottomMm: config.margins.bottomMm,
    },
  };
  const result = nestGrid2DSingle(
    {
      id: 'pieza_0',
      widthMm: pieza.anchoMm,
      heightMm: pieza.altoMm,
      quantity: 1,
    },
    sustrato,
    {
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
    },
  );

  const piezasPorPliego = result.metrics.piezasPorSustrato ?? 0;
  if (piezasPorPliego <= 0) return null;

  const totalPiezas = piezas.reduce((acc, item) => acc + item.cantidad, 0);
  const pliegosNecesarios = Math.ceil(totalPiezas / piezasPorPliego);
  const mixedLayout = buildSingleSizeMixedLayout({
    pieceId: 'pieza_0',
    pieceWidthMm: pieza.anchoMm,
    pieceHeightMm: pieza.altoMm,
    quantity: Math.min(totalPiezas, piezasPorPliego),
    substrateWidthMm: config.sheetWidthMm,
    substrateHeightMm: config.sheetHeightMm,
    margins: sustrato.margins,
    separationHMm: config.separationHMm,
    separationVMm: config.separationVMm,
    allowRotation: config.allowRotation,
  });
  const placements =
    mixedLayout?.placements ??
    result.placements
      .slice(0, Math.min(totalPiezas, piezasPorPliego))
      .map((placement) => ({
        ...placement,
        substrateIndex: 0,
      }));
  const previewConsumedLengthMm =
    mixedLayout?.consumedLengthMm ?? result.metrics.largoConsumidoMm ?? 0;

  return {
    algorithm: 'grid-2d-single',
    cantidadCalculada: pliegosNecesarios,
    unidad: 'pliegos',
    aprovechamientoPct:
      result.metrics.areaTotalMm2 > 0
        ? Math.round(
            ((totalPiezas * pieza.anchoMm * pieza.altoMm) /
              (result.metrics.areaTotalMm2 * pliegosNecesarios)) *
              10000,
          ) / 100
        : result.metrics.aprovechamientoPct,
    substrates: [
      {
        kind: 'sheet' as const,
        count: pliegosNecesarios,
        widthMm: config.sheetWidthMm,
        heightMm: config.sheetHeightMm,
      },
    ],
    placements,
    metricasRaw: {
      ...result.metrics,
      areaUtilMm2: totalPiezas * pieza.anchoMm * pieza.altoMm,
      areaTotalMm2: result.metrics.areaTotalMm2 * pliegosNecesarios,
      largoConsumidoMm: previewConsumedLengthMm,
      columnas: undefined,
      filas: undefined,
      piezasPorSustrato: undefined,
    },
    piezasPorPliego,
    piezasAcomodadas: totalPiezas,
    visualConfig: buildVisualConfig({
      kind: 'sheet',
      widthMm: config.sheetWidthMm,
      heightMm: config.sheetHeightMm,
      margins: sustrato.margins,
      pieceBleedMm: config.pieceBleedMm,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      substrateLabel,
    }),
  };
}

function buildSingleSizeMixedLayout(input: {
  pieceId: string;
  pieceWidthMm: number;
  pieceHeightMm: number;
  quantity: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  separationHMm: number;
  separationVMm: number;
  allowRotation: boolean;
}): { placements: Placement[]; consumedLengthMm: number } | null {
  if (input.quantity <= 0) return null;
  const usableWidthMm =
    input.substrateWidthMm - input.margins.leftMm - input.margins.rightMm;
  const usableHeightMm =
    input.substrateHeightMm - input.margins.topMm - input.margins.bottomMm;

  const rowTypes = [
    buildRowType(
      input.pieceWidthMm,
      input.pieceHeightMm,
      false,
      usableWidthMm,
      input.separationHMm,
    ),
    ...(input.allowRotation && input.pieceWidthMm !== input.pieceHeightMm
      ? [
          buildRowType(
            input.pieceHeightMm,
            input.pieceWidthMm,
            true,
            usableWidthMm,
            input.separationHMm,
          ),
        ]
      : []),
  ].filter((row): row is RowType => row !== null);
  if (rowTypes.length === 0) return null;

  const maxRows = rowTypes.map((row) =>
    Math.floor(
      (usableHeightMm + input.separationVMm) /
        (row.heightMm + input.separationVMm),
    ),
  );
  let best: { counts: number[]; heightMm: number; capacity: number } | null =
    null;

  for (let a = 0; a <= (maxRows[0] ?? 0); a++) {
    const secondMax = maxRows[1] ?? 0;
    for (let b = 0; b <= secondMax; b++) {
      const counts = rowTypes.length === 1 ? [a] : [a, b];
      const rows = counts.reduce((acc, count) => acc + count, 0);
      if (rows <= 0) continue;
      const height =
        counts.reduce(
          (acc, count, idx) => acc + count * rowTypes[idx].heightMm,
          0,
        ) +
        (rows - 1) * input.separationVMm;
      if (height > usableHeightMm) continue;
      const capacity = counts.reduce(
        (acc, count, idx) => acc + count * rowTypes[idx].columns,
        0,
      );
      if (capacity < input.quantity) continue;
      if (
        !best ||
        height < best.heightMm ||
        (height === best.heightMm && capacity > best.capacity)
      ) {
        best = { counts, heightMm: height, capacity };
      }
    }
  }
  if (!best) return null;

  const rows: RowType[] = [];
  best.counts.forEach((count, idx) => {
    for (let i = 0; i < count; i++) rows.push(rowTypes[idx]);
  });
  rows.sort((a, b) => b.columns - a.columns || b.heightMm - a.heightMm);

  const placements: Placement[] = [];
  let remaining = input.quantity;
  let yMm = input.margins.topMm;
  for (const row of rows) {
    if (remaining <= 0) break;
    const inRow = Math.min(remaining, row.columns);
    for (let col = 0; col < inRow; col++) {
      placements.push({
        pieceId: input.pieceId,
        substrateIndex: 0,
        xMm: input.margins.leftMm + col * (row.widthMm + input.separationHMm),
        yMm,
        widthMm: row.widthMm,
        heightMm: row.heightMm,
        rotated: row.rotated,
      });
    }
    remaining -= inRow;
    yMm += row.heightMm + input.separationVMm;
  }

  const maxBottomMm = placements.reduce(
    (max, placement) => Math.max(max, placement.yMm + placement.heightMm),
    0,
  );
  return {
    placements,
    consumedLengthMm: maxBottomMm + input.margins.bottomMm,
  };
}

interface RowType {
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  columns: number;
}

function buildRowType(
  widthMm: number,
  heightMm: number,
  rotated: boolean,
  usableWidthMm: number,
  separationHMm: number,
): RowType | null {
  if (usableWidthMm < widthMm) return null;
  return {
    widthMm,
    heightMm,
    rotated,
    columns: Math.floor(
      (usableWidthMm + separationHMm) / (widthMm + separationHMm),
    ),
  };
}

/**
 * Decide entre grid-2d-single (1 pieza repetida en grilla) y grid-2d-multi
 * (N piezas de medidas distintas en una o más placas con bin-packing).
 *
 * Heurística: si `jobContext.piezas` tiene >1 medida distinta → multi.
 * Si solo hay 1 medida (o sin piezas pero con medidaCustom/params) → single.
 */
/** Config de imposición de cuadernillo del paso, o null si no está activada.
 *  Vive en paramsPasoJson.nestingConfig.imposicion — la declara el MODELADOR
 *  (no es editable por el comercial). */
export function getImposicionCaballeteConfig(paso: {
  paramsPasoJson?: unknown;
}): {
  maxHojas?: number;
  paginasDefault?: number;
  hojas: SeleccionHojas;
} | null {
  const params =
    paso.paramsPasoJson && typeof paso.paramsPasoJson === 'object'
      ? (paso.paramsPasoJson as Record<string, unknown>)
      : {};
  const nesting =
    params.nestingConfig && typeof params.nestingConfig === 'object'
      ? (params.nestingConfig as Record<string, unknown>)
      : {};
  const imposicion =
    nesting.imposicion && typeof nesting.imposicion === 'object'
      ? (nesting.imposicion as Record<string, unknown>)
      : null;
  if (!imposicion) return null;
  if (String(imposicion.esquema ?? '').toLowerCase() !== 'caballete') {
    return null;
  }
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    maxHojas: num(imposicion.maxHojas),
    paginasDefault: num(imposicion.paginasDefault),
    hojas: parseSeleccionHojas(imposicion.hojas),
  };
}

/** `hojas` del paso: 'todas' | 'tapa' | 'interior' | {desde, hasta}.
 *  Cualquier cosa que no se entienda cae en 'todas' (el comportamiento
 *  previo a que existiera el parámetro). */
function parseSeleccionHojas(raw: unknown): SeleccionHojas {
  if (typeof raw === 'string') {
    const modo = raw.trim().toLowerCase();
    if (modo === 'tapa' || modo === 'interior') return { modo };
    return SELECCION_HOJAS_TODAS;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const modo = String(o.modo ?? '').toLowerCase();
    if (modo === 'tapa' || modo === 'interior') return { modo };
    if (modo === 'rango') {
      const desde = Number(o.desde);
      const hasta = Number(o.hasta);
      if (Number.isFinite(desde) && Number.isFinite(hasta) && desde >= 1) {
        return { modo: 'rango', desde, hasta };
      }
    }
  }
  return SELECCION_HOJAS_TODAS;
}

/**
 * Imposición de cuadernillo a caballete sobre el pliego de impresión.
 *
 * La PIEZA que se acomoda no es la página sino el PAR de páginas enfrentadas
 * (2·ancho × alto de la medida final): el grid dice cuántos pares entran por
 * cara (K = copias del mismo pliego, se cortan al medio → K libros por juego)
 * y `calcularCuadernilloCaballete` convierte eso en pliegos + plan.
 *
 * Devuelve null cuando falta un insumo (páginas, medida, pliego) o el par no
 * entra o se excede el tope de hojas: el guard de `impresion_por_hoja` en el
 * motor re-deriva la causa y corta con el diagnóstico específico.
 */
function runImposicionCaballete(
  paso: PasoCargado,
  jobContext: JobContext,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  const imposicion = getImposicionCaballeteConfig(paso);
  if (!imposicion) return null;

  const paginas = Number(jobContext.paginas ?? imposicion.paginasDefault ?? 0);
  if (!Number.isFinite(paginas) || paginas <= 0) return null;

  const sheetWidthMm = config.sheetWidthMm;
  const sheetHeightMm = config.sheetHeightMm;
  if (!sheetWidthMm || !sheetHeightMm) return null;

  // Medida de la PÁGINA final: medida custom o primera pieza (misma
  // precedencia que el modo single).
  const pagina = jobContext.medidaCustomMm ?? jobContext.piezas?.[0] ?? null;
  const paginaAnchoMm = Number(pagina?.anchoMm ?? 0);
  const paginaAltoMm = Number(pagina?.altoMm ?? 0);
  if (paginaAnchoMm <= 0 || paginaAltoMm <= 0) return null;

  const sustrato = {
    kind: 'sheet' as const,
    widthMm: sheetWidthMm,
    heightMm: sheetHeightMm,
    margins: {
      leftMm: config.margins.leftMm,
      rightMm: config.margins.rightMm,
      topMm: config.margins.topMm,
      bottomMm: config.margins.bottomMm,
    },
  };
  const grid = nestGrid2DSingle(
    {
      id: 'par_paginas',
      widthMm: paginaAnchoMm * 2,
      heightMm: paginaAltoMm,
      quantity: 1,
    },
    sustrato,
    {
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
    },
  );
  const paresPorCara = grid.metrics.piezasPorSustrato ?? 0;
  if (paresPorCara <= 0) return null;

  const ejemplares = Number(jobContext.cantidad ?? 0);
  const cuadernillo = calcularCuadernilloCaballete({
    paginas,
    ejemplares,
    paresPorCara,
    maxHojas: imposicion.maxHojas,
    hojas: imposicion.hojas,
  });
  // Excede el caballete, o el paso quedó sin hojas que imprimir (ej. "interior"
  // sobre un documento de 4 páginas): el guard del motor lo diagnostica.
  if (cuadernillo.excedeMaxHojas || cuadernillo.hojasDelPaso === 0) return null;

  return {
    algorithm: 'grid-2d-single',
    cantidadCalculada: cuadernillo.pliegos,
    unidad: 'pliegos',
    aprovechamientoPct: grid.metrics.aprovechamientoPct,
    substrates: grid.substrates.map((s) => ({
      ...s,
      count: cuadernillo.pliegos,
    })),
    placements: grid.placements,
    metricasRaw: grid.metrics,
    piezasPorPliego: paresPorCara,
    piezasAcomodadas: paresPorCara,
    imposicionCuadernillo: cuadernillo,
    visualConfig: buildVisualConfig({
      kind: 'sheet',
      widthMm: sheetWidthMm,
      heightMm: sheetHeightMm,
      margins: sustrato.margins,
      pieceBleedMm: config.pieceBleedMm,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      substrateLabel: 'Pliego',
      // Mismo criterio que las tarjetas (grid single en láser): si sobra
      // pliego, el acomodo se dibuja centrado — el operario centra la carga.
      centerPlacements: shouldCenterPlacementsForPaso(paso),
    }),
  };
}

function runGrid2DSingle(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  // `printSheetMode` sólo puede ser 'automatic' si la familia declara la
  // estrategia pliego_digital (gate en resolveNestingConfig) — no hace falta
  // re-chequear la familia acá. [Etapa F2]
  if (config.printSheetMode === 'automatic') {
    return runGrid2DSingleAutoPrintSheet(
      paso,
      jobContext,
      materialResuelto,
      config,
    );
  }

  // Sustrato común a ambos modos.
  void materialResuelto;
  const sheetWidthMm = config.sheetWidthMm;
  const sheetHeightMm = config.sheetHeightMm;
  if (!sheetWidthMm || !sheetHeightMm) return null;

  const sustrato = {
    kind: 'sheet' as const,
    widthMm: sheetWidthMm,
    heightMm: sheetHeightMm,
    margins: {
      leftMm: config.margins.leftMm,
      rightMm: config.margins.rightMm,
      topMm: config.margins.topMm,
      bottomMm: config.margins.bottomMm,
    },
  };

  // ─── Detección de modo multi-medida ──────────────────────────────
  if (jobContext.piezas && jobContext.piezas.length > 0) {
    // Detectar si hay >1 medida distinta. Si todas son iguales, single
    // es más eficiente y devuelve `piezasPorPliego` que el motor usa
    // para `HEREDAR_DEL_OUTPUT_CANONICO`.
    const medidasDistintas = new Set(
      jobContext.piezas.map((p) => `${p.anchoMm}x${p.altoMm}`),
    );
    if (
      config.algorithm === 'grid-2d-multi' ||
      (config.algorithm === 'auto' && medidasDistintas.size > 1)
    ) {
      return runGrid2DMulti(jobContext, sustrato, {
        pieceBleedMm: config.pieceBleedMm,
        separationHMm: config.separationHMm,
        separationVMm: config.separationVMm,
        allowRotation: config.allowRotation,
      });
    }
  }

  // ─── Modo single (1 pieza repetida) ──────────────────────────────
  let widthMm = 0;
  let heightMm = 0;
  if (jobContext.medidaCustomMm) {
    widthMm = jobContext.medidaCustomMm.anchoMm;
    heightMm = jobContext.medidaCustomMm.altoMm;
  } else if (jobContext.piezas && jobContext.piezas.length > 0) {
    widthMm = jobContext.piezas[0].anchoMm;
    heightMm = jobContext.piezas[0].altoMm;
  } else {
    const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
    widthMm = Number(params.piezaAnchoMm ?? 0);
    heightMm = Number(params.piezaAltoMm ?? 0);
  }
  if (widthMm <= 0 || heightMm <= 0) return null;

  const result = nestGrid2DSingle(
    { id: 'pieza_principal', widthMm, heightMm, quantity: 1 },
    sustrato,
    {
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
    },
  );

  const piezasPorPliego = result.metrics.piezasPorSustrato ?? 0;
  if (piezasPorPliego <= 0) return null;

  const cantidadPiezas = Number(jobContext.cantidad ?? 0);
  const pliegosNecesarios = Math.ceil(cantidadPiezas / piezasPorPliego);

  return {
    algorithm: 'grid-2d-single',
    cantidadCalculada: pliegosNecesarios,
    unidad: 'pliegos',
    aprovechamientoPct: result.metrics.aprovechamientoPct,
    // El acomodo describe UN pliego (los placements son de ese pliego), pero
    // `substrates` es el sustrato REALMENTE consumido: quien lo lee para
    // costear —la tinta, por ejemplo— espera el total, no la plantilla. Los
    // dos caminos de multi ya listan una entrada por placa.
    substrates: result.substrates.map((sustrato) => ({
      ...sustrato,
      count: pliegosNecesarios,
    })),
    placements: result.placements,
    metricasRaw: result.metrics,
    piezasPorPliego,
    piezasAcomodadas: piezasPorPliego,
    visualConfig: buildVisualConfig({
      kind: 'sheet',
      widthMm: sheetWidthMm,
      heightMm: sheetHeightMm,
      margins: sustrato.margins,
      pieceBleedMm: config.pieceBleedMm,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      substrateLabel: 'Pliego',
      centerPlacements: shouldCenterPlacementsForPaso(paso),
    }),
  };
}

function runGrid2DSingleAutoPrintSheet(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  void materialResuelto;
  const candidates = config.printSheetCandidates;
  if (candidates.length === 0) return null;

  const porCandidato = config.printSheetCostSource === 'por_candidato';
  const evaluated = candidates
    .map((candidate) => {
      const candidateConfig: NestingConfigResolved = {
        ...config,
        printSheetMode: 'fixed',
        printSheetCandidates: [],
        sheetWidthMm: candidate.anchoMm,
        sheetHeightMm: candidate.altoMm,
      };
      const result = runGrid2DSingle(
        paso,
        jobContext,
        materialResuelto,
        candidateConfig,
      );
      if (!result || result.cantidadCalculada <= 0) return null;
      const score = porCandidato
        ? scorePrintSheetCandidateRealCost(candidate, result, config)
        : scorePrintSheetCandidate(candidate, result, config);
      if (!score) return null;
      return { candidate, result, score };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.score.costo !== b.score.costo) {
        return a.score.costo - b.score.costo;
      }
      if (a.result.aprovechamientoPct !== b.result.aprovechamientoPct) {
        return b.result.aprovechamientoPct - a.result.aprovechamientoPct;
      }
      return a.result.cantidadCalculada - b.result.cantidadCalculada;
    });

  const winner = evaluated[0];
  if (!winner) return null;

  const materiaPrimaGanadora = winner.score.materiaPrima;
  return {
    ...winner.result,
    pliegoImpresionSeleccionado: {
      id: winner.candidate.id,
      nombre: winner.candidate.nombre,
      anchoMm: winner.candidate.anchoMm,
      altoMm: winner.candidate.altoMm,
      criterio: porCandidato ? 'menor_costo_real' : 'menor_costo_sustrato',
      candidatosEvaluados: evaluated.length,
      costoEstimadoMm2: winner.score.costo,
      pliegosImpresion: winner.result.cantidadCalculada,
      pliegosComprados: winner.score.pliegosComprados,
      aprovechamientoPct: winner.result.aprovechamientoPct,
      ...(materiaPrimaGanadora
        ? {
            materiaPrima: {
              varianteId: materiaPrimaGanadora.varianteId,
              sku: materiaPrimaGanadora.sku,
              nombre: materiaPrimaGanadora.nombre,
              precioReferencia: materiaPrimaGanadora.precioReferencia,
            },
          }
        : {}),
    },
  };
}

function scorePrintSheetCandidate(
  candidate: PrintSheetCandidateConfig,
  result: NestingDispatchResult,
  config: NestingConfigResolved,
): {
  costo: number;
  pliegosComprados: number;
  materiaPrima?: PrintSheetCandidateMaterial;
} | null {
  const pliegosImpresion = result.cantidadCalculada;
  if (!Number.isFinite(pliegosImpresion) || pliegosImpresion <= 0) return null;

  const purchaseWidthMm = config.purchaseSheetWidthMm ?? 0;
  const purchaseHeightMm = config.purchaseSheetHeightMm ?? 0;
  if (purchaseWidthMm > 0 && purchaseHeightMm > 0) {
    const pliegosPorSustrato = getPrintSheetsPerPurchaseSheet(
      purchaseWidthMm,
      purchaseHeightMm,
      candidate.anchoMm,
      candidate.altoMm,
    );
    if (pliegosPorSustrato <= 0) return null;
    const conversion = calculateSustratoToPliegoConversion({
      sustrato: { anchoMm: purchaseWidthMm, altoMm: purchaseHeightMm },
      pliegoImpresion: { anchoMm: candidate.anchoMm, altoMm: candidate.altoMm },
    });
    const effectiveSheetsPerPurchase =
      conversion.esDerivado && conversion.pliegosPorSustrato > 0
        ? conversion.pliegosPorSustrato
        : pliegosPorSustrato;
    const pliegosComprados = Math.ceil(
      pliegosImpresion / effectiveSheetsPerPurchase,
    );
    return {
      pliegosComprados,
      costo: pliegosComprados * purchaseWidthMm * purchaseHeightMm,
    };
  }

  return {
    pliegosComprados: pliegosImpresion,
    costo: pliegosImpresion * candidate.anchoMm * candidate.altoMm,
  };
}

/**
 * Score en $ reales (origen de costo 'por_candidato').
 *
 * Con MP propia: pliegos comprados de ESA MP (1:1 si la MP ya es del tamaño
 * del candidato; derivación si es más grande) × su precio de referencia.
 * Sin MP propia: cae al derivado del slot, convertido a $ con el precio de
 * la MP del slot para que compita en la misma unidad.
 *
 * Devuelve null (candidato no comparable) si falta el precio necesario o el
 * candidato no sale de su sustrato.
 */
function scorePrintSheetCandidateRealCost(
  candidate: PrintSheetCandidateConfig,
  result: NestingDispatchResult,
  config: NestingConfigResolved,
): {
  costo: number;
  pliegosComprados: number;
  materiaPrima?: PrintSheetCandidateMaterial;
} | null {
  const pliegosImpresion = result.cantidadCalculada;
  if (!Number.isFinite(pliegosImpresion) || pliegosImpresion <= 0) return null;

  const materiaPrima = candidate.materiaPrima;
  if (materiaPrima) {
    const precio = Number(materiaPrima.precioReferencia ?? 0);
    if (!Number.isFinite(precio) || precio <= 0) return null;
    const sustratoAnchoMm = materiaPrima.anchoMm ?? candidate.anchoMm;
    const sustratoAltoMm = materiaPrima.altoMm ?? candidate.altoMm;
    const pliegosPorSustrato = getPrintSheetsPerPurchaseSheet(
      sustratoAnchoMm,
      sustratoAltoMm,
      candidate.anchoMm,
      candidate.altoMm,
    );
    if (pliegosPorSustrato <= 0) return null;
    const pliegosComprados = Math.ceil(pliegosImpresion / pliegosPorSustrato);
    return {
      costo: pliegosComprados * precio,
      pliegosComprados,
      materiaPrima,
    };
  }

  const precioSlot = Number(config.purchaseSheetPrecio ?? 0);
  if (!Number.isFinite(precioSlot) || precioSlot <= 0) return null;
  const derivado = scorePrintSheetCandidate(candidate, result, config);
  if (!derivado) return null;
  return {
    costo: derivado.pliegosComprados * precioSlot,
    pliegosComprados: derivado.pliegosComprados,
  };
}

function getPrintSheetsPerPurchaseSheet(
  purchaseWidthMm: number,
  purchaseHeightMm: number,
  printWidthMm: number,
  printHeightMm: number,
) {
  const direct =
    Math.floor(purchaseWidthMm / printWidthMm) *
    Math.floor(purchaseHeightMm / printHeightMm);
  const rotated =
    Math.floor(purchaseWidthMm / printHeightMm) *
    Math.floor(purchaseHeightMm / printWidthMm);
  return Math.max(0, direct, rotated);
}

/**
 * Bin-packing 2D para múltiples piezas de medidas distintas en una o más
 * placas. Usa `nestGrid2DMulti` (MaxRectsPacker) que abre nuevas placas
 * automáticamente cuando lo pendiente no entra en la actual.
 *
 * Útil para impresión rígida (CNC, UV flatbed) donde un job mezcla piezas
 * de tamaños distintos.
 */
function runGrid2DMulti(
  jobContext: JobContext,
  sustrato: {
    kind: 'sheet';
    widthMm: number;
    heightMm: number;
    margins: {
      leftMm: number;
      rightMm: number;
      topMm: number;
      bottomMm: number;
    };
  },
  options: {
    pieceBleedMm: number;
    separationHMm: number;
    separationVMm: number;
    allowRotation: boolean;
  },
): NestingDispatchResult | null {
  const piezas = getPiezasParaNesting(jobContext);
  if (piezas.length === 0) return null;

  const result = nestGrid2DMulti(
    piezas.map((p, idx) => ({
      id: `pieza_${idx}`,
      widthMm: p.anchoMm,
      heightMm: p.altoMm,
      quantity: p.cantidad,
    })),
    sustrato,
    options,
  );

  if (result.placements.length === 0) return null;

  const cantidadPlacas = result.substrates.length;

  return {
    algorithm: 'grid-2d-multi',
    cantidadCalculada: cantidadPlacas, // pliegos/placas necesarios
    unidad: 'pliegos',
    aprovechamientoPct: result.metrics.aprovechamientoPct,
    substrates: result.substrates,
    placements: result.placements,
    metricasRaw: result.metrics,
    piezasAcomodadas: result.placements.length,
    visualConfig: buildVisualConfig({
      kind: 'sheet',
      widthMm: sustrato.widthMm,
      heightMm: sustrato.heightMm,
      margins: sustrato.margins,
      pieceBleedMm: options.pieceBleedMm,
      separationHMm: options.separationHMm,
      separationVMm: options.separationVMm,
      allowRotation: options.allowRotation,
      substrateLabel: 'Placa',
    }),
  };
}

/**
 * Datos de la máquina del paso para la ilustración del viewer (la "boca de
 * impresora" sobre el rollo). `tecnologia` sale de los params técnicos de la
 * plantilla gran formato; si no está, el viewer muestra solo el ancho útil.
 */
function maquinaVisualDe(
  paso: PasoCargado,
): NestingVisualConfig['maquina'] | undefined {
  const maquina = paso.maquina;
  if (!maquina?.nombre) return undefined;
  const params = maquina.parametrosTecnicosJson ?? {};
  const tecnologia =
    typeof params.tecnologia === 'string' && params.tecnologia.trim()
      ? params.tecnologia.trim()
      : null;
  const anchoUtil = Number(maquina.anchoUtil ?? params.anchoUtil);
  return {
    nombre: maquina.nombre,
    anchoUtilMm: Number.isFinite(anchoUtil) && anchoUtil > 0 ? anchoUtil : null,
    tecnologia,
  };
}

function buildVisualConfig(input: {
  kind: 'roll' | 'sheet';
  widthMm: number;
  heightMm: number;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  pieceBleedMm: number;
  separationHMm: number;
  separationVMm: number;
  allowRotation: boolean;
  substrateLabel: string;
  centerPlacements?: boolean;
  panelizado?: NestingVisualConfig['panelizado'];
  maquina?: NestingVisualConfig['maquina'];
}): NestingVisualConfig {
  const displayMargins = {
    leftMm: Math.max(0, input.margins.leftMm - input.pieceBleedMm),
    rightMm: Math.max(0, input.margins.rightMm - input.pieceBleedMm),
    topMm: Math.max(0, input.margins.topMm - input.pieceBleedMm),
    bottomMm: Math.max(0, input.margins.bottomMm - input.pieceBleedMm),
  };
  const usableWidthMm = Math.max(
    0,
    input.widthMm - input.margins.leftMm - input.margins.rightMm,
  );
  const usableHeightMm = Math.max(
    0,
    input.heightMm - input.margins.topMm - input.margins.bottomMm,
  );
  const printableWidthMm = Math.max(
    0,
    input.widthMm - displayMargins.leftMm - displayMargins.rightMm,
  );
  const printableHeightMm = Math.max(
    0,
    input.heightMm - displayMargins.topMm - displayMargins.bottomMm,
  );
  return {
    margins: displayMargins,
    spacing: {
      horizontalMm: input.separationHMm,
      verticalMm: input.separationVMm,
    },
    pieceBleedMm: input.pieceBleedMm,
    allowRotation: input.allowRotation,
    substrateLabel: input.substrateLabel,
    centerPlacements: input.centerPlacements,
    panelizado: input.panelizado,
    maquina: input.maquina,
    usableArea: {
      xMm: input.margins.leftMm,
      yMm: input.margins.topMm,
      widthMm: usableWidthMm,
      heightMm: usableHeightMm,
    },
    printableArea: {
      xMm: displayMargins.leftMm,
      yMm: displayMargins.topMm,
      widthMm: printableWidthMm,
      heightMm: printableHeightMm,
    },
  };
}

function shouldCenterPlacementsForPaso(paso: PasoCargado) {
  // El centrado en el pliego es de la impresión digital sobre pliego
  // (estrategia declarada) cuando la máquina es láser. [Etapa F2]
  return (
    estrategiaNestingDeFamilia(paso.familiaCodigo) === 'pliego_digital' &&
    paso.maquina?.plantilla?.toLowerCase() === 'impresora_laser'
  );
}

function getPiezasParaNesting(jobContext: JobContext) {
  if (jobContext.piezas && jobContext.piezas.length > 0) {
    return jobContext.piezas;
  }
  if (jobContext.medidaCustomMm) {
    return [
      {
        cantidad: Number(jobContext.cantidad ?? 0),
        anchoMm: jobContext.medidaCustomMm.anchoMm,
        altoMm: jobContext.medidaCustomMm.altoMm,
      },
    ];
  }
  return [];
}

/**
 * Si el paso declara `paramsPaso.modoTalonarioIncompleto` y el JobContext es
 * de talonario (`numerosXTalonario` declarado), aplica el grouping al
 * resultado del nesting base. Sino, devuelve baseResult sin tocar.
 *
 * El param lo lleva el paso que define el armado —el del original—, así que
 * es ese el que publica las pilas que después usa el abrochado para contar
 * broches. El duplicado y el triplicado calculan sus pliegos sin tocarlas.
 */
function aplicarTalonarioGroupingSiCorresponde(
  baseResult: NestingDispatchResult,
  paso: PasoCargado,
  jobContext: JobContext,
): NestingDispatchResult {
  const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
  const modo = params.modoTalonarioIncompleto;
  if (modo !== 'aprovechar_pliego' && modo !== 'pose_completa') {
    return baseResult; // no es talonario
  }
  const numerosXTalonario = Number(jobContext.numerosXTalonario ?? 0);
  if (!numerosXTalonario || numerosXTalonario <= 0) {
    return baseResult; // sin info de hojas por talonario, no aplica
  }
  const piezasPorPliego = baseResult.piezasPorPliego ?? 0;
  if (piezasPorPliego <= 0) {
    return baseResult; // sin nesting, no se puede calcular grouping
  }
  const cantidadTalonarios = Number(jobContext.cantidad ?? 0);
  if (!cantidadTalonarios || cantidadTalonarios <= 0) {
    return baseResult;
  }

  const grouping = calculateTalonarioGrouping({
    cantidadTalonarios,
    posesXPliego: piezasPorPliego,
    numerosXTalonario,
    modoTalonarioIncompleto: modo,
  });

  // Sobrescribir la cantidad por la real con grouping (pliegosXCapa).
  // baseResult.cantidadCalculada antes era ceil(cantidad/piezasPorPliego);
  // ahora es pliegosXCapa que considera el residuo + modo del modelador.
  return {
    ...baseResult,
    cantidadCalculada: grouping.pliegosXCapa,
    talonarioGrouping: grouping,
    ...buildTalonarioVisualPatch(baseResult, grouping, jobContext),
  };
}

/**
 * Reconstruye la parte visual del nesting (substrates + placements +
 * aprovechamiento) para que el dibujo muestre cómo se cotizó realmente el
 * talonario, en vez de la imposición base (que ignora el grouping):
 *  - Los grupos completos van como pliegos llenos (P poses).
 *  - El residuo va como un sustrato aparte: con `pose_completa` muestra las
 *    poses usadas y el espacio vacío (desperdicio); con `aprovechar_pliego`
 *    los pliegos del residuo también van llenos (comparten números), salvo
 *    el último si sobran poses.
 * Devuelve {} (sin tocar el visual base) si falta información de geometría.
 */
function buildTalonarioVisualPatch(
  baseResult: NestingDispatchResult,
  grouping: ReturnType<typeof calculateTalonarioGrouping>,
  jobContext: JobContext,
): Partial<NestingDispatchResult> {
  const sheet = baseResult.substrates[0];
  if (!sheet || sheet.kind !== 'sheet') return {};
  const P = grouping.posesXPliego;
  const N = grouping.numerosXTalonario;
  if (P <= 0 || grouping.pliegosXCapa <= 0) return {};

  // Layout de un pliego lleno (P poses). El base solo trae min(cantidad, P)
  // poses; si faltan, lo regeneramos con la misma geometría.
  let fullPlacements = baseResult.placements.filter(
    (p) => (p.substrateIndex ?? 0) === 0,
  );
  if (fullPlacements.length !== P) {
    const vc = baseResult.visualConfig;
    const pieza = getPiezasParaNesting(jobContext)[0];
    if (!vc || !pieza) return {};
    const layout = buildSingleSizeMixedLayout({
      pieceId: 'pieza_0',
      pieceWidthMm: pieza.anchoMm,
      pieceHeightMm: pieza.altoMm,
      quantity: P,
      substrateWidthMm: sheet.widthMm,
      substrateHeightMm: sheet.heightMm,
      margins: vc.margins,
      separationHMm: vc.spacing.horizontalMm,
      separationVMm: vc.spacing.verticalMm,
      allowRotation: vc.allowRotation,
    });
    if (!layout || layout.placements.length < P) return {};
    fullPlacements = layout.placements;
  }

  // Bloques de pliegos homogéneos: cuántos pliegos y cuántas poses usa cada uno.
  const bloques: Array<{ count: number; poses: number }> = [];
  const pliegosGrupos = grouping.gruposCompletos * N;
  if (grouping.talonariosResiduo === 0) {
    bloques.push({ count: grouping.pliegosXCapa, poses: P });
  } else if (grouping.modoIncompleto === 'pose_completa') {
    if (pliegosGrupos > 0) bloques.push({ count: pliegosGrupos, poses: P });
    bloques.push({ count: N, poses: grouping.talonariosResiduo });
  } else {
    const pliegosResiduo = grouping.pliegosXCapa - pliegosGrupos;
    const llenos =
      pliegosGrupos +
      (grouping.posesDesperdicio > 0 ? pliegosResiduo - 1 : pliegosResiduo);
    if (llenos > 0) bloques.push({ count: llenos, poses: P });
    if (grouping.posesDesperdicio > 0) {
      bloques.push({ count: 1, poses: P - grouping.posesDesperdicio });
    }
  }

  const substrates = bloques.map((b) => ({
    kind: 'sheet' as const,
    count: b.count,
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
  }));
  const placements = bloques.flatMap((b, idx) =>
    fullPlacements.slice(0, b.poses).map((p, i) => ({
      ...p,
      pieceId: `pose_${idx}_${i}`,
      substrateIndex: idx,
    })),
  );

  // Aprovechamiento real: descuenta las poses vacías del desperdicio.
  const posesUsadas = grouping.pliegosXCapa * P - grouping.posesDesperdicio;
  const piezaW = fullPlacements[0].widthMm;
  const piezaH = fullPlacements[0].heightMm;
  const areaUtilMm2 = posesUsadas * piezaW * piezaH;
  const areaTotalMm2 = grouping.pliegosXCapa * sheet.widthMm * sheet.heightMm;

  return {
    substrates,
    placements,
    piezasAcomodadas: posesUsadas,
    aprovechamientoPct:
      areaTotalMm2 > 0
        ? Math.round((areaUtilMm2 / areaTotalMm2) * 10000) / 100
        : baseResult.aprovechamientoPct,
    metricasRaw: {
      ...baseResult.metricasRaw,
      areaUtilMm2,
      areaTotalMm2,
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function readNumber(
  json: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!json) return null;
  const v = json[key];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveNumberFromRecord(
  record: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}
