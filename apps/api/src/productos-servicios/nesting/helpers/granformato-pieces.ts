/**
 * Helpers de construcción de piezas para gran formato.
 *
 * Convierten "medidas pedidas" (anchoMm × altoMm × cantidad) en
 * instancias concretas de piezas listas para acomodar en el rollo.
 *
 * 4 modos:
 *  1. Simples: 1 pieza por copia, sin panelizado.
 *  2. Panelizadas (automático): si la pieza es más ancha que el rollo,
 *     se subdivide en N paneles del eje configurado, con solapamiento.
 *  3. Manuales: el usuario define la subdivisión panel por panel.
 *  4. "Single pieces": versión flat para cuando se quiere iterar pieza
 *     por pieza (usado por modos híbridos).
 *
 * Ported (1:1) desde productos-servicios.service.ts.
 */

// ─── Tipos públicos ─────────────────────────────────────────────────

export type GranFormatoMeasure = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
};

export type GranFormatoPanelAxis = 'vertical' | 'horizontal';

export type GranFormatoPiece = {
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
  panelAxis: GranFormatoPanelAxis | null;
};

export type GranFormatoManualLayoutItem = {
  sourcePieceId: string;
  pieceWidthMm: number;
  pieceHeightMm: number;
  axis: GranFormatoPanelAxis;
  panels: Array<{
    panelIndex: number;
    usefulWidthMm: number;
    usefulHeightMm: number;
    overlapStartMm: number;
    overlapEndMm: number;
    finalWidthMm: number;
    finalHeightMm: number;
  }>;
};

export type GranFormatoManualLayout = {
  items: GranFormatoManualLayoutItem[];
};

// ─── getGranFormatoNullableNumber ───────────────────────────────────

export function getGranFormatoNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

// ─── buildGranFormatoPieceInstances ─────────────────────────────────

export function buildGranFormatoPieceInstances(medidas: GranFormatoMeasure[]): GranFormatoPiece[] {
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
        panelAxis: null as GranFormatoPanelAxis | null,
      })),
    )
    .sort(
      (a, b) =>
        b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide,
    );
}

// ─── expandGranFormatoMeasuresToSinglePieces ────────────────────────

export function expandGranFormatoMeasuresToSinglePieces(
  medidas: GranFormatoMeasure[],
): Array<{ sourcePieceId: string; anchoMm: number; altoMm: number }> {
  const pieces: Array<{ sourcePieceId: string; anchoMm: number; altoMm: number }> = [];
  for (const [medidaIndex, medida] of medidas.entries()) {
    for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
      pieces.push({
        sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
        anchoMm: medida.anchoMm,
        altoMm: medida.altoMm,
      });
    }
  }
  return pieces;
}

// ─── buildGranFormatoPanelizedPieces ────────────────────────────────

export type BuildGranFormatoPanelizedPiecesInput = {
  medidas: GranFormatoMeasure[];
  printableWidthMm: number;
  panelAxis: GranFormatoPanelAxis;
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
};

export function buildGranFormatoPanelizedPieces(
  input: BuildGranFormatoPanelizedPiecesInput,
): GranFormatoPiece[] | null {
  const pieces: GranFormatoPiece[] = [];

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
      if (effectiveUsefulLimitMm <= 0) {
        return null;
      }
      if (splitDimension <= effectiveUsefulLimitMm) {
        return null;
      }
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

      if (!fits) {
        return null;
      }

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

// ─── normalizeGranFormatoPanelManualLayout ──────────────────────────

export function normalizeGranFormatoPanelManualLayout(
  value: Record<string, unknown> | null | undefined,
): GranFormatoManualLayout | null {
  const itemsRaw = Array.isArray(value?.items) ? value.items : null;
  if (!itemsRaw?.length) {
    return null;
  }
  const items = itemsRaw
    .map((item) => {
      const current = item as Record<string, unknown>;
      const panelsRaw = Array.isArray(current.panels) ? current.panels : [];
      const sourcePieceId =
        typeof current.sourcePieceId === 'string' ? current.sourcePieceId.trim() : '';
      const axis =
        current.axis === 'horizontal' ? 'horizontal' : current.axis === 'vertical' ? 'vertical' : null;
      const pieceWidthMm = getGranFormatoNullableNumber(current.pieceWidthMm);
      const pieceHeightMm = getGranFormatoNullableNumber(current.pieceHeightMm);
      const panels = panelsRaw
        .map((panel) => {
          const currentPanel = panel as Record<string, unknown>;
          return {
            panelIndex: Math.max(1, Number(currentPanel.panelIndex ?? 1)),
            usefulWidthMm: getGranFormatoNullableNumber(currentPanel.usefulWidthMm) ?? 0,
            usefulHeightMm: getGranFormatoNullableNumber(currentPanel.usefulHeightMm) ?? 0,
            overlapStartMm: getGranFormatoNullableNumber(currentPanel.overlapStartMm) ?? 0,
            overlapEndMm: getGranFormatoNullableNumber(currentPanel.overlapEndMm) ?? 0,
            finalWidthMm: getGranFormatoNullableNumber(currentPanel.finalWidthMm) ?? 0,
            finalHeightMm: getGranFormatoNullableNumber(currentPanel.finalHeightMm) ?? 0,
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
        axis: axis as GranFormatoPanelAxis,
        panels,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return items.length ? { items } : null;
}

// ─── buildGranFormatoManualPieces ────────────────────────────────────

export type BuildGranFormatoManualPiecesInput = {
  medidas: GranFormatoMeasure[];
  printableWidthMm: number;
  maxPanelWidthMm: number;
  widthInterpretation: 'total' | 'util';
  manualLayout: GranFormatoManualLayout;
};

export function buildGranFormatoManualPieces(
  input: BuildGranFormatoManualPiecesInput,
): GranFormatoPiece[] | null {
  const expectedPieces = buildGranFormatoPieceInstances(input.medidas);
  if (expectedPieces.length !== input.manualLayout.items.length) {
    return null;
  }
  const byId = new Map(input.manualLayout.items.map((item) => [item.sourcePieceId, item]));
  const pieces: GranFormatoPiece[] = [];

  for (const sourcePiece of expectedPieces) {
    const layout = byId.get(sourcePiece.sourcePieceId);
    if (!layout) {
      return null;
    }
    const expectedTotal =
      layout.axis === 'vertical' ? sourcePiece.originalWidthMm : sourcePiece.originalHeightMm;
    const usefulTotal = layout.panels.reduce(
      (acc, panel) => acc + (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm),
      0,
    );
    if (Math.abs(usefulTotal - expectedTotal) > 1) {
      return null;
    }

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
