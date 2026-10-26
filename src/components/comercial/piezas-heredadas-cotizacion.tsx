"use client";

import { useRef } from "react";
import type { ConfiguracionGeometriasComerciales } from "@/lib/producto-geometrias";
import {
  piezasVectorialesIniciales,
  type PiezaVectorialCotizacion,
} from "@/lib/piezas-vectoriales-cotizacion";
import { PiezasVectorialesCotizacion } from "./piezas-vectoriales-cotizacion";
import type { FuenteVectorialCotizada } from "./geometrias-vectoriales-cotizacion";
import { DisenoCompartidoCotizacion } from "./diseno-compartido-cotizacion";

export function PiezasHeredadasCotizacion({
  productoId,
  configuracion,
  fuentes,
  colecciones,
  cantidad,
  onChange,
  onFuenteChange,
  onProcesandoChange,
}: {
  productoId: string;
  configuracion: ConfiguracionGeometriasComerciales;
  fuentes: Record<string, FuenteVectorialCotizada>;
  colecciones: Record<string, PiezaVectorialCotizacion[]>;
  cantidad: number;
  onChange: (id: string, piezas: PiezaVectorialCotizacion[]) => void;
  onFuenteChange: (id: string, fuente: FuenteVectorialCotizada) => void;
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
    const coleccion = colecciones[fuente.id];
    const completa = coleccion
      ? undefined
      : (fuentes[fuente.id] ?? fuente.predeterminada);
    const procesandoFuente = (editor: string, value: boolean) => {
      procesando.current.set(`${fuente.id}:${editor}`, value);
      onProcesandoChange([...procesando.current.values()].some(Boolean));
    };
    return (
      <div key={fuente.id} className="flex flex-col gap-3">
        <DisenoCompartidoCotizacion
          titulo={
            configuracion.fuentes.length === 1
              ? "Diseño del cartel"
              : fuente.nombre
          }
          value={completa}
          permitirReemplazo={
            !fuente.predeterminada || fuente.permitirReemplazo === true
          }
          reemplazaPiezas={Boolean(coleccion?.length)}
          onChange={(value) => onFuenteChange(fuente.id, value)}
          onProcesandoChange={(value) => procesandoFuente("completo", value)}
        />
        <details>
          <summary className="cursor-pointer text-sm">
            {coleccion?.length
              ? `Revisar ${coleccion.length} piezas importadas y sus capas`
              : "Opciones avanzadas: varios archivos, piezas y capas"}
          </summary>
          <PiezasVectorialesCotizacion
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
            onProcesandoChange={(value) => procesandoFuente("piezas", value)}
          />
        </details>
      </div>
    );
  });
}
