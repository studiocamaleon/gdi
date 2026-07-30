// FRONTERA-NESTING: este archivo entero es frontera (pasos-componibles-diseno
// §3.4 Tipo B). Resuelve la config de nesting POR FAMILIA (márgenes,
// separación, panelizado, algoritmo): son las primitivas de geometría del
// sistema, no datos de la declaración. Se parametriza recién en la Etapa B.
import type { PasoCargado, JobContext } from './tipos';
import type { CostingStrategyKind } from '../productos-servicios/nesting/costing';

export type NestingAlgorithmPolicy =
  | 'auto'
  | 'shelf-rollo'
  | 'maxrects-rollo'
  | 'grid-2d-single'
  | 'grid-2d-multi';

export interface NestingCostingConfig {
  strategy: 'simple' | CostingStrategyKind;
  segmentSteps: number[];
}

export interface NestingPanelizadoConfig {
  enabled: boolean;
  mode: 'automatic' | 'manual';
  axis: 'automatic' | 'vertical' | 'horizontal';
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
  manualLayout?: Record<string, unknown> | null;
}

/** Materia prima propia de un candidato de pliego (modo 'por_candidato'). */
export interface PrintSheetCandidateMaterial {
  varianteId: string;
  sku: string;
  nombre: string;
  precioReferencia: number | null;
  /** Medidas del sustrato comprado; null → se asume igual al candidato. */
  anchoMm: number | null;
  altoMm: number | null;
}

export interface PrintSheetCandidateConfig {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  /** Modo 'por_candidato': variante de MP propia declarada en el modelador. */
  materiaPrimaVarianteId: string | null;
  /** Enriquecido en runtime (precio real para el score). */
  materiaPrima?: PrintSheetCandidateMaterial | null;
}

const MIN_PANEL_MAX_WIDTH_MM = 300;

export interface NestingConfigResolved {
  algorithm: NestingAlgorithmPolicy;
  allowRotation: boolean;
  pieceBleedMm: number;
  separationHMm: number;
  separationVMm: number;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
    startMm: number;
    endMm: number;
  };
  rollWidthMm: number | null;
  sheetWidthMm: number | null;
  sheetHeightMm: number | null;
  printSheetMode: 'fixed' | 'automatic';
  /**
   * Origen del costo al comparar candidatos de pliego:
   *  - 'derivado' (default): proxy por área comprada de la MP única del slot.
   *  - 'por_candidato': precio real de la MP propia de cada candidato.
   */
  printSheetCostSource: 'derivado' | 'por_candidato';
  printSheetCandidates: PrintSheetCandidateConfig[];
  purchaseSheetWidthMm: number | null;
  purchaseSheetHeightMm: number | null;
  /** Precio de referencia de la MP del slot (para score en $ del derivado). */
  purchaseSheetPrecio: number | null;
  machineGeometry: string | null;
  costing: NestingCostingConfig;
  panelizado: NestingPanelizadoConfig;
}

export interface MaterialResueltoParaNestingConfig {
  atributosVarianteJson?: Record<string, unknown> | null;
  precioReferencia?: number | null;
}

const COSTING_STRATEGIES = new Set([
  'simple',
  'm2-exact',
  'consumed-length',
  'plate-segments',
]);

