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
import { nestGrid2DMulti } from '../productos-servicios/nesting/algorithms/grid-2d-multi';
import { nestPackingSolverRectangle } from '../productos-servicios/nesting/algorithms/packingsolver-rectangle';
import {
  calculateTalonarioGrouping,
  type TalonarioGroupingResult,
} from '../productos-servicios/nesting/helpers/talonario-grouping';
import { calculateSustratoToPliegoConversion } from '../productos-servicios/nesting/helpers/sustrato-to-pliego';
import type {
  NestingResult,
  Placement,
  SubstrateUsage,
} from '../productos-servicios/nesting/types';
import {
  resolveNestingConfig,
  type NestingConfigResolved,
  type PrintSheetCandidateConfig,
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
    | 'grid-2d-multi'
    | 'packingsolver-rectangle';
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
    criterio: 'menor_costo_sustrato';
    candidatosEvaluados: number;
    costoEstimadoMm2: number;
    pliegosImpresion: number;
    pliegosComprados: number;
    aprovechamientoPct: number;
  };
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
export async function runNestingForPaso(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
): Promise<NestingDispatchResult | null> {
  const config = resolveNestingConfig(paso, jobContext, materialResuelto);
  // ─── Caso 1: gran formato por área ──────────────────────────────
  // Si la máquina/material trabajan en rollo usa shelf-rollo; si trabajan
  // sobre mesa/placa usa grid 2D multi. Esto permite que rígidos impresos
  // generen nesting en el paso productivo sin depender de pre-prensa.
  if (paso.familiaCodigo === 'impresion_por_area') {
    return await runImpresionPorArea(paso, jobContext, materialResuelto, config);
  }

  // ─── Caso 2: shelf-rollo (corte sobre rollo) ─────────────────────
  if (paso.familiaCodigo === 'plotter_corte') {
    if (getPlotterModoOperacion(paso) === 'HOJAS') {
      return null;
    }
    return runShelfRollo(
      paso,
      jobContext,
      materialResuelto,
      disablePanelizado(config),
    );
  }

  // ─── Caso 3: laminado en rollo sobre pliegos ya impresos ─────────
  if (paso.familiaCodigo === 'laminado') {
    return runLaminadoRollo(paso, jobContext, materialResuelto, config);
  }

  // ─── Caso 4: plastificado pouch sobre formato finito ──────────────
  if (paso.familiaCodigo === 'plastificado_pouch') {
    return runPlastificadoPouch(jobContext, materialResuelto, config);
  }

  // ─── Caso 5: montaje sobre otro sustrato ─────────────────────────
  // Reusa los algoritmos existentes, pero permite que las piezas vengan
  // de la medida comercial o de outputs publicados por pasos anteriores.
  if (paso.familiaCodigo === 'montaje_sobre_sustrato') {
    return await runMontajeSobreSustrato(
      paso,
      jobContext,
      materialResuelto,
      config,
    );
  }

  // ─── Caso 6: grid 2D single/multi (digital sobre pliego) ─────────
  if (paso.familiaCodigo === 'impresion_por_hoja') {
    return runGrid2DSingle(paso, jobContext, materialResuelto, config);
  }

  // No cubierto: caller sigue con fallback.
  return null;
}

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

async function runImpresionPorArea(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): Promise<NestingDispatchResult | null> {
  if (config.algorithm === 'shelf-rollo') {
    return runShelfRollo(paso, jobContext, materialResuelto, config);
  }
  if (config.algorithm === 'grid-2d-single') {
    return runGrid2DSingle(paso, jobContext, materialResuelto, config);
  }
  if (config.algorithm === 'grid-2d-multi') {
    return runGrid2DMultiForArea(paso, jobContext, config);
  }
  if (config.algorithm === 'packingsolver-rectangle') {
    return await runPackingSolverRectangleForArea(paso, jobContext, config);
  }

  if (config.machineGeometry === 'ROLLO') {
    return runShelfRollo(paso, jobContext, materialResuelto, config);
  }

  if (isRollMaterial(materialResuelto?.atributosVarianteJson)) {
    return runShelfRollo(paso, jobContext, materialResuelto, config);
  }

  if (config.machineGeometry === 'MESA_EXTENSORA') {
    return await runPackingSolverRectangleForArea(paso, jobContext, config);
  }

  if (config.sheetWidthMm && config.sheetHeightMm && !config.rollWidthMm) {
    return await runPackingSolverRectangleForArea(paso, jobContext, config);
  }

  return runShelfRollo(paso, jobContext, materialResuelto, config);
}

