"use client";

import * as React from "react";
import { GitBranchIcon, InfoIcon, Layers3Icon } from "lucide-react";

import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { cn } from "@/lib/utils";

type OptionalRouteSummaryItem = {
  label: string;
  value: React.ReactNode;
};

type ProductoRutaOpcionalesShellProps = {
  summaryItems: OptionalRouteSummaryItem[];
  context: React.ReactNode;
  editor: React.ReactNode;
  className?: string;
};

export function ProductoRutaOpcionalesShell({
  summaryItems,
  context,
  editor,
  className,
}: ProductoRutaOpcionalesShellProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <ProductoTabSection
        title="Resumen de configuración"
        description="Lectura rápida del alcance, la cantidad de reglas activas y el estado actual del configurador."
        icon={InfoIcon}
        contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      >
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <div className="mt-1 text-sm font-medium">{item.value}</div>
          </div>
        ))}
      </ProductoTabSection>

      <ProductoTabSection
        title="Alcance y contexto"
        description="Definí sobre qué ruta o tecnología estás trabajando antes de editar preguntas y reglas opcionales."
        icon={Layers3Icon}
      >
        {context}
      </ProductoTabSection>

      <ProductoTabSection
        title="Checklist de opcionales"
        description="Definí preguntas, respuestas y acciones que agregan pasos, materiales o costos opcionales. La vista previa lateral muestra la ruta final sin salir del editor."
        icon={GitBranchIcon}
        className="min-w-0"
      >
        {editor}
      </ProductoTabSection>
    </div>
  );
}
