"use client";

import { useRef } from "react";
import type { ConfiguracionGeometriasComerciales } from "@/lib/producto-geometrias";
import {
  piezasVectorialesIniciales,
  type PiezaVectorialCotizacion,
} from "@/lib/piezas-vectoriales-cotizacion";
import { PiezasVectorialesCotizacion } from "./piezas-vectoriales-cotizacion";
import type { FuenteVectorialCotizada } from "./geometrias-vectoriales-cotizacion";

export function PiezasHeredadasCotizacion({
  productoId,
  configuracion,
  fuentes,
  colecciones,
  cantidad,
  onChange,
  onProcesandoChange,
}: {
  productoId: string;
  configuracion: ConfiguracionGeometriasComerciales;
  fuentes: Record<string, FuenteVectorialCotizada>;
  colecciones: Record<string, PiezaVectorialCotizacion[]>;
  cantidad: number;
  onChange: (id: string, piezas: PiezaVectorialCotizacion[]) => void;
  onProcesandoChange: (value: boolean) => void;
}) {
  const procesando = useRef(new Map<string, boolean>());
  return configuracion.fuentes.map((fuente) => {
    const config = { ...configuracion, fuentes: [fuente] };
    const piezas = piezasVectorialesIniciales(
      colecciones[fuente.id],
      config,
      null,
      fuentes,
    );
    return (
      <PiezasVectorialesCotizacion
        key={fuente.id}
        productoId={productoId}
        piezas={piezas}
        configuracion={config}
        cantidad={cantidad}
        titulo={
          configuracion.fuentes.length === 1
            ? "Piezas del producto"
            : fuente.nombre
        }
        descripcion="Cargá los archivos SVG o DXF y definí la cantidad de cada pieza por producto."
        onChange={(piezas) => onChange(fuente.id, piezas)}
        onProcesandoChange={(value) => {
          procesando.current.set(fuente.id, value);
          onProcesandoChange([...procesando.current.values()].some(Boolean));
        }}
      />
    );
  });
}
