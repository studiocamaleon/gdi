/**
 * Piezas que se gastan con el uso de la máquina: el "costo por click".
 *
 * A diferencia del tóner, el desgaste no depende de la cobertura sino de
 * cuántas páginas pasaron —una hoja al 2% gasta el cilindro igual que una
 * al 60%—, así que cada pieza declara su vida útil en clicks A4 y el motor
 * prorratea. Ver docs/costo-por-click-desgaste-diseno.md
 */

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  tipoComponenteDesgasteMaquinaItems,
  type MaquinaPayload,
} from "@/lib/maquinaria";

type DesgasteEditorProps = {
  form: MaquinaPayload;
  setForm: React.Dispatch<React.SetStateAction<MaquinaPayload>>;
};

/** Una máquina que imprime en color tiene piezas que sólo giran en color. */
function admiteColor(form: MaquinaPayload) {
  const declarados = (form.parametrosTecnicos ?? {}).coloresSoportados;
  const modos = Array.isArray(declarados)
    ? declarados.map(String)
    : typeof declarados === "string"
      ? [declarados]
      : [];
  return modos.some((modo) => modo.toUpperCase().includes("CMYK"));
}

export function DesgasteEditor({ form, setForm }: DesgasteEditorProps) {
  const { moneda } = useConfigRegional();
  const fmt = (valor: number) =>
    formatearMoneda(valor, moneda, { decimales: 2 });

  const componentes = form.componentesDesgaste;
  const conColumnaColor = admiteColor(form);

  const actualizar = (
    indice: number,
    patch: Partial<MaquinaPayload["componentesDesgaste"][number]>,
  ) => {
    setForm((actual) => ({
      ...actual,
      componentesDesgaste: actual.componentesDesgaste.map((item, i) =>
        i === indice ? { ...item, ...patch } : item,
      ),
    }));
  };

  const agregar = () => {
    setForm((actual) => ({
      ...actual,
      componentesDesgaste: [
        ...actual.componentesDesgaste,
        {
          nombre: "",
          tipo: "drum",
          unidadDesgaste: "copias_a4_equiv",
          soloColor: false,
          activo: true,
        },
      ],
    }));
  };

  const quitar = (indice: number) => {
    setForm((actual) => ({
      ...actual,
      componentesDesgaste: actual.componentesDesgaste.filter(
        (_, i) => i !== indice,
      ),
    }));
  };

  /** Lo que aporta cada pieza a un click, y el total que la imprenta reconoce. */
  const costoPorClick = (item: (typeof componentes)[number]) => {
    const precio = Number(item.precioUnitario ?? 0);
    const vida = Number(item.vidaUtilEstimada ?? 0);
    if (!Number.isFinite(precio) || precio <= 0) return null;
    if (!Number.isFinite(vida) || vida <= 0) return null;
    return precio / vida;
  };

  const totales = componentes.reduce(
    (acc, item) => {
      const costo = costoPorClick(item);
      if (costo === null) return acc;
      if (!item.soloColor) acc.mono += costo;
      acc.color += costo;
      return acc;
    },
    { mono: 0, color: 0 },
  );

  return (
    <div className="maq-perfiles">
      {componentes.length === 0 ? (
        <p className="maq-perfiles-vacio">
          Sin piezas cargadas: la máquina no suma costo por click.
        </p>
      ) : (
        <div className="maq-perfiles-scroll">
          <table className="maq-perfiles-tabla">
            <thead>
              <tr>
                <th>Componente</th>
                <th className="tipo">Tipo</th>
                <th className="num">Precio del repuesto</th>
                <th className="num">Rinde (clicks A4)</th>
                <th className="num">Costo por click</th>
                {conColumnaColor ? <th className="num">Sólo color</th> : null}
                <th className="acciones" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {componentes.map((item, indice) => {
                const costo = costoPorClick(item);
                return (
                  <tr key={item.id ?? `nuevo-${indice}`}>
                    <td>
                      <input
                        value={item.nombre}
                        placeholder="Drum negro"
                        aria-label={`Nombre del componente ${indice + 1}`}
                        onChange={(e) =>
                          actualizar(indice, { nombre: e.target.value })
                        }
                      />
                    </td>
                    <td className="tipo">
                      <select
                        value={item.tipo}
                        aria-label={`Tipo del componente ${indice + 1}`}
                        onChange={(e) =>
                          actualizar(indice, {
                            tipo: e.target
                              .value as (typeof componentes)[number]["tipo"],
                          })
                        }
                      >
                        {tipoComponenteDesgasteMaquinaItems.map((opcion) => (
                          <option key={opcion.value} value={opcion.value}>
                            {opcion.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.precioUnitario ?? ""}
                        aria-label={`Precio del componente ${indice + 1}`}
                        onChange={(e) =>
                          actualizar(indice, {
                            precioUnitario:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.vidaUtilEstimada ?? ""}
                        aria-label={`Vida útil del componente ${indice + 1}`}
                        onChange={(e) =>
                          actualizar(indice, {
                            vidaUtilEstimada:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="num maq-desgaste-costo">
                      {costo === null ? "—" : fmt(costo)}
                    </td>
                    {conColumnaColor ? (
                      <td className="num">
                        <input
                          type="checkbox"
                          checked={Boolean(item.soloColor)}
                          aria-label={`El componente ${indice + 1} sólo se gasta en color`}
                          onChange={(e) =>
                            actualizar(indice, { soloColor: e.target.checked })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="acciones">
                      <span className="maq-perfiles-acciones">
                        <button
                          type="button"
                          className="del"
                          title="Quitar pieza"
                          aria-label={`Quitar ${item.nombre || `componente ${indice + 1}`}`}
                          onClick={() => quitar(indice)}
                        >
                          <XIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="maq-btn maq-perfiles-agregar" onClick={agregar}>
        <PlusIcon />
        Agregar pieza
      </button>

      {totales.mono > 0 || totales.color > 0 ? (
        <p className="maq-desgaste-total">
          Costo por click:{" "}
          {conColumnaColor ? (
            <>
              <strong>{fmt(totales.mono)}</strong> en blanco y negro ·{" "}
              <strong>{fmt(totales.color)}</strong> en color
            </>
          ) : (
            <strong>{fmt(totales.mono)}</strong>
          )}
        </p>
      ) : null}
    </div>
  );
}
