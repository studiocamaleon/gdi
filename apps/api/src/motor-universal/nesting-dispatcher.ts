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
import { normalizeGranFormatoPanelManualLayout } from '../productos-servicios/nesting/helpers/granformato-pieces';
import { evaluateGranFormatoMaxRectsRollLayout } from '../productos-servicios/nesting/algorithms/maxrects-rollo';
import { evaluateGranFormatoSequentialRollLayout } from '../productos-servicios/nesting/algorithms/secuencial-rollo';
import { nestGrid2DSingle } from '../productos-servicios/nesting/algorithms/grid-2d-single';
import {
  estrategiaNestingDeFamilia,
  fuentePiezasNestingDeFamilia,
  herramientasCotizacionEfectivas,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import { nestGrid2DMulti } from '../productos-servicios/nesting/algorithms/grid-2d-multi';
import {
  calculateTalonarioGrouping,
  type TalonarioGroupingResult,
} from '../productos-servicios/nesting/helpers/talonario-grouping';
import { calculateSustratoToPliegoConversion } from '../productos-servicios/nesting/helpers/sustrato-to-pliego';
import {
  consumedLengthAlongPlateLongAxis,
  resolvePlateAxes,
} from '../productos-servicios/nesting/helpers/plate-axis';
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
import type {
  PasoCargado,
  JobContext,
  LayoutProduccionCompartido,
  NestingVisualConfig,
} from './tipos';
import {
  nestearGeometriaIrregular,
  NestingIrregularError,
} from './geometria-vectorial/nesting-irregular';
import {
  marcarNestingVectorialReutilizado,
  obtenerCacheVectorial,
} from './geometria-vectorial/geometria-vectorial-cache.service';

/**
 * Resultado del dispatcher con TODO lo que el motor + viewer necesitan.
 */
export interface NestingDispatchResult {
  algorithm:
    | 'shelf-rollo'
    | 'maxrects-rollo'
    | 'secuencial-rollo'
    | 'grid-2d-single'
    | 'grid-2d-multi'
    | 'irregular-2d-bottom-left-v1';
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
  /**
   * Recorrido productivo real de la máquina. Puede diferir del material
   * consumido: una laminadora doble usa dos largos de film simultáneamente,
   * pero recorre el trabajo una sola vez.
   */
  machineRunLengthMm?: number;
  /** Cantidad de instancias de pieza efectivamente acomodadas. */
  piezasAcomodadas: number;
  /**
   * F4.4.1 — demanda física exacta que originó un nesting rectangular.
   * El modo sombra la usa para reagrupar piezas de componentes distintos sin
   * inferir cantidades desde una vista previa ni alterar el resultado actual.
   */
  demandaRectangular?: Array<{
    pieceId: string;
    cantidad: number;
    anchoMm: number;
    altoMm: number;
  }>;
  /** Política efectiva aplicada al vector completo. */
  estrategiaDisposicion?: 'composicion_original' | 'nesting_optimizado';
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
  /** Metadatos canónicos de la materia prima padre. La subfamilia describe qué
   *  material es; plantilla/unidad/atributos completan cómo se suministra. */
  subfamilia?: string | null;
  materiaPrimaTemplateId?: string | null;
  materiaPrimaTipoTecnico?: string | null;
  unidadStock?: string | null;
}

type SenalFormatoMaterial =
  | string
  | Pick<
      MaterialResueltoParaNesting,
      | 'subfamilia'
      | 'materiaPrimaTemplateId'
      | 'materiaPrimaTipoTecnico'
      | 'unidadStock'
      | 'atributosVarianteJson'
    >
  | null
  | undefined;

const SUBFAMILIAS_ROLLO = new Set([
  'SUSTRATO_ROLLO_FLEXIBLE',
  'VINILO_CORTE',
  'LAMINADO_FILM',
]);

const SUBFAMILIAS_PLANAS = new Set([
  'SUSTRATO_HOJA',
  'SUSTRATO_RIGIDO',
  'LAMINADO_POUCH',
]);

function textoFormato(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function numeroPositivo(value: unknown): boolean {
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0;
}

export type FormatoFisicoMaterial = 'rollo' | 'plano' | 'desconocido';

/**
 * ¿El material se suministra como rollo?
 *
 * La subfamilia no alcanza: `IMAN_CERAMICO_FLEXIBLE`, por ejemplo, agrupa
 * tanto imanes flexibles en rollo como piezas cerámicas unitarias. Por eso se
 * resuelve el formato con señales canónicas ya presentes en el material:
 * subfamilias inequívocas primero y, para las ambiguas, plantilla/tipo,
 * unidad de stock y dimensiones propias de rollo.
 *
 * Se mantiene el string como entrada por compatibilidad con callers viejos;
 * los caminos productivos deben pasar el material completo.
 */
export function resolverFormatoFisicoMaterial(
  material: SenalFormatoMaterial,
): FormatoFisicoMaterial {
  const subfamilia =
    typeof material === 'string'
      ? textoFormato(material)
      : textoFormato(material?.subfamilia);
  if (SUBFAMILIAS_ROLLO.has(subfamilia)) return 'rollo';
  if (SUBFAMILIAS_PLANAS.has(subfamilia)) return 'plano';
  if (!material || typeof material === 'string') {
    return subfamilia ? 'plano' : 'desconocido';
  }

  const templateId = textoFormato(material.materiaPrimaTemplateId);
  const tipoTecnico = textoFormato(material.materiaPrimaTipoTecnico);
  const unidadStock = textoFormato(material.unidadStock);
  const attrs = material.atributosVarianteJson ?? {};
  const tieneAncho = numeroPositivo(attrs.anchoMm ?? attrs.widthMm);
  const tieneLargoRollo = numeroPositivo(
    attrs.largoRolloMm ?? attrs.longitudRolloMm,
  );
  const metadataDeclaraRollo =
    templateId.includes('ROLLO') || tipoTecnico.includes('ROLLO');
  const unidadDeclaraRollo =
    unidadStock === 'ROLLO' || unidadStock === 'METRO_LINEAL';

  // La combinación evita convertir perfiles/cables vendidos por metro en
  // sustratos de rollo: además de la unidad o plantilla debe existir la
  // geometría física ancho + largo de rollo.
  if (
    tieneAncho &&
    tieneLargoRollo &&
    (metadataDeclaraRollo || unidadDeclaraRollo)
  ) {
    return 'rollo';
  }
  return subfamilia ? 'plano' : 'desconocido';
}

export function esSustratoRollo(material: SenalFormatoMaterial): boolean {
  return resolverFormatoFisicoMaterial(material) === 'rollo';
}

/**
 * El corte va sobre HOJA/placa cuando el material cargado NO es un rollo. Sin
 * material (heredado) o con material de rollo → corre sobre rollo (default).
 * Reemplaza al `modoOperacion` del perfil: el formato (rollo vs hoja) lo dice
 * el material, no una bandera estática del perfil.
 */
export function esCorteSobreHojas(material: SenalFormatoMaterial): boolean {
  return resolverFormatoFisicoMaterial(material) === 'plano';
}

/**
 * Corte HEREDADO de una cadena de pliegos (papel impreso): lo que se monta en
 * el plotter son los PLIEGOS ya impresos, no piezas sueltas sobre un rollo.
 * El acomodo lo decidió la impresión por hoja — acá no se nestea nada y la
 * medida del trabajo es el pliego. Las claves de pliego sólo las publica la
 * cadena por hoja (la impresión por área/rollo no), así que la señal separa
 * limpio papel-en-pliegos de vinilo-en-rollo.
 */
export function hayPliegosImpresosHeredados(jobContext: JobContext): boolean {
  const ctx = jobContext as unknown as Record<string, unknown>;
  const pliegos = Number(ctx.pliegos_impresos ?? ctx.pliegos_calculados ?? 0);
  const anchoMm = Number(ctx.pliego_impresion_ancho_mm ?? 0);
  const altoMm = Number(ctx.pliego_impresion_alto_mm ?? 0);
  return pliegos > 0 && anchoMm > 0 && altoMm > 0;
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
  if (!resultado || !geometriaDispatchValida(resultado)) return null;
  // El agrupamiento de talonario es post-nesting. El original declara el modo
  // y las capas siguientes lo heredan para repetir la misma tirada.
  const final = aplicarTalonarioGroupingSiCorresponde(
    resultado,
    paso,
    jobContext,
  );
  return adjuntarDemandaRectangular(final, paso, jobContext);
}

function adjuntarDemandaRectangular(
  result: NestingDispatchResult,
  paso: PasoCargado,
  jobContext: JobContext,
): NestingDispatchResult {
  if (
    result.unidad !== 'pliegos' ||
    !['grid-2d-single', 'grid-2d-multi'].includes(result.algorithm) ||
    result.talonarioGrouping ||
    result.imposicionCuadernillo
  ) {
    return result;
  }

  const estrategia = resolverFamilia(paso.familiaCodigo)?.nestingConfig
    ?.estrategia;
  if (estrategia === 'pliego_digital') {
    const piezas = getPiezasParaNesting(jobContext)
      .map((pieza, index) => ({
        pieceId: pieza.sourcePieceId ?? `pieza_${index}`,
        cantidad: Math.ceil(Number(pieza.cantidad)),
        anchoMm: Number(pieza.anchoMm),
        altoMm: Number(pieza.altoMm),
      }))
      .filter(
        (pieza) => pieza.cantidad > 0 && pieza.anchoMm > 0 && pieza.altoMm > 0,
      );
    return piezas.length > 0
      ? { ...result, demandaRectangular: piezas }
      : result;
  }

  // Los caminos genéricos y de montaje materializan un placement por pieza
  // realmente pedida. Reconstruir desde ellos también preserva paneles y
  // geometrías derivadas por pasos anteriores.
  const agrupadas = new Map<
    string,
    {
      pieceId: string;
      cantidad: number;
      anchoMm: number;
      altoMm: number;
    }
  >();
  for (const placement of result.placements) {
    const anchoMm = placement.rotated ? placement.heightMm : placement.widthMm;
    const altoMm = placement.rotated ? placement.widthMm : placement.heightMm;
    const key = `${placement.pieceId}:${anchoMm}:${altoMm}`;
    const actual = agrupadas.get(key);
    if (actual) actual.cantidad += 1;
    else {
      agrupadas.set(key, {
        pieceId: placement.pieceId,
        cantidad: 1,
        anchoMm,
        altoMm,
      });
    }
  }
  return agrupadas.size > 0
    ? { ...result, demandaRectangular: [...agrupadas.values()] }
    : result;
}

/** Última barrera común: ningún algoritmo puede publicar piezas fuera del
 * material, superpuestas o con números no finitos.
 *
 * En geometría irregular los rectángulos envolventes sí pueden superponerse:
 * justamente eso permite encastrar letras y logos. En ese caso la colisión de
 * polígonos ya fue validada por el solver y aquí conservamos las verificaciones
 * comunes de índices, límites y valores finitos. */
export function geometriaDispatchValida(
  result: NestingDispatchResult,
): boolean {
  if (
    !Number.isFinite(result.cantidadCalculada) ||
    result.cantidadCalculada <= 0 ||
    !Number.isFinite(result.aprovechamientoPct) ||
    result.aprovechamientoPct < 0 ||
    result.aprovechamientoPct > 100.01
  ) {
    return false;
  }
  const porSustrato = new Map<number, Placement[]>();
  for (const placement of result.placements) {
    const substrateIndex = placement.substrateIndex ?? 0;
    if (
      !Number.isInteger(substrateIndex) ||
      substrateIndex < 0 ||
      substrateIndex >= result.substrates.length
    ) {
      return false;
    }
    const substrate = result.substrates[substrateIndex];
    if (!substrate) return false;
    const heightMm =
      substrate.kind === 'sheet' ? substrate.heightMm : substrate.lengthMm;
    const values = [
      placement.xMm,
      placement.yMm,
      placement.widthMm,
      placement.heightMm,
    ];
    if (
      values.some((value) => !Number.isFinite(value)) ||
      placement.widthMm <= 0 ||
      placement.heightMm <= 0
    ) {
      return false;
    }
    const epsilon = 0.01;
    if (
      placement.xMm < -epsilon ||
      placement.yMm < -epsilon ||
      placement.xMm + placement.widthMm > substrate.widthMm + epsilon ||
      placement.yMm + placement.heightMm > heightMm + epsilon
    ) {
      return false;
    }
    const group = porSustrato.get(substrateIndex) ?? [];
    group.push(placement);
    porSustrato.set(substrateIndex, group);
  }

  if (result.algorithm === 'irregular-2d-bottom-left-v1') return true;

  // Barrido por X: exacto para resultados rectangulares. El límite evita que una
  // validación defensiva vuelva a bloquear el API en tiradas masivas.
  for (const placements of porSustrato.values()) {
    if (placements.length > 5_000) continue;
    const sorted = [...placements].sort((a, b) => a.xMm - b.xMm);
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentRight = current.xMm + current.widthMm;
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        if (next.xMm >= currentRight - 0.01) break;
        const overlapY =
          current.yMm < next.yMm + next.heightMm - 0.01 &&
          next.yMm < current.yMm + current.heightMm - 0.01;
        if (overlapY) return false;
      }
    }
  }
  return true;
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
  /** Contornos SVG normalizados por el servidor sobre una placa finita. */
  irregular_placa: (paso, jobContext, materialResuelto, config) =>
    herramientasCotizacionEfectivas(
      paso.familiaCodigo,
      paso.paramsPasoJson,
    ).includes('diseno_vectorial')
      ? runIrregularPlaca(jobContext, materialResuelto, config)
      : null,

  /** Corte sobre rollo: shelf sin panelizado. Si el material cargado es hoja/
   *  placa (no rollo) no acomoda en rollo — el formato lo dice el material. */
  corte_rollo: (paso, jobContext, materialResuelto, config) => {
    if (esCorteSobreHojas(materialResuelto)) {
      return null;
    }
    // Heredado de una cadena de PLIEGOS (papel impreso): al plotter se montan
    // los pliegos enteros — el acomodo ya lo decidió la impresión por hoja.
    // Nestear las piezas sobre el ancho de la máquina inventaría un rollo que
    // no existe. La cantidad cae al fallback m2_crudos (m² de pliegos).
    if (!materialResuelto && hayPliegosImpresosHeredados(jobContext)) {
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

// ────────────────────────────────────────────────────────────────────
// Implementaciones
// ────────────────────────────────────────────────────────────────────

function leerLayoutProduccionCompartido(
  jobContext: JobContext,
): LayoutProduccionCompartido | null {
  const layout = jobContext.layout_produccion;
  if (
    !layout ||
    layout.schemaVersion !== 1 ||
    layout.sourceFamiliaCodigo !== 'impresion_por_area' ||
    !Array.isArray(layout.substrates) ||
    layout.substrates.length === 0 ||
    !layout.substrates.every((substrate) => substrate.kind === 'sheet') ||
    !Array.isArray(layout.placements) ||
    layout.placements.length === 0
  ) {
    return null;
  }
  return layout;
}

/** Aplica los contornos del SVG sobre las cajas que ya imprimió el paso
 * anterior. No vuelve a empacar: la coincidencia física tiene prioridad sobre
 * cualquier mejora de aprovechamiento del láser. */
function aplicarGeometriaVectorialAlLayoutCompartido(
  jobContext: JobContext,
  layout: LayoutProduccionCompartido,
  config: NestingConfigResolved,
  materialResuelto: MaterialResueltoParaNesting,
): NestingDispatchResult {
  const geometria = jobContext.geometriaVectorial!;
  const substratesOriginales = layout.substrates.filter(
    (substrate): substrate is Extract<SubstrateUsage, { kind: 'sheet' }> =>
      substrate.kind === 'sheet',
  );
  const primeraPlaca = substratesOriginales[0];
  const todasIguales = substratesOriginales.every(
    (substrate) =>
      casiIgual(substrate.widthMm, primeraPlaca.widthMm) &&
      casiIgual(substrate.heightMm, primeraPlaca.heightMm),
  );
  if (!todasIguales) {
    throw new NestingIrregularError(
      'La impresión publicó placas de medidas diferentes; el corte láser no puede conservar un único sistema de registro.',
    );
  }

  const coincideMaterial =
    (casiIgual(primeraPlaca.widthMm, config.sheetWidthMm ?? 0) &&
      casiIgual(primeraPlaca.heightMm, config.sheetHeightMm ?? 0)) ||
    (casiIgual(primeraPlaca.widthMm, config.sheetHeightMm ?? 0) &&
      casiIgual(primeraPlaca.heightMm, config.sheetWidthMm ?? 0));
  if (
    layout.materialVarianteId &&
    layout.materialVarianteId !== materialResuelto.id
  ) {
    throw new NestingIrregularError(
      'El corte láser resolvió un material distinto del que se utilizó para imprimir el layout.',
    );
  }
  if (!coincideMaterial) {
    throw new NestingIrregularError(
      `El layout impreso usa placas de ${primeraPlaca.widthMm} × ${primeraPlaca.heightMm} mm, pero el corte resolvió una placa diferente (${config.sheetWidthMm ?? '?'} × ${config.sheetHeightMm ?? '?'} mm).`,
    );
  }

  const camaAncho = config.machineBedWidthMm;
  const camaAlto = config.machineBedHeightMm;
  const entraDirecta =
    camaAncho == null ||
    camaAlto == null ||
    (primeraPlaca.widthMm <= camaAncho + 0.01 &&
      primeraPlaca.heightMm <= camaAlto + 0.01);
  const entraRotada =
    camaAncho != null &&
    camaAlto != null &&
    primeraPlaca.heightMm <= camaAncho + 0.01 &&
    primeraPlaca.widthMm <= camaAlto + 0.01;
  if (!entraDirecta && !entraRotada) {
    throw new NestingIrregularError(
      `La placa impresa de ${primeraPlaca.widthMm} × ${primeraPlaca.heightMm} mm no entra en el área útil del láser (${camaAncho} × ${camaAlto} mm), ni siquiera rotada.`,
    );
  }
  // La placa puede necesitar girarse físicamente para entrar en la cama, pero
  // el archivo y el visor conservan SIEMPRE las coordenadas de impresión. Si
  // rotáramos el sistema de coordenadas acá, ambos procesos registrarían en
  // producción pero se verían orientados distinto y los archivos dejarían de
  // compartir el mismo origen visual.
  const requiereRotacionFisicaEnMaquina = !entraDirecta && entraRotada;

  const piezasPorId = new Map(
    geometria.piezas.map((pieza) => [pieza.id, pieza] as const),
  );
  const copiasPorPieza = new Map<string, number>();
  const areaPorPlaca = Array.from(
    { length: substratesOriginales.length },
    () => 0,
  );
  let perimetroCorteMm = 0;

  const placements: Placement[] = layout.placements.map((placement) => {
    const pieza =
      piezasPorId.get(placement.pieceId) ??
      resolverPiezaPorIdGrid(placement.pieceId, geometria.piezas);
    if (!pieza) {
      throw new NestingIrregularError(
        `El layout de impresión contiene la pieza "${placement.pieceId}", pero no existe en el SVG de corte.`,
      );
    }
    const dimensionesCoinciden = placement.rotated
      ? casiIgual(placement.widthMm, pieza.altoMm) &&
        casiIgual(placement.heightMm, pieza.anchoMm)
      : casiIgual(placement.widthMm, pieza.anchoMm) &&
        casiIgual(placement.heightMm, pieza.altoMm);
    if (!dimensionesCoinciden) {
      throw new NestingIrregularError(
        `La pieza "${pieza.id}" no tiene la misma escala en impresión y corte.`,
      );
    }

    const transformarPunto = (punto: { x: number; y: number }) => {
      const sobrePlaca = placement.rotated
        ? {
            x: placement.xMm + pieza.altoMm - punto.y,
            y: placement.yMm + punto.x,
          }
        : {
            x: placement.xMm + punto.x,
            y: placement.yMm + punto.y,
          };
      return sobrePlaca;
    };
    const transformarContornos = (
      contornos: typeof pieza.contornos,
    ): typeof pieza.contornos =>
      contornos.map((contorno) => ({
        ...contorno,
        puntos: contorno.puntos.map(transformarPunto),
      }));
    const contornos = transformarContornos(pieza.contornos);
    const cortesInternos = transformarContornos(pieza.cortesInternos ?? []);
    const puntos = [...contornos, ...cortesInternos].flatMap(
      (contorno) => contorno.puntos,
    );
    const minX = Math.min(...puntos.map((punto) => punto.x));
    const minY = Math.min(...puntos.map((punto) => punto.y));
    const maxX = Math.max(...puntos.map((punto) => punto.x));
    const maxY = Math.max(...puntos.map((punto) => punto.y));
    const substrateIndex = placement.substrateIndex ?? 0;
    if (areaPorPlaca[substrateIndex] === undefined) {
      throw new NestingIrregularError(
        'El layout de impresión referencia una placa inexistente.',
      );
    }
    areaPorPlaca[substrateIndex] += pieza.areaMm2;
    perimetroCorteMm += pieza.perimetroMm;
    const copyIndex = copiasPorPieza.get(pieza.id) ?? 0;
    copiasPorPieza.set(pieza.id, copyIndex + 1);
    return {
      pieceId: pieza.id,
      substrateIndex,
      xMm: redondearCoordenada(minX),
      yMm: redondearCoordenada(minY),
      widthMm: redondearCoordenada(maxX - minX),
      heightMm: redondearCoordenada(maxY - minY),
      rotated: placement.rotated,
      meta: {
        contornos,
        cortesInternos,
        copyIndex,
        rotacionGrados: (placement.rotated ? 90 : 0) % 360,
        layoutHeredadoDe: layout.sourceRutaPasoId,
        requiereRotacionFisicaEnMaquina,
        label: pieza.id,
      },
    };
  });

  const substrates: SubstrateUsage[] = substratesOriginales.map(
    (substrate) => ({
      kind: 'sheet',
      count: substrate.count,
      widthMm: substrate.widthMm,
      heightMm: substrate.heightMm,
    }),
  );
  const areaCompradaMm2 = substrates.reduce(
    (total, substrate) =>
      total +
      (substrate.kind === 'sheet'
        ? substrate.widthMm * substrate.heightMm * substrate.count
        : 0),
    0,
  );
  const areaPiezasMm2 = areaPorPlaca.reduce((total, area) => total + area, 0);
  jobContext.piezaPerimetroTotalM = perimetroCorteMm / 1_000;
  const aprovechamientoPct =
    areaCompradaMm2 > 0 ? (areaPiezasMm2 / areaCompradaMm2) * 100 : 0;

  return {
    algorithm: 'irregular-2d-bottom-left-v1',
    cantidadCalculada: substrates.length,
    unidad: 'pliegos',
    aprovechamientoPct,
    substrates,
    placements,
    metricasRaw: {
      aprovechamientoPct,
      areaUtilMm2: areaPiezasMm2,
      areaTotalMm2: areaCompradaMm2,
      perSubstrate: areaPorPlaca.map((areaUtilMm2) => ({
        areaUtilMm2,
        consumedLengthMm: primeraPlaca.heightMm,
      })),
      perimetroCorteMm,
      piezasOriginales: placements.length,
      segmentos: placements.length,
      unionesFisicas: 0,
      layoutHeredadoDeImpresion: true,
      placaRequiereRotacionEnMaquina: requiereRotacionFisicaEnMaquina,
      sourceRutaPasoId: layout.sourceRutaPasoId,
    },
    piezasAcomodadas: placements.length,
    estrategiaDisposicion: 'nesting_optimizado',
    visualConfig: transformarVisualConfigCompartida(
      layout.visualConfig,
      requiereRotacionFisicaEnMaquina,
    ),
  };
}

function resolverPiezaPorIdGrid(
  pieceId: string,
  piezas: NonNullable<JobContext['geometriaVectorial']>['piezas'],
) {
  const match = /^pieza_(\d+)$/.exec(pieceId);
  return match ? (piezas[Number(match[1])] ?? null) : null;
}

function casiIgual(a: number, b: number, toleranciaMm = 0.05) {
  return Math.abs(a - b) <= toleranciaMm;
}

function redondearCoordenada(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function transformarVisualConfigCompartida(
  visual: NestingVisualConfig | undefined,
  requiereRotacionFisicaEnMaquina: boolean,
): NestingVisualConfig | undefined {
  if (!visual) return undefined;
  return {
    ...visual,
    allowRotation: false,
    substrateLabel: requiereRotacionFisicaEnMaquina
      ? 'Placa impresa · girar 90° al cargar en el láser'
      : 'Placa impresa',
    maquina: undefined,
  };
}

function runIrregularPlaca(
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  if (!materialResuelto || !config.sheetWidthMm || !config.sheetHeightMm) {
    return null;
  }
  if (config.machineBedWidthMm && config.machineBedHeightMm) {
    const entraSinRotar =
      config.sheetWidthMm <= config.machineBedWidthMm &&
      config.sheetHeightMm <= config.machineBedHeightMm;
    const entraRotada =
      config.sheetWidthMm <= config.machineBedHeightMm &&
      config.sheetHeightMm <= config.machineBedWidthMm;
    if (!entraSinRotar && !entraRotada) {
      throw new NestingIrregularError(
        `La placa de ${config.sheetWidthMm} × ${config.sheetHeightMm} mm supera el área útil de la máquina (${config.machineBedWidthMm} × ${config.machineBedHeightMm} mm).`,
      );
    }
  }
  const layoutCompartido = leerLayoutProduccionCompartido(jobContext);
  if (layoutCompartido && jobContext.geometriaVectorial) {
    return aplicarGeometriaVectorialAlLayoutCompartido(
      jobContext,
      layoutCompartido,
      config,
      materialResuelto,
    );
  }
  const placasManuales = Number(jobContext.placasVectorialesManuales ?? 0);
  const metrosCortePorPlaca = Number(
    jobContext.metrosCortePorPlacaVectorial ?? 0,
  );
  if (placasManuales > 0 && metrosCortePorPlaca > 0) {
    const placas = Math.ceil(placasManuales);
    const areaPorPlacaMm2 = config.sheetWidthMm * config.sheetHeightMm;
    const perimetroCorteMm = placas * metrosCortePorPlaca * 1_000;
    jobContext.piezaAreaTotalM2 = (areaPorPlacaMm2 * placas) / 1_000_000;
    jobContext.piezaPerimetroTotalM = perimetroCorteMm / 1_000;
    jobContext.piezaAnchoMaxMm = config.sheetWidthMm;
    jobContext.piezaAltoMaxMm = config.sheetHeightMm;
    return {
      algorithm: 'irregular-2d-bottom-left-v1',
      cantidadCalculada: placas,
      unidad: 'pliegos',
      aprovechamientoPct: 100,
      substrates: [
        {
          kind: 'sheet',
          count: placas,
          widthMm: config.sheetWidthMm,
          heightMm: config.sheetHeightMm,
        },
      ],
      placements: [],
      metricasRaw: {
        aprovechamientoPct: 100,
        areaUtilMm2: areaPorPlacaMm2 * placas,
        areaTotalMm2: areaPorPlacaMm2 * placas,
        perSubstrate: Array.from({ length: placas }, () => ({
          areaUtilMm2: areaPorPlacaMm2,
          consumedLengthMm: config.sheetHeightMm!,
        })),
        perimetroCorteMm,
      },
      piezasAcomodadas: 0,
    };
  }
  if (!jobContext.geometriaVectorial) return null;
  const margenUniforme = Math.max(
    config.margins.leftMm,
    config.margins.rightMm,
    config.margins.topMm,
    config.margins.bottomMm,
  );
  const separacionUniforme = Math.max(
    config.separationHMm,
    config.separationVMm,
  );
  try {
    const cached = obtenerCacheVectorial(jobContext);
    const cacheMatches =
      cached?.analisis.geometria.hashFuente ===
        jobContext.geometriaVectorial.hashFuente &&
      cached.parametros.cantidad === jobContext.cantidad &&
      cached.parametros.anchoPlacaMm === config.sheetWidthMm &&
      cached.parametros.altoPlacaMm === config.sheetHeightMm &&
      cached.parametros.margenMm === margenUniforme &&
      cached.parametros.separacionMm === separacionUniforme &&
      cached.parametros.permitirRotacion === config.allowRotation &&
      cached.parametros.permitirSegmentacion ===
        config.permitirSegmentacionVectorial &&
      cached.parametros.preservarComposicionOriginalSiEntra ===
        config.preservarComposicionOriginalSiEntra &&
      JSON.stringify(cached.parametros.configuracionEncastres) ===
        JSON.stringify(config.configuracionEncastres);
    if (cacheMatches) marcarNestingVectorialReutilizado(jobContext);
    const result =
      cacheMatches && cached
        ? cached.nesting
        : nestearGeometriaIrregular({
            geometria: jobContext.geometriaVectorial,
            cantidad: jobContext.cantidad,
            anchoPlacaMm: config.sheetWidthMm,
            altoPlacaMm: config.sheetHeightMm,
            margenMm: margenUniforme,
            separacionMm: separacionUniforme,
            permitirRotacion: config.allowRotation,
            permitirSegmentacion: config.permitirSegmentacionVectorial,
            preservarComposicionOriginalSiEntra:
              config.preservarComposicionOriginalSiEntra,
            configuracionEncastres: config.configuracionEncastres,
          });
    const substrates: SubstrateUsage[] = Array.from(
      { length: result.placas },
      () => ({
        kind: 'sheet' as const,
        count: 1,
        widthMm: result.anchoPlacaMm,
        heightMm: result.altoPlacaMm,
      }),
    );
    const perSubstrate = substrates.map((_, index) => ({
      areaUtilMm2: result.placements
        .filter((placement) => placement.substrateIndex === index)
        .reduce((sum, placement) => {
          const areaPlacement = areaContornosVectoriales(placement.contornos);
          return sum + areaPlacement;
        }, 0),
      consumedLengthMm: result.altoPlacaMm,
    }));
    // El corte real incluye las nuevas fronteras creadas por la división. Se
    // publica antes de calcular el tiempo del paso para que el hilo caliente
    // y la mano de obra coticen el trabajo efectivo, no el perímetro original.
    jobContext.piezaPerimetroTotalM = result.perimetroCorteMm / 1_000;
    jobContext.unionesVectoriales = result.unionesFisicas;
    jobContext.encastresVectoriales =
      result.uniones.reduce(
        (total, union) => total + union.cantidadEncastres,
        0,
      ) * jobContext.cantidad;
    return {
      algorithm: result.algorithm,
      cantidadCalculada: result.placas,
      unidad: 'pliegos',
      aprovechamientoPct: result.aprovechamientoPct,
      substrates,
      placements: result.placements.map((placement) => ({
        pieceId: placement.pieceId,
        substrateIndex: placement.substrateIndex,
        xMm: placement.xMm,
        yMm: placement.yMm,
        widthMm: placement.anchoMm,
        heightMm: placement.altoMm,
        rotated: placement.rotacion !== 0,
        meta: {
          contornos: placement.contornos,
          cortesInternos: placement.cortesInternos,
          rotacionGrados: placement.rotacion,
          segmentacion: placement.segmentacion,
          label: placement.segmentacion
            ? `${placement.segmentacion.piezaOrigenId} · parte ${placement.segmentacion.indice}/${placement.segmentacion.total}`
            : placement.pieceId,
        },
      })),
      metricasRaw: {
        aprovechamientoPct: result.aprovechamientoPct,
        areaUtilMm2: result.areaPiezasMm2,
        areaTotalMm2: result.areaCompradaMm2,
        perSubstrate,
        perimetroCorteMm: result.perimetroCorteMm,
        piezasOriginales: result.piezasOriginales,
        segmentos: result.segmentos,
        unionesFisicas: result.unionesFisicas,
        uniones: result.uniones,
        configuracionEncastres: config.configuracionEncastres,
        estrategiaDisposicion: result.estrategiaDisposicion,
      },
      piezasAcomodadas: result.placements.length,
      estrategiaDisposicion: result.estrategiaDisposicion,
      visualConfig: {
        margins: {
          leftMm: margenUniforme,
          rightMm: margenUniforme,
          topMm: margenUniforme,
          bottomMm: margenUniforme,
        },
        spacing: {
          horizontalMm: Math.max(config.separationHMm, config.separationVMm),
          verticalMm: Math.max(config.separationHMm, config.separationVMm),
        },
        // La separación evita que dos cortes se toquen; no es demasía ni
        // sangrado de la pieza. Declararlo evita que el visor la infiera como
        // la mitad del gap, una regla válida sólo para layouts impresos legacy.
        pieceBleedMm: 0,
        allowRotation: config.allowRotation,
        usableArea: {
          xMm: margenUniforme,
          yMm: margenUniforme,
          widthMm: result.anchoUtilMm,
          heightMm: result.altoUtilMm,
        },
      },
    };
  } catch (error) {
    // Los errores geométricos esperables (pieza demasiado grande, márgenes que
    // consumen la placa, etc.) permiten que el motor emita su diagnóstico
    // habitual. Un error de programación inesperado no debe quedar oculto.
    if (error instanceof NestingIrregularError) return null;
    throw error;
  }
}

function areaContornosVectoriales(
  contornos: Array<{
    esHueco: boolean;
    puntos: Array<{ x: number; y: number }>;
  }>,
): number {
  return contornos.reduce((total, contorno) => {
    const area = Math.abs(
      contorno.puntos.reduce((sum, punto, index) => {
        const siguiente = contorno.puntos[(index + 1) % contorno.puntos.length];
        return sum + punto.x * siguiente.y - siguiente.x * punto.y;
      }, 0) / 2,
    );
    return total + (contorno.esHueco ? -area : area);
  }, 0);
}

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
  if (esSustratoRollo(materialResuelto)) return 'rollo';
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

  const result = runGrid2DSingleForArea(jobContext, config, 'Pouch', false);
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

  if (
    config.algorithm === 'shelf-rollo' ||
    config.algorithm === 'maxrects-rollo'
  ) {
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

  if (esSustratoRollo(materialResuelto)) {
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
  piezas: NonNullable<JobContext['piezas']>,
  config: NestingConfigResolved,
): NonNullable<JobContext['piezas']> | null {
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
  const eje = config.panelizado.axis;
  const resultado: NonNullable<JobContext['piezas']> = [];

  if (config.panelizado.mode === 'manual') {
    const manual = normalizeGranFormatoPanelManualLayout(
      config.panelizado.manualLayout,
    );
    const cantidadInstancias = piezas.reduce(
      (total, pieza) => total + Math.ceil(pieza.cantidad),
      0,
    );
    if (!manual || manual.items.length !== cantidadInstancias) return null;
    const byId = new Map(
      manual.items.map((item) => [item.sourcePieceId, item]),
    );
    for (const [pieceIndex, pieza] of piezas.entries()) {
      for (
        let copyIndex = 0;
        copyIndex < Math.ceil(pieza.cantidad);
        copyIndex++
      ) {
        const sourcePieceId = `piece-${pieceIndex}-${copyIndex}`;
        const item = byId.get(sourcePieceId);
        if (
          !item ||
          Math.abs(item.pieceWidthMm - pieza.anchoMm) > 1 ||
          Math.abs(item.pieceHeightMm - pieza.altoMm) > 1
        ) {
          return null;
        }
        for (const panel of item.panels) {
          if (!entra(panel.finalWidthMm, panel.finalHeightMm)) return null;
          resultado.push({
            cantidad: 1,
            anchoMm: panel.finalWidthMm,
            altoMm: panel.finalHeightMm,
            sourcePieceId,
            panelIndex: panel.panelIndex,
            panelCount: item.panels.length,
            panelAxis: item.axis,
            usefulWidthMm: panel.usefulWidthMm,
            usefulHeightMm: panel.usefulHeightMm,
            overlapStartMm: panel.overlapStartMm,
            overlapEndMm: panel.overlapEndMm,
          });
        }
      }
    }
    return resultado;
  }

  for (const [pieceIndex, pieza] of piezas.entries()) {
    if (entra(pieza.anchoMm, pieza.altoMm)) {
      resultado.push(pieza);
      continue;
    }
    // Se permiten hasta 64 divisiones por eje. El límite anterior de 8 era
    // demasiado chico para frentes o fondos largos y no estaba documentado.
    const maxDiv = 64;
    let mejor: {
      nx: number;
      ny: number;
      areaFisicaMm2: number;
    } | null = null;
    for (let nx = 1; nx <= (eje === 'horizontal' ? 1 : maxDiv); nx++) {
      for (let ny = 1; ny <= (eje === 'vertical' ? 1 : maxDiv); ny++) {
        const usefulW = pieza.anchoMm / nx;
        const usefulH = pieza.altoMm / ny;
        const paneles = Array.from({ length: nx * ny }, (_, index) => {
          const col = index % nx;
          const row = Math.floor(index / nx);
          const extraW = (col > 0 ? overlap : 0) + (col < nx - 1 ? overlap : 0);
          const extraH = (row > 0 ? overlap : 0) + (row < ny - 1 ? overlap : 0);
          return { anchoMm: usefulW + extraW, altoMm: usefulH + extraH };
        });
        if (!paneles.every((panel) => entra(panel.anchoMm, panel.altoMm)))
          continue;
        const areaFisicaMm2 = paneles.reduce(
          (total, panel) => total + panel.anchoMm * panel.altoMm,
          0,
        );
        if (
          !mejor ||
          nx * ny < mejor.nx * mejor.ny ||
          (nx * ny === mejor.nx * mejor.ny &&
            (areaFisicaMm2 < mejor.areaFisicaMm2 ||
              (areaFisicaMm2 === mejor.areaFisicaMm2 &&
                nx + ny < mejor.nx + mejor.ny)))
        ) {
          mejor = { nx, ny, areaFisicaMm2 };
        }
      }
    }
    if (!mejor) return null;
    const usefulW = pieza.anchoMm / mejor.nx;
    const usefulH = pieza.altoMm / mejor.ny;
    const panelCount = mejor.nx * mejor.ny;
    for (
      let copyIndex = 0;
      copyIndex < Math.ceil(pieza.cantidad);
      copyIndex++
    ) {
      const sourcePieceId = `piece-${pieceIndex}-${copyIndex}`;
      for (let row = 0; row < mejor.ny; row++) {
        for (let col = 0; col < mejor.nx; col++) {
          const overlapLeft = col > 0 ? overlap : 0;
          const overlapRight = col < mejor.nx - 1 ? overlap : 0;
          const overlapTop = row > 0 ? overlap : 0;
          const overlapBottom = row < mejor.ny - 1 ? overlap : 0;
          resultado.push({
            cantidad: 1,
            anchoMm: usefulW + overlapLeft + overlapRight,
            altoMm: usefulH + overlapTop + overlapBottom,
            sourcePieceId,
            panelIndex: row * mejor.nx + col + 1,
            panelCount,
            panelAxis:
              mejor.nx > 1 && mejor.ny === 1
                ? 'vertical'
                : mejor.ny > 1 && mejor.nx === 1
                  ? 'horizontal'
                  : mejor.nx >= mejor.ny
                    ? 'vertical'
                    : 'horizontal',
            usefulWidthMm: usefulW,
            usefulHeightMm: usefulH,
            overlapStartMm: overlapLeft + overlapTop,
            overlapEndMm: overlapRight + overlapBottom,
          });
        }
      }
    }
  }
  return resultado;
}

/**
 * Invariante universal: NINGUNA pieza puede quedar fuera del sustrato. Antes de
 * acomodar en una HOJA, verifica que cada pieza entre en el área útil en alguna
 * orientación (con el panelizado ya aplicado aguas arriba). Si alguna no entra,
 * no hay layout válido → el dispatcher devuelve null y el guard corta con "no
 * entra, activá panelizado", en vez de que el packer la coloque DESBORDADA
 * (feedback del usuario: piezas dibujadas fuera de la chapa). El rollo ya lo
 * respeta por su cuenta; esto cierra el hueco de las hojas (MaxRects abría un
 * bin por overflow y colocaba igual).
 */
function todasLasPiezasEntranEnHoja(
  piezas: Array<{ anchoMm: number; altoMm: number }>,
  config: NestingConfigResolved,
): boolean {
  const utilW =
    (config.sheetWidthMm ?? 0) - config.margins.leftMm - config.margins.rightMm;
  const utilH =
    (config.sheetHeightMm ?? 0) -
    config.margins.topMm -
    config.margins.bottomMm;
  if (utilW <= 0 || utilH <= 0) return false;
  const EPS = 1; // mm — tolerancia de redondeo
  return piezas.every(
    (p) =>
      (p.anchoMm <= utilW + EPS && p.altoMm <= utilH + EPS) ||
      (config.allowRotation &&
        p.altoMm <= utilW + EPS &&
        p.anchoMm <= utilH + EPS),
  );
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
  if (
    !bruta ||
    !(bruta.anchoMm > 0) ||
    !(bruta.altoMm > 0) ||
    piezas.length === 0
  ) {
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
 * rectángulo `{anchoMm, altoMm}` o una lista.
 *
 * Una TIRA `{largoMm, anchoMm}` se ACUESTA A LO LARGO del material: su LARGO va
 * al eje MAYOR de la pieza (`altoMm` → alto de la hoja / largo del rollo) y su
 * ancho al eje MENOR (`anchoMm` → ancho del material), para que las copias
 * tilen a lo ancho (1220/220 = 5 por fila) en vez de una por fila.
 * Antes el largo iba a `anchoMm` (el eje CORTO) → las tiras se paraban de canto
 * y empaquetaban pésimo (feedback: cenefas verticales, 3 chapas).
 * docs/fuente-de-medida-de-consumo-diseno.md §4.
 */
function normalizarPiezasDeOutput(
  valor: unknown,
): Array<{ cantidad: number; anchoMm: number; altoMm: number }> {
  if (!valor || typeof valor !== 'object') return [];
  const items = Array.isArray(valor) ? valor : [valor];
  const piezas: Array<{ cantidad: number; anchoMm: number; altoMm: number }> =
    [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const esTira = it.largoMm != null;
    const anchoMm = Number(it.anchoMm);
    const altoMm = Number(esTira ? it.largoMm : it.altoMm);
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
        : evaluateRollLayoutForConfiguredAlgorithm(
            shelfInput,
            config.algorithm,
          ),
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
      'vertical' | 'horizontal' | undefined,
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
        ? // La dirección automática se compara con layouts COMPLETOS. Antes el
          // helper elegía el eje por cantidad de paneles sin saber cómo iban a
          // acomodarse después en el rollo.
          (['vertical', 'horizontal'] as const)
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
  // Invariante: sin layout válido si una pieza no entra en la hoja (→ guard).
  if (!todasLasPiezasEntranEnHoja(piezas, config)) return null;

  const medidasDistintas = new Set(
    piezas.map((p) => `${p.anchoMm}x${p.altoMm}`),
  );
  const contienePaneles = piezas.some((pieza) => pieza.panelIndex != null);
  // Una geometría SVG necesita conservar la identidad de cada contorno para
  // que el corte posterior pueda aplicarlo sobre SU caja impresa. El grid
  // single colapsa todas las piezas iguales en una pose anónima; por eso los
  // vectores siempre pasan por multi aunque compartan ancho y alto.
  const contieneIdentidadesVectoriales = piezas.some(
    (pieza) => typeof pieza.sourcePieceId === 'string',
  );
  if (
    medidasDistintas.size <= 1 &&
    !contienePaneles &&
    !contieneIdentidadesVectoriales
  ) {
    return runGrid2DSingleForArea(jobContext, config);
  }

  const result = nestGrid2DMulti(
    piezas.map((p, idx) => ({
      id: `pieza_${idx}`,
      widthMm: p.anchoMm,
      heightMm: p.altoMm,
      quantity: p.cantidad,
      meta: metadataPanelDePieza(p),
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
    placements: result.placements.map(promoverMetadataPanel),
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

function metadataPanelDePieza(
  pieza: NonNullable<JobContext['piezas']>[number],
): Record<string, unknown> | undefined {
  if (pieza.panelIndex == null && !pieza.sourcePieceId) return undefined;
  return {
    sourcePieceId: pieza.sourcePieceId,
    panelIndex: pieza.panelIndex,
    panelCount: pieza.panelCount,
    panelAxis: pieza.panelAxis,
    usefulWidthMm: pieza.usefulWidthMm,
    usefulHeightMm: pieza.usefulHeightMm,
    overlapStartMm: pieza.overlapStartMm,
    overlapEndMm: pieza.overlapEndMm,
  };
}

function promoverMetadataPanel(placement: Placement): Placement {
  const meta = asRecord(placement.meta);
  const panelAxis =
    meta.panelAxis === 'vertical' || meta.panelAxis === 'horizontal'
      ? meta.panelAxis
      : undefined;
  return {
    ...placement,
    pieceId:
      typeof meta.sourcePieceId === 'string'
        ? meta.sourcePieceId
        : placement.pieceId,
    panelIndex: readPositiveNumberFromRecord(meta, 'panelIndex') ?? undefined,
    panelCount: readPositiveNumberFromRecord(meta, 'panelCount') ?? undefined,
    panelAxis,
    usefulWidthMm:
      readPositiveNumberFromRecord(meta, 'usefulWidthMm') ?? undefined,
    usefulHeightMm:
      readPositiveNumberFromRecord(meta, 'usefulHeightMm') ?? undefined,
    overlapStartMm: readNonNegativeNumberFromRecord(meta, 'overlapStartMm'),
    overlapEndMm: readNonNegativeNumberFromRecord(meta, 'overlapEndMm'),
  };
}

function runGrid2DSingleForArea(
  jobContext: JobContext,
  config: NestingConfigResolved,
  substrateLabel = 'Placa',
  advanceAlongLongSide = true,
): NestingDispatchResult | null {
  const piezas = getPiezasParaNesting(jobContext);
  const pieza = piezas[0];
  if (!pieza || !config.sheetWidthMm || !config.sheetHeightMm) return null;
  // Invariante: sin layout válido si una pieza no entra en la hoja (→ guard).
  if (!todasLasPiezasEntranEnHoja(piezas, config)) return null;

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
  // El contrato visual/costeable representa CADA placa física. Antes se
  // publicaba un único sustrato con `count: pliegosNecesarios` y solamente
  // los placements de la primera placa. El visor dibujaba una sola placa y
  // terminaba superponiéndole el escalón de costo de la última.
  const substrates: SubstrateUsage[] = [];
  const placements: Placement[] = [];
  const perSubstrate: Array<{
    areaUtilMm2: number;
    consumedLengthMm: number;
  }> = [];
  let piezasRestantes = totalPiezas;

  for (
    let substrateIndex = 0;
    substrateIndex < pliegosNecesarios;
    substrateIndex++
  ) {
    const piezasEnEstaPlaca = Math.min(piezasRestantes, piezasPorPliego);
    piezasRestantes -= piezasEnEstaPlaca;
    const mixedLayout = buildSingleSizeMixedLayout({
      pieceId: 'pieza_0',
      pieceWidthMm: pieza.anchoMm,
      pieceHeightMm: pieza.altoMm,
      quantity: piezasEnEstaPlaca,
      substrateWidthMm: config.sheetWidthMm,
      substrateHeightMm: config.sheetHeightMm,
      margins: sustrato.margins,
      separationHMm: config.separationHMm,
      separationVMm: config.separationVMm,
      allowRotation: config.allowRotation,
      advanceAlongLongSide,
    });
    const placementsPlaca =
      mixedLayout?.placements ?? result.placements.slice(0, piezasEnEstaPlaca);
    const indexedPlacements = placementsPlaca.map((placement) => ({
      ...placement,
      substrateIndex,
    }));
    placements.push(...indexedPlacements);
    substrates.push({
      kind: 'sheet',
      count: 1,
      widthMm: config.sheetWidthMm,
      heightMm: config.sheetHeightMm,
    });
    perSubstrate.push({
      areaUtilMm2: piezasEnEstaPlaca * pieza.anchoMm * pieza.altoMm,
      consumedLengthMm:
        mixedLayout?.consumedLengthMm ??
        consumedLengthFromPlacements(indexedPlacements, {
          widthMm: config.sheetWidthMm,
          heightMm: config.sheetHeightMm,
          trailingMarginMm: advanceAlongLongSide
            ? resolvePlateAxes({
                widthMm: config.sheetWidthMm,
                heightMm: config.sheetHeightMm,
              }).longAxis === 'x'
              ? config.margins.rightMm
              : config.margins.bottomMm
            : config.margins.bottomMm,
          advanceAlongLongSide,
        }),
    });
  }
  const previewConsumedLengthMm =
    perSubstrate[perSubstrate.length - 1]?.consumedLengthMm ??
    result.metrics.largoConsumidoMm ??
    0;

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
    substrates,
    placements,
    metricasRaw: {
      ...result.metrics,
      areaUtilMm2: totalPiezas * pieza.anchoMm * pieza.altoMm,
      areaTotalMm2: result.metrics.areaTotalMm2 * pliegosNecesarios,
      largoConsumidoMm: previewConsumedLengthMm,
      trailingMarginMm: advanceAlongLongSide
        ? resolvePlateAxes({
            widthMm: config.sheetWidthMm,
            heightMm: config.sheetHeightMm,
          }).longAxis === 'x'
          ? config.margins.rightMm
          : config.margins.bottomMm
        : config.margins.bottomMm,
      perSubstrate,
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

function consumedLengthFromPlacements(
  placements: Placement[],
  config: {
    widthMm: number;
    heightMm: number;
    trailingMarginMm: number;
    advanceAlongLongSide: boolean;
  },
): number {
  if (placements.length === 0) return 0;
  if (config.advanceAlongLongSide) {
    return consumedLengthAlongPlateLongAxis({
      placements,
      sheet: { widthMm: config.widthMm, heightMm: config.heightMm },
      trailingMarginMm: config.trailingMarginMm,
    });
  }
  return (
    placements.reduce(
      (max, placement) => Math.max(max, placement.yMm + placement.heightMm),
      0,
    ) + config.trailingMarginMm
  );
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
  advanceAlongLongSide?: boolean;
}): { placements: Placement[]; consumedLengthMm: number } | null {
  if (
    input.advanceAlongLongSide &&
    input.substrateWidthMm > input.substrateHeightMm
  ) {
    const transposed = buildSingleSizeMixedLayout({
      ...input,
      pieceWidthMm: input.pieceHeightMm,
      pieceHeightMm: input.pieceWidthMm,
      substrateWidthMm: input.substrateHeightMm,
      substrateHeightMm: input.substrateWidthMm,
      margins: {
        leftMm: input.margins.topMm,
        rightMm: input.margins.bottomMm,
        topMm: input.margins.leftMm,
        bottomMm: input.margins.rightMm,
      },
      separationHMm: input.separationVMm,
      separationVMm: input.separationHMm,
      advanceAlongLongSide: false,
    });
    return transposed
      ? {
          consumedLengthMm: transposed.consumedLengthMm,
          placements: transposed.placements.map((placement) => ({
            ...placement,
            xMm: placement.yMm,
            yMm: placement.xMm,
            widthMm: placement.heightMm,
            heightMm: placement.widthMm,
          })),
        }
      : null;
  }
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
      meta: metadataPanelDePieza(p),
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
    placements: result.placements.map(promoverMetadataPanel),
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
    ['impresora_laser', 'duplicadora_digital'].includes(
      paso.maquina?.plantilla?.toLowerCase() ?? '',
    )
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
 * Si el paso declara `paramsPaso.modoTalonarioIncompleto`, o lo heredó de una
 * capa anterior mediante `talonario_modo_incompleto`, y el JobContext es de
 * talonario (`numerosXTalonario` declarado), aplica el grouping al resultado
 * del nesting base. Sino, devuelve baseResult sin tocar.
 *
 * El param propio lo lleva el paso que define el armado —el del original— y
 * sólo ese conserva `talonarioGrouping`, por lo que es el único que publica
 * las pilas para abrochado. Duplicado y triplicado repiten la cantidad real de
 * hojas sin volver a emitir ni sobrescribir esas pilas.
 */
function aplicarTalonarioGroupingSiCorresponde(
  baseResult: NestingDispatchResult,
  paso: PasoCargado,
  jobContext: JobContext,
): NestingDispatchResult {
  const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
  const modoPropio = params.modoTalonarioIncompleto;
  const modoHeredado = (jobContext as Record<string, unknown>)
    .talonario_modo_incompleto;
  const tieneModoPropio =
    modoPropio === 'aprovechar_pliego' || modoPropio === 'pose_completa';
  const modo = tieneModoPropio ? modoPropio : modoHeredado;
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
    // La traza completa (y por lo tanto `talonario_pilas`) pertenece al paso
    // modelador. Las capas heredadas sólo necesitan la cantidad y el visual.
    ...(tieneModoPropio ? { talonarioGrouping: grouping } : {}),
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

function readNonNegativeNumberFromRecord(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
