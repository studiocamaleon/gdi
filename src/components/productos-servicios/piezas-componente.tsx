"use client";
import { Button, Input } from "./producto-ui";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { LibraryIcon } from "lucide-react";
import styles from "./piezas-diseno.module.css";
import type { PiezaVectorialComponente } from "@/lib/productos-servicios-api";
import type { FuenteGeometriaComercial } from "@/lib/producto-geometrias";
import { PiezasArchivosProducto } from "./piezas-archivos-producto";

export function PiezasComponente({
  productoId,
  piezas,
  disponibles,
  onChange,
}: {
  productoId: string;
  piezas: PiezaVectorialComponente[];
  disponibles: FuenteGeometriaComercial[];
  onChange: (piezas: PiezaVectorialComponente[]) => void;
}) {
  const fuentes = piezas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    requerida: true,
    predeterminada: p.fuente,
  }));
  const accionBiblioteca = disponibles.some(
    (f) =>
      f.predeterminada &&
      !piezas.some(
        (p) =>
          p.fuente.procedencia.geometriaId ===
          f.predeterminada?.procedencia.geometriaId,
      ),
  ) && (
    <Button
      className={styles.secondaryAction}
      type="button"
      variant="outline"
      onClick={() =>
        onChange(
          [
            ...piezas,
            ...disponibles
              .filter(
                (f) =>
                  f.predeterminada &&
                  !piezas.some(
                    (p) =>
                      p.fuente.procedencia.geometriaId ===
                      f.predeterminada?.procedencia.geometriaId,
                  ),
              )
              .map((f) => ({
                id: crypto.randomUUID(),
                nombre: f.nombre,
                fuente: f.predeterminada!,
                cantidadPorUnidad: 1,
              })),
          ].slice(0, 30),
        )
      }
    >
      <LibraryIcon data-icon="inline-start" />
      Reutilizar diseños del producto
    </Button>
  );
  const total = piezas.reduce(
    (n, p) =>
      n +
      (Number.isSafeInteger(p.cantidadPorUnidad) && p.cantidadPorUnidad > 0
        ? p.cantidadPorUnidad
        : 0),
    0,
  );
  return (
    <PiezasArchivosProducto
      productoId={productoId}
      fuentes={fuentes}
      paraComponente
      accionBiblioteca={accionBiblioteca}
      resumen={`${piezas.length} diseños · ${total} piezas por producto`}
      onChange={(fs) =>
        onChange(
          fs
            .filter((f) => f.predeterminada)
            .map((f) => ({
              id: f.id,
              nombre: f.nombre,
              fuente: f.predeterminada!,
              cantidadPorUnidad:
                piezas.find((p) => p.id === f.id)?.cantidadPorUnidad ?? 1,
            })),
        )
      }
      renderCantidad={(id) => {
        const p = piezas.find((p) => p.id === id)!;
        return (
          <Field
            data-invalid={
              !Number.isSafeInteger(p.cantidadPorUnidad) ||
              p.cantidadPorUnidad < 1 ||
              p.cantidadPorUnidad > 10000
            }
          >
            <FieldLabel htmlFor={`cantidad-pieza-${id}`}>
              Piezas por producto
            </FieldLabel>
            <Input
              id={`cantidad-pieza-${id}`}
              type="number"
              aria-invalid={
                !Number.isSafeInteger(p.cantidadPorUnidad) ||
                p.cantidadPorUnidad < 1 ||
                p.cantidadPorUnidad > 10000
              }
              min={1}
              max={10000}
              step={1}
              value={
                Number.isNaN(p.cantidadPorUnidad) ? "" : p.cantidadPorUnidad
              }
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
              {Number.isInteger(p.cantidadPorUnidad) && p.cantidadPorUnidad > 0
                ? `${p.cantidadPorUnidad} por cada unidad vendida.`
                : "Ingresá una cantidad entera mayor que cero."}
            </FieldDescription>
          </Field>
        );
      }}
    />
  );
}
