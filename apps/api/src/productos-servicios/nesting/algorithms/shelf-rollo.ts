/**
 * Mixed-shelf packing en rollo flexible (gran formato + vinyl).
 *
 * Algoritmo heurístico que acomoda piezas de DIFERENTES tamaños en un
 * rollo (ancho fijo, largo variable). Para cada pieza, evalúa todas las
 * posiciones posibles (rotada o no, en cada fila existente o nueva) y
 * elige el estado con menor largo consumido y menor desperdicio.
 *
 * Soporta:
 *  - Multi-size (varias medidas + cantidad por medida).
 *  - Rotación 90° opcional por pieza.
 *  - Panelizado: piezas más anchas que el rollo se subdividen en N
 *    paneles (automático o manual con solapamiento).
 *
 * Heurística de búsqueda: en cada paso mantiene los 12 mejores estados
 * y descarta el resto para evitar explosión combinatoria.
 *
 * Ported (1:1) desde:
 *   productos-servicios.service.ts:evaluateGranFormatoMixedShelfLayout
 *
 * Mantiene los tipos legacy (GranFormatoCostosPreviewPlacement,
 * GranFormatoNestingOrientation) para no romper consumidores. Cuando
 * Fase 2 normalice todos los motores a tipos universales, se mapea.
 */

import {
  buildGranFormatoPanelizedPieces,
  buildGranFormatoPieceInstances,
  buildGranFormatoManualPieces,
  normalizeGranFormatoPanelManualLayout,
  type GranFormatoMeasure,
  type GranFormatoPanelAxis,
  type GranFormatoPanelAxisInput,
  type GranFormatoPiece,
} from '../helpers/granformato-pieces';

// ─── Tipos ──────────────────────────────────────────────────────────

export type GranFormatoNestingOrientation = 'normal' | 'rotada' | 'mixta';

export type GranFormatoCostosPreviewPlacement = {
  id: string;
  widthMm: number;
  heightMm: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  centerXMm: number;
  centerYMm: number;
  label: string;
  rotated: boolean;
  originalWidthMm: number;
  originalHeightMm: number;
  panelIndex: number | null;
  panelCount: number | null;
  panelAxis: GranFormatoPanelAxis | null;
  sourcePieceId: string | null;
};

export type EvaluateGranFormatoMixedShelfLayoutInput = {
  printableWidthMm: number;
  marginLeftMm: number;
  marginStartMm: number;
  marginEndMm: number;
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  permitirRotacion: boolean;
  medidas: GranFormatoMeasure[];
  panelizado?: {
    activo: boolean;
    mode: 'automatico' | 'manual';
    axis: GranFormatoPanelAxisInput;
    overlapMm: number;
    maxPanelWidthMm: number;
    distribution: 'equilibrada' | 'libre';
    widthInterpretation: 'total' | 'util';
    manualLayout?: Record<string, unknown> | null;
  };
  beamWidth?: number;
};

export type GranFormatoMixedShelfLayoutResult = {
  orientacion: GranFormatoNestingOrientation;
  panelizado: boolean;
  panelAxis: GranFormatoPanelAxisInput | null;
  panelCount: number;
  panelOverlapMm: number | null;
  panelMaxWidthMm: number | null;
  panelDistribution: 'equilibrada' | 'libre' | null;
  panelWidthInterpretation: 'total' | 'util' | null;
  panelMode: 'automatico' | 'manual' | null;
  piecesPerRow: number;
  rows: number;
  consumedLengthMm: number;
  usefulAreaM2: number;
  placements: GranFormatoCostosPreviewPlacement[];
};

// ─── Helpers post-procesamiento ─────────────────────────────────────

function resolvePanelAxisSummary(
  configuredAxis: GranFormatoPanelAxisInput | null | undefined,
  placements: GranFormatoCostosPreviewPlacement[],
): GranFormatoPanelAxisInput | null {
  if (!configuredAxis) return null;
  const axes = new Set(
    placements
      .map((placement) => placement.panelAxis)
      .filter((axis): axis is GranFormatoPanelAxis => axis != null),
  );
  if (axes.size === 0) return null;
  if (axes.size === 1) return [...axes][0];
  return configuredAxis === 'automatic' ? 'automatic' : [...axes][0];
}

export function buildGranFormatoNestingOrientacion(
  placements: Array<{ rotated: boolean }>,
): GranFormatoNestingOrientation {
  if (!placements.length) {
    return 'normal';
  }
  const hasRotated = placements.some((item) => item.rotated);
  const hasNormal = placements.some((item) => !item.rotated);
  if (hasRotated && hasNormal) {
    return 'mixta';
  }
  return hasRotated ? 'rotada' : 'normal';
}

