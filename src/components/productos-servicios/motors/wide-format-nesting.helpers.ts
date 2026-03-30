"use client";

import type { PlotterSimulatorPiece } from "@/components/plotter-simulator";
import type {
  GranFormatoCostosCandidateResumen,
  GranFormatoCostosResponse,
  GranFormatoCostosNestingPreview,
  GranFormatoPanelManualLayout,
  GranFormatoPanelManualLayoutItem,
  GranFormatoPanelizadoInterpretacionAnchoMaximo,
} from "@/lib/productos-servicios";

export const MIN_MANUAL_PANEL_USEFUL_MM = 20;

export type WideFormatSimulatorData = {
  pieces: PlotterSimulatorPiece[];
  rollWidth: number;
  rollLength: number;
  marginLeft: number;
  marginRight: number;
  marginStart: number;
  marginEnd: number;
  panelizado: boolean;
  panelAxis: "vertical" | "horizontal" | null;
  panelCount: number;
  panelOverlap: number | null;
  panelMaxWidth: number | null;
  panelDistribution: "equilibrada" | "libre" | null;
  panelWidthInterpretation: "total" | "util" | null;
  panelMode: "automatico" | "manual" | null;
};

export function buildWideFormatSourcePieceIds(
  medidas: Array<{ anchoMm: number | null; altoMm: number | null; cantidad: number }>,
) {
  return medidas.flatMap((medida, medidaIndex) =>
    Array.from({ length: Math.max(1, medida.cantidad || 1) }, (_, copyIndex) => ({
      sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
      piezaLabel: `Pieza ${medidaIndex + 1}.${copyIndex + 1}`,
      pieceWidthMm: medida.anchoMm ?? 0,
      pieceHeightMm: medida.altoMm ?? 0,
    })),
  );
}

export function buildDefaultManualLayout(
  medidas: Array<{ anchoMm: number | null; altoMm: number | null; cantidad: number }>,
  axis: "vertical" | "horizontal",
): GranFormatoPanelManualLayout {
  return {
    items: buildWideFormatSourcePieceIds(medidas).map((item) => ({
      sourcePieceId: item.sourcePieceId,
      pieceWidthMm: item.pieceWidthMm,
      pieceHeightMm: item.pieceHeightMm,
      axis,
      panels: [
        {
          panelIndex: 1,
          usefulWidthMm: item.pieceWidthMm,
          usefulHeightMm: item.pieceHeightMm,
          overlapStartMm: 0,
          overlapEndMm: 0,
          finalWidthMm: item.pieceWidthMm,
          finalHeightMm: item.pieceHeightMm,
        },
      ],
    })),
  };
}

export function normalizeManualLayoutForMeasures(
  layout: GranFormatoPanelManualLayout | null | undefined,
  medidas: Array<{ anchoMm: number | null; altoMm: number | null; cantidad: number }>,
  axis: "vertical" | "horizontal",
): GranFormatoPanelManualLayout {
  const expected = buildWideFormatSourcePieceIds(medidas);
  const currentById = new Map((layout?.items ?? []).map((item) => [item.sourcePieceId, item]));
  return {
    items: expected.map((piece) => {
      const existing = currentById.get(piece.sourcePieceId);
      if (!existing) {
        return {
          sourcePieceId: piece.sourcePieceId,
          pieceWidthMm: piece.pieceWidthMm,
          pieceHeightMm: piece.pieceHeightMm,
          axis,
          panels: [
            {
              panelIndex: 1,
              usefulWidthMm: piece.pieceWidthMm,
              usefulHeightMm: piece.pieceHeightMm,
              overlapStartMm: 0,
              overlapEndMm: 0,
              finalWidthMm: piece.pieceWidthMm,
              finalHeightMm: piece.pieceHeightMm,
            },
          ],
        };
      }
      return {
        ...existing,
        pieceWidthMm: piece.pieceWidthMm,
        pieceHeightMm: piece.pieceHeightMm,
        axis: existing.axis ?? axis,
        panels: existing.panels
          .slice()
          .sort((a, b) => a.panelIndex - b.panelIndex)
          .map((panel, index) => ({
            ...panel,
            panelIndex: index + 1,
          })),
      };
    }),
  };
}

export function cloneWideFormatManualLayout(
  layout: GranFormatoPanelManualLayout | null | undefined,
): GranFormatoPanelManualLayout | null {
  if (!layout) return null;
  return {
    items: layout.items.map((item) => ({
      ...item,
      panels: item.panels.map((panel) => ({ ...panel })),
    })),
  };
}