export function resolveNestingConfig(
  paso: PasoCargado,
  jobContext: JobContext,
  materialResuelto: MaterialResueltoParaNestingConfig | null,
): NestingConfigResolved {
  const params = asRecord(paso.paramsPasoJson);
  const nestingConfig = asRecord(params.nestingConfig);
  const maqParams = paso.maquina?.parametrosTecnicosJson ?? {};
  const materialAttrs = materialResuelto?.atributosVarianteJson ?? {};
  const machineMarginSource =
    paso.familiaCodigo === 'laminado'
      ? asRecord(maqParams.margenesDesperdicioMm)
      : paso.familiaCodigo === 'plastificado_pouch'
        ? uniformMargins(readNumber(materialAttrs.margenNoUsableMm) ?? 0)
      : asRecord(maqParams.margenesNoImprimiblesMm);
  const machineMargins = normalizeMargins(
    machineMarginSource,
    defaultMarginForFamily(paso.familiaCodigo),
  );
  const overrideMargins = normalizeMargins(asRecord(nestingConfig.margins), {});
  const legacyMargins = normalizeMargins(params, {});
  const runtimeConfig = asRecord(
    asRecord(jobContext.configPasoRuntime)?.[paso.configPasoId],
  );
  const runtimeNestingConfig = asRecord(runtimeConfig.nestingConfig);
  const runtimeMargins = normalizeMargins(
    asRecord(runtimeNestingConfig.margins),
    {},
  );
  const extraMargins = normalizeMargins(asRecord(nestingConfig.extraMargins), {});
  const runtimeExtraMargins = normalizeMargins(
    asRecord(runtimeNestingConfig.extraMargins),
    {},
  );

  const algorithm = normalizeAlgorithm(nestingConfig.algorithm);
  const geometry =
    typeof maqParams.geometria === 'string'
      ? maqParams.geometria.toUpperCase()
      : null;
  const costingConfig = asRecord(nestingConfig.costing);
  const strategy = normalizeCostingStrategy(costingConfig.strategy);
  const machineSheetGapMm =
    paso.familiaCodigo === 'laminado'
      ? readNumber(maqParams.margenEntrePliegosMm)
      : null;
  const legacySeparationHMm =
    readNumber(
      runtimeNestingConfig.separationHMm,
      nestingConfig.separationHMm,
      params.separacionEntrePiezasMm,
      params.separacionHorizontalMm,
      machineSheetGapMm,
      defaultSeparationForFamily(paso.familiaCodigo),
    ) ?? defaultSeparationForFamily(paso.familiaCodigo);
  const legacySeparationVMm =
    readNumber(
      runtimeNestingConfig.separationVMm,
      nestingConfig.separationVMm,
      params.separacionEntrePiezasMm,
      params.separacionVerticalMm,
      machineSheetGapMm,
      defaultSeparationForFamily(paso.familiaCodigo),
    ) ?? defaultSeparationForFamily(paso.familiaCodigo);
  const configuredPieceBleedMm = readNumber(
    runtimeNestingConfig.pieceBleedMm,
    nestingConfig.pieceBleedMm,
  );
  // E.1 — tier "default declarado de la familia" (FamiliaPasoDefaults):
  // runtime → config del producto → default de familia → derivado legacy.
  const pieceBleedMm = Math.max(
    0,
    configuredPieceBleedMm ??
      paso.defaultsFamilia?.demasiaMm ??
      (paso.familiaCodigo === 'plastificado_pouch'
        ? 0
        : Math.max(legacySeparationHMm, legacySeparationVMm) / 2),
  );
  const separationHMm =
    paso.familiaCodigo === 'plastificado_pouch'
      ? Math.max(0, legacySeparationHMm)
      : pieceBleedMm * 2;
  const separationVMm =
    paso.familiaCodigo === 'plastificado_pouch'
      ? Math.max(0, legacySeparationVMm)
      : pieceBleedMm * 2;
  const baseMargins = {
    leftMm: readNumber(
      runtimeMargins.leftMm,
      overrideMargins.leftMm,
      legacyMargins.leftMm,
      machineMargins.leftMm,
      0,
    ) ?? 0,
    rightMm: readNumber(
      runtimeMargins.rightMm,
      overrideMargins.rightMm,
      legacyMargins.rightMm,
      machineMargins.rightMm,
      0,
    ) ?? 0,
    topMm: readNumber(
      runtimeMargins.topMm,
      overrideMargins.topMm,
      legacyMargins.topMm,
      machineMargins.topMm,
      0,
    ) ?? 0,
    bottomMm: readNumber(
      runtimeMargins.bottomMm,
      overrideMargins.bottomMm,
      legacyMargins.bottomMm,
      machineMargins.bottomMm,
      0,
    ) ?? 0,
    startMm: readNumber(
      runtimeMargins.startMm,
      overrideMargins.startMm,
      legacyMargins.startMm,
      machineMargins.startMm,
      10,
    ) ?? 10,
    endMm: readNumber(
      runtimeMargins.endMm,
      overrideMargins.endMm,
      legacyMargins.endMm,
      machineMargins.endMm,
      10,
    ) ?? 10,
  };
  const margins = {
    leftMm:
      baseMargins.leftMm +
      (readNumber(runtimeExtraMargins.leftMm, extraMargins.leftMm, 0) ?? 0) +
      pieceBleedMm,
    rightMm:
      baseMargins.rightMm +
      (readNumber(runtimeExtraMargins.rightMm, extraMargins.rightMm, 0) ?? 0) +
      pieceBleedMm,
    topMm:
      baseMargins.topMm +
      (readNumber(runtimeExtraMargins.topMm, extraMargins.topMm, 0) ?? 0) +
      pieceBleedMm,
    bottomMm:
      baseMargins.bottomMm +
      (readNumber(runtimeExtraMargins.bottomMm, extraMargins.bottomMm, 0) ?? 0) +
      pieceBleedMm,
    startMm:
      baseMargins.startMm +
      (readNumber(
        runtimeExtraMargins.startMm,
        runtimeExtraMargins.topMm,
        extraMargins.startMm,
        extraMargins.topMm,
        0,
      ) ?? 0) +
      pieceBleedMm,
    endMm:
      baseMargins.endMm +
      (readNumber(
        runtimeExtraMargins.endMm,
        runtimeExtraMargins.bottomMm,
        extraMargins.endMm,
        extraMargins.bottomMm,
        0,
      ) ?? 0) +
      pieceBleedMm,
  };
  const materialRollWidthMm = readNumber(materialAttrs.anchoMm);
  const machineMaxRollWidthMm = readNumber(
    maqParams.anchoMaxRolloMm,
    maqParams.anchoMaxMm,
    maqParams.anchoUtil,
    paso.maquina?.anchoUtil,
  );
  const shouldValidateRollWidthAgainstMachine =
    geometry === 'ROLLO' && algorithm !== 'shelf-rollo' && algorithm !== 'maxrects-rollo';
  const rollWidthMm =
    materialRollWidthMm != null
      ? shouldValidateRollWidthAgainstMachine &&
        machineMaxRollWidthMm != null &&
        materialRollWidthMm > machineMaxRollWidthMm
        ? null
        : materialRollWidthMm
      : machineMaxRollWidthMm;
  const printableWidthMm =
    rollWidthMm != null ? Math.max(0, rollWidthMm - margins.leftMm - margins.rightMm) : null;
  const runtimePanelizadoConfig = asRecord(runtimeNestingConfig.panelizado);
  const panelizadoConfig = asRecord(nestingConfig.panelizado);
  const pliegoImpresionConfig = asRecord(
    readFirst(
      runtimeNestingConfig.pliegoImpresion,
      nestingConfig.pliegoImpresion,
      nestingConfig.tamanoPliegoImpresion,
    ),
  );
  const purchaseSheetWidthMm = readNumber(materialAttrs.anchoMm);
  const purchaseSheetHeightMm = readNumber(materialAttrs.altoMm, materialAttrs.largoMm);
  const printSheetMode =
    paso.familiaCodigo === 'impresion_por_hoja' &&
    normalizePrintSheetMode(pliegoImpresionConfig.modo, pliegoImpresionConfig.mode) ===
      'automatic'
      ? 'automatic'
      : 'fixed';
  const printSheetCostSource =
    paso.familiaCodigo === 'impresion_por_hoja'
      ? normalizePrintSheetCostSource(pliegoImpresionConfig.origenCosto)
      : 'derivado';
  const printSheetCandidates =
    paso.familiaCodigo === 'impresion_por_hoja'
      ? normalizePrintSheetCandidates(pliegoImpresionConfig.candidatos)
      : [];
  const configuredPrintSheetWidthMm =
    paso.familiaCodigo === 'impresion_por_hoja'
      ? readNumber(
          pliegoImpresionConfig.anchoMm,
          pliegoImpresionConfig.widthMm,
        )
      : null;
  const configuredPrintSheetHeightMm =
    paso.familiaCodigo === 'impresion_por_hoja'
      ? readNumber(
          pliegoImpresionConfig.altoMm,
          pliegoImpresionConfig.largoMm,
          pliegoImpresionConfig.heightMm,
        )
      : null;

  return {
    algorithm,
    allowRotation: readBoolean(
      runtimeNestingConfig.allowRotation,
      nestingConfig.allowRotation,
      params.permitirRotacion,
      true,
    ),
    pieceBleedMm,
    separationHMm,
    separationVMm,
    margins,
    rollWidthMm,
    sheetWidthMm:
      configuredPrintSheetWidthMm ??
      purchaseSheetWidthMm ??
      readNumber(maqParams.anchoMesaMm),
    sheetHeightMm:
      configuredPrintSheetHeightMm ??
      purchaseSheetHeightMm ??
      readNumber(maqParams.largoMesaMm),
    printSheetMode,
    printSheetCostSource,
    printSheetCandidates,
    purchaseSheetWidthMm,
    purchaseSheetHeightMm,
    purchaseSheetPrecio: readNumber(materialResuelto?.precioReferencia),
    machineGeometry: geometry,
    costing: {
      strategy,
      segmentSteps: normalizeSegmentSteps(costingConfig.segmentSteps),
    },
    panelizado: normalizePanelizado(
      runtimePanelizadoConfig,
      panelizadoConfig,
      printableWidthMm,
      paso.defaultsFamilia?.solapePanelMm ?? null,
    ),
  };
}

