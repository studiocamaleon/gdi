"use client";

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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  getEstadoMaquinaLabel,
  getGeometriaTrabajoMaquinaLabel,
  type MaquinaPayload,
  type MaquinariaTemplateField,
} from "@/lib/maquinaria";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";
import type { CentroCosto, Planta } from "@/lib/costos";

import {
  FieldInput,
  STRUCTURED_MARGIN_FIELDS,
  SelectDisplay,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identidad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <LabelConTooltip
              label="Tipo"
              required
              tooltip="Tipo de máquina. Se elige al crearla y no se cambia: define qué campos y perfiles tiene."
            />
            <Input
              value={getPlantillaMaquinariaLabel(form.plantilla)}
              disabled
            />
          </div>
          {/* Fabricante y modelo venían del seed y no tenían dónde editarse:
              aparecían bajo el nombre en la lista como si fueran magia. */}
          <div className="min-w-0 space-y-1">
            <Label htmlFor="maquina-fabricante">Fabricante</Label>
            <Input
              id="maquina-fabricante"
              placeholder="Ej: Ricoh"
              value={form.fabricante ?? ""}
              onChange={(e) =>
                setForm({ ...form, fabricante: e.target.value || undefined })
              }
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="maquina-modelo">Modelo</Label>
            <Input
              id="maquina-modelo"
              placeholder="Ej: PRO C5100s"
              value={form.modelo ?? ""}
              onChange={(e) =>
                setForm({ ...form, modelo: e.target.value || undefined })
              }
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="maquina-serie">Número de serie</Label>
            <Input
              id="maquina-serie"
              value={form.numeroSerie ?? ""}
              onChange={(e) =>
                setForm({ ...form, numeroSerie: e.target.value || undefined })
              }
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Estado</Label>
            <Select
              value={form.estado}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  estado: (v ?? "activa") as MaquinaPayload["estado"],
                })
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectDisplay label={getEstadoMaquinaLabel(form.estado)} />
              </SelectTrigger>
              <SelectContent>
                {estadoMaquinaItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Planta</Label>
            <Select
              value={form.plantaId}
              onValueChange={(v) => setForm({ ...form, plantaId: v ?? "" })}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectDisplay
                  label={plantas.find((planta) => planta.id === form.plantaId)?.nombre}
                />
              </SelectTrigger>
              <SelectContent>
                {plantas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Centro de costo</Label>
            <Select
              value={form.centroCostoPrincipalId ?? ""}
              onValueChange={(v) =>
                setForm({ ...form, centroCostoPrincipalId: v || undefined })
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectDisplay
                  label={centroSeleccionado?.nombre}
                  placeholder="Sin asignar"
                />
              </SelectTrigger>
              <SelectContent>
                {centrosCosto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <LabelConTooltip
              label="Tarifa / hora"
              tooltip="Lo que cuesta una hora de esta máquina según la última planilla publicada de su centro de costo. Se edita en Centros de costo, no acá."
            />
            <Input
              value={
                typeof centroSeleccionado?.ultimaTarifaTotal === "number"
                  ? fmtTarifa.format(centroSeleccionado.ultimaTarifaTotal)
                  : "Sin tarifa publicada"
              }
              disabled
            />
          </div>
          {form.plantilla !== "impresora_gran_formato_por_area" ? (
            <div className="min-w-0 space-y-1">
              <LabelConTooltip
                label="Geometría de trabajo"
                tooltip="Forma del sustrato sobre el que opera la máquina. Pliego = hojas precortadas; Rollo = bobina continua; Plano/Cilindrico/Volumen = piezas tridimensionales."
              />
              <Select
                value={form.geometriaTrabajo}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    geometriaTrabajo: (v ?? "pliego") as MaquinaPayload["geometriaTrabajo"],
                  })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectDisplay label={getGeometriaTrabajoMaquinaLabel(form.geometriaTrabajo)} />
                </SelectTrigger>
                <SelectContent>
                  {geometriaTrabajoMaquinaItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="min-w-0 space-y-1 md:col-span-2">
            <Label htmlFor="maquina-descripcion">Descripción</Label>
            <Textarea
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
      </CardContent>
    </Card>
  );
}

export function MaquinaEditorSecciones({ editor }: { editor: MaquinaEditorState }) {
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
    template?.sections.filter((sec) => sec.id !== "consumibles") ?? [];

  return (
    <>
      {secciones.map((sec) => (
        <Card key={sec.id}>
          <CardHeader>
            <CardTitle className="text-base">{sec.title}</CardTitle>
            {sec.description ? (
              <CardDescription className="text-xs">
                {sec.description}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
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
                  {sec.fields.filter((field) => shouldShowMaquinaField(field, form)).map((field) => {
                    const displayInCm = shouldDisplayGranFormatoFieldInCm(field, form);
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
                        className={`space-y-1 ${fullWidth ? "md:col-span-2" : ""}`}
                      >
                        {descripcion ? (
                          <LabelConTooltip
                            label={field.label}
                            required={field.required}
                            tooltip={descripcion}
                            iconSize="sm"
                          />
                        ) : (
                          <Label htmlFor={`field-${field.scope}-${field.key}`} className="text-sm">
                            {field.label}
                            {field.required && <span className="text-destructive"> *</span>}
                          </Label>
                        )}
                        <FieldInput
                          field={displayField}
                          value={displayInCm ? mmToCmForInput(fieldValue) : fieldValue}
                          renderColorModeCards={field.key === "coloresSoportados"}
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
          </CardContent>
        </Card>
      ))}
    </>
  );
}