function runLaminadoRollo(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  const ctx = jobContext as Record<string, unknown>;
  const pliegosImpresos = Number(ctx.pliegos_impresos ?? 0);
  const anchoPliegoMm = Number(ctx.pliego_impresion_ancho_mm ?? 0);
  const altoPliegoMm = Number(ctx.pliego_impresion_alto_mm ?? 0);
  if (
    !Number.isFinite(pliegosImpresos) ||
    pliegosImpresos <= 0 ||
    !Number.isFinite(anchoPliegoMm) ||
    anchoPliegoMm <= 0 ||
    !Number.isFinite(altoPliegoMm) ||
    altoPliegoMm <= 0
  ) {
    return null;
  }

  return runShelfRollo(
    paso,
    {
      ...jobContext,
      cantidad: Math.ceil(pliegosImpresos),
      piezas: [
        {
          cantidad: Math.ceil(pliegosImpresos),
          anchoMm: anchoPliegoMm,
          altoMm: altoPliegoMm,
        },
      ],
    },
    materialResuelto,
    config,
  );
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
  const montajeContext = buildJobContextMontaje(paso, jobContext);
  if (!montajeContext) return null;

  if (config.algorithm === 'shelf-rollo' || config.algorithm === 'maxrects-rollo') {
    return runShelfRollo(paso, montajeContext, materialResuelto, config);
  }
  if (config.algorithm === 'grid-2d-single') {
    return runGrid2DSingleForArea(montajeContext, config);
  }
  if (config.algorithm === 'grid-2d-multi') {
    return runGrid2DMultiForArea(paso, montajeContext, config);
  }
  if (config.algorithm === 'packingsolver-rectangle') {
    return await runPackingSolverRectangleForArea(paso, montajeContext, config);
  }

  if (isRollMaterial(materialResuelto?.atributosVarianteJson)) {
    return runShelfRollo(paso, montajeContext, materialResuelto, config);
  }
  if (config.sheetWidthMm && config.sheetHeightMm) {
    return await runPackingSolverRectangleForArea(paso, montajeContext, config);
  }
  return null;
}

