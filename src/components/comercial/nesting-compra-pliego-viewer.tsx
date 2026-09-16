"use client";

import * as React from "react";

import type { LayoutPliegosEnHoja } from "@/lib/nesting-compra-pliego";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import theme from "@/components/ui/workspace-theme.module.css";
import s from "./nesting-compra-pliego-viewer.module.css";

interface Props {
  hoja: { anchoMm: number; altoMm: number };
  pliego: { anchoMm: number; altoMm: number };
  layout: LayoutPliegosEnHoja;
  onClose: () => void;
}

function cm(mm: number): string {
  const v = mm / 10;
  return Number.isInteger(v) ? v.toString() : v.toFixed(1).replace(".", ",");
}

/**
 * Modal minimalista: cómo el sistema acomodó los pliegos de impresión dentro de
 * la hoja de compra. La grilla y el sobrante salen de `layoutPliegosEnHoja`.
 */
export function NestingCompraPliegoModal({
  hoja,
  pliego,
  layout,
  onClose,
}: Props) {
  const {
    cols,
    rows,
    pliegoDibujoAnchoMm: pw,
    pliegoDibujoAltoMm: ph,
  } = layout;

  const pliegos: Array<{ x: number; y: number; n: number }> = [];
  let n = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      pliegos.push({ x: j * pw, y: i * ph, n: ++n });
    }
  }
  const mostrarNumeros =
    pliegos.length <= 24 && Math.min(pw, ph) >= hoja.anchoMm * 0.12;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={cn(theme.theme, s.modal)}>
        <DialogHeader>
          <DialogTitle>{layout.pliegosPorHoja} pliegos por hoja</DialogTitle>
          <DialogDescription>
            {layout.orientacion === "rotada" ? "Rotados · " : ""}
            {Math.round(layout.aprovechamientoPct)}% aprovechado
          </DialogDescription>
        </DialogHeader>

        <svg
          className={s.svg}
          viewBox={`-2 -2 ${hoja.anchoMm + 4} ${hoja.altoMm + 4}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${layout.pliegosPorHoja} pliegos por hoja`}
        >
          <rect
            x={0}
            y={0}
            width={hoja.anchoMm}
            height={hoja.altoMm}
            className={s.hoja}
            vectorEffect="non-scaling-stroke"
          />
          {pliegos.map((p) => (
            <g key={p.n}>
              <rect
                x={p.x}
                y={p.y}
                width={pw}
                height={ph}
                className={s.pliego}
                vectorEffect="non-scaling-stroke"
              />
              {mostrarNumeros ? (
                <text
                  x={p.x + pw / 2}
                  y={p.y + ph / 2}
                  className={s.num}
                  dominantBaseline="central"
                  textAnchor="middle"
                  style={{ fontSize: Math.min(pw, ph) * 0.3 }}
                >
                  {p.n}
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        <div className={s.caption}>
          Hoja {cm(hoja.anchoMm)} × {cm(hoja.altoMm)} · Pliego{" "}
          {cm(pliego.anchoMm)} × {cm(pliego.altoMm)} cm
        </div>
      </DialogContent>
    </Dialog>
  );
}
