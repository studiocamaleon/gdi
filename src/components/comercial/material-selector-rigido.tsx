"use client";

import type { GrupoRigido } from "@/lib/selector-rigidos";
import { muestraColorMaterial } from "@/lib/selector-colores";
import { MaterialPlateIllustration } from "@/components/design-system/material-plate-illustration";
import { MaterialSelectorVisual } from "./material-selector-visual";

export function MaterialSelectorRigido({
  grupos,
  ...props
}: {
  etiquetaSlot: string;
  grupos: readonly GrupoRigido[];
  selected: string;
  onSelect: (variantId: string) => void;
  sinTarjeta?: boolean;
}) {
  return (
    <MaterialSelectorVisual
      {...props}
      eje="Espesor"
      etiquetaBusqueda="Buscar material, espesor o formato"
      ejemploBusqueda="Ej. acrílico, 5 mm…"
      pendiente="Elegí el espesor para este trabajo."
      grupos={grupos.map((grupo) => ({
        id: grupo.id,
        titulo: grupo.material,
        subtitulo: grupo.color,
        detalleComun: grupo.formatoComun ? `Placa ${grupo.formatoComun}` : "",
        opciones: grupo.opciones.map((o) => ({
          ...o,
          descripcion: [!grupo.formatoComun ? o.formato : "", o.referencia].filter(Boolean).join(" · "),
          resumen: [grupo.material, grupo.color, o.titulo, !grupo.formatoComun ? o.formato : "", o.referencia].filter(Boolean).join(" · "),
          nombreAccesible: [grupo.material, grupo.color, o.titulo, o.formato, o.referencia].filter(Boolean).join(" · "),
          ilustracion: <MaterialPlateIllustration espesor={o.espesorMm} color={grupo.color} />,
          aviso: muestraColorMaterial(grupo.color).tipo === "desconocido" ? "Color identificado por el nombre del catálogo; sin muestra de tono." : "",
        })),
      }))}
    />
  );
}
