/**
 * Adapter para imposición de pliegos del motor digital (y reflex en
 * pliegos de vinyl_cut).
 *
 * El service usa `calculateImposicion` con un input que mezcla geometría
 * pura (pieza, sheet, márgenes de máquina) con config del producto
 * (tipo de corte, demasía, líneas de corte, parámetros de troquelado).
 *
 * Este adapter:
 *  1. Resuelve la lógica config-aware (efectivos, márgenes ampliados).
 *  2. Delega el grid 2D rectangular a `nestGrid2DSingle` (algoritmo puro).
 *  3. Reconstruye el output legacy `ImposicionBase` campo por campo.
 *
 * Comportamiento idéntico al método privado original (validado vía
 * snapshots HTTP de cotizaciones reales).
 */

import { nestGrid2DSingle } from '../algorithms/grid-2d-single';
import type { Piece, SheetSubstrate } from '../types';

export interface CalculateImposicionInput {
  varianteAnchoMm: number;
  varianteAltoMm: number;
  sheetAnchoMm: number;
  sheetAltoMm: number;
  machineMargins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  config: Record<string, unknown>;
}

export interface CalculateImposicionResult {
  tipoCorte: string;
  piezasPorPliego: number;
  orientacion: 'normal' | 'rotada';
  anchoImprimibleMm: number;
  altoImprimibleMm: number;
  anchoDisponibleMm: number;
  altoDisponibleMm: number;
  normal: number;
  rotada: number;
  demasiaCorteMm: number;
  lineaCorteMm: number;
  piezaAnchoMm: number;
  piezaAltoMm: number;
  piezaAnchoEfectivoMm: number;
  piezaAltoEfectivoMm: number;
  cols: number;
  rows: number;
  sheetAnchoMm: number;
  sheetAltoMm: number;
  machineMargins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
}

/**
 * Reemplazo bit-exacto de service.ts:calculateImposicion (privado).
 */