export function buildManualLayoutFromPlacements(
  placements: GranFormatoCostosCandidateResumen["placements"],
): GranFormatoPanelManualLayout | null {
  const groups = new Map<string, GranFormatoPanelManualLayoutItem>();
  for (const placement of placements) {
    if (!placement.sourcePieceId || !placement.panelIndex || !placement.panelAxis) continue;
    const current =
      groups.get(placement.sourcePieceId) ??
      {
        sourcePieceId: placement.sourcePieceId,
        pieceWidthMm: placement.originalWidthMm,
        pieceHeightMm: placement.originalHeightMm,
        axis: placement.panelAxis,
        panels: [],
      };
    current.panels.push({
      panelIndex: placement.panelIndex,
      usefulWidthMm: placement.usefulWidthMm,
      usefulHeightMm: placement.usefulHeightMm,
      overlapStartMm: placement.overlapStartMm,
      overlapEndMm: placement.overlapEndMm,
      finalWidthMm:
        placement.panelAxis === "vertical"
          ? placement.usefulWidthMm + placement.overlapStartMm + placement.overlapEndMm
          : placement.usefulWidthMm,
      finalHeightMm:
        placement.panelAxis === "horizontal"
          ? placement.usefulHeightMm + placement.overlapStartMm + placement.overlapEndMm
          : placement.usefulHeightMm,
    });
    groups.set(placement.sourcePieceId, current);
  }
  const items = Array.from(groups.values())
    .map((item) => ({
      ...item,
      panels: [...item.panels].sort((a, b) => a.panelIndex - b.panelIndex),
    }))
    .sort((a, b) => a.sourcePieceId.localeCompare(b.sourcePieceId));
  return items.length ? { items } : null;
}

export function buildManualLayoutFromNestingPieces(
  pieces: NonNullable<GranFormatoCostosResponse["nestingPreview"]>["pieces"],
): GranFormatoPanelManualLayout | null {
  const groups = new Map<string, GranFormatoPanelManualLayoutItem>();
  for (const piece of pieces) {
    if (!piece.sourcePieceId || !piece.panelIndex || !piece.panelAxis) continue;
    const usefulWidthMm = Math.round((piece.usefulW ?? piece.w ?? 0) * 10);
    const usefulHeightMm = Math.round((piece.usefulH ?? piece.h ?? 0) * 10);
    const overlapStartMm = Math.round((piece.overlapStart ?? 0) * 10);
    const overlapEndMm = Math.round((piece.overlapEnd ?? 0) * 10);
    const current =
      groups.get(piece.sourcePieceId) ??
      {
        sourcePieceId: piece.sourcePieceId,
        pieceWidthMm: 0,
        pieceHeightMm: 0,
        axis: piece.panelAxis,
        panels: [],
      };
    current.panels.push({
      panelIndex: piece.panelIndex,
      usefulWidthMm,
      usefulHeightMm,
      overlapStartMm,
      overlapEndMm,
      finalWidthMm:
        piece.panelAxis === "vertical"
          ? usefulWidthMm + overlapStartMm + overlapEndMm
          : usefulWidthMm,
      finalHeightMm:
        piece.panelAxis === "horizontal"
          ? usefulHeightMm + overlapStartMm + overlapEndMm
          : usefulHeightMm,
    });
    groups.set(piece.sourcePieceId, current);
  }
  const items = Array.from(groups.values())
    .map((item) => {
      const panels = [...item.panels].sort((a, b) => a.panelIndex - b.panelIndex);
      const pieceWidthMm =
        item.axis === "vertical"
          ? panels.reduce((acc, panel) => acc + panel.usefulWidthMm, 0)
          : panels[0]?.usefulWidthMm ?? 0;
      const pieceHeightMm =
        item.axis === "horizontal"
          ? panels.reduce((acc, panel) => acc + panel.usefulHeightMm, 0)
          : panels[0]?.usefulHeightMm ?? 0;
      return {
        ...item,
        pieceWidthMm,
        pieceHeightMm,
        panels,
      };
    })
    .filter((item) => item.pieceWidthMm > 0 && item.pieceHeightMm > 0)
    .sort((a, b) => a.sourcePieceId.localeCompare(b.sourcePieceId));
  return items.length ? { items } : null;
}

export function recalculateManualLayoutItem(
  item: GranFormatoPanelManualLayoutItem,
): GranFormatoPanelManualLayoutItem {
  return {
    ...item,
    panels: item.panels.map((panel) => ({
      ...panel,
      finalWidthMm:
        item.axis === "vertical"
          ? panel.usefulWidthMm + panel.overlapStartMm + panel.overlapEndMm
          : item.pieceWidthMm,
      finalHeightMm:
        item.axis === "horizontal"
          ? panel.usefulHeightMm + panel.overlapStartMm + panel.overlapEndMm
          : item.pieceHeightMm,
    })),
  };
}

