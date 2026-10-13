"use client";

import { useState } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "./centro-copiado-ui";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  preciosConRangos,
  type MatrizHojas,
  type MatrizCad,
} from "@/lib/centro-copiado-tarifarios-editor";
import type { CeldaSimulacion } from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";

type Matriz = MatrizHojas | MatrizCad;

export function LimpiarPreciosTarifario({
  matriz,
  indices,
  descripcionVista,
  disabled,
  onChange,
  onLimpiarResultados,
}: {
  matriz: Matriz;
  indices: number[];
  descripcionVista: string;
  disabled: boolean;
  onChange: (matriz: Matriz) => void;
  onLimpiarResultados?: (celdas: CeldaSimulacion[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [alcance, setAlcance] = useState("VISTA");
  const [firmaInicial, setFirmaInicial] = useState("");
  const [deshacer, setDeshacer] = useState<{
    antes: Matriz;
    despues: string;
  } | null>(null);
  const firma = JSON.stringify([matriz, indices]);
  const seleccion =
    alcance === "MATRIZ" ? matriz.filas.map((_, i) => i) : indices;
  const cargados = seleccion.reduce(
    (n, i) =>
      n +
      preciosConRangos(
        matriz.filas[i],
        matriz.filas[i].rangosPropios ?? matriz.rangosGenerales,
      ).filter(
        (p) => p.precioUnitario != null && p.precioUnitario.trim() !== "",
      ).length,
    0,
  );
  const cad = matriz.reglas.unidad === "ML";
  const limpiar = () => {
    if (disabled || firma !== firmaInicial || !seleccion.length) return;
    const nuevo = structuredClone(matriz);
    const celdas: CeldaSimulacion[] = [];
    for (const fila of seleccion) {
      nuevo.filas[fila].precios = preciosConRangos(
        nuevo.filas[fila],
        nuevo.filas[fila].rangosPropios ?? nuevo.rangosGenerales,
      ).map((p, tramo) => {
        celdas.push({ seccion: cad ? "cad" : "hojas", fila, tramo });
        return { ...p, precioUnitario: null };
      }) as (typeof nuevo.filas)[number]["precios"];
    }
    setDeshacer({
      antes: structuredClone(matriz),
      despues: JSON.stringify(nuevo),
    });
    onLimpiarResultados?.(celdas);
    onChange(nuevo);
    setAbierto(false);
  };
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled || !matriz.filas.length}
        onClick={() => {
          setAlcance("VISTA");
          setFirmaInicial(firma);
          setAbierto(true);
        }}
      >
        <Eraser /> Limpiar valores
      </Button>
      {deshacer && JSON.stringify(matriz) === deshacer.despues && (
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={() => {
            onChange(structuredClone(deshacer.antes));
            setDeshacer(null);
          }}
        >
          <Undo2 /> Deshacer limpieza
        </Button>
      )}
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar precios y cálculos</AlertDialogTitle>
            <AlertDialogDescription>
              Los precios quedarán pendientes en el borrador para volver a
              calcularlos. Se borrarán también sus simulaciones y referencias
              personalizadas. Los rangos, combinaciones y versiones publicadas
              se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 flex flex-col gap-3">
            <SegmentedControl
              aria-label="Alcance de la limpieza"
              value={alcance}
              onChange={setAlcance}
              options={[
                { value: "VISTA", label: "Vista filtrada", icon: null },
                { value: "MATRIZ", label: "Toda la matriz", icon: null },
              ]}
            />
            <p className="text-sm">
              {alcance === "VISTA"
                ? `${descripcionVista}, en todas sus páginas.`
                : `Toda la matriz de ${cad ? "CAD" : "hojas"}.`}{" "}
              {seleccion.length} combinaciones · {cargados} precios cargados,
              incluidos los ceros.
            </p>
            <p className="text-sm text-muted-foreground">
              Podés deshacer la limpieza antes de editar otros precios. Guardar
              borrador conserva los cambios sin publicarlos.
            </p>
            {firma !== firmaInicial && (
              <p role="alert">
                La matriz cambió. Cerrá y volvé a abrir la limpieza para revisar
                su alcance.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={disabled || firma !== firmaInicial || !seleccion.length}
              onClick={limpiar}
            >
              Limpiar y dejar pendientes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
