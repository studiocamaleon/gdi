"use client";

import type { GrupoRollo } from "@/lib/selector-rollos";
import { MaterialRollIllustration } from "@/components/design-system/material-roll-illustration";
import { MaterialSelectorVisual } from "./material-selector-visual";

export function MaterialSelectorRollo({ grupos, recomendadoId, ...props }: {
  etiquetaSlot: string;
  grupos: readonly GrupoRollo[];
  selected: string;
  onSelect: (id: string) => void;
  sinTarjeta?: boolean;
  recomendadoId?: string | null;
}) {
  return <MaterialSelectorVisual {...props}
    eje="Ancho de rollo"
    etiquetaBusqueda="Buscar material o ancho de rollo"
    ejemploBusqueda="Ej. vinilo, 1,37 m…"
    pendiente="Elegí el ancho de rollo para este trabajo."
    grupos={grupos.map((g) => ({
      id: g.id, titulo: g.material, subtitulo: "Ancho de rollo", detalleComun: g.detalleComun,
      opciones: g.opciones.map((o) => ({
        ...o,
        recomendada: o.id === recomendadoId,
        ilustracion: <MaterialRollIllustration anchoMm={o.anchoMm} />,
      })),
    }))}
  />;
}
