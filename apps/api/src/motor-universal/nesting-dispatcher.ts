/**
 * G-M1 — Dispatcher de nesting para el motor universal.
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
 *   - `impresion_por_hoja` con sustrato sheet → `nestGrid2DSingle`.
 *     Devuelve `piezasPorSustrato`, motor calcula `pliegos = ceil(cantidad / piezasPorSustrato)`.
 *   - Familias no cubiertas → `null` (motor mantiene fallback de m² crudos).
 *
 * Pendiente (G-M2 + iteración futura):
 *   - Talonarios: requiere `posesXPliego` desde paso `pre_prensa` previo,
 *     que solo está disponible cuando G-M2 (outputs canónicos al JobContext)
 *     esté implementado. Por ahora devuelve null para esta familia.
 *   - Multi-medida en grid 2D (placas rígidas): requiere `nestGrid2DMulti`,
 *     se agrega cuando aparezca el caso real.
 */

import { evaluateGranFormatoMixedShelfLayout } from '../productos-servicios/nesting/algorithms/shelf-rollo';
import { nestGrid2DSingle } from '../productos-servicios/nesting/algorithms/grid-2d-single';
import type {
  NestingResult,
  Placement,
  SubstrateUsage,
} from '../productos-servicios/nesting/types';
import type { PasoCargado, JobContext } from './tipos';

/**
 * Resultado del dispatcher con TODO lo que el motor + viewer necesitan.
 */
export interface NestingDispatchResult {
  algorithm: 'shelf-rollo' | 'grid-2d-single';
  /**
   * Cantidad CALCULADA del paso, en la unidad correcta:
   *  - Para shelf-rollo: metros lineales consumidos del rollo.
   *  - Para grid-2d-single: pliegos necesarios.
   */
  cantidadCalculada: number;
  unidad: 'm_lineales' | 'pliegos' | 'm2' | 'piezas';
  /** Aprovechamiento del sustrato (%). */
  aprovechamientoPct: number;
  /** Para visualización: bins/sustratos consumidos. */
  substrates: SubstrateUsage[];
  /** Para visualización: placements de cada pieza. */
  placements: Placement[];
  /** Métricas crudas heredadas del algoritmo (para trazabilidad). */
  metricasRaw: NestingResult['metrics'];
  /** Sólo grid-2d-single: piezas por pliego (útil para outputs canónicos). */
  piezasPorPliego?: number;
  /** Sólo shelf-rollo: largo consumido del rollo en mm. */
  consumedLengthMm?: number;
  /** Cantidad de instancias de pieza efectivamente acomodadas. */
  piezasAcomodadas: number;
}

