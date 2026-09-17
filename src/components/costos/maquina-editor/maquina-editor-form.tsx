"use client";
import styles from "../maquinaria.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { SelectField } from "@/components/design-system/select-field";
import { HerramientasCorteEditor } from "./herramientas-corte-editor";
import { OperacionMaquinaEditor } from "./operacion-maquina-editor";

/**
 * Cuerpo del editor de una máquina, en dos piezas que la ficha reparte en
 * sus tabs:
 *
 *  - MaquinaEditorIdentidad (tab Descripción): nombre, tipo (inmutable),
 *    estado, planta, centro + tarifa/hora, geometría y descripción.
 *  - MaquinaEditorSecciones (tab Ajustes): las secciones que declara la
 *    plantilla (capacidades, parámetros técnicos, perfiles, consumibles).
 *
 * El estado viene de useMaquinaEditor. El alta NO pasa por acá: es el
 * diálogo chico de maquina-alta-dialog.tsx.
 */

import * as React from "react";
import {
  CogIcon,
  RulerIcon,
  Settings2Icon,
  LayersIcon,
  WrenchIcon,
} from "lucide-react";

import { Card } from "@heroui/react";
import { Input } from "@heroui/react";
import { Label } from "@/components/ui/label";
import { MaquinaFieldLabel as LabelConTooltip } from "./maquina-field-label";
import { TextArea as Textarea } from "@heroui/react";
import {
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  type MaquinaPayload,
  type MaquinariaTemplateField,
} from "@/lib/maquinaria";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";
import type { CentroCosto, Planta } from "@/lib/costos";

import {
  FieldInput,
  STRUCTURED_MARGIN_FIELDS,
  cmToMmForPayload,
  getFriendlyFieldDescription,
  getMaquinaFieldValue,
  mmToCmForInput,
  shouldDisplayGranFormatoFieldInCm,
  shouldShowMaquinaField,
} from "./helpers";
import { DesgasteEditor } from "./desgaste-editor";
import { PerfilesOperativosEditor } from "./perfiles-editor";
import type { MaquinaEditorState } from "./use-maquina-editor";

const fmtTarifa = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const SIN_CENTRO = "sin_centro";

type MaquinaEditorIdentidadProps = {
  editor: MaquinaEditorState;
  plantas: Planta[];
  centrosCosto: CentroCosto[];
};

