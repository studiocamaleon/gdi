/**
 * Editor de perfiles operativos de una máquina. Extraído de
 * maquinaria-panel.tsx en la Fase B (2026-07-28), sin cambios de
 * comportamiento.
 */

import * as React from "react";
import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { tipoPerfilOperativoMaquinaItems } from "@/lib/maquinaria";
import type {
  MaquinaPayload,
  MaquinariaTemplateField,
} from "@/lib/maquinaria";

import {
  FieldInput,
  SelectDisplay,
  cleanPerfilDetailsForType,
  getAllowedProfileTypes,
  getDefaultProfileType,
  getFriendlyFieldDescription,
  getPerfilFieldValue,
  normalizePerfilTypeForTemplate,
  setPerfilFieldValue,
  setPerfilFieldValueForTemplate,
  shouldShowPerfilField,
  type LocalPerfil,
} from "./helpers";

// ─── Sub-componente: editor de perfiles ────────────────────────────

interface PerfilesProps {
  perfiles: LocalPerfil[];
  setPerfiles: React.Dispatch<React.SetStateAction<LocalPerfil[]>>;
  sectionFields: MaquinariaTemplateField[];
  form: MaquinaPayload;
  onAgregar: () => void;
  onEliminar: (uiKey: string) => void;
  onDuplicar: (uiKey: string) => void;
}

export function PerfilesOperativosEditor({
  perfiles,
  setPerfiles,
  sectionFields,
  form,
  onAgregar,
  onEliminar,
  onDuplicar,
}: PerfilesProps) {
  const allowedProfileTypeItems = tipoPerfilOperativoMaquinaItems.filter((item) =>
    getAllowedProfileTypes(form).includes(item.value),
  );

  return (
    <div className="space-y-3">
      {perfiles.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">Sin perfiles. Agregá al menos uno.</p>
      ) : (
        perfiles.map((perfil, idx) => (
          <Card key={perfil.uiKey} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Badge>{idx + 1}</Badge>
                <span className="text-sm font-medium">
                  {perfil.nombre || "(sin nombre)"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => onDuplicar(perfil.uiKey)}
                  title="Duplicar perfil"
                  aria-label={`Duplicar perfil ${perfil.nombre || idx + 1}`}
                >
                  <CopyIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-7"
                  onClick={() => onEliminar(perfil.uiKey)}
                  title="Eliminar perfil"
                  aria-label={`Eliminar perfil ${perfil.nombre || idx + 1}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0 space-y-1">
                <LabelConTooltip
                  label="Tipo de perfil"
                  iconSize="sm"
                  tooltip="Define qué tipo de operación ejecuta este perfil dentro de la máquina (impresión, corte, laminado, mecanizado, etc.). Una misma máquina puede tener múltiples perfiles si soporta más de un tipo."
                />
                <Select
                  value={perfil.tipoPerfil}
                  onValueChange={(v) => {
                    const next = normalizePerfilTypeForTemplate(
                      cleanPerfilDetailsForType(
                        setPerfilFieldValue(
                          perfil,
                          "tipoPerfil",
                          v ?? getDefaultProfileType(form),
                        ),
                      ),
                      form,
                    );
                    setPerfiles((prev) =>
                      prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                    );
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectDisplay
                      label={
                        tipoPerfilOperativoMaquinaItems.find(
                          (item) => item.value === perfil.tipoPerfil,
                        )?.label
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedProfileTypeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sectionFields.filter((field) => shouldShowPerfilField(field, form, perfil)).map((field) => {
                const profileFieldMax =
                  field.key === "gramajeMaxGr" &&
                  typeof form.gramajeMaxGr === "number"
                    ? form.gramajeMaxGr
                    : undefined;

                return (
                  <div key={field.key} className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`p-${perfil.uiKey}-${field.key}`}
                    className="text-xs"
                  >
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={getPerfilFieldValue(perfil, field.key)}
                    max={profileFieldMax}
                    onChange={(v) => {
                      const next = setPerfilFieldValueForTemplate(perfil, form, field.key, v);
                      setPerfiles((prev) =>
                        prev.map((p) => (p.uiKey === perfil.uiKey ? next : p)),
                      );
                    }}
                  />
                  {getFriendlyFieldDescription(field) && (
                    <p className="text-muted-foreground text-xs">
                      {getFriendlyFieldDescription(field)}
                    </p>
                  )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
      <Button variant="outline" size="sm" onClick={onAgregar}>
        <PlusIcon className="mr-2 size-4" />
        Agregar perfil
      </Button>
    </div>
  );
}