/** Material resuelto que el motor pasa al dispatcher (subset de SlotCargado). */
export interface MaterialResueltoParaNesting {
  id: string;
  /** Atributos: anchoMm (rollo o pliego), largoMm (pliego), largoRolloMm (rollo). */
  atributosVarianteJson?: Record<string, unknown> | null;
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
export function runNestingForPaso(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
): NestingDispatchResult | null {
  // ─── Caso 1: shelf-rollo (gran formato sobre rollo) ──────────────
  if (paso.familiaCodigo === 'impresion_por_area' || paso.familiaCodigo === 'plotter_corte') {
    return runShelfRollo(paso, jobContext, materialResuelto);
  }

  // ─── Caso 2: grid 2D single (digital sobre pliego) ───────────────
  if (paso.familiaCodigo === 'impresion_por_hoja') {
    return runGrid2DSingle(paso, jobContext, materialResuelto);
  }

  // No cubierto: caller sigue con fallback.
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Implementaciones
// ────────────────────────────────────────────────────────────────────

function runShelfRollo(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
): NestingDispatchResult | null {
  const piezas = jobContext.piezas ?? [];
  if (piezas.length === 0) return null;

  // v3.0: ancho útil viene del paramsTecnicos de la máquina.
  // Para IMPRESORA_GRAN_FORMATO_POR_AREA con geometria=ROLLO: `anchoMaxRolloMm`.
  // Compat retro: `anchoMaxMm` (nombre legacy).
  // Fallback: ancho declarado en la variante de material.
  const maqParams = (paso.maquina?.parametrosTecnicosJson ?? {}) as Record<string, unknown>;
  const anchoMaquinaMm =
    readNumber(maqParams, 'anchoMaxRolloMm') ??
    readNumber(maqParams, 'anchoMaxMm');
  const anchoMaterialMm = readNumber(materialResuelto?.atributosVarianteJson, 'anchoMm');
  let printableWidthMm = anchoMaquinaMm ?? anchoMaterialMm;
  if (!printableWidthMm || printableWidthMm <= 0) return null;

  // v3.0 (doc §6): márgenes no imprimibles de la MÁQUINA reducen el ancho útil.
  // `margenesNoImprimiblesMm = { sup, inf, izq, der }`. Para shelf-rollo:
  //   - izq + der → restan al ancho útil del rollo.
  //   - sup → marginStartMm (inicio del rollo).
  //   - inf → marginEndMm (fin de cada trabajo).
  // El paso puede sobrescribir vía `paramsPasoJson`.
  const margenesMaquina = (maqParams.margenesNoImprimiblesMm ?? {}) as Record<string, unknown>;
  const margenIzqMaq = Number(margenesMaquina.izq ?? 0);
  const margenDerMaq = Number(margenesMaquina.der ?? 0);
  const margenSupMaq = Number(margenesMaquina.sup ?? 0);
  const margenInfMaq = Number(margenesMaquina.inf ?? 0);
  printableWidthMm = printableWidthMm - margenIzqMaq - margenDerMaq;
  if (printableWidthMm <= 0) return null;

  // Overrides del paso > márgenes de máquina > defaults.
  const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
  const marginLeftMm = Number(params.marginLeftMm ?? margenIzqMaq) || 0;
  const marginStartMm = Number(params.marginStartMm ?? margenSupMaq ?? 10);
  const marginEndMm = Number(params.marginEndMm ?? margenInfMaq ?? 10);
  const separacionHorizontalMm = Number(params.separacionHorizontalMm ?? 5);
  const separacionVerticalMm = Number(params.separacionVerticalMm ?? 5);
  const permitirRotacion = Boolean(params.permitirRotacion ?? true);

  const result = evaluateGranFormatoMixedShelfLayout({
    printableWidthMm,
    marginLeftMm,
    marginStartMm,
    marginEndMm,
    separacionHorizontalMm,
    separacionVerticalMm,
    permitirRotacion,
    medidas: piezas.map((p, idx) => ({
      id: `pieza_${idx}`,
      cantidad: p.cantidad,
      anchoMm: p.anchoMm,
      altoMm: p.altoMm,
    })),
  });

  if (!result) return null;

  const consumedLengthMm = result.consumedLengthMm;
  const consumedLengthM = consumedLengthMm / 1000;
  const areaTotalMm2 = printableWidthMm * consumedLengthMm;
  const aprovechamientoPct = areaTotalMm2 > 0
    ? Math.round((result.usefulAreaM2 * 1_000_000 / areaTotalMm2) * 10000) / 100
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
    panelAxis: (p.panelAxis ?? undefined) as 'vertical' | 'horizontal' | undefined,
    usefulWidthMm: p.usefulWidthMm,
    usefulHeightMm: p.usefulHeightMm,
    overlapStartMm: p.overlapStartMm,
    overlapEndMm: p.overlapEndMm,
    meta: { label: p.label },
  }));

  const substrates: SubstrateUsage[] = [
    { kind: 'roll', lengthMm: consumedLengthMm, widthMm: printableWidthMm },
  ];

  return {
    algorithm: 'shelf-rollo',
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
      wasteAreaM2: Math.max(0, (areaTotalMm2 - result.usefulAreaM2 * 1_000_000) / 1_000_000),
    },
    consumedLengthMm,
    piezasAcomodadas: result.placements.length,
  };
}