function defaultMarginForFamily(familiaCodigo: string) {
  if (familiaCodigo === 'impresion_por_hoja') {
    return { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 };
  }
  if (familiaCodigo === 'laminado') {
    return {
      leftMm: 0,
      rightMm: 0,
      topMm: 0,
      bottomMm: 0,
      startMm: 0,
      endMm: 0,
    };
  }
  if (familiaCodigo === 'plastificado_pouch') {
    return { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 };
  }
  return { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 };
}

function defaultSeparationForFamily(familiaCodigo: string) {
  return familiaCodigo === 'impresion_por_area' ||
    familiaCodigo === 'plotter_corte'
    ? 5
    : 0;
}

function uniformMargins(value: number) {
  const margin = Number.isFinite(value) ? Math.max(0, value) : 0;
  return {
    leftMm: margin,
    rightMm: margin,
    topMm: margin,
    bottomMm: margin,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeAlgorithm(value: unknown): NestingAlgorithmPolicy {
  return value === 'shelf-rollo' ||
    value === 'maxrects-rollo' ||
    value === 'grid-2d-single' ||
    value === 'grid-2d-multi'
    ? value
    : 'auto';
}

function normalizeCostingStrategy(
  value: unknown,
): NestingCostingConfig['strategy'] {
  return typeof value === 'string' && COSTING_STRATEGIES.has(value)
    ? (value as NestingCostingConfig['strategy'])
    : 'simple';
}

function normalizeSegmentSteps(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [25, 50, 75, 100];
  return source
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0 && item <= 100)
    .sort((a, b) => a - b);
}

function normalizePanelizado(
  runtimeConfig: Record<string, unknown>,
  config: Record<string, unknown>,
  printableWidthMm: number | null,
  defaultOverlapMm: number | null = null,
): NestingPanelizadoConfig {
  const modeRaw = readFirst(runtimeConfig.mode, config.mode);
  const axisRaw = readFirst(runtimeConfig.axis, config.axis);
  const distributionRaw = readFirst(runtimeConfig.distribution, config.distribution);
  const widthInterpretationRaw = readFirst(
    runtimeConfig.widthInterpretation,
    config.widthInterpretation,
  );
  const rawMaxPanelWidthMm = readNumber(
    runtimeConfig.maxPanelWidthMm,
    config.maxPanelWidthMm,
  );
  const maxPanelWidthMm =
    rawMaxPanelWidthMm != null &&
    rawMaxPanelWidthMm >= MIN_PANEL_MAX_WIDTH_MM
      ? rawMaxPanelWidthMm
      : printableWidthMm ?? 0;

  return {
    enabled: readBoolean(runtimeConfig.enabled, config.enabled, false),
    mode: modeRaw === 'manual' ? 'manual' : 'automatic',
    axis:
      axisRaw === 'automatic' || axisRaw === 'automatica'
        ? 'automatic'
        : axisRaw === 'horizontal'
          ? 'horizontal'
          : axisRaw === 'vertical'
            ? 'vertical'
            : 'automatic',
    // E.1 — runtime → config del producto → default de familia → 20.
    overlapMm:
      readNumber(
        runtimeConfig.overlapMm,
        config.overlapMm,
        defaultOverlapMm,
        20,
      ) ?? 20,
    maxPanelWidthMm,
    distribution: distributionRaw === 'libre' ? 'libre' : 'equilibrada',
    widthInterpretation:
      widthInterpretationRaw === 'util' ? 'util' : 'total',
    manualLayout: asRecord(runtimeConfig.manualLayout).items
      ? asRecord(runtimeConfig.manualLayout)
      : asRecord(config.manualLayout).items
        ? asRecord(config.manualLayout)
        : null,
  };
}

function normalizeMargins(
  value: Record<string, unknown>,
  defaults: Record<string, number | undefined>,
) {
  return {
    leftMm: readNumber(value.leftMm, value.izq, value.izquierdo, defaults.leftMm),
    rightMm: readNumber(value.rightMm, value.der, value.derecho, defaults.rightMm),
    topMm: readNumber(value.topMm, value.sup, defaults.topMm),
    bottomMm: readNumber(value.bottomMm, value.inf, defaults.bottomMm),
    startMm: readNumber(value.startMm, value.inicio, value.sup, defaults.startMm),
    endMm: readNumber(value.endMm, value.fin, value.inf, defaults.endMm),
  };
}

function normalizePrintSheetMode(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'automatico' || normalized === 'automatic') {
      return 'automatic';
    }
  }
  return 'fixed';
}

