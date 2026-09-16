"use client";
import { WrenchIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { ActionButton as Button } from "@/components/design-system/action-button";
import styles from "../maquinaria.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { SelectField } from "@/components/design-system/select-field";
/**
 * Piezas que se gastan con el uso de la máquina. Las impresoras por hoja las
 * prorratean por clicks A4; el Plotter CAD prorratea su cabezal por los ml que
 * suman las tintas configuradas en el perfil.
 */

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Input } from "@heroui/react";
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
  const esCabezalCad = form.plantilla === "plotter_cad";
  const conColumnaColor = !esCabezalCad && admiteColor(form);

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
          nombre: esCabezalCad ? "Cabezal de impresión" : "",
          tipo: esCabezalCad ? "cabezal" : "drum",
          unidadDesgaste: esCabezalCad ? "ml_tinta" : "copias_a4_equiv",
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
    <div className={`${styles["maq-perfiles"]} ${styles["maq-desgaste"]}`}>
      {componentes.length === 0 ? (
        <Empty className={styles.sectionEmpty}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WrenchIcon />
            </EmptyMedia>
            <EmptyTitle>Sin componentes de desgaste</EmptyTitle>
            <EmptyDescription>
              {esCabezalCad
                ? "Sin cabezal cargado: todavía no se prorratea su reemplazo por tinta procesada."
                : "Sin piezas cargadas: la máquina no suma costo por click."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={`${styles["maq-perfiles-scroll"]}`}>
          <table className={`${styles["maq-perfiles-tabla"]}`}>
            <thead>
              <tr>
                <th className="nombre">
                  {esCabezalCad ? "Cabezal" : "Componente"}
                  <span className="req"> *</span>
                </th>
                <th className="tipo">Tipo</th>
                <th className="num precio">
                  Precio del repuesto
                  <span className="req"> *</span>
                  <span className="unidad"> ({moneda.simbolo})</span>
                </th>
                <th className="num rinde">
                  Rinde<span className="req"> *</span>
                  <span className="unidad">
                    {esCabezalCad ? " (ml de tinta)" : " (clicks A4)"}
                  </span>
                </th>
                <th className="num costo">
                  {esCabezalCad ? "Costo por ml" : "Costo por click"}
                </th>
                {conColumnaColor ? <th className="color">Sólo color</th> : null}
                <th className="relleno" />
                <th className="acciones" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {componentes.map((item, indice) => {
                const costo = costoPorClick(item);
                return (
                  <tr key={item.id ?? `nuevo-${indice}`}>
                    <td className="nombre">
                      <Input
                        className={focus.singleBorder}
                        value={item.nombre}
                        placeholder={
                          esCabezalCad ? "Cabezal de impresión" : "Drum negro"
                        }
                        aria-label={`Nombre del componente ${indice + 1}`}
                        onChange={(e) =>
                          actualizar(indice, { nombre: e.target.value })
                        }
                      />
                    </td>
                    <td className="tipo">
                      {esCabezalCad ? (
                        <span>Cabezal</span>
                      ) : (
                        <SelectField
                          value={item.tipo}
                          aria-label={`Tipo del componente ${indice + 1}`}
                          onChange={(value) =>
                            actualizar(indice, {
                              tipo: value as (typeof componentes)[number]["tipo"],
                            })
                          }
                          options={[
                            ...(tipoComponenteDesgasteMaquinaItems.map(
                              (opcion) => ({
                                value: opcion.value,
                                label: opcion.label,
                              }),
                            ) ?? []),
                          ]}
                        />
                      )}
                    </td>
                    <td className="num">
                      <Input
                        className={focus.singleBorder}
                        type="number"
                        inputMode="decimal"
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
                      <Input
                        className={focus.singleBorder}
                        type="number"
                        inputMode="numeric"
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
                    <td className={`num ${styles["maq-desgaste-costo"]}`}>
                      {costo === null ? "—" : fmt(costo)}
                    </td>
                    {conColumnaColor ? (
                      <td className="color">
                        <div
                          className={`${styles["maq-seg"]} ${styles["maq-seg-mini"]}`}
                          role="group"
                          aria-label={`El componente ${indice + 1} sólo se gasta en color`}
                        >
                          <Button
                            variant={
                              Boolean(item.soloColor) ? "secondary" : "outline"
                            }
                            type="button"
                            className={item.soloColor ? "activo" : ""}
                            aria-pressed={Boolean(item.soloColor)}
                            onClick={() =>
                              actualizar(indice, { soloColor: true })
                            }
                          >
                            Sí
                          </Button>
                          <Button
                            variant={!item.soloColor ? "secondary" : "outline"}
                            type="button"
                            className={item.soloColor ? "" : "activo"}
                            aria-pressed={!item.soloColor}
                            onClick={() =>
                              actualizar(indice, { soloColor: false })
                            }
                          >
                            No
                          </Button>
                        </div>
                      </td>
                    ) : null}
                    <td className="relleno" />
                    <td className="acciones">
                      <span className={`${styles["maq-perfiles-acciones"]}`}>
                        <Button
                          variant="ghost"
                          isIconOnly
                          type="button"
                          className="del"
                          title="Quitar pieza"
                          aria-label={`Quitar ${item.nombre || `componente ${indice + 1}`}`}
                          onClick={() => quitar(indice)}
                        >
                          <XIcon />
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!esCabezalCad || componentes.length === 0 ? (
        <Button
          variant="outline"
          type="button"
          className={`${styles["maq-btn"]} ${styles["maq-perfiles-agregar"]}`}
          onClick={agregar}
        >
          <PlusIcon />
          {esCabezalCad ? "Agregar cabezal" : "Agregar pieza"}
        </Button>
      ) : null}

      {totales.mono > 0 || totales.color > 0 ? (
        <p className={`${styles["maq-desgaste-total"]}`}>
          {esCabezalCad ? "Costo por ml: " : "Costo por click: "}
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