function runGrid2DSingle(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
): NestingDispatchResult | null {
  // Pieza: prioriza medidaCustomMm (modoMedidas=LIBRE), después primera pieza, después params.
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

  // Sustrato: dimensiones del pliego (variante de papel).
  const sheetWidthMm = readNumber(materialResuelto?.atributosVarianteJson, 'anchoMm');
  const sheetHeightMm = readNumber(materialResuelto?.atributosVarianteJson, 'largoMm');
  if (!sheetWidthMm || !sheetHeightMm) return null;

  // Margenes de la máquina (defaults sensatos para impresión digital).
  const maqParams = (paso.maquina?.parametrosTecnicosJson ?? {}) as Record<string, unknown>;
  const margins = (maqParams.margenesNoImprimiblesMm ?? {}) as Record<string, unknown>;
  const marginLeftMm = Number(margins.izq ?? margins.leftMm ?? 5);
  const marginRightMm = Number(margins.der ?? margins.rightMm ?? 5);
  const marginTopMm = Number(margins.sup ?? margins.topMm ?? 5);
  const marginBottomMm = Number(margins.inf ?? margins.bottomMm ?? 5);

  const params = (paso.paramsPasoJson ?? {}) as Record<string, unknown>;
  const sepHMm = Number(params.separacionHorizontalMm ?? 0);
  const sepVMm = Number(params.separacionVerticalMm ?? 0);
  const allowRotation = Boolean(params.permitirRotacion ?? true);

  const result = nestGrid2DSingle(
    {
      id: 'pieza_principal',
      widthMm,
      heightMm,
      quantity: 1,
    },
    {
      kind: 'sheet',
      widthMm: sheetWidthMm,
      heightMm: sheetHeightMm,
      margins: {
        leftMm: marginLeftMm,
        rightMm: marginRightMm,
        topMm: marginTopMm,
        bottomMm: marginBottomMm,
      },
    },
    {
      separationHMm: sepHMm,
      separationVMm: sepVMm,
      allowRotation,
    },
  );

  const piezasPorPliego = result.metrics.piezasPorSustrato ?? 0;
  if (piezasPorPliego <= 0) return null;

  const cantidadPiezas = Number(jobContext.cantidad ?? 0);
  // Si caras=2, multiplicamos: doble faz duplica las pasadas pero NO los pliegos.
  // El motor luego aplica el multiplicador 'caras' al tiempo, no a los pliegos.
  const pliegosNecesarios = Math.ceil(cantidadPiezas / piezasPorPliego);

  return {
    algorithm: 'grid-2d-single',
    cantidadCalculada: pliegosNecesarios,
    unidad: 'pliegos',
    aprovechamientoPct: result.metrics.aprovechamientoPct,
    substrates: result.substrates,
    placements: result.placements,
    metricasRaw: result.metrics,
    piezasPorPliego,
    piezasAcomodadas: piezasPorPliego, // las acomodadas en 1 pliego "modelo"
  };
}

/**
 * G-M2 — Look-ahead para `pre_prensa`.
 *
 * `pre_prensa` (M-0, T-1, sin slots de material) NO conoce el papel ni la
 * máquina por sí solo, pero su rol semántico es PLANIFICAR la imposición y
 * publicar `pliegos_calculados` para que el siguiente paso de impresión por
 * hoja lo herede.
 *
 * Esta función busca el siguiente paso con familia `impresion_por_hoja`
 * (en el subset `pasosSiguientes`), toma su material + máquina, y corre el
 * dispatcher de grid-2d-single sintetizando un paso virtual. El resultado
 * tiene exactamente el mismo shape que cualquier otro `NestingDispatchResult`,
 * lo que permite reusar el viewer y la lógica de outputs canónicos.
 */
export async function runNestingForPrePrensa(
  paso: PasoCargado,
  jobContext: JobContext,
  pasosSiguientes: PasoCargado[],
  resolveMaterialFn: (slot: PasoCargado['slots'][number], jc: JobContext) => Promise<MaterialResueltoParaNesting | null>,
): Promise<NestingDispatchResult | null> {
  if (paso.familiaCodigo !== 'pre_prensa') return null;

  const proximoImpresionPorHoja = pasosSiguientes.find(
    (p) => p.familiaCodigo === 'impresion_por_hoja',
  );
  if (!proximoImpresionPorHoja) return null;

  const slot = proximoImpresionPorHoja.slots[0] ?? null;
  if (!slot) return null;
  const material = await resolveMaterialFn(slot, jobContext);
  if (!material) return null;

  // Construir un paso sintético que el dispatcher trate como impresion_por_hoja
  // (mismo material + máquina + paramsPaso del siguiente paso). El resultado se
  // adjudica luego a pre_prensa para que escriba sus outputs canónicos.
  const pasoSintetico: PasoCargado = {
    ...proximoImpresionPorHoja,
    paramsPasoJson: paso.paramsPasoJson, // mantener overrides locales de pre_prensa
  };

  return runNestingForPaso(pasoSintetico, jobContext, material);
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function readNumber(json: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!json) return null;
  const v = json[key];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