function normalizePrintSheetCostSource(
  value: unknown,
): 'derivado' | 'por_candidato' {
  if (typeof value !== 'string') return 'derivado';
  const normalized = value.trim().toLowerCase();
  return normalized === 'por_candidato' ||
    normalized === 'materia_prima_por_candidato'
    ? 'por_candidato'
    : 'derivado';
}

function normalizePrintSheetCandidates(value: unknown): PrintSheetCandidateConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      if (record.activo === false || record.enabled === false) return null;
      const anchoMm = readNumber(record.anchoMm, record.widthMm);
      const altoMm = readNumber(record.altoMm, record.largoMm, record.heightMm);
      if (!anchoMm || anchoMm <= 0 || !altoMm || altoMm <= 0) return null;
      const id =
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `candidato_${index + 1}`;
      const nombre =
        typeof record.nombre === 'string' && record.nombre.trim()
          ? record.nombre.trim()
          : typeof record.label === 'string' && record.label.trim()
            ? record.label.trim()
            : `${anchoMm} × ${altoMm} mm`;
      const materiaPrimaVarianteId =
        typeof record.materiaPrimaVarianteId === 'string' &&
        record.materiaPrimaVarianteId.trim()
          ? record.materiaPrimaVarianteId.trim()
          : null;
      return { id, nombre, anchoMm, altoMm, materiaPrimaVarianteId };
    })
    .filter((item): item is PrintSheetCandidateConfig => item !== null);
}

function readBoolean(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return false;
}

function readFirst(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
