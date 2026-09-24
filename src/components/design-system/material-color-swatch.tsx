"use client";

import { useId } from "react";
import { muestraColorMaterial } from "@/lib/selector-colores";

/** El texto de la opción es la referencia; la muestra es sólo orientativa. */
export function MaterialColorSwatch({ color }: { color: string }) {
  const id = useId().replace(/:/g, "");
  const muestra = muestraColorMaterial(color);
  const patron = `color-material-${id}`;
  return (
    <svg width="47" height="29" viewBox="0 0 47 29" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${patron}-transparente`} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#ffffff" />
          <path d="M0 0h4v4H0ZM4 4h4v4H4Z" fill="#dce0e2" />
        </pattern>
        <linearGradient id={`${patron}-metal`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={muestra.tipo === "metalizado" ? muestra.hex : "#a5abb1"} />
          <stop offset=".5" stopColor="#f1f0e9" />
          <stop offset="1" stopColor={muestra.tipo === "metalizado" ? muestra.hex : "#a5abb1"} />
        </linearGradient>
        <clipPath id={`${patron}-clip`}><rect x="2" y="2" width="42" height="25" rx="5" /></clipPath>
      </defs>
      <g clipPath={`url(#${patron}-clip)`}>
        <rect x="2" y="2" width="42" height="25" fill={muestra.tipo === "solido" ? muestra.hex : muestra.tipo === "transparente" ? `url(#${patron}-transparente)` : muestra.tipo === "metalizado" ? `url(#${patron}-metal)` : "var(--surface-secondary)"} />
        {muestra.tipo === "multicolor" ? <><path d="M2 2h14v25H2Z" fill="#d67b8b" /><path d="M16 2h14v25H16Z" fill="#ddc77c" /><path d="M30 2h14v25H30Z" fill="#6eabba" /></> : null}
        {muestra.tipo === "desconocido" ? <path d="M20 10a4 4 0 0 1 7 2c0 3-4 3-4 6m0 3v.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /> : null}
      </g>
      <rect x="2" y="2" width="42" height="25" rx="5" fill="none" stroke="var(--muted-text)" strokeOpacity=".5" />
    </svg>
  );
}
