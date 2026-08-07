"use client";

import { Input } from "@/components/ui/input";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  ETIQUETA_LADO,
  LADOS_PIEZA,
  type EfectoDemasiaMedida,
  type LadoPieza,
  leerEfectoDemasia,
  declaraEfectoDemasia,
  patchEfectoDemasia,
} from "@/lib/efectos-paso";

/**
 * Lo que el paso le EXIGE al trabajo (docs/efectos-de-paso-diseno.md).
 *
 * Hoy hay un solo efecto: la demasía de medida. El paso pide que la pieza
 * venga más grande —envolver un bastidor, coser un bolsillo— y el motor
 * agranda el material ANTES de imprimir, aunque el paso vaya al final de la
 * ruta. La medida visible, la que el cliente ve colgada, no se toca.
 *
 * La lógica (leer, escribir, limpiar el formato viejo) vive en
 * `@/lib/efectos-paso` para poder testearla; acá queda sólo el render.
 */
export function EfectosPasoFields({
  params,
  onChange,
}: {
  params: Record<string, unknown>;
  /** Patch shallow sobre `paramsPasoJson`. */
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const efecto = leerEfectoDemasia(params);
  const declarado = declaraEfectoDemasia(params);

  // Lo que el usuario está editando: si ya hay efecto, eso; si lo prendió
  // pero le falta un dato, lo que haya escrito hasta ahora.
  const lados: LadoPieza[] = efecto
    ? efecto.lados
    : ladosCrudos(params);
  const mm = efecto?.mm ?? mmCrudo(params);
  const refuerza = efecto?.refuerza ?? false;

  const guardar = (parcial: Partial<EfectoDemasiaMedida>) => {
    const siguiente: EfectoDemasiaMedida = {
      lados,
      mm: mm ?? 0,
      refuerza,
      ...parcial,
    };
    onChange(patchEfectoDemasia(params, siguiente));
  };

  const apagar = () => onChange(patchEfectoDemasia(params, null));

  if (!declarado) {
    return (
      <div className="pasos-sections">
        <p className="text-muted-foreground text-sm">
          Este paso trabaja sobre la medida que le llega. Si necesita que la
          pieza venga más grande, pedilo acá.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm w-fit"
          onClick={() =>
            onChange(
              patchEfectoDemasia(params, {
                lados: ["superior", "inferior"],
                mm: 100,
                refuerza: false,
              }),
            )
          }
        >
          + Necesita material extra alrededor
        </button>
      </div>
    );
  }

  return (
    <div className="pasos-sections wiz-grid">
      <div className="field md:col-span-full">
        <LabelConTooltip
          label="¿De qué lados necesita material extra?"
          tooltip="El material se agranda por cada lado elegido. Un bolsillo para el caño suele ir arriba y abajo; un refuerzo, en los 4 lados."
          required
        />
        <div className="flex flex-wrap gap-2">
          {LADOS_PIEZA.map((lado) => (
            <label
              key={lado}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={lados.includes(lado)}
                onChange={(e) =>
                  guardar({
                    lados: e.target.checked
                      ? [...lados, lado]
                      : lados.filter((l) => l !== lado),
                  })
                }
              />
              <span>{ETIQUETA_LADO[lado]}</span>
            </label>
          ))}
        </div>
        {lados.length === 0 ? (
          <span className="text-destructive text-xs">
            Elegí al menos un lado: sin lados el motor no sabe cuánto agrandar y
            la cotización va a salir con la medida chica.
          </span>
        ) : null}
      </div>

      <div className="field">
        <LabelConTooltip
          label="¿Cuánto por lado? (mm)"
          tooltip="Milímetros que se suman POR LADO. 100 mm arriba y abajo agrandan el alto en 200 mm."
          required
        />
        <Input
          type="number"
          min={1}
          step={1}
          value={mm ?? ""}
          onChange={(e) =>
            guardar({
              mm: e.target.value === "" ? 0 : Number(e.target.value),
            })
          }
          placeholder="mm"
        />
        {!mm ? (
          <span className="text-destructive text-xs">
            Falta cuántos milímetros.
          </span>
        ) : null}
      </div>

      <div className="field md:col-span-full">
        <label className="flex items-start gap-2 rounded-md border p-2 text-sm">
          <input
            type="checkbox"
            checked={refuerza}
            onChange={(e) => guardar({ refuerza: e.target.checked })}
          />
          <span>
            <span className="font-medium">
              Deja una banda plana donde se puede perforar
            </span>
            <span className="text-muted-foreground block text-xs">
              Un refuerzo o dobladillo deja borde firme: los ojales se centran
              ahí. Un bolsillo para el caño es un tubo — no se perfora.
            </span>
          </span>
        </label>
      </div>

      <div className="md:col-span-full">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={apagar}
        >
          Este paso no exige nada
        </button>
      </div>
    </div>
  );
}

/** Lados escritos a medias (el efecto todavía no valida). */
function ladosCrudos(params: Record<string, unknown>): LadoPieza[] {
  const crudo = crudoDelEfecto(params).lados;
  if (!Array.isArray(crudo)) return [];
  const set = new Set(crudo.map((v) => String(v)));
  return LADOS_PIEZA.filter((lado) => set.has(lado));
}

function mmCrudo(params: Record<string, unknown>): number | null {
  const crudo = crudoDelEfecto(params);
  const valor = Number(crudo.mm ?? crudo.demasiaMm ?? NaN);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function crudoDelEfecto(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const efectos = params.efectos;
  const nuevo =
    efectos && typeof efectos === "object" && !Array.isArray(efectos)
      ? (efectos as Record<string, unknown>).demasiaMedida
      : null;
  return nuevo && typeof nuevo === "object" && !Array.isArray(nuevo)
    ? (nuevo as Record<string, unknown>)
    : params;
}
