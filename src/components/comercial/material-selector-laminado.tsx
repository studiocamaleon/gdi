"use client";

import type { AcabadoLaminadoVisual, GrupoLaminado } from "@/lib/selector-laminados";
import { MaterialSelectorVisual } from "./material-selector-visual";

/** Muestra esquemática del acabado; no promete propiedades del material. */
function MuestraAcabado({ acabado }: { acabado: AcabadoLaminadoVisual }) {
  return (
    <svg width="47" height="29" viewBox="0 0 47 29" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="39" height="23" rx="3" fill="currentColor" fillOpacity=".07" stroke="currentColor" />
      {acabado === "brillante" ? (
        <><path d="m10 23 9-17m0 17 9-17m0 17 9-17" stroke="currentColor" strokeWidth="2" opacity=".55" /><path d="M34 1v8m-4-4h8" stroke="currentColor" strokeLinecap="round" /></>
      ) : acabado === "mate" ? (
        <g fill="currentColor" opacity=".4">{[10, 18, 26, 34].flatMap((x) => [9, 15, 21].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".8" />))}</g>
      ) : acabado === "soft-touch" ? (
        <g stroke="currentColor" strokeLinecap="round" opacity=".55"><path d="M8 10c5-5 10 5 15 0s10 5 15 0M8 15c5-5 10 5 15 0s10 5 15 0M8 20c5-5 10 5 15 0s10 5 15 0" /></g>
      ) : acabado === "satinado" ? (
        <path d="m17 23 10-17m-3 17 10-17" stroke="currentColor" strokeWidth="5" opacity=".16" />
      ) : <path d="M10 11h24M10 17h16" stroke="currentColor" opacity=".4" />}
    </svg>
  );
}

export function MaterialSelectorLaminado({ grupos, ...props }: {
  etiquetaSlot: string;
  grupos: readonly GrupoLaminado[];
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
}) {
  return (
    <MaterialSelectorVisual
      {...props}
      eje="Acabado"
      etiquetaBusqueda="Buscar material, acabado o medida"
      ejemploBusqueda="Ej. mate, 330 mm…"
      pendiente="Elegí el acabado para este trabajo."
      grupos={grupos.map((grupo) => ({
        id: grupo.id,
        titulo: grupo.material,
        detalleComun: grupo.detalleComun,
        opciones: grupo.opciones.map((o) => ({
          ...o,
          resumen: [grupo.material, o.titulo, o.descripcion].filter(Boolean).join(" · "),
          nombreAccesible: [grupo.material, o.titulo, ...o.detalles.map((d) => d.valor), o.referencia].filter(Boolean).join(" · "),
          ilustracion: <MuestraAcabado acabado={o.visual} />,
        })),
      }))}
    />
  );
}
