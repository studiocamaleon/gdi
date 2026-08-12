"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  type NivelPasoOpcion,
  leerNivelesPaso,
} from "@/lib/niveles-paso";
import { leerTiemposExtra } from "@/lib/tiempos-extra-paso";

/**
 * NIVELES del paso: un paso, varias variantes que elige el comercial.
 *
 * "Colocación a domicilio" no son tres pasos (taller / zona 1 / zona 2): es UNO
 * con tres niveles. Lo mismo "Diseño gráfico" (básico / intermedio /
 * profesional). El nivel es un DELTA sobre la base del paso: sólo pisa lo que
 * declara. Ver docs/cargos-por-paso-analisis-y-plan.md §8.
 */
export function NivelesPasoFields({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  /** Patch shallow sobre `paramsPasoJson`. */
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const config = leerNivelesPaso(params);
  const bloques = leerTiemposExtra(params).filter((b) => b.minutos > 0);

  const guardar = (etiqueta: string, opciones: NivelPasoOpcion[]) =>
    onChange({
      niveles: opciones.length >= 2 ? { etiqueta, opciones } : null,
    });

  if (!config) {
    return (
      <div className="pasos-sections">
        <p className="text-muted-foreground text-sm">
          Este paso corre siempre igual. Si el mismo trabajo se cobra distinto
          según dónde o con qué dificultad se haga, declaralo como niveles: el
          comercial elige uno al cotizar y no hay que modelar un paso por caso.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm w-fit"
          onClick={() =>
            guardar("¿Qué nivel?", [
              { codigo: "nivel_1", nombre: "Nivel 1", esDefault: true, overrides: {} },
              { codigo: "nivel_2", nombre: "Nivel 2", esDefault: false, overrides: {} },
            ])
          }
        >
          <PlusIcon className="mr-1 size-4" />
          Este paso viene en niveles
        </button>
      </div>
    );
  }

  const { etiqueta, opciones } = config;

  const actualizarOpcion = (
    indice: number,
    parcial: Partial<NivelPasoOpcion>,
  ) =>
    guardar(
      etiqueta,
      opciones.map((opcion, i) =>
        i === indice ? { ...opcion, ...parcial } : opcion,
      ),
    );

  const setOverride = (
    indice: number,
    campo: "tiempoFijoMin" | "productividadHora" | "dotacion",
    valor: string,
  ) => {
    const overrides = { ...opciones[indice].overrides };
    if (valor === "") delete overrides[campo];
    else overrides[campo] = Number(valor);
    actualizarOpcion(indice, { overrides });
  };

  const setMinutosBloque = (indice: number, bloqueId: string, valor: string) => {
    const overrides = { ...opciones[indice].overrides };
    const minutos = { ...(overrides.tiemposExtraMin ?? {}) };
    if (valor === "") delete minutos[bloqueId];
    else minutos[bloqueId] = Number(valor);
    overrides.tiemposExtraMin =
      Object.keys(minutos).length > 0 ? minutos : undefined;
    actualizarOpcion(indice, { overrides });
  };

  // Un solo default: marcar uno desmarca al resto.
  const marcarDefault = (indice: number) =>
    guardar(
      etiqueta,
      opciones.map((opcion, i) => ({ ...opcion, esDefault: i === indice })),
    );

  return (
    <div className="pasos-sections">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">
          ¿Cómo le preguntamos al comercial?
        </label>
        <Input
          value={etiqueta}
          placeholder="¿Dónde se coloca?"
          onChange={(e) => guardar(e.target.value, opciones)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {opciones.map((opcion, indice) => (
          <div
            key={opcion.codigo}
            className="flex flex-col gap-3 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                <label className="text-muted-foreground text-xs">Nombre</label>
                <Input
                  value={opcion.nombre}
                  placeholder="Zona 1"
                  onChange={(e) =>
                    actualizarOpcion(indice, { nombre: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-xs">
                <input
                  type="radio"
                  name="nivel-default"
                  checked={opcion.esDefault}
                  onChange={() => marcarDefault(indice)}
                />
                Viene marcado
              </label>
              {opciones.length > 2 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-red-600"
                  onClick={() =>
                    guardar(
                      etiqueta,
                      opciones.filter((_, i) => i !== indice),
                    )
                  }
                  aria-label="Quitar nivel"
                >
                  <Trash2Icon className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-[130px] flex-col gap-1">
                <label className="text-muted-foreground text-xs">
                  Trabajo (min)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={opcion.overrides.tiempoFijoMin ?? ""}
                  placeholder="el del paso"
                  onChange={(e) =>
                    setOverride(indice, "tiempoFijoMin", e.target.value)
                  }
                />
              </div>
              <div className="flex w-[130px] flex-col gap-1">
                <label className="text-muted-foreground text-xs">
                  Ritmo (por hora)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={opcion.overrides.productividadHora ?? ""}
                  placeholder="el del paso"
                  onChange={(e) =>
                    setOverride(indice, "productividadHora", e.target.value)
                  }
                />
              </div>
              <div className="flex w-[110px] flex-col gap-1">
                <label className="text-muted-foreground text-xs">Personas</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={opcion.overrides.dotacion ?? ""}
                  placeholder="las del paso"
                  onChange={(e) =>
                    setOverride(indice, "dotacion", e.target.value)
                  }
                />
              </div>
              {bloques.map((bloque) => (
                <div key={bloque.id} className="flex w-[150px] flex-col gap-1">
                  <label
                    className="text-muted-foreground truncate text-xs"
                    title={bloque.etiqueta}
                  >
                    {bloque.etiqueta} (min)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={opcion.overrides.tiemposExtraMin?.[bloque.id] ?? ""}
                    placeholder={String(bloque.minutos)}
                    onChange={(e) =>
                      setMinutosBloque(indice, bloque.id, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm w-fit"
          onClick={() => {
            // Código estable y único: lo elige el número libre más chico, no un
            // timestamp (el código viaja al jobContext y se congela en la OT).
            const usados = new Set(opciones.map((opcion) => opcion.codigo));
            let n = opciones.length + 1;
            while (usados.has(`nivel_${n}`)) n += 1;
            guardar(etiqueta, [
              ...opciones,
              {
                codigo: `nivel_${n}`,
                nombre: `Nivel ${n}`,
                esDefault: false,
                overrides: {},
              },
            ]);
          }}
        >
          <PlusIcon className="mr-1 size-4" />
          Agregar nivel
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm w-fit text-red-600"
          onClick={() => onChange({ niveles: null })}
        >
          Quitar los niveles
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        Vacío = usa lo del paso. El nivel sólo pisa lo que declara.
      </p>
    </div>
  );
}