export function validateManualLayoutItem(input: {
  item: GranFormatoPanelManualLayoutItem;
  printableWidthMm: number;
  maxPanelWidthMm: number | null;
  widthInterpretation: GranFormatoPanelizadoInterpretacionAnchoMaximo;
}) {
  const dimension = input.item.axis === "vertical" ? input.item.pieceWidthMm : input.item.pieceHeightMm;
  const usefulTotal = input.item.panels.reduce(
    (acc, panel) =>
      acc + (input.item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm),
    0,
  );
  if (Math.abs(usefulTotal - dimension) > 1) return false;
  return input.item.panels.every((panel) => {
    const useful = input.item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm;
    const final = input.item.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
    const withinConfiguredLimit =
      input.maxPanelWidthMm == null
        ? true
        : input.widthInterpretation === "total"
          ? final <= input.maxPanelWidthMm
          : useful <= input.maxPanelWidthMm;
    return useful >= MIN_MANUAL_PANEL_USEFUL_MM && final <= input.printableWidthMm && withinConfiguredLimit;
  });
}

export function buildWideFormatSimulatorDataFromCandidate(
  candidate: Pick<
    GranFormatoCostosCandidateResumen,
    | "rollWidthMm"
    | "consumedLengthMm"
    | "marginLeftMm"
    | "marginRightMm"
    | "marginStartMm"
    | "marginEndMm"
    | "panelizado"
    | "panelAxis"
    | "panelCount"
    | "panelOverlapMm"
    | "panelMaxWidthMm"
    | "panelDistribution"
    | "panelWidthInterpretation"
    | "panelMode"
    | "placements"
  >,
): WideFormatSimulatorData {
  return {
    rollWidth: Number((candidate.rollWidthMm / 10).toFixed(2)),
    rollLength: Number((candidate.consumedLengthMm / 10).toFixed(2)),
    marginLeft: Number((candidate.marginLeftMm / 10).toFixed(2)),
    marginRight: Number((candidate.marginRightMm / 10).toFixed(2)),
    marginStart: Number((candidate.marginStartMm / 10).toFixed(2)),
    marginEnd: Number((candidate.marginEndMm / 10).toFixed(2)),
    panelizado: candidate.panelizado,
    panelAxis: candidate.panelAxis,
    panelCount: candidate.panelCount,
    panelOverlap: candidate.panelOverlapMm != null ? Number((candidate.panelOverlapMm / 10).toFixed(2)) : null,
    panelMaxWidth: candidate.panelMaxWidthMm != null ? Number((candidate.panelMaxWidthMm / 10).toFixed(2)) : null,
    panelDistribution: candidate.panelDistribution,
    panelWidthInterpretation: candidate.panelWidthInterpretation,
    panelMode: candidate.panelMode,
    pieces: candidate.placements.map((item, index) => ({
      id: item.id,
      w: Number((item.widthMm / 10).toFixed(2)),
      h: Number((item.heightMm / 10).toFixed(2)),
      originalW: Number((item.originalWidthMm / 10).toFixed(2)),
      originalH: Number((item.originalHeightMm / 10).toFixed(2)),
      usefulW: Number((item.usefulWidthMm / 10).toFixed(2)),
      usefulH: Number((item.usefulHeightMm / 10).toFixed(2)),
      cx: Number(((item.centerXMm - candidate.rollWidthMm / 2) / 10).toFixed(2)),
      cy: Number((item.centerYMm / 10).toFixed(2)),
      color: ["#ff9f43", "#0abde3", "#1dd1a1", "#ff6b6b", "#f97316", "#22c55e"][index % 6],
      label: `P${index + 1}`,
      textColor: "#111111",
      rotated: item.rotated,
      panelIndex: item.panelIndex,
      panelCount: item.panelCount,
      panelAxis: item.panelAxis,
      sourcePieceId: item.sourcePieceId,
      overlapStart: Number((item.overlapStartMm / 10).toFixed(2)),
      overlapEnd: Number((item.overlapEndMm / 10).toFixed(2)),
    })),
  };
}

export function buildWideFormatSimulatorDataFromPreview(
  preview: GranFormatoCostosNestingPreview,
): WideFormatSimulatorData {
  return {
    pieces: preview.pieces,
    rollWidth: preview.rollWidth,
    rollLength: preview.rollLength,
    marginLeft: preview.marginLeft,
    marginRight: preview.marginRight,
    marginStart: preview.marginStart,
    marginEnd: preview.marginEnd,
    panelizado: preview.panelizado === true,
    panelAxis: preview.panelAxis ?? null,
    panelCount: preview.panelCount ?? 0,
    panelOverlap: preview.panelOverlap ?? null,
    panelMaxWidth: preview.panelMaxWidth ?? null,
    panelDistribution: preview.panelDistribution ?? null,
    panelWidthInterpretation: preview.panelWidthInterpretation ?? null,
    panelMode: preview.panelMode ?? null,
  };
}
