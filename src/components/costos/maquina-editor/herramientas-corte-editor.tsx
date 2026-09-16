"use client";
import styles from "../maquinaria.module.css";
import { useMaquinariaPuedeEditar } from "./maquinaria-edicion";
import focus from "@/components/design-system/field-focus.module.css";
import { SelectField } from "@/components/design-system/select-field";
import { useId } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { Checkbox } from "@heroui/react";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@heroui/react";
import { Switch } from "@heroui/react";
import {
  configuracionCorteInicial,
  NOMBRES_OPERACION_CORTE,
  OPERACIONES_CORTE,
  PLANTILLAS_PROCESAMIENTO_CORTE,
  TIPOS_HERRAMIENTA_CORTE,
  type ConfiguracionProcesamientoCorte,
  type HerramientaCorte,
} from "@/lib/procesamiento-corte";
import type { MaquinaEditorState } from "./use-maquina-editor";
import s from "./procesamiento-corte.module.css";

export function NumeroCorte({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        className={focus.singleBorder}
        id={id}
        aria-label={label}
        type="number"
        min={min}
        step="any"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </Field>
  );
}
export function OpcionCorteHero({
  label,
  value,
  onChange,
  opciones,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opciones: Array<{ value: string; label: string }>;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SelectField
        value={value}
        onChange={(v) => v && onChange(v)}
        aria-label={label}
        options={[
          ...(opciones.map((o) => ({ value: o.value, label: o.label })) ?? []),
        ]}
      />
    </Field>
  );
}
export function HerramientasCorteEditor({
  editor,
}: {
  editor: MaquinaEditorState;
}) {
  const puedeEditar = useMaquinariaPuedeEditar();
  const { form, setForm, perfiles } = editor;
  if (!PLANTILLAS_PROCESAMIENTO_CORTE.includes(form.plantilla)) return null;
  const config = form.parametrosTecnicos?.procesamientoCorte as
    | ConfiguracionProcesamientoCorte
    | undefined;
  const guardar = (next: ConfiguracionProcesamientoCorte) =>
    setForm((f) => ({
      ...f,
      parametrosTecnicos: { ...f.parametrosTecnicos, procesamientoCorte: next },
    }));
  const actualizar = (id: string, patch: Partial<HerramientaCorte>) =>
    config &&
    guardar({
      ...config,
      herramientas: config.herramientas.map((h) =>
        h.id === id ? { ...h, ...patch } : h,
      ),
    });
  const tipos = Object.entries(TIPOS_HERRAMIENTA_CORTE)
    .filter(([id]) =>
      form.plantilla === "corte_laser"
        ? id === "LASER"
        : form.plantilla === "router_cnc"
          ? id === "FRESA"
          : id !== "LASER",
    )
    .map(([value, label]) => ({ value, label }));
  const agregar = () => {
    const base = config ?? configuracionCorteInicial();
    guardar({
      ...base,
      herramientas: [
        ...base.herramientas,
        {
          id: crypto.randomUUID(),
          nombre: `Herramienta ${base.herramientas.length + 1}`,
          tipo: tipos[0].value as HerramientaCorte["tipo"],
          activo: true,
          operaciones: ["CORTE_COMPLETO"],
          posicion: 1,
          montada: false,
          desgaste: { modo: "INCLUIDO_CENTRO" },
        },
      ],
    });
  };
  return (
    <section
      className={`${s.panel} ${styles.cuttingPanel}`}
      aria-label="Herramientas y preparación de corte"
    >
      <div className={s.header}>
        <div>
          <h3>Herramientas y preparación</h3>
          <p>
            Configuración compartida por las operaciones de una misma tanda de
            máquina.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <PlusIcon data-icon="inline-start" />
          {config ? "Agregar herramienta" : "Configurar herramientas"}
        </Button>
      </div>
      {config ? (
        <div className={s.body}>
          <FieldGroup className={s.grid}>
            <NumeroCorte
              label="Posiciones disponibles"
              value={config.posiciones}
              min={1}
              onChange={(v) => guardar({ ...config, posiciones: v ?? 1 })}
            />
            <OpcionCorteHero
              label="Reemplazo de herramienta"
              value={config.cambio}
              onChange={(v) =>
                guardar({
                  ...config,
                  cambio: v as ConfiguracionProcesamientoCorte["cambio"],
                })
              }
              opciones={[
                { value: "MANUAL", label: "Cambio manual" },
                { value: "AUTOMATICO", label: "Cambiador automático" },
              ]}
            />
            {(
              [
                ["preparacionMin", "Preparación por trabajo (min)"],
                ["limpiezaMin", "Limpieza por trabajo (min)"],
                ["cargaDescargaPlacaMin", "Carga y descarga por placa (min)"],
                ["registroPlacaMin", "Registro por placa (min)"],
                ["cambioMin", "Por reemplazo de herramienta (min)"],
                ["activacionSeg", "Por activación de herramienta (s)"],
              ] as const
            ).map(([key, label]) => (
              <NumeroCorte
                key={key}
                label={label}
                value={config[key]}
                onChange={(v) => guardar({ ...config, [key]: v ?? 0 })}
              />
            ))}
          </FieldGroup>
          <p className={s.help}>
            Las operaciones se estiman en secuencia. Los tiempos de preparación
            se cobran una vez por trabajo; carga y registro, por cada placa.
            Cargá los tiempos medidos en tu taller.
          </p>
          {config.herramientas.map((h) => (
            <details key={h.id} className={s.tool}>
              <summary className={s.summary}>
                {h.nombre} · {TIPOS_HERRAMIENTA_CORTE[h.tipo]} · Posición{" "}
                {h.posicion}
                {h.montada ? " · Montada" : ""}
                {!h.activo ? " · Inactiva" : ""}
              </summary>
              <div className={s.body}>
                <FieldGroup className={s.grid}>
                  <Field>
                    <FieldLabel htmlFor={`herramienta-${h.id}`}>
                      Nombre
                    </FieldLabel>
                    <Input
                      className={focus.singleBorder}
                      id={`herramienta-${h.id}`}
                      aria-label={`Nombre de ${h.nombre}`}
                      value={h.nombre}
                      onChange={(e) =>
                        actualizar(h.id, { nombre: e.target.value })
                      }
                    />
                  </Field>
                  <OpcionCorteHero
                    label="Tipo de herramienta"
                    value={h.tipo}
                    opciones={tipos}
                    onChange={(v) =>
                      actualizar(h.id, {
                        tipo: v as HerramientaCorte["tipo"],
                        operaciones:
                          v === "RUEDA" ? ["HENDIDO"] : ["CORTE_COMPLETO"],
                      })
                    }
                  />
                  <NumeroCorte
                    label="Posición del soporte"
                    value={h.posicion}
                    min={1}
                    onChange={(v) => actualizar(h.id, { posicion: v ?? 1 })}
                  />
                  <NumeroCorte
                    label="Espesor máximo de herramienta (mm)"
                    value={h.espesorMaxMm}
                    onChange={(v) => actualizar(h.id, { espesorMaxMm: v })}
                  />
                  {(h.tipo === "FRESA" || h.tipo === "RUEDA") && (
                    <NumeroCorte
                      label="Diámetro (mm)"
                      value={h.diametroMm}
                      onChange={(v) => actualizar(h.id, { diametroMm: v })}
                    />
                  )}
                  <Field orientation="horizontal">
                    <Switch
                      isDisabled={!puedeEditar}
                      aria-label={`Herramienta ${h.nombre} activa`}
                      isSelected={h.activo}
                      onChange={(v) => actualizar(h.id, { activo: v })}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                    <FieldLabel>Activa</FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Switch
                      isDisabled={!puedeEditar}
                      aria-label={`${h.nombre} montada al comenzar`}
                      isSelected={h.montada}
                      onChange={(v) => actualizar(h.id, { montada: v })}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                    <FieldLabel>Montada al comenzar</FieldLabel>
                  </Field>
                </FieldGroup>
                <FieldSet>
                  <FieldLegend>Operaciones compatibles</FieldLegend>
                  <div className={s.checks}>
                    {OPERACIONES_CORTE.filter((op) =>
                      h.tipo === "RUEDA" ? op === "HENDIDO" : op !== "HENDIDO",
                    ).map((op) => (
                      <div key={op} className={s.checkItem}>
                        <Checkbox
                          isDisabled={!puedeEditar}
                          aria-label={NOMBRES_OPERACION_CORTE[op]}
                          isSelected={h.operaciones.includes(op)}
                          onChange={(v) =>
                            actualizar(h.id, {
                              operaciones: v
                                ? [...h.operaciones, op]
                                : h.operaciones.filter((o) => o !== op),
                            })
                          }
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                        {NOMBRES_OPERACION_CORTE[op]}
                      </div>
                    ))}
                  </div>
                </FieldSet>
                <FieldGroup className={s.grid}>
                  <OpcionCorteHero
                    label="Desgaste"
                    value={h.desgaste.modo}
                    opciones={[
                      {
                        value: "INCLUIDO_CENTRO",
                        label: "Incluido en el centro de costo",
                      },
                      { value: "POR_METRO", label: "Por metros procesados" },
                      {
                        value: "POR_HORA",
                        label: "Por horas de herramienta activa",
                      },
                    ]}
                    onChange={(v) =>
                      actualizar(h.id, {
                        desgaste: {
                          ...h.desgaste,
                          modo: v as HerramientaCorte["desgaste"]["modo"],
                        },
                      })
                    }
                  />
                  {h.desgaste.modo !== "INCLUIDO_CENTRO" && (
                    <>
                      <NumeroCorte
                        label="Costo de reposición ($)"
                        value={h.desgaste.costoReposicion}
                        onChange={(v) =>
                          actualizar(h.id, {
                            desgaste: { ...h.desgaste, costoReposicion: v },
                          })
                        }
                      />
                      <NumeroCorte
                        label={`Vida útil (${h.desgaste.modo === "POR_METRO" ? "m" : "h"})`}
                        value={h.desgaste.vidaUtil}
                        onChange={(v) =>
                          actualizar(h.id, {
                            desgaste: { ...h.desgaste, vidaUtil: v },
                          })
                        }
                      />
                    </>
                  )}
                </FieldGroup>
                <div className={s.actions}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isDisabled={perfiles.some(
                      (p) => p.detalle?.herramientaId === h.id,
                    )}
                    onClick={() =>
                      guardar({
                        ...config,
                        herramientas: config.herramientas.filter(
                          (item) => item.id !== h.id,
                        ),
                      })
                    }
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Eliminar herramienta
                  </Button>
                  <span className={s.help}>
                    {perfiles.some((p) => p.detalle?.herramientaId === h.id)
                      ? "Tiene perfiles asociados. Podés desactivarla."
                      : "El desgaste específico debe quedar fuera de los costos ya incluidos en el centro."}
                  </span>
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export { OpcionCorte } from "./opcion-corte-legacy";
