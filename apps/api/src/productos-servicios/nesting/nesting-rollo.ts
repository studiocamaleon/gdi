/**
 * Nesting en rollo continuo — funciones puras.
 *
 * Usa-casos: gran formato látex/eco/solvente/UV rollo, vinilo adhesivo,
 * vinilo de corte, lona. Cualquier sustrato que venga en formato de "rollo"
 * (ancho fijo × largo "infinito").
 *
 * Features:
 * - Mixed-shelf layout (filas de altura variable) con mini-búsqueda de
 *   12 candidatos por pieza para minimizar largo consumido.
 * - Rotación opcional por pieza.
 * - Cuatro márgenes no-imprimibles de la máquina (izq/der/inicio/fin).
 * - Panelizado en modos automático y manual:
 *   - Automático: parte piezas que no caben en el ancho en sub-paneles con solape.
 *   - Manual: el operador define el layout de paneles por pieza.
 * - Distribución de paneles: equilibrada o libre.
 * - Interpretación de ancho máximo como "total" (incluye solape) o "útil" (sin solape).
 *
 * Origen: extraído de `productos-servicios.service.ts` en C.2.3
 * (métodos privados `evaluateGranFormatoMixedShelfLayout`,
 * `buildGranFormatoPanelizedPieces`, `buildGranFormatoManualPieces`,
 * `normalizeGranFormatoPanelManualLayout`, y helpers afines).
 */

// ─── Tipos públicos ─────────────────────────────────────────────

export type NestingRolloOrientacion = 'normal' | 'rotada' | 'mixta';

export type NestingRolloPlacement = {
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
  panelAxis: 'vertical' | 'horizontal' | null;
  sourcePieceId: string | null;
};

export type NestingRolloMedida = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
};

export type NestingRolloPanelizadoConfig = {
  activo: boolean;
  mode: 'automatico' | 'manual';
  axis: 'vertical' | 'horizontal';
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
  manualLayout?: Record<string, unknown> | null;
};

export type NestingRolloInput = {
  /** Ancho imprimible de la máquina (en mm), ya restados los márgenes laterales no-imprimibles. */
  printableWidthMm: number;
  /** Margen izquierdo del rollo (no imprimible). */
  marginLeftMm: number;
  /** Margen superior (inicio del rollo, no imprimible). */
  marginStartMm: number;
  /** Margen inferior (fin, no imprimible). */
  marginEndMm: number;
  /** Separación horizontal entre piezas. */
  separacionHorizontalMm: number;
  /** Separación vertical entre filas. */
  separacionVerticalMm: number;
  /** Permitir rotar piezas para optimizar aprovechamiento. */
  permitirRotacion: boolean;
  /** Medidas del pedido. */
  medidas: NestingRolloMedida[];
  /** Si se debe panelizar piezas más grandes que el ancho disponible. Opcional. */
  panelizado?: NestingRolloPanelizadoConfig;
};

export type NestingRolloResult = {
  orientacion: NestingRolloOrientacion;
  panelizado: boolean;
  panelAxis: 'vertical' | 'horizontal' | null;
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
  placements: NestingRolloPlacement[];
};

type ManualLayoutNormalizado = {
  items: Array<{
    sourcePieceId: string;
    pieceWidthMm: number;
    pieceHeightMm: number;
    axis: 'vertical' | 'horizontal';
    panels: Array<{
      panelIndex: number;
      usefulWidthMm: number;
      usefulHeightMm: number;
      overlapStartMm: number;
      overlapEndMm: number;
      finalWidthMm: number;
      finalHeightMm: number;
    }>;
  }>;
};

type PiezaInstancia = {
  id: string;
  sourcePieceId: string;
  originalWidthMm: number;
  originalHeightMm: number;
  widthMm: number;
  heightMm: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  area: number;
  longestSide: number;
  shortestSide: number;
  panelIndex: number | null;
  panelCount: number | null;
  panelAxis: 'vertical' | 'horizontal' | null;
};

// ─── Helpers internos ─────────────────────────────────────────────

function getNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildPieceInstances(medidas: NestingRolloMedida[]): PiezaInstancia[] {
  return medidas
    .flatMap((medida, medidaIndex) =>
      Array.from({ length: Math.max(1, medida.cantidad) }, (_, copyIndex) => ({
        id: `piece-${medidaIndex}-${copyIndex}`,
        sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
        originalWidthMm: medida.anchoMm,
        originalHeightMm: medida.altoMm,
        widthMm: medida.anchoMm,
        heightMm: medida.altoMm,
        usefulWidthMm: medida.anchoMm,
        usefulHeightMm: medida.altoMm,
        overlapStartMm: 0,
        overlapEndMm: 0,
        area: medida.anchoMm * medida.altoMm,
        longestSide: Math.max(medida.anchoMm, medida.altoMm),
        shortestSide: Math.min(medida.anchoMm, medida.altoMm),
        panelIndex: null as number | null,
        panelCount: null as number | null,
        panelAxis: null as 'vertical' | 'horizontal' | null,
      })),
    )
    .sort(
      (a, b) =>
        b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide,
    );
}

function buildPanelizedPieces(input: {
  medidas: NestingRolloMedida[];
  printableWidthMm: number;
  panelAxis: 'vertical' | 'horizontal';
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
}): PiezaInstancia[] | null {
  const pieces: PiezaInstancia[] = [];

  const buildSplitSizes = (totalMm: number, panelCount: number, maxUsefulWidthMm: number) => {
    if (input.distribution === 'libre') {
      const sizes: number[] = [];
      let remaining = totalMm;
      for (let index = 0; index < panelCount; index += 1) {
        const segmentsLeft = panelCount - index;
        if (segmentsLeft === 1) {
          sizes.push(remaining);
          break;
        }
        const next = Math.min(maxUsefulWidthMm, remaining - (segmentsLeft - 1));
        sizes.push(next);
        remaining -= next;
      }
      return sizes;
    }
    const base = Math.floor(totalMm / panelCount);
    const remainder = totalMm % panelCount;
    return Array.from({ length: panelCount }, (_, index) => base + (index < remainder ? 1 : 0));
  };

  for (const [medidaIndex, medida] of input.medidas.entries()) {
    for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
      const sourcePieceId = `piece-${medidaIndex}-${copyIndex}`;
      const splitDimension = input.panelAxis === 'vertical' ? medida.anchoMm : medida.altoMm;
      const effectivePhysicalLimitMm = Math.min(input.maxPanelWidthMm, input.printableWidthMm);
      const maxOverlapPerPanelMm = input.overlapMm * 2;
      const effectiveUsefulLimitMm =
        input.widthInterpretation === 'total'
          ? effectivePhysicalLimitMm - maxOverlapPerPanelMm
          : effectivePhysicalLimitMm;
      if (effectiveUsefulLimitMm <= 0) return null;
      if (splitDimension <= effectiveUsefulLimitMm) return null;
      const panelCountResolved = Math.max(2, Math.ceil(splitDimension / effectiveUsefulLimitMm));
      const panelSizes = buildSplitSizes(splitDimension, panelCountResolved, effectiveUsefulLimitMm);
      const fits = panelSizes.every((segment, index) => {
        const extraStart = index === 0 ? 0 : input.overlapMm;
        const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
        const physicalSize = segment + extraStart + extraEnd;
        const withinConfiguredLimit =
          input.widthInterpretation === 'total'
            ? physicalSize <= effectivePhysicalLimitMm
            : segment <= effectivePhysicalLimitMm;
        return withinConfiguredLimit && physicalSize <= input.printableWidthMm;
      });
      if (!fits) return null;

      panelSizes.forEach((segment, index) => {
        const extraStart = index === 0 ? 0 : input.overlapMm;
        const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
        const widthMm =
          input.panelAxis === 'vertical' ? segment + extraStart + extraEnd : medida.anchoMm;
        const heightMm =
          input.panelAxis === 'horizontal' ? segment + extraStart + extraEnd : medida.altoMm;
        pieces.push({
          id: `${sourcePieceId}-panel-${index + 1}`,
          sourcePieceId,
          originalWidthMm: medida.anchoMm,
          originalHeightMm: medida.altoMm,
          widthMm,
          heightMm,
          usefulWidthMm: input.panelAxis === 'vertical' ? segment : medida.anchoMm,
          usefulHeightMm: input.panelAxis === 'horizontal' ? segment : medida.altoMm,
          overlapStartMm: extraStart,
          overlapEndMm: extraEnd,
          panelIndex: index + 1,
          panelCount: panelCountResolved,
          panelAxis: input.panelAxis,
          area: medida.anchoMm * medida.altoMm,
          longestSide: Math.max(widthMm, heightMm),
          shortestSide: Math.min(widthMm, heightMm),
        });
      });
    }
  }

  return pieces.sort(
    (a, b) =>
      b.longestSide - a.longestSide ||
      b.area - a.area ||
      b.shortestSide - a.shortestSide,
  );
}

