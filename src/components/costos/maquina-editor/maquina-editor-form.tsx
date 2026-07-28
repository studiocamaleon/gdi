"use client";

/**
 * Cuerpo del editor de una máquina: Identidad + secciones del template +
 * botonera. Extraído verbatim del sheet de maquinaria-panel.tsx en la
 * Fase B (2026-07-28); en la Fase C este mismo cuerpo se renderiza en la
 * ficha por máquina. El estado viene de useMaquinaEditor.
 */

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  getEstadoMaquinaLabel,
  getGeometriaTrabajoMaquinaLabel,
  type MaquinaPayload,
  type MaquinariaTemplateField,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";
import {
  getPlantillaMaquinariaLabel,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import type { CentroCosto, Planta } from "@/lib/costos";

import { ConsumiblesImpresionEditor } from "./consumibles-editor";
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
import { PerfilesOperativosEditor } from "./perfiles-editor";
import type { MaquinaEditorState } from "./use-maquina-editor";

type MaquinaEditorFormProps = {
  editor: MaquinaEditorState;
  plantas: Planta[];
  centrosCosto: CentroCosto[];
  saving: boolean;
  /** Cambia la botonera: "Actualizar" vs "Crear". */
  esEdicion: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
};

export function MaquinaEditorForm({
  editor,
  plantas,
  centrosCosto,
  saving,
  esEdicion,
  onGuardar,
  onCancelar,
}: MaquinaEditorFormProps) {
  const {
    form,
    setForm,
    perfiles,
    setPerfiles,
    template,
    openSection,
    setOpenSection,
    materiasPrimas,
    loadingMaterias,
    handlePlantillaChange,
    handleMaquinaFieldChange,
    handleAgregarPerfil,
    handleEliminarPerfil,
    handleDuplicarPerfil,
  } = editor;

  return (
  <div className="space-y-4 p-4 md:p-6">
    {/* Identidad */}
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
              label="Plantilla"
              required
              tooltip="Tipo de máquina (define qué campos pide y qué familias puede ejecutar). Ej: impresora láser, plotter eco-solvente, guillotina, plegadora."
            />
            <Select
              value={form.plantilla}
              onValueChange={(v) => handlePlantillaChange((v ?? "impresora_laser") as PlantillaMaquinaria)}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectDisplay label={getPlantillaMaquinariaLabel(form.plantilla)} />
              </SelectTrigger>
              <SelectContent>
                {maquinariaTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  label={
                    centrosCosto.find(
                      (centroCosto) => centroCosto.id === form.centroCostoPrincipalId,
                    )?.nombre
                  }
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
        </div>
      </CardContent>
    </Card>

    {/* Secciones del template */}
    {template?.sections.map((sec) => (
      <Card key={sec.id}>
        <button
          type="button"
          onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
          className="w-full text-left"
        >
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {openSection === sec.id ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                  {sec.title}
                </CardTitle>
                <CardDescription className="ml-6 text-xs">
                  {sec.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </button>
        {openSection === sec.id && (
          <CardContent className="space-y-3">
            {sec.id === "perfiles_operativos" ? (
              <PerfilesOperativosEditor
                perfiles={perfiles}
                setPerfiles={setPerfiles}
                sectionFields={sec.fields}
                form={form}
                onAgregar={handleAgregarPerfil}
                onEliminar={handleEliminarPerfil}
                onDuplicar={handleDuplicarPerfil}
              />
            ) : sec.id === "consumibles" || sec.id === "desgaste_repuestos" ? (
              sec.id === "consumibles" ? (
                <ConsumiblesImpresionEditor
                  form={form}
                  setForm={setForm}
                  perfiles={perfiles}
                  materiasPrimas={materiasPrimas}
                  loadingMaterias={loadingMaterias}
                />
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  Editor de desgaste simplificado: editá vía API por ahora.
                  UI rica pendiente de iteración UX.
                </p>
              )
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

                  return (
                    <div
                      key={field.key}
                      className={`space-y-1 ${fullWidth ? "md:col-span-2" : ""}`}
                    >
                      <Label htmlFor={`field-${field.scope}-${field.key}`} className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive"> *</span>}
                      </Label>
                      <FieldInput
                        field={displayField}
                        value={displayInCm ? mmToCmForInput(fieldValue) : fieldValue}
                        renderColorModeCards={
                          form.plantilla === "impresora_gran_formato_por_area" &&
                          field.key === "coloresSoportados"
                        }
                        onChange={(v) =>
                          handleMaquinaFieldChange(
                            field,
                            displayInCm ? cmToMmForPayload(v) : v,
                          )
                        }
                      />
                      {getFriendlyFieldDescription(field) && (
                        <p className="text-muted-foreground text-xs">
                          {getFriendlyFieldDescription(field)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    ))}

    {/* Botones */}
    <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
      <Button variant="outline" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button onClick={onGuardar} disabled={saving}>
        {saving ? "Guardando..." : esEdicion ? "Actualizar" : "Crear"}
      </Button>
    </div>
  </div>
  );
}
