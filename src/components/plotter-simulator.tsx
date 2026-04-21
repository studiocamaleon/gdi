"use client";

/**
 * Thin wrapper sobre <NestingPreview> que preserva la API pública del antiguo
 * `PlotterSimulator` (Three.js 3D, ~644 LOC). Ahora delega al componente
 * canónico 2D SVG del modelo universal — consistencia visual con digital,
 * vinilo y rígidos.
 *
 * Conversión de unidades:
 *   - Input en cm → convierte a mm.
 *   - Input `cx`/`cy` en cm relativos al centro del rollo →
 *     convierte a `x`/`y` en mm desde el borde top-left del contenedor.
 */

import * as React from "react";

import { NestingPreview } from "@/components/nesting-preview";

export interface PlotterSimulatorPiece {
  id: string;
  w: number;
  h: number;
  originalW?: number | null;
  originalH?: number | null;
  usefulW?: number | null;
  usefulH?: number | null;
  cx: number;
  cy: number;
  color: string;
  label: string;
  textColor?: string;
  rotated?: boolean;
  panelIndex?: number | null;
  panelCount?: number | null;
  panelAxis?: "vertical" | "horizontal" | null;
  sourcePieceId?: string | null;
  overlapStart?: number | null;
  overlapEnd?: number | null;
}

interface PlotterSimulatorProps {
  pieces: PlotterSimulatorPiece[];
  rollWidth?: number;
  rollLength?: number;
  optimizationPercentage?: number;
  marginLeft?: number;
  marginRight?: number;
  marginStart?: number;
  marginEnd?: number;
  panelizado?: boolean;
  panelAxis?: "vertical" | "horizontal" | null;
  panelCount?: number;
  panelOverlap?: number | null;
  panelMaxWidth?: number | null;
  panelDistribution?: "equilibrada" | "libre" | null;
  panelWidthInterpretation?: "total" | "util" | null;
  panelMode?: "automatico" | "manual" | null;
}

const cmToMm = (v: number) => v * 10;

export default function PlotterSimulator({
  pieces,
  rollWidth = 100,
  rollLength = 100,
  marginLeft = 0,
  marginRight = 0,
  marginStart = 0,
  marginEnd = 0,
}: PlotterSimulatorProps) {
  const rolloAnchoTotalMm = cmToMm(rollWidth);
  const rollLengthMm = cmToMm(rollLength);
  const marginLeftMm = cmToMm(marginLeft);
  const marginRightMm = cmToMm(marginRight);
  const marginStartMm = cmToMm(marginStart);
  const marginEndMm = cmToMm(marginEnd);
  const printableWidthMm = Math.max(0, rolloAnchoTotalMm - marginLeftMm - marginRightMm);

  // Las piezas vienen con cx/cy = centro relativo al centro del rollo (en cm).
  // Convertir a (x, y) = esquina top-left en mm desde el borde del rollo.
  const placements = pieces.map((p) => {
    const widthMm = cmToMm(p.w);
    const heightMm = cmToMm(p.h);
    const centerXMm = cmToMm(p.cx) + rolloAnchoTotalMm / 2;
    const centerYMm = cmToMm(p.cy);
    return {
      x: centerXMm - widthMm / 2,
      y: centerYMm - heightMm / 2,
      anchoMm: widthMm,
      altoMm: heightMm,
      rotada: p.rotated,
      label: p.label,
      colorKey: p.sourcePieceId ?? p.id,
    };
  });

  return (
    <div className="h-full w-full p-2">
      <NestingPreview
        container={{
          type: "rollo",
          rolloAnchoTotalMm,
          printableWidthMm,
          consumedLengthMm: rollLengthMm,
          marginLeftMm,
          marginStartMm,
          marginEndMm,
        }}
        placements={placements}
        variant="compact"
        maxHeightPx={700}
      />
    </div>
  );
}
