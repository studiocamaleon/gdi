"use client";

import * as React from "react";

import type { LayoutPliegosEnHoja } from "@/lib/nesting-compra-pliego";

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
export function NestingCompraPliegoModal({ hoja, pliego, layout, onClose }: Props) {
  const { cols, rows, pliegoDibujoAnchoMm: pw, pliegoDibujoAltoMm: ph } = layout;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pliegos: Array<{ x: number; y: number; n: number }> = [];
  let n = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      pliegos.push({ x: j * pw, y: i * ph, n: ++n });
    }
  }
  const mostrarNumeros = pliegos.length <= 24 && Math.min(pw, ph) >= hoja.anchoMm * 0.12;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Acomodado de pliegos en la hoja"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className={s.head}>
          <div className={s.count}>
            {layout.pliegosPorHoja} pliegos por hoja
          </div>
          <div className={s.sub}>
            {layout.orientacion === "rotada" ? "rotados · " : ""}
            {Math.round(layout.aprovechamientoPct)}% aprovechado
          </div>
        </div>

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
          Hoja {cm(hoja.anchoMm)} × {cm(hoja.altoMm)} · Pliego {cm(pliego.anchoMm)} × {cm(pliego.altoMm)} cm
        </div>
      </div>
    </div>
  );
}
