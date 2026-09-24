"use client";

import { useId } from "react";
import { muestraColorMaterial } from "@/lib/selector-colores";

/** Placa ilustrativa: el color es orientativo y la altura no está a escala. */
export function MaterialPlateIllustration({ espesor, color }: { espesor: number | null; color: string }) {
  const id = `placa-${useId().replace(/:/g, "")}`;
  const muestra = muestraColorMaterial(color);
  const h = espesor === null ? 3 : Math.min(9, 2 + Math.log2(espesor + 1) * 1.5);
  const fill = muestra.tipo === "solido" ? muestra.hex
    : muestra.tipo === "desconocido" ? "var(--surface-secondary)" : `url(#${id}-${muestra.tipo})`;
  const frente = `M3 12 29 18v${h}L3 ${12 + h}Z`;
  const lado = `M29 18 43 10v${h}L29 ${18 + h}Z`;
  return (
    <svg width="47" height="29" viewBox="0 0 47 29" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}-transparente`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#ffffff" />
          <path d="M0 0h4v4H0ZM4 4h4v4H4Z" fill="#dce0e2" />
        </pattern>
        <linearGradient id={`${id}-metalizado`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={muestra.tipo === "metalizado" ? muestra.hex : "#a5abb1"} />
          <stop offset=".5" stopColor="#f1f0e9" />
          <stop offset="1" stopColor={muestra.tipo === "metalizado" ? muestra.hex : "#a5abb1"} />
        </linearGradient>
        <linearGradient id={`${id}-multicolor`}>
          <stop offset="0" stopColor="#d67b8b" /><stop offset=".5" stopColor="#ddc77c" /><stop offset="1" stopColor="#6eabba" />
        </linearGradient>
      </defs>
      <g fill={fill} stroke="var(--muted-text)" strokeOpacity=".65" strokeLinejoin="round">
        <path d="M3 12 17 4 43 10 29 18Z" />
        <path d={frente} /><path d={lado} />
      </g>
      <path d={frente} fill="#000000" fillOpacity=".08" />
      <path d={lado} fill="#000000" fillOpacity=".2" />
    </svg>
  );
}