export function calculateImposicionV2(
  input: CalculateImposicionInput,
): CalculateImposicionResult {
  // ─── 1. Resolver tipo de corte (compat legacy) ─────────────────
  const tipoCorteValue = input.config.tipoCorte;
  const rawTipoCorte =
    typeof tipoCorteValue === 'string' || typeof tipoCorteValue === 'number'
      ? String(tipoCorteValue)
      : 'sin_demasia';
  const tipoCorte =
    rawTipoCorte === 'sin_corte' ||
    rawTipoCorte === 'guillotina' ||
    rawTipoCorte === 'corte_manual' ||
    rawTipoCorte === 'troquelado'
      ? rawTipoCorte
      : 'guillotina';

  // ─── 2. Demasía y separación entre piezas (config-aware) ───────
  const troquelado =
    input.config.troquelado &&
    typeof input.config.troquelado === 'object' &&
    !Array.isArray(input.config.troquelado)
      ? (input.config.troquelado as Record<string, unknown>)
      : {};

  const demasiaRaw =
    tipoCorte === 'troquelado'
      ? Number(troquelado.sangriadoTroquelMm ?? 3)
      : Number(input.config.demasiaCorteMm ?? 0);
  const demasiaCorteMm =
    tipoCorte !== 'sin_corte' && Number.isFinite(demasiaRaw)
      ? Math.max(0, demasiaRaw)
      : 0;

  const lineaCorteRaw =
    tipoCorte === 'troquelado'
      ? 0
      : tipoCorte === 'sin_corte'
        ? 0
        : Number(input.config.lineaCorteMm ?? 3);
  const lineaCorteMm = Number.isFinite(lineaCorteRaw)
    ? Math.max(0, lineaCorteRaw)
    : 3;

  const separacionEntrePiezasMm =
    tipoCorte === 'troquelado'
      ? Math.max(0, Number(troquelado.separacionEntreContornosMm ?? 3))
      : 0;

  const piezaAnchoEfectivoMm =
    input.varianteAnchoMm + 2 * demasiaCorteMm + separacionEntrePiezasMm;
  const piezaAltoEfectivoMm =
    input.varianteAltoMm + 2 * demasiaCorteMm + separacionEntrePiezasMm;

  // ─── 3. Márgenes (con plotter para troquelado) ─────────────────
  let marginLeftMm = input.machineMargins.leftMm;
  let marginRightMm = input.machineMargins.rightMm;
  let marginTopMm = input.machineMargins.topMm;
  let marginBottomMm = input.machineMargins.bottomMm;
  if (tipoCorte === 'troquelado') {
    const anchoUtilPlotter = Math.min(
      input.sheetAnchoMm,
      Math.max(
        0,
        Number(troquelado.anchoUtilPlotterMm ?? input.sheetAnchoMm - 20),
      ),
    );
    const altoUtilPlotter = Math.min(
      input.sheetAltoMm,
      Math.max(
        0,
        Number(troquelado.altoUtilPlotterMm ?? input.sheetAltoMm - 20),
      ),
    );
    const plotterMarginH = Math.max(
      0,
      (input.sheetAnchoMm - anchoUtilPlotter) / 2,
    );
    const plotterMarginV = Math.max(
      0,
      (input.sheetAltoMm - altoUtilPlotter) / 2,
    );
    marginLeftMm = Math.max(marginLeftMm, plotterMarginH);
    marginRightMm = Math.max(marginRightMm, plotterMarginH);
    marginTopMm = Math.max(marginTopMm, plotterMarginV);
    marginBottomMm = Math.max(marginBottomMm, plotterMarginV);
  }

  const anchoImprimible = input.sheetAnchoMm - marginLeftMm - marginRightMm;
  const altoImprimible = input.sheetAltoMm - marginTopMm - marginBottomMm;
  const anchoDisponible = anchoImprimible - 2 * lineaCorteMm;
  const altoDisponible = altoImprimible - 2 * lineaCorteMm;

  // ─── 4. Delegar el grid 2D al algoritmo universal ──────────────
  // Margenes efectivos = machineMargins + lineaCorteMm en todos los lados.
  const piece: Piece = {
    id: 'pieza',
    widthMm: piezaAnchoEfectivoMm,
    heightMm: piezaAltoEfectivoMm,
    quantity: 1,
  };
  const substrate: SheetSubstrate = {
    kind: 'sheet',
    widthMm: input.sheetAnchoMm,
    heightMm: input.sheetAltoMm,
    margins: {
      leftMm: marginLeftMm + lineaCorteMm,
      rightMm: marginRightMm + lineaCorteMm,
      topMm: marginTopMm + lineaCorteMm,
      bottomMm: marginBottomMm + lineaCorteMm,
    },
  };

  // Orientación normal (pieza tal cual)
  const normalResult = nestGrid2DSingle(piece, substrate, {
    separationHMm: 0,
    separationVMm: 0,
    allowRotation: false,
  });
  const normal = normalResult.metrics.piezasPorSustrato ?? 0;
  const normalCols = normalResult.metrics.columnas ?? 0;
  const normalRows = normalResult.metrics.filas ?? 0;

  // Orientación rotada (pieza con dimensiones intercambiadas)
  const rotatedPiece: Piece = {
    ...piece,
    widthMm: piezaAltoEfectivoMm,
    heightMm: piezaAnchoEfectivoMm,
  };
  const rotatedResult = nestGrid2DSingle(rotatedPiece, substrate, {
    separationHMm: 0,
    separationVMm: 0,
    allowRotation: false,
  });
  const rotada = rotatedResult.metrics.piezasPorSustrato ?? 0;
  const rotCols = rotatedResult.metrics.columnas ?? 0;
  const rotRows = rotatedResult.metrics.filas ?? 0;

  const piezasPorPliego = Math.max(normal, rotada);
  const orientacion: 'normal' | 'rotada' =
    rotada > normal ? 'rotada' : 'normal';
  const cols = orientacion === 'rotada' ? rotCols : normalCols;
  const rows = orientacion === 'rotada' ? rotRows : normalRows;

  // ─── 5. Construir output legacy ────────────────────────────────
  return {
    tipoCorte,
    piezasPorPliego,
    orientacion,
    anchoImprimibleMm: Number(anchoImprimible.toFixed(2)),
    altoImprimibleMm: Number(altoImprimible.toFixed(2)),
    anchoDisponibleMm: Number(anchoDisponible.toFixed(2)),
    altoDisponibleMm: Number(altoDisponible.toFixed(2)),
    normal,
    rotada,
    demasiaCorteMm: Number(demasiaCorteMm.toFixed(2)),
    lineaCorteMm: Number(lineaCorteMm.toFixed(2)),
    piezaAnchoMm: input.varianteAnchoMm,
    piezaAltoMm: input.varianteAltoMm,
    piezaAnchoEfectivoMm: Number(piezaAnchoEfectivoMm.toFixed(2)),
    piezaAltoEfectivoMm: Number(piezaAltoEfectivoMm.toFixed(2)),
    cols,
    rows,
    sheetAnchoMm: input.sheetAnchoMm,
    sheetAltoMm: input.sheetAltoMm,
    machineMargins: input.machineMargins,
  };
}
