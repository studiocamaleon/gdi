"use client";

import { ShapesIcon } from "lucide-react";
import { ModoIngresoSelector } from "./modo-ingreso-selector";

export type ModoCotizacionGeometria = "medidas" | "svg" | "placas";

export function GeometriaProductoSelector({
  value,
  permiteMedidas,
  permiteArchivo,
  permitePlacas,
  onValueChange,
}: {
  value: ModoCotizacionGeometria;
  permiteMedidas: boolean;
  permiteArchivo: boolean;
  permitePlacas: boolean;
  onValueChange: (value: ModoCotizacionGeometria) => void;
}) {
  return (
    <ModoIngresoSelector
      value={value}
      options={[
        ...(permiteMedidas
          ? [{ value: "medidas" as const, label: "Rectangular" }]
          : []),
        ...(permiteArchivo
          ? [{ value: "svg" as const, label: "Archivo SVG / DXF" }]
          : []),
        ...(permitePlacas || value === "placas"
          ? [{ value: "placas" as const, label: "Por placas" }]
          : []),
      ]}
      onValueChange={onValueChange}
      title="Cómo cotizar el trabajo"
      ariaLabel="Geometría del producto"
      description={
        value === "placas"
          ? "Estimá placas y recorrido de corte. Sin archivo ni aprovechamiento calculado."
          : value === "svg"
            ? "Cargá los contornos para calcular el nesting irregular sobre placas."
            : "Ingresá medidas y cantidades para calcular el acomodo rectangular."
      }
      icon={ShapesIcon}
    />
  );
}