export function countGranFormatoRowsAndPiecesPerRow(
  placements: GranFormatoCostosPreviewPlacement[],
  toleranceMm: number,
): { rows: number; piecesPerRow: number } {
  if (!placements.length) {
    return { rows: 0, piecesPerRow: 0 };
  }
  const rows: Array<{ topMm: number; bottomMm: number; count: number }> = [];
  const sorted = [...placements].sort((a, b) => {
    const topDiff =
      a.centerYMm - a.heightMm / 2 - (b.centerYMm - b.heightMm / 2);
    if (Math.abs(topDiff) > toleranceMm) {
      return topDiff;
    }
    return a.centerXMm - b.centerXMm;
  });
  for (const placement of sorted) {
    const topMm = placement.centerYMm - placement.heightMm / 2;
    const bottomMm = placement.centerYMm + placement.heightMm / 2;
    const existing = rows.find(
      (row) =>
        Math.abs(row.topMm - topMm) <= toleranceMm ||
        (topMm <= row.bottomMm - toleranceMm &&
          bottomMm >= row.topMm + toleranceMm),
    );
    if (existing) {
      existing.topMm = Math.min(existing.topMm, topMm);
      existing.bottomMm = Math.max(existing.bottomMm, bottomMm);
      existing.count += 1;
      continue;
    }
    rows.push({ topMm, bottomMm, count: 1 });
  }
  return {
    rows: rows.length,
    piecesPerRow: rows.reduce((max, row) => Math.max(max, row.count), 0),
  };
}

function uniquePieceOrders(orders: GranFormatoPiece[][]): GranFormatoPiece[][] {
  const seen = new Set<string>();
  const unique: GranFormatoPiece[][] = [];
  for (const order of orders) {
    const key = order.map((piece) => piece.id).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(order);
  }
  return unique;
}

// ─── Algoritmo principal ────────────────────────────────────────────