export function normalizeManualLayout(
  value: Record<string, unknown> | null | undefined,
): ManualLayoutNormalizado | null {
  const itemsRaw = Array.isArray(value?.items) ? (value.items as unknown[]) : null;
  if (!itemsRaw?.length) return null;
  const items = itemsRaw
    .map((item) => {
      const current = item as Record<string, unknown>;
      const panelsRaw = Array.isArray(current.panels) ? current.panels : [];
      const sourcePieceId = typeof current.sourcePieceId === 'string' ? current.sourcePieceId.trim() : '';
      const axis =
        current.axis === 'horizontal' ? 'horizontal' : current.axis === 'vertical' ? 'vertical' : null;
      const pieceWidthMm = getNullableNumber(current.pieceWidthMm);
      const pieceHeightMm = getNullableNumber(current.pieceHeightMm);
      const panels = panelsRaw
        .map((panel) => {
          const currentPanel = panel as Record<string, unknown>;
          return {
            panelIndex: Math.max(1, Number(currentPanel.panelIndex ?? 1)),
            usefulWidthMm: getNullableNumber(currentPanel.usefulWidthMm) ?? 0,
            usefulHeightMm: getNullableNumber(currentPanel.usefulHeightMm) ?? 0,
            overlapStartMm: getNullableNumber(currentPanel.overlapStartMm) ?? 0,
            overlapEndMm: getNullableNumber(currentPanel.overlapEndMm) ?? 0,
            finalWidthMm: getNullableNumber(currentPanel.finalWidthMm) ?? 0,
            finalHeightMm: getNullableNumber(currentPanel.finalHeightMm) ?? 0,
          };
        })
        .filter((panel) => panel.finalWidthMm > 0 && panel.finalHeightMm > 0)
        .sort((a, b) => a.panelIndex - b.panelIndex);
      if (!sourcePieceId || !axis || !pieceWidthMm || !pieceHeightMm || !panels.length) {
        return null;
      }
      return {
        sourcePieceId,
        pieceWidthMm,
        pieceHeightMm,
        axis: axis as 'vertical' | 'horizontal',
        panels,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return items.length ? { items } : null;
}

function buildManualPieces(input: {
  medidas: NestingRolloMedida[];
  printableWidthMm: number;
  maxPanelWidthMm: number;
  widthInterpretation: 'total' | 'util';
  manualLayout: ManualLayoutNormalizado;
}): PiezaInstancia[] | null {
  const expectedPieces = buildPieceInstances(input.medidas);
  if (expectedPieces.length !== input.manualLayout.items.length) return null;
  const byId = new Map(input.manualLayout.items.map((item) => [item.sourcePieceId, item]));
  const pieces: PiezaInstancia[] = [];

  for (const sourcePiece of expectedPieces) {
    const layout = byId.get(sourcePiece.sourcePieceId);
    if (!layout) return null;
    const expectedTotal =
      layout.axis === 'vertical' ? sourcePiece.originalWidthMm : sourcePiece.originalHeightMm;
    const usefulTotal = layout.panels.reduce(
      (acc, panel) => acc + (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm),
      0,
    );
    if (Math.abs(usefulTotal - expectedTotal) > 1) return null;

    for (const panel of layout.panels) {
      const physicalLimitOk =
        input.widthInterpretation === 'total'
          ? (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.maxPanelWidthMm
          : (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm) <= input.maxPanelWidthMm;
      const printableFit =
        (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.printableWidthMm;
      if (
        panel.usefulWidthMm <= 0 ||
        panel.usefulHeightMm <= 0 ||
        panel.finalWidthMm <= 0 ||
        panel.finalHeightMm <= 0 ||
        !physicalLimitOk ||
        !printableFit
      ) {
        return null;
      }
      pieces.push({
        id: `${layout.sourcePieceId}-panel-${panel.panelIndex}`,
        sourcePieceId: layout.sourcePieceId,
        originalWidthMm: layout.pieceWidthMm,
        originalHeightMm: layout.pieceHeightMm,
        widthMm: panel.finalWidthMm,
        heightMm: panel.finalHeightMm,
        usefulWidthMm: panel.usefulWidthMm,
        usefulHeightMm: panel.usefulHeightMm,
        overlapStartMm: panel.overlapStartMm,
        overlapEndMm: panel.overlapEndMm,
        panelIndex: panel.panelIndex,
        panelCount: layout.panels.length,
        panelAxis: layout.axis,
        area: layout.pieceWidthMm * layout.pieceHeightMm,
        longestSide: Math.max(panel.finalWidthMm, panel.finalHeightMm),
        shortestSide: Math.min(panel.finalWidthMm, panel.finalHeightMm),
      });
    }
  }

  return pieces.sort(
    (a, b) =>
      b.longestSide - a.longestSide ||
      b.area - a.area ||
      b.shortestSide - a.shortestSide,
  );
}

function buildOrientacion(placements: Array<{ rotated: boolean }>): NestingRolloOrientacion {
  if (!placements.length) return 'normal';
  const hasRotated = placements.some((item) => item.rotated);
  const hasNormal = placements.some((item) => !item.rotated);
  if (hasRotated && hasNormal) return 'mixta';
  return hasRotated ? 'rotada' : 'normal';
}

function countRowsAndPiecesPerRow(
  placements: NestingRolloPlacement[],
  toleranceMm: number,
) {
  if (!placements.length) return { rows: 0, piecesPerRow: 0 };
  const rows: Array<{ topMm: number; bottomMm: number; count: number }> = [];
  const sorted = [...placements].sort((a, b) => {
    const topDiff = a.centerYMm - a.heightMm / 2 - (b.centerYMm - b.heightMm / 2);
    if (Math.abs(topDiff) > toleranceMm) return topDiff;
    return a.centerXMm - b.centerXMm;
  });
  for (const placement of sorted) {
    const topMm = placement.centerYMm - placement.heightMm / 2;
    const bottomMm = placement.centerYMm + placement.heightMm / 2;
    const existing = rows.find(
      (row) =>
        Math.abs(row.topMm - topMm) <= toleranceMm ||
        (topMm <= row.bottomMm - toleranceMm && bottomMm >= row.topMm + toleranceMm),
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

// ─── Función pública: nesting en rollo ──────────────────────────

export function nestOnRoll(input: NestingRolloInput): NestingRolloResult | null {
  const manualLayout = normalizeManualLayout(
    (input.panelizado?.manualLayout as Record<string, unknown> | null | undefined) ?? null,
  );

  const pieces = input.panelizado?.activo
    ? input.panelizado.mode === 'manual' && manualLayout
      ? buildManualPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          widthInterpretation: input.panelizado.widthInterpretation,
          manualLayout,
        })
      : buildPanelizedPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          panelAxis: input.panelizado.axis,
          overlapMm: input.panelizado.overlapMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          distribution: input.panelizado.distribution,
          widthInterpretation: input.panelizado.widthInterpretation,
        })
    : buildPieceInstances(input.medidas);

  if (!pieces || !pieces.length) return null;

  type Row = { yMm: number; usedWidthMm: number; heightMm: number; count: number };
  type State = { rows: Row[]; placements: NestingRolloPlacement[] };

  const resolveNextRowY = (rows: Row[]) => {
    if (!rows.length) return input.marginStartMm;
    const last = rows[rows.length - 1];
    return last.yMm + last.heightMm + input.separacionVerticalMm;
  };

  const measureState = (state: State) => {
    const contentHeightMm = state.rows.reduce((acc, row) => acc + row.heightMm, 0);
    const verticalGapsMm =
      state.rows.length > 1 ? (state.rows.length - 1) * input.separacionVerticalMm : 0;
    const consumedContentLengthMm = contentHeightMm + verticalGapsMm;
    const placedAreaMm2 = state.placements.reduce(
      (acc, placement) => acc + placement.originalWidthMm * placement.originalHeightMm,
      0,
    );
    const wasteProxyMm2 = input.printableWidthMm * consumedContentLengthMm - placedAreaMm2;
    return { consumedContentLengthMm, wasteProxyMm2 };
  };

  let states: State[] = [{ rows: [], placements: [] }];

  for (const piece of pieces) {
    const orientations = [
      { widthMm: piece.widthMm, heightMm: piece.heightMm, rotated: false },
      ...(input.permitirRotacion && piece.widthMm !== piece.heightMm
        ? [{ widthMm: piece.heightMm, heightMm: piece.widthMm, rotated: true }]
        : []),
    ];
    const nextStates: State[] = [];

    for (const state of states) {
      for (const option of orientations) {
        if (option.widthMm > input.printableWidthMm) continue;

        for (const [rowIndex, row] of state.rows.entries()) {
          const nextWidth =
            row.usedWidthMm === 0
              ? option.widthMm
              : row.usedWidthMm + input.separacionHorizontalMm + option.widthMm;
          if (nextWidth > input.printableWidthMm) continue;
          const rows = state.rows.map((item) => ({ ...item }));
          const targetRow = rows[rowIndex];
          const xMm =
            targetRow.usedWidthMm === 0
              ? input.marginLeftMm
              : input.marginLeftMm + targetRow.usedWidthMm + input.separacionHorizontalMm;
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
                label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(piece.originalHeightMm / 10)} cm`,
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
              label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(piece.originalHeightMm / 10)} cm`,
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

    if (!nextStates.length) return null;

    states = nextStates
      .sort((a, b) => {
        const left = measureState(a);
        const right = measureState(b);
        return (
          left.consumedContentLengthMm - right.consumedContentLengthMm ||
          left.wasteProxyMm2 - right.wasteProxyMm2 ||
          a.rows.length - b.rows.length
        );
      })
      .slice(0, 12);
  }

  const bestState = [...states].sort((a, b) => {
    const left = measureState(a);
    const right = measureState(b);
    return (
      left.consumedContentLengthMm - right.consumedContentLengthMm ||
      left.wasteProxyMm2 - right.wasteProxyMm2 ||
      a.rows.length - b.rows.length
    );
  })[0];

  const contentHeightMm = bestState.rows.reduce((acc, row) => acc + row.heightMm, 0);
  const verticalGapsMm =
    bestState.rows.length > 1 ? (bestState.rows.length - 1) * input.separacionVerticalMm : 0;
  const consumedLengthMm = input.marginStartMm + input.marginEndMm + contentHeightMm + verticalGapsMm;
  const usefulAreaM2 = input.medidas.reduce(
    (acc, item) => acc + ((item.anchoMm * item.altoMm) / 1_000_000) * item.cantidad,
    0,
  );
  const { rows: rowCount, piecesPerRow } = countRowsAndPiecesPerRow(
    bestState.placements,
    Math.max(1, input.separacionVerticalMm / 2),
  );

  return {
    orientacion: buildOrientacion(bestState.placements),
    panelizado: input.panelizado?.activo === true,
    panelAxis: input.panelizado?.activo ? input.panelizado.axis : null,
    panelCount: bestState.placements.reduce((max, item) => Math.max(max, item.panelCount ?? 1), 1),
    panelOverlapMm: input.panelizado?.activo ? input.panelizado.overlapMm : null,
    panelMaxWidthMm: input.panelizado?.activo ? input.panelizado.maxPanelWidthMm : null,
    panelDistribution: input.panelizado?.activo ? input.panelizado.distribution : null,
    panelWidthInterpretation: input.panelizado?.activo ? input.panelizado.widthInterpretation : null,
    panelMode: input.panelizado?.activo ? input.panelizado.mode : null,
    piecesPerRow,
    rows: rowCount,
    consumedLengthMm,
    usefulAreaM2,
    placements: bestState.placements,
  };
}
