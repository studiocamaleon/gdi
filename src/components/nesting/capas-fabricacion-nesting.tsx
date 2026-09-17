"use client";

import { recorridosDePlacement } from "@/lib/fabricacion-export";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import { Button } from "@/components/ui/button";

export function CapasFabricacionPlacement({
  placement,
  transform,
}: {
  placement: NestingViewerInput["placements"][number];
  transform?: string;
}) {
  return (
    <g transform={transform} data-capas-fabricacion="true">
      {recorridosDePlacement(placement)
        .filter((e) => e.rol !== "CORTE_EXTERIOR")
        .map((e) => {
          const color =
            e.color ?? (e.rol === "HENDIDO" ? "#008000" : "#5a70bc");
          return (
            <g
              key={e.entidadId}
              data-capa={e.capa}
              data-entidad={e.entidadId}
              data-operacion={e.rol ?? "SIN_OPERACION"}
            >
              <title>{e.capa}</title>
              {e.texto ? (
                <text
                  x={e.texto.x}
                  y={e.texto.y}
                  fontSize={e.texto.altura}
                  fill={color}
                  transform={`rotate(${e.texto.rotacion} ${e.texto.x} ${e.texto.y})`}
                >
                  {e.texto.contenido}
                </text>
              ) : (
                <path
                  d={`M${e.puntos.map((v) => `${v.x},${v.y}`).join(" L")}${e.cerrada ? " Z" : ""}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
    </g>
  );
}

export function EstadoCapasFabricacion({
  cargando,
  error,
  reintentar,
}: {
  cargando: boolean;
  error?: string;
  reintentar: () => void;
}) {
  if (cargando)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando capas del archivo original…
      </p>
    );
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 text-sm text-destructive"
    >
      <p>{error}</p>
      <Button type="button" variant="outline" size="sm" onClick={reintentar}>
        Reintentar
      </Button>
    </div>
  );
}
