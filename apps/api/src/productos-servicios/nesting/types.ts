/**
 * Tipos públicos del módulo de nesting universal.
 *
 * Diseñados para cubrir los 4 algoritmos actuales (rigid grid, digital
 * imposición, talonario tete-beche, gran formato shelf-rollo) sin perder
 * ningún campo de los tipos legacy de cada motor.
 *
 * Generic `<T>` permite que el caller adjunte metadata libre que viaja
 * con cada pieza/placement (ej. variante, color, label, sourcePieceId).
 *
 * Ver `docs/nesting-abstraccion-diseno.md` para diseño completo.
 */

// ─── Pieza ────────────────────────────────────────────────────────

/** Una pieza a acomodar. */
export interface Piece<T = unknown> {
  /** ID estable para trazabilidad. Lo provee el caller. */
  id: string;
  /** Medidas finales (ya con sangrado/demasía aplicada si corresponde). */
  widthMm: number;
  heightMm: number;
  /** Cantidad de instancias requeridas. */
  quantity: number;
  /** Metadata libre del caller. */
  meta?: T;
}

// ─── Sustrato (donde se acomodan las piezas) ──────────────────────

/** Discriminated union por geometría del sustrato. */
export type Substrate =
  | SheetSubstrate    // pliego de papel, placa rígida, cualquier rectángulo finito
  | RollSubstrate;    // rollo (ancho fijo, largo variable)

export interface SheetSubstrate {
  kind: 'sheet';
  widthMm: number;
  heightMm: number;
  margins?: Margins;
}

export interface RollSubstrate {
  kind: 'roll';
  widthMm: number;
  margins?: Margins;
}

export interface Margins {
  topMm?: number;
  bottomMm?: number;
  leftMm?: number;
  rightMm?: number;
  /** Para rollos: borde de inicio (donde arranca el primer trabajo). */
  startMm?: number;
  /** Para rollos: borde de fin. */
  endMm?: number;
}

// ─── Opciones del algoritmo ───────────────────────────────────────

export interface NestingOptions {
  separationHMm?: number;
  separationVMm?: number;
  allowRotation?: boolean;
  /** Para shelf-rollo: panelizar piezas mayores al ancho útil. */
  panelizado?: PanelizadoOptions;
}

export interface PanelizadoOptions {
  enabled: boolean;
  mode: 'automatic' | 'manual';
  axis: 'vertical' | 'horizontal';
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
}

// ─── Resultado: posición individual ────────────────────────────────

export interface Placement<T = unknown> {
  /** ID de la pieza original (referencia a Piece.id). */
  pieceId: string;
  /** Esquina superior-izquierda en el sustrato. Origen (0,0) = top-left. */
  xMm: number;
  yMm: number;
  /** Medidas finales en el placement. Si rotated=true, son las del lado largo en horizontal. */
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  /** Para panelizado: índice del panel y total de paneles. */
  panelIndex?: number;
  panelCount?: number;
  panelAxis?: 'vertical' | 'horizontal';
  /** Para piezas con sangrado/demasía: medidas útiles vs totales. */
  usefulWidthMm?: number;
  usefulHeightMm?: number;
  overlapStartMm?: number;
  overlapEndMm?: number;
  /** Metadata heredada de la pieza. */
  meta?: T;
}

// ─── Resultado: uso de sustrato ───────────────────────────────────

export type SubstrateUsage =
  | { kind: 'sheet'; count: number; widthMm: number; heightMm: number }
  | { kind: 'roll'; lengthMm: number; widthMm: number };

// ─── Resultado: agregado completo ─────────────────────────────────

export interface NestingResult<T = unknown> {
  algorithm: NestingAlgorithm;
  /** Sustratos consumidos. Para sheet: cuántas placas/pliegos. Para roll: longitud. */
  substrates: SubstrateUsage[];
  placements: Placement<T>[];
  metrics: NestingMetrics;
}

export type NestingAlgorithm =
  | 'grid-2d-single'
  | 'grid-2d-multi'
  | 'shelf-rollo';

export interface NestingMetrics {
  /** Solo grid-2d-single: cantidad de columnas resultantes. */
  columnas?: number;
  /** Solo grid-2d-single: cantidad de filas resultantes. */
  filas?: number;
  /** Solo grid-2d-single: si se eligió la orientación rotada (90°). */
  rotada?: boolean;
  /** Solo grid-2d-single y grid-2d-multi: piezas por sustrato (1 sustrato base). */
  piezasPorSustrato?: number;
  /** Aprovechamiento del sustrato en %. */
  aprovechamientoPct: number;
  /** Área útil acumulada (suma de placements). */
  areaUtilMm2: number;
  /** Área total del sustrato (1 sustrato × medida) — para single y multi solo se usa el bin base. */
  areaTotalMm2: number;
  /** Solo shelf-rollo: largo consumido del rollo. */
  consumedLengthMm?: number;
  /** Solo shelf-rollo: área de desperdicio en m². */
  wasteAreaM2?: number;
  /** Solo grid-2d-single: largo consumido en una placa parcial (para costeo largo_consumido). */
  largoConsumidoMm?: number;
}
