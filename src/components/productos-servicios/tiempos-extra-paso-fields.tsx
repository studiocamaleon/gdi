"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { HumanSelect } from "@/components/ui/human-select";
import {
  type TiempoExtraPaso,
  leerTiemposExtra,
  patchTiemposExtra,
} from "@/lib/tiempos-extra-paso";

/**
 * TIEMPO EXTRA del paso: trabajo que lleva el paso pero no depende de la
 * cantidad — preparar el trabajo, el traslado de ida y vuelta.
 *
 * Sus minutos suman al tiempo del paso (la ETA los cuenta) y su costo se
 * tarifa aparte: cada bloque puede ir a OTRO centro y con otra dotación.
 *
 * La lista muestra el bloque RESUELTO en una línea (qué es, cuánto lleva, de
 * quién es el tiempo) y se edita de a uno: con cuatro campos por bloque
 * abiertos a la vez, la card se vuelve un formulario y deja de leerse.
 * Ver docs/cargos-por-paso-analisis-y-plan.md §7.
 */
export function TiemposExtraPasoFields({
  params,
  centros,
  centroDelPaso,
  dotacionDelPaso,
  onChange,
}: {
  params: Record<string, unknown>;
  centros: Array<{ id: string; nombre: string }>;
  /** Nombre del centro del paso, para explicar qué significa "el del paso". */
  centroDelPaso: string | null;
  dotacionDelPaso: number;
  /** Patch shallow sobre `paramsPasoJson`. */
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const bloques = leerTiemposExtra(params);
  const [editando, setEditando] = React.useState<string | null>(null);

  const guardar = (siguientes: TiempoExtraPaso[]) =>
    onChange(patchTiemposExtra(siguientes));

  const actualizar = (indice: number, parcial: Partial<TiempoExtraPaso>) =>
    guardar(
      bloques.map((bloque, i) =>
        i === indice ? { ...bloque, ...parcial } : bloque,
      ),
    );

  // El id tiene que ser estable y único DENTRO del paso: los niveles pisan los
  // minutos por id. Se numera a partir del mayor existente para no reciclar el
  // de un bloque borrado (un nivel viejo le pisaría los minutos al nuevo).
  const agregar = () => {
    const usados = new Set(bloques.map((bloque) => bloque.id));
    let n = bloques.length + 1;
    while (usados.has(`extra_${n}`)) n += 1;
    const id = `extra_${n}`;
    guardar([
      ...bloques,
      {
        id,
        etiqueta: bloques.length === 0 ? "Preparar el trabajo" : "Tiempo extra",
        minutos: 30,
        centroCostoId: null,
        dotacion: null,
      },
    ]);
    setEditando(id);
  };

  /** La segunda línea de la fila: de quién es ese tiempo. */
  const describir = (bloque: TiempoExtraPaso) => {
    const centro = bloque.centroCostoId
      ? (centros.find((c) => c.id === bloque.centroCostoId)?.nombre ??
        "otro centro")
      : "mismo centro";
    const personas =
      bloque.dotacion == null
        ? "mismas personas"
        : bloque.dotacion === 1
          ? "1 persona"
          : `${bloque.dotacion} personas`;
    return `${centro} · ${personas}`;
  };

  return (
    // `pasos-sections` es `display:block` sin gap: el flex-col es lo que separa
    // la lista del botón de agregar (si no, queda pegado al borde de la card).
    <div className="pasos-sections flex flex-col gap-3">
      {bloques.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin tiempo extra: el paso cobra sólo lo que tarda el trabajo.
        </p>
      ) : (
        <div className="divide-y overflow-hidden rounded-md border">
          {bloques.map((bloque, indice) => (
            <div
              key={bloque.id}
              className={
                editando === bloque.id ? "bg-muted/20 p-3" : "hover:bg-muted/20 p-3 transition-colors"
              }
            >
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  {/* Sin `truncate`: en la columna angosta del editor un
                      "Traslado ida y vuelta" quedaba en "Tra…". Envuelve. */}
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">
                      {bloque.etiqueta}
                    </span>
                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] leading-4">
                      {bloque.minutos} min
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {describir(bloque)}
                  </div>
                </div>
                {/* Neutros en reposo: el rojo permanente de un tacho por fila
                    grita más fuerte que el dato. */}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() =>
                    setEditando(editando === bloque.id ? null : bloque.id)
                  }
                  aria-label={`Editar ${bloque.etiqueta}`}
                  aria-expanded={editando === bloque.id}
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-muted-foreground shrink-0 hover:text-red-600"
                  onClick={() => {
                    setEditando(null);
                    guardar(bloques.filter((_, i) => i !== indice));
                  }}
                  aria-label={`Quitar ${bloque.etiqueta}`}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>

              {editando === bloque.id ? (
                <div className="border-border/70 mt-3 flex flex-col gap-2.5 border-t pt-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-xs">
                      Nombre
                    </label>
                    <Input
                      value={bloque.etiqueta}
                      placeholder="Traslado ida y vuelta"
                      onChange={(e) =>
                        actualizar(indice, { etiqueta: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-muted-foreground text-xs">
                        Minutos
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bloque.minutos}
                        onChange={(e) =>
                          actualizar(indice, {
                            minutos: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-muted-foreground text-xs">
                        Personas
                      </label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={bloque.dotacion ?? ""}
                        placeholder={String(dotacionDelPaso)}
                        onChange={(e) =>
                          actualizar(indice, {
                            dotacion:
                              e.target.value === ""
                                ? null
                                : Math.max(
                                    1,
                                    Math.round(Number(e.target.value) || 1),
                                  ),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-muted-foreground text-xs">
                      Centro de costo
                    </label>
                    <HumanSelect
                      value={bloque.centroCostoId ?? ""}
                      onValueChange={(v) =>
                        actualizar(indice, { centroCostoId: v || null })
                      }
                      options={centros.map((centro) => ({
                        value: centro.id,
                        label: centro.nombre,
                      }))}
                      placeholder={
                        centroDelPaso
                          ? `El del paso: ${centroDelPaso}`
                          : "El del paso"
                      }
                    />
                    <span className="text-muted-foreground text-xs leading-snug">
                      Puede ser otro: el traslado lo hace la cuadrilla aunque el
                      trabajo se cobre en el taller.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm w-fit self-end"
                    onClick={() => setEditando(null)}
                  >
                    Listo
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline btn-sm w-fit"
        onClick={agregar}
      >
        <PlusIcon className="mr-1 size-4" />
        Agregar tiempo extra
      </button>
    </div>
  );
}
