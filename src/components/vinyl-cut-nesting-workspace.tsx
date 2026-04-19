"use client";

/**
 * Thin wrapper sobre <NestingPreview> que preserva la API pública original
 * (props en cm) usada por los callers de vinilo. Internamente convierte a
 * milímetros y delega el render al componente canónico 2D SVG del modelo
 * universal.
 *
 * El plotter decorativo 3D-looking (arms + luz azul) se removió para
 * uniformidad visual con digital/rígidos/gran formato. Si se quiere
 * recuperar un "frame" de máquina, hacerlo a nivel contenedor externo.
 */
import * as React from "react";

import { NestingPreview } from "@/components/nesting-preview";

type NestingPiece = {
  id: string;
  label: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  originalWidthCm?: number;
  originalHeightCm?: number;
  rotated?: boolean;
};

type VinylCutNestingWorkspaceProps = {
  machineLabel: string;
  rollWidthCm: number;
  rollLengthCm: number;
  pieces: NestingPiece[];
  marginLeftCm?: number;
  marginRightCm?: number;
  marginTopCm?: number;
  marginBottomCm?: number;
  separacionHorizontalCm?: number;
  separacionVerticalCm?: number;
};

const cmToMm = (v: number) => v * 10;

export function VinylCutNestingWorkspace({
  machineLabel,
  rollWidthCm,
  rollLengthCm,
  pieces,
  marginLeftCm = 0,
  marginRightCm = 0,
  marginTopCm = 0,
  marginBottomCm = 0,
}: VinylCutNestingWorkspaceProps) {
  const rolloAnchoTotalMm = cmToMm(rollWidthCm);
  const consumedLengthMm = cmToMm(rollLengthCm);
  const marginLeftMm = cmToMm(marginLeftCm);
  const marginRightMm = cmToMm(marginRightCm);
  const printableWidthMm = Math.max(0, rolloAnchoTotalMm - marginLeftMm - marginRightMm);

  const placements = pieces.map((p) => ({
    x: cmToMm(p.xCm),
    y: cmToMm(p.yCm),
    anchoMm: cmToMm(p.widthCm),
    altoMm: cmToMm(p.heightCm),
    rotada: p.rotated,
    label: p.label,
    colorKey: p.id,
  }));

  return (
    <div className="space-y-2">
      <div className="text-center font-mono text-sm text-muted-foreground">
        {machineLabel} · {rollWidthCm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} cm
      </div>
      <NestingPreview
        container={{
          type: "rollo",
          rolloAnchoTotalMm,
          printableWidthMm,
          consumedLengthMm,
          marginLeftMm,
          marginStartMm: cmToMm(marginTopCm),
          marginEndMm: cmToMm(marginBottomCm),
        }}
        placements={placements}
        maxHeightPx={600}
      />
    </div>
  );
}
