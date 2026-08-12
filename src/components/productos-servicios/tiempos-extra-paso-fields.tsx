"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

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
    guardar([
      ...bloques,
      {
        id: `extra_${n}`,
        etiqueta: bloques.length === 0 ? "Preparar el trabajo" : "Tiempo extra",
        minutos: 30,
        centroCostoId: null,
        dotacion: null,
      },
    ]);
  };

  return (
    <div className="pasos-sections">
      <p className="text-muted-foreground text-sm">
        Trabajo que lleva el paso pero <strong>no depende de la cantidad</strong>:
        preparar, trasladarse. Se cobra una vez por trabajo, suma al tiempo del
        paso (la fecha de entrega lo cuenta) y se muestra aparte en el desglose.
      </p>

      {bloques.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin tiempo extra: el paso cobra sólo lo que tarda el trabajo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {bloques.map((bloque, indice) => (
            <div
              key={bloque.id}
              className="flex flex-wrap items-end gap-3 rounded-md border p-3"
            >
              <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                <label className="text-muted-foreground text-xs">
                  Qué es
                </label>
                <Input
                  value={bloque.etiqueta}
                  placeholder="Traslado ida y vuelta"
                  onChange={(e) =>
                    actualizar(indice, { etiqueta: e.target.value })
                  }
                />
              </div>
              <div className="flex w-[110px] flex-col gap-1">
                <label className="text-muted-foreground text-xs">Minutos</label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={bloque.minutos}
                  onChange={(e) =>
                    actualizar(indice, { minutos: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex min-w-[190px] flex-1 flex-col gap-1">
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
              </div>
              <div className="flex w-[110px] flex-col gap-1">
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
                          : Math.max(1, Math.round(Number(e.target.value) || 1)),
                    })
                  }
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-red-600"
                onClick={() =>
                  guardar(bloques.filter((_, i) => i !== indice))
                }
                aria-label="Quitar tiempo extra"
              >
                <Trash2Icon className="size-4" />
              </button>
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