export function evaluateGranFormatoMixedShelfLayout(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
): GranFormatoMixedShelfLayoutResult | null {
  const manualLayout = normalizeGranFormatoPanelManualLayout(
    input.panelizado?.manualLayout ?? null,
  );
  const pieces: GranFormatoPiece[] | null = input.panelizado?.activo
    ? input.panelizado.mode === 'manual' && manualLayout
      ? buildGranFormatoManualPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          widthInterpretation: input.panelizado.widthInterpretation,
          manualLayout,
        })
      : buildGranFormatoPanelizedPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          allowRotation: input.permitirRotacion,
          panelAxis: input.panelizado.axis,
          overlapMm: input.panelizado.overlapMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          distribution: input.panelizado.distribution,
          widthInterpretation: input.panelizado.widthInterpretation,
        })
    : buildGranFormatoPieceInstances(input.medidas);
  if (!pieces || !pieces.length) {
    return null;
  }
  type Row = {
    yMm: number;
    usedWidthMm: number;
    heightMm: number;
    count: number;
  };
  type State = {
    rows: Row[];
    placements: GranFormatoCostosPreviewPlacement[];
  };

  const resolveNextRowY = (rows: Row[]) => {
    if (!rows.length) {
      return input.marginStartMm;
    }
    const last = rows[rows.length - 1];
    return last.yMm + last.heightMm + input.separacionVerticalMm;
  };

  const measureState = (state: State) => {
    const contentHeightMm = state.rows.reduce(
      (acc, row) => acc + row.heightMm,
      0,
    );
    const verticalGapsMm =
      state.rows.length > 1
        ? (state.rows.length - 1) * input.separacionVerticalMm
        : 0;
    const consumedContentLengthMm = contentHeightMm + verticalGapsMm;
    const placedAreaMm2 = state.placements.reduce(
      (acc, placement) =>
        acc + placement.originalWidthMm * placement.originalHeightMm,
      0,
    );
    const wasteProxyMm2 =
      input.printableWidthMm * consumedContentLengthMm - placedAreaMm2;
    return { consumedContentLengthMm, wasteProxyMm2 };
  };

  const rankStates = (a: State, b: State) => {
    const left = measureState(a);
    const right = measureState(b);
    return (
      left.consumedContentLengthMm - right.consumedContentLengthMm ||
      left.wasteProxyMm2 - right.wasteProxyMm2 ||
      a.rows.length - b.rows.length
    );
  };

  const solveOrder = (orderedPieces: GranFormatoPiece[]): State | null => {
    let states: State[] = [{ rows: [], placements: [] }];

    for (const piece of orderedPieces) {
      const orientations = [
        {
          widthMm: piece.widthMm,
          heightMm: piece.heightMm,
          rotated: false,
        },
        ...(input.permitirRotacion && piece.widthMm !== piece.heightMm
          ? [
              {
                widthMm: piece.heightMm,
                heightMm: piece.widthMm,
                rotated: true,
              },
            ]
          : []),
      ];
      const nextStates: State[] = [];

      for (const state of states) {
        for (const option of orientations) {
          if (option.widthMm > input.printableWidthMm) {
            continue;
          }

          for (const [rowIndex, row] of state.rows.entries()) {
            const nextWidth =
              row.usedWidthMm === 0
                ? option.widthMm
                : row.usedWidthMm +
                  input.separacionHorizontalMm +
                  option.widthMm;
            if (nextWidth > input.printableWidthMm) {
              continue;
            }
            const rows = state.rows.map((item) => ({ ...item }));
            const targetRow = rows[rowIndex];
            const xMm =
              targetRow.usedWidthMm === 0
                ? input.marginLeftMm
                : input.marginLeftMm +
                  targetRow.usedWidthMm +
                  input.separacionHorizontalMm;
            targetRow.usedWidthMm = nextWidth;
            targetRow.heightMm = Math.max(targetRow.heightMm, option.heightMm);
            targetRow.count += 1;
            nextStates.push({
              rows,
              placements: [
                ...state.placements,
                {
                  id: piece.id,
                  widthMm: option.widthMm,
                  heightMm: option.heightMm,
                  centerXMm: xMm + option.widthMm / 2,
                  centerYMm: targetRow.yMm + option.heightMm / 2,
                  label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(
                    piece.originalHeightMm / 10,
                  )} cm`,
                  rotated: option.rotated,
                  originalWidthMm: piece.originalWidthMm,
                  originalHeightMm: piece.originalHeightMm,
                  panelIndex: piece.panelIndex,
                  panelCount: piece.panelCount,
                  panelAxis: piece.panelAxis,
                  sourcePieceId: piece.sourcePieceId,
                  usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                  usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                  overlapStartMm: piece.overlapStartMm ?? 0,
                  overlapEndMm: piece.overlapEndMm ?? 0,
                },
              ],
            });
          }

          const rows = state.rows.map((item) => ({ ...item }));
          const newRow: Row = {
            yMm: resolveNextRowY(rows),
            usedWidthMm: option.widthMm,
            heightMm: option.heightMm,
            count: 1,
          };
          rows.push(newRow);
          nextStates.push({
            rows,
            placements: [
              ...state.placements,
              {
                id: piece.id,
                widthMm: option.widthMm,
                heightMm: option.heightMm,
                centerXMm: input.marginLeftMm + option.widthMm / 2,
                centerYMm: newRow.yMm + option.heightMm / 2,
                label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(
                  piece.originalHeightMm / 10,
                )} cm`,
                rotated: option.rotated,
                originalWidthMm: piece.originalWidthMm,
                originalHeightMm: piece.originalHeightMm,
                panelIndex: piece.panelIndex,
                panelCount: piece.panelCount,
                panelAxis: piece.panelAxis,
                sourcePieceId: piece.sourcePieceId,
                usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                overlapStartMm: piece.overlapStartMm ?? 0,
                overlapEndMm: piece.overlapEndMm ?? 0,
              },
            ],
          });
        }
      }

      if (!nextStates.length) {
        return null;
      }

      states = nextStates
        .sort(rankStates)
        .slice(0, Math.max(12, input.beamWidth ?? 64));
    }

    return [...states].sort(rankStates)[0] ?? null;
  };

  const pieceOrders = uniquePieceOrders([
    pieces,
    [...pieces].sort((a, b) => b.area - a.area),
    [...pieces].sort(
      (a, b) => b.widthMm - a.widthMm || b.heightMm - a.heightMm,
    ),
    [...pieces].sort(
      (a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm,
    ),
    [...pieces].sort(
      (a, b) => b.shortestSide - a.shortestSide || b.area - a.area,
    ),
  ]);
  const bestState = pieceOrders
    .map((order) => solveOrder(order))
    .filter((state): state is State => state != null)
    .sort(rankStates)[0];

  if (!bestState) {
    return null;
  }

  const contentHeightMm = bestState.rows.reduce(
    (acc, row) => acc + row.heightMm,
    0,
  );
  const verticalGapsMm =
    bestState.rows.length > 1
      ? (bestState.rows.length - 1) * input.separacionVerticalMm
      : 0;
  const consumedLengthMm =
    input.marginStartMm + input.marginEndMm + contentHeightMm + verticalGapsMm;
  const usefulAreaM2 = input.medidas.reduce(
    (acc, item) =>
      acc + ((item.anchoMm * item.altoMm) / 1_000_000) * item.cantidad,
    0,
  );
  const { rows: rowCount, piecesPerRow } = countGranFormatoRowsAndPiecesPerRow(
    bestState.placements,
    Math.max(1, input.separacionVerticalMm / 2),
  );
  const panelAxisSummary = resolvePanelAxisSummary(
    input.panelizado?.activo ? input.panelizado.axis : null,
    bestState.placements,
  );

  return {
    orientacion: buildGranFormatoNestingOrientacion(bestState.placements),
    panelizado: input.panelizado?.activo === true,
    panelAxis: panelAxisSummary,
    panelCount: bestState.placements.reduce(
      (max, item) => Math.max(max, item.panelCount ?? 1),
      1,
    ),
    panelOverlapMm: input.panelizado?.activo
      ? input.panelizado.overlapMm
      : null,
    panelMaxWidthMm: input.panelizado?.activo
      ? input.panelizado.maxPanelWidthMm
      : null,
    panelDistribution: input.panelizado?.activo
      ? input.panelizado.distribution
      : null,
    panelWidthInterpretation: input.panelizado?.activo
      ? input.panelizado.widthInterpretation
      : null,
    panelMode: input.panelizado?.activo ? input.panelizado.mode : null,
    piecesPerRow,
    rows: rowCount,
    consumedLengthMm,
    usefulAreaM2,
    placements: bestState.placements,
  };
}
