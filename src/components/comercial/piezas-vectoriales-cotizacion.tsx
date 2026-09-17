"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Trash2Icon } from "lucide-react";
import { PiezasArchivosProducto } from "../productos-servicios/piezas-archivos-producto";
import type {
  ConfiguracionGeometriasComerciales,
  FuenteGeometriaComercial,
} from "@/lib/producto-geometrias";
import {
  esFuenteInterpretada,
  type PiezaVectorialCotizacion,
} from "@/lib/piezas-vectoriales-cotizacion";
import styles from "../productos-servicios/piezas-diseno.module.css";

export function PiezasVectorialesCotizacion({
  productoId,
  piezas,
  configuracion,
  cantidad,
  onChange,
  onProcesandoChange,
  titulo,
  descripcion,
}: {
  productoId: string;
  piezas: PiezaVectorialCotizacion[];
  configuracion: ConfiguracionGeometriasComerciales;
  cantidad: number;
  onChange: (piezas: PiezaVectorialCotizacion[]) => void;
  onProcesandoChange: (value: boolean) => void;
  titulo?: string;
  descripcion?: string;
}) {
  // Las cotizaciones antiguas pueden tener SVG sin referencia al archivo original.
  // Se mantienen en la colección; los archivos nuevos siempre guardan su interpretación.
  const anteriores = piezas.filter((p) => !esFuenteInterpretada(p.fuente));
  const fuentes: FuenteGeometriaComercial[] = piezas.flatMap((p) => {
    if (!esFuenteInterpretada(p.fuente)) return [];
    const configurada = configuracion.fuentes.find((f) => f.id === p.id);
    return [
      {
        id: p.id,
        nombre: p.nombre,
        requerida: configurada?.requerida ?? false,
        permitirReemplazo:
          !configurada?.predeterminada ||
          configurada.permitirReemplazo === true,
        predeterminada: p.fuente,
      },
    ];
  });
  // Conserva el identificador de los archivos que la receta exige cargar.
  for (const f of configuracion.fuentes) {
    if (f.requerida && !piezas.some((p) => p.id === f.id)) {
      fuentes.push({
        id: f.id,
        nombre: f.nombre,
        requerida: true,
        permitirReemplazo: true,
      });
    }
  }
  const total = piezas.reduce(
    (s, p) =>
      s + (Number.isSafeInteger(p.cantidadPorUnidad) ? p.cantidadPorUnidad : 0),
    0,
  );
  const cantidadPieza = (id: string) => {
    const p = piezas.find((p) => p.id === id);
    if (!p) return null;
    const invalida =
      !Number.isSafeInteger(p.cantidadPorUnidad) ||
      p.cantidadPorUnidad < 1 ||
      p.cantidadPorUnidad > 10000;
    return (
      <Field data-invalid={invalida}>
        <FieldLabel htmlFor={`copias-${id}`}>Por producto</FieldLabel>
        <Input
          id={`copias-${id}`}
          type="number"
          min={1}
          max={10000}
          step={1}
          aria-invalid={invalida}
          value={Number.isNaN(p.cantidadPorUnidad) ? "" : p.cantidadPorUnidad}
          onChange={(e) =>
            onChange(
              piezas.map((x) =>
                x.id === id
                  ? {
                      ...x,
                      cantidadPorUnidad:
                        e.target.value === ""
                          ? Number.NaN
                          : Number(e.target.value),
                    }
                  : x,
              ),
            )
          }
        />
        <FieldDescription>
          {invalida
            ? "Ingresá entre 1 y 10.000 piezas por producto."
            : `${cantidad} × ${p.cantidadPorUnidad} = ${cantidad * p.cantidadPorUnidad} piezas en total.`}
        </FieldDescription>
      </Field>
    );
  };
  return (
    <PiezasArchivosProducto
      productoId={productoId}
      fuentes={fuentes}
      paraCotizacion
      titulo={titulo}
      descripcion={descripcion}
      resumen={`${piezas.length} diseños · ${total} piezas por producto · ${total * cantidad} en total`}
      idsReservados={anteriores.map((p) => p.id)}
      onProcesandoChange={onProcesandoChange}
      renderCantidad={cantidadPieza}
      contenidoAdicional={anteriores.map((p) => (
        <article key={p.id} className={styles.piece}>
          <div className={`${styles.pieceMain} ${styles.legacyMain}`}>
            <div className={styles.identity}>
              <strong>{p.nombre}</strong>
              <p>{p.fuente.nombreArchivo}</p>
              <small>
                {p.fuente.anchoFinalMm} × {p.fuente.altoFinalMm ?? "—"} mm ·
                Diseño de la cotización anterior
              </small>
            </div>
            {cantidadPieza(p.id)}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${p.nombre}`}
              onClick={() => onChange(piezas.filter((x) => x.id !== p.id))}
            >
              <Trash2Icon />
            </Button>
          </div>
        </article>
      ))}
      onChange={(fs) =>
        onChange([
          ...anteriores,
          ...fs.flatMap((f) =>
            f.predeterminada
              ? [
                  {
                    id: f.id,
                    nombre: f.nombre,
                    fuente: f.predeterminada,
                    cantidadPorUnidad:
                      piezas.find((p) => p.id === f.id)?.cantidadPorUnidad ?? 1,
                  },
                ]
              : [],
          ),
        ])
      }
    />
  );
}