export function MaquinaEditorIdentidad({
  editor,
  plantas,
  centrosCosto,
}: MaquinaEditorIdentidadProps) {
  const { form, setForm } = editor;
  const centroSeleccionado = centrosCosto.find(
    (centroCosto) => centroCosto.id === form.centroCostoPrincipalId,
  );
  const centrosDeLaPlanta = centrosCosto.filter(
    (centroCosto) =>
      centroCosto.plantaId === form.plantaId && centroCosto.activo,
  );

  return (
    <Card className={styles.card}>
      <Card.Header>
        <Card.Title>
          <CogIcon aria-hidden="true" /> Identidad del equipo
        </Card.Title>
        <Card.Description>
          Datos de la máquina, ubicación y centro que define su tarifa.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <div className={styles.identityGrid}>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              className={focus.singleBorder}
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <LabelConTooltip
              label="Tipo"
              required
              tooltip="Tipo de máquina. Se elige al crearla y no se cambia: define qué campos y perfiles tiene."
            />
            <Input
              className={focus.singleBorder}
              value={getPlantillaMaquinariaLabel(form.plantilla)}
              disabled
            />
          </div>
          {/* Fabricante y modelo venían del seed y no tenían dónde editarse:
              aparecían bajo el nombre en la lista como si fueran magia. */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="maquina-fabricante">Fabricante</Label>
            <Input
              className={focus.singleBorder}
              id="maquina-fabricante"
              placeholder="Ej: Ricoh"
              value={form.fabricante ?? ""}
              onChange={(e) =>
                setForm({ ...form, fabricante: e.target.value || undefined })
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="maquina-modelo">Modelo</Label>
            <Input
              className={focus.singleBorder}
              id="maquina-modelo"
              placeholder="Ej: PRO C5100s"
              value={form.modelo ?? ""}
              onChange={(e) =>
                setForm({ ...form, modelo: e.target.value || undefined })
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="maquina-serie">Número de serie</Label>
            <Input
              className={focus.singleBorder}
              id="maquina-serie"
              value={form.numeroSerie ?? ""}
              onChange={(e) =>
                setForm({ ...form, numeroSerie: e.target.value || undefined })
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label>Estado</Label>
            <SelectField
              value={form.estado}
              onChange={(v) =>
                setForm({
                  ...form,
                  estado: (v ?? "activa") as MaquinaPayload["estado"],
                })
              }
              aria-label="Estado"
              className="w-full min-w-0"
              options={[
                ...(estadoMaquinaItems.map((item) => ({
                  value: item.value,
                  label: item.label,
                })) ?? []),
              ]}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label>Planta</Label>
            <SelectField
              value={form.plantaId}
              onChange={(v) => {
                const plantaId = v ?? "";
                setForm({
                  ...form,
                  plantaId,
                  centroCostoPrincipalId:
                    centroSeleccionado?.plantaId === plantaId
                      ? form.centroCostoPrincipalId
                      : undefined,
                });
              }}
              aria-label="Planta"
              className="w-full min-w-0"
              options={[
                ...(plantas.map((p) => ({ value: p.id, label: p.nombre })) ??
                  []),
              ]}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label>Centro de costo</Label>
            <SelectField
              value={form.centroCostoPrincipalId ?? SIN_CENTRO}
              onChange={(v) =>
                setForm({
                  ...form,
                  centroCostoPrincipalId:
                    !v || v === SIN_CENTRO ? undefined : v,
                })
              }
              aria-label="Centro de costo"
              className="w-full min-w-0"
              options={[
                { value: SIN_CENTRO, label: "Sin asignar" },
                ...(centrosDeLaPlanta.map((cc) => ({
                  value: cc.id,
                  label: cc.nombre,
                })) ?? []),
                ...(centroSeleccionado &&
                !centrosDeLaPlanta.some((cc) => cc.id === centroSeleccionado.id)
                  ? [
                      {
                        value: centroSeleccionado.id,
                        label: centroSeleccionado.nombre,
                        disabled: true,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
          <div className={styles.tariffField}>
            <LabelConTooltip
              label="Tarifa / hora"
              tooltip="Lo que cuesta una hora de esta máquina según la última planilla publicada de su centro de costo. Se edita en Centros de costo, no acá."
            />
            <Input
              className={focus.singleBorder}
              value={
                typeof centroSeleccionado?.ultimaTarifaTotal === "number"
                  ? fmtTarifa.format(centroSeleccionado.ultimaTarifaTotal)
                  : "Sin tarifa publicada"
              }
              disabled
            />
          </div>
          {form.plantilla !== "impresora_gran_formato_por_area" ? (
            <div className="flex min-w-0 flex-col gap-2">
              <LabelConTooltip
                label="Geometría de trabajo"
                tooltip="Forma del sustrato sobre el que opera la máquina. Pliego = hojas precortadas; Rollo = bobina continua; Plano/Cilindrico/Volumen = piezas tridimensionales."
              />
              <SelectField
                value={form.geometriaTrabajo}
                onChange={(v) =>
                  setForm({
                    ...form,
                    geometriaTrabajo: (v ??
                      "pliego") as MaquinaPayload["geometriaTrabajo"],
                  })
                }
                aria-label="Geometría de trabajo"
                className="w-full min-w-0"
                options={[
                  ...(geometriaTrabajoMaquinaItems.map((item) => ({
                    value: item.value,
                    label: item.label,
                  })) ?? []),
                ]}
              />
            </div>
          ) : null}
          <div
            className={`flex min-w-0 flex-col gap-2 ${styles.identityDescription}`}
          >
            <Label htmlFor="maquina-descripcion">Descripción</Label>
            <Textarea
              className={focus.singleBorder}
              id="maquina-descripcion"
              rows={4}
              placeholder="Notas sobre la máquina: estado, mantenimiento, particularidades…"
              value={form.observaciones ?? ""}
              onChange={(e) =>
                setForm({ ...form, observaciones: e.target.value || undefined })
              }
            />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

export function MaquinaEditorSecciones({
  editor,
}: {
  editor: MaquinaEditorState;
}) {
  const {
    form,
    setForm,
    perfiles,
    setPerfiles,
    template,
    materiasPrimas,
    loadingMaterias,
    handleMaquinaFieldChange,
    handleAgregarPerfil,
    handleEliminarPerfil,
    handleDuplicarPerfil,
  } = editor;

  // Las tintas y el tóner se configuran desde la tabla de perfiles (modal por
  // fila), así que la sección Consumibles ya no tiene nada que mostrar.
  const secciones =
    template?.sections.filter(
      (sec) =>
        sec.id !== "consumibles" &&
        !(
          sec.id === "desgaste_repuestos" &&
          form.parametrosTecnicos?.procesamientoCorte
        ),
    ) ?? [];

  return (
    <>
      <OperacionMaquinaEditor editor={editor} />
      <HerramientasCorteEditor editor={editor} />
      {secciones.map((sec) => (
        <Card
          key={sec.id}
          className={
            sec.id !== "perfiles_operativos" && sec.id !== "desgaste_repuestos"
              ? styles.technicalCard
              : styles.card
          }
        >
          <Card.Header>
            <Card.Title>
              {sec.id === "perfiles_operativos" ? (
                <LayersIcon aria-hidden="true" />
              ) : sec.id === "desgaste_repuestos" ? (
                <WrenchIcon aria-hidden="true" />
              ) : sec.id === "capacidades_fisicas" ? (
                <RulerIcon aria-hidden="true" />
              ) : (
                <Settings2Icon aria-hidden="true" />
              )}
              {sec.id === "perfiles_operativos" &&
              form.parametrosTecnicos?.procesamientoCorte
                ? "Perfiles por herramienta y material"
                : sec.title}
            </Card.Title>
            {sec.description ? (
              <Card.Description className="text-xs">
                {sec.id === "perfiles_operativos" &&
                form.parametrosTecnicos?.procesamientoCorte
                  ? "Recetas de trabajo para cada operación y rango de espesor."
                  : sec.description}
              </Card.Description>
            ) : null}
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {sec.id === "perfiles_operativos" ? (
              <PerfilesOperativosEditor
                perfiles={perfiles}
                setPerfiles={setPerfiles}
                sectionFields={sec.fields}
                form={form}
                setForm={setForm}
                materiasPrimas={materiasPrimas}
                loadingMaterias={loadingMaterias}
                onAgregar={handleAgregarPerfil}
                onEliminar={handleEliminarPerfil}
                onDuplicar={handleDuplicarPerfil}
              />
            ) : sec.id === "desgaste_repuestos" ? (
              <DesgasteEditor form={form} setForm={setForm} />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {sec.fields
                  .filter((field) => shouldShowMaquinaField(field, form))
                  .map((field) => {
                    const displayInCm = shouldDisplayGranFormatoFieldInCm(
                      field,
                      form,
                    );
                    const displayField: MaquinariaTemplateField = displayInCm
                      ? { ...field, unit: "cm" }
                      : field;
                    const fieldValue = getMaquinaFieldValue(form, field.key);
                    const fullWidth =
                      field.kind === "textarea" ||
                      field.kind === "multiselect" ||
                      STRUCTURED_MARGIN_FIELDS.has(field.key);

                    // La descripción va como tooltip en el label, no como
                    // texto debajo del input: ensuciaba la vista.
                    const descripcion = getFriendlyFieldDescription(field);
                    return (
                      <div
                        key={field.key}
                        className={`flex min-w-0 flex-col gap-2 ${fullWidth ? "md:col-span-2" : ""}`}
                      >
                        {descripcion ? (
                          <LabelConTooltip
                            label={field.label}
                            htmlFor={`field-${field.scope}-${field.key}`}
                            required={field.required}
                            tooltip={descripcion}
                            iconSize="sm"
                          />
                        ) : (
                          <Label
                            htmlFor={`field-${field.scope}-${field.key}`}
                            className="text-sm"
                          >
                            {field.label}
                            {field.required && (
                              <span className="text-destructive"> *</span>
                            )}
                          </Label>
                        )}
                        <FieldInput
                          field={displayField}
                          value={
                            displayInCm
                              ? mmToCmForInput(fieldValue)
                              : fieldValue
                          }
                          renderColorModeCards={
                            field.key === "coloresSoportados"
                          }
                          onChange={(v) =>
                            handleMaquinaFieldChange(
                              field,
                              displayInCm ? cmToMmForPayload(v) : v,
                            )
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </Card.Content>
        </Card>
      ))}
    </>
  );
}