function buildJobContextMontaje(
  paso: PasoCargado,
  jobContext: JobContext,
): JobContext | null {
  const params = asRecord(paso.paramsPasoJson);
  const fuente =
    typeof params.fuentePiezasMontaje === 'string'
      ? params.fuentePiezasMontaje
      : 'piezas_jobcontext';
  const ctx = jobContext as Record<string, unknown>;

  if (fuente === 'pliegos_impresos') {
    const cantidad = readPositiveNumberFromRecord(
      ctx,
      'pliegos_impresos',
      'pliegos_calculados',
    );
    const anchoMm = readPositiveNumberFromRecord(
      ctx,
      'pliego_impresion_ancho_mm',
    );
    const altoMm = readPositiveNumberFromRecord(
      ctx,
      'pliego_impresion_alto_mm',
    );
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

function isRollMaterial(attrs: Record<string, unknown> | null | undefined) {
  return (
    readNumber(attrs, 'largoRolloMm') != null ||
    readNumber(attrs, 'largoRolloM') != null ||
    readNumber(attrs, 'rollLengthMm') != null ||
    readNumber(attrs, 'rollLengthM') != null ||
    readNumber(attrs, 'longitudRolloMm') != null ||
    readNumber(attrs, 'longitudRolloM') != null
  );
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

function evaluateRollLayoutForConfiguredAlgorithm(
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

async function runPackingSolverRectangleForArea(
  paso: PasoCargado,
  jobContext: JobContext,
  config: NestingConfigResolved,
): Promise<NestingDispatchResult | null> {
  const piezas = getPiezasParaNesting(jobContext);
  if (piezas.length === 0) return null;
  void paso;
  if (!config.sheetWidthMm || !config.sheetHeightMm) return null;

  const result = await nestPackingSolverRectangle(
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
      binHeightSegmentsPct:
        config.costing.strategy === 'plate-segments'
          ? config.costing.segmentSteps
          : [100],
    },
  );

  if (!result) {
    return runGrid2DMultiForArea(paso, jobContext, {
      ...config,
      algorithm: 'grid-2d-multi',
    });
  }

  return {
    algorithm: 'packingsolver-rectangle',
    cantidadCalculada: result.substrates.length,
    unidad: 'pliegos',
    aprovechamientoPct: result.metrics.aprovechamientoPct,
    substrates: result.substrates,
    placements: result.placements,
    metricasRaw: {
      ...result.metrics,
      perSubstrate: result.perSubstrate,
    },
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
function runGrid2DSingle(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNesting | null,
  config: NestingConfigResolved,
): NestingDispatchResult | null {
  if (
    paso.familiaCodigo === 'impresion_por_hoja' &&
    config.printSheetMode === 'automatic'
  ) {
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
    substrates: result.substrates,
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
      const score = scorePrintSheetCandidate(candidate, result, config);
      if (!score) return null;
      return { candidate, result, score };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.score.costoEstimadoMm2 !== b.score.costoEstimadoMm2) {
        return a.score.costoEstimadoMm2 - b.score.costoEstimadoMm2;
      }
      if (a.result.aprovechamientoPct !== b.result.aprovechamientoPct) {
        return b.result.aprovechamientoPct - a.result.aprovechamientoPct;
      }
      return a.result.cantidadCalculada - b.result.cantidadCalculada;
    });

  const winner = evaluated[0];
  if (!winner) return null;

  return {
    ...winner.result,
    pliegoImpresionSeleccionado: {
      id: winner.candidate.id,
      nombre: winner.candidate.nombre,
      anchoMm: winner.candidate.anchoMm,
      altoMm: winner.candidate.altoMm,
      criterio: 'menor_costo_sustrato',
      candidatosEvaluados: evaluated.length,
      costoEstimadoMm2: winner.score.costoEstimadoMm2,
      pliegosImpresion: winner.result.cantidadCalculada,
      pliegosComprados: winner.score.pliegosComprados,
      aprovechamientoPct: winner.result.aprovechamientoPct,
    },
  };
}

function scorePrintSheetCandidate(
  candidate: PrintSheetCandidateConfig,
  result: NestingDispatchResult,
  config: NestingConfigResolved,
): { costoEstimadoMm2: number; pliegosComprados: number } | null {
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
      costoEstimadoMm2: pliegosComprados * purchaseWidthMm * purchaseHeightMm,
    };
  }

  return {
    pliegosComprados: pliegosImpresion,
    costoEstimadoMm2: pliegosImpresion * candidate.anchoMm * candidate.altoMm,
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
  return (
    paso.familiaCodigo === 'impresion_por_hoja' &&
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
  resolveMaterialFn: (
    slot: PasoCargado['slots'][number],
    jc: JobContext,
  ) => Promise<MaterialResueltoParaNesting | null>,
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
  };

  const baseResult = await runNestingForPaso(pasoSintetico, jobContext, material);
  if (!baseResult) return null;

  // ─── Talonario-grouping (post-nesting) ──────────────────────────
  // Si pre_prensa declara `paramsPaso.modoTalonarioIncompleto` Y el JobContext
  // tiene `numerosXTalonario`, aplicamos el grouping para obtener
  // `pliegosXCapa` real considerando si la cantidad pedida no completa un
  // grupo (modos 'aprovechar_pliego' vs 'pose_completa').
  //
  // El resultado sobrescribe la `cantidadCalculada` del base (que era pliegos
  // sin grouping = ceil(cantidad / piezasPorPliego)) por `pliegosXCapa` que
  // considera el modo del modelador.
  return aplicarTalonarioGroupingSiCorresponde(baseResult, paso, jobContext);
}

/**
 * Si el paso `pre_prensa` declara `paramsPaso.modoTalonarioIncompleto` y el
 * JobContext es de talonario (`numerosXTalonario` declarado), aplica el
 * grouping al resultado del nesting base. Sino, devuelve baseResult sin tocar.
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
