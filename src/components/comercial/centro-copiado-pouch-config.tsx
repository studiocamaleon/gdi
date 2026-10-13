"use client";
import { Layers } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  Input,
} from "./centro-copiado-ui";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { SelectField } from "@/components/design-system/select-field";
import type {
  CentroCopiadoConfig,
  ConfigPouchCopiado,
} from "@/lib/centro-copiado-api";

export function CentroCopiadoPouchConfig({
  activo,
  onActivo,
  value,
  onChange,
  disponibles,
  disabled,
}: {
  activo: boolean;
  onActivo: (activo: boolean) => void;
  value: ConfigPouchCopiado;
  onChange: (value: ConfigPouchCopiado) => void;
  disponibles: CentroCopiadoConfig["disponibles"];
  disabled: boolean;
}) {
  const pouches = disponibles.pouches ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers /> Plastificado pouch
        </CardTitle>
        <CardDescription>
          Un sobre por hoja física, también en doble faz. Se suma a la impresión
          como terminación.
        </CardDescription>
        <CardAction>
          <Switch
            aria-label="Ofrecer Plastificado pouch"
            checked={activo}
            disabled={disabled}
            onCheckedChange={onActivo}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pouch-centro">
              Centro de costo del plastificado
            </FieldLabel>
            <SelectField
              id="pouch-centro"
              aria-label="Centro de costo del plastificado"
              value={value.centroCostoId ?? ""}
              disabled={disabled || !activo}
              options={[
                { value: "", label: "Elegí un centro de costo" },
                ...(disponibles.centrosCosto ?? []).map((c) => ({
                  value: c.id,
                  label: c.nombre,
                })),
              ]}
              onChange={(centroCostoId) =>
                onChange({ ...value, centroCostoId: centroCostoId || null })
              }
            />
            <FieldDescription>
              Su tarifa calcula el costo del tiempo de plastificado.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pouch-tiempo">Minutos por hoja</FieldLabel>
            <Input
              id="pouch-tiempo"
              type="number"
              min="0.01"
              max="60"
              step="0.1"
              value={value.minutosPorHoja}
              disabled={disabled || !activo}
              onChange={(e) =>
                onChange({ ...value, minutosPorHoja: Number(e.target.value) })
              }
            />
            <FieldDescription>
              Incluí colocación, pasada y retiro. Ajustá la referencia inicial
              al tiempo del taller.
            </FieldDescription>
          </Field>
          {!pouches.length && (
            <p className="text-sm text-muted-foreground">
              Cargá sobres de tipo Laminado pouch en Inventario para ofrecer
              esta terminación.
            </p>
          )}
          {disponibles.formatos.map((f) => {
            const opciones = pouches.filter((p) => {
              const w = p.anchoMm - 2 * p.margenMm,
                h = p.altoMm - 2 * p.margenMm;
              if (![w, h].every((n) => Number.isFinite(n) && n > 0))
                return false;
              return (
                Math.max(
                  Math.floor((w + 0.001) / f.anchoMm) *
                    Math.floor((h + 0.001) / f.altoMm),
                  Math.floor((w + 0.001) / f.altoMm) *
                    Math.floor((h + 0.001) / f.anchoMm),
                ) === 1
              );
            });
            const seleccionado =
              value.formatos.find((x) => x.tamano === f.nombre)?.varianteId ??
              "";
            return (
              <Field key={f.nombre}>
                <FieldLabel htmlFor={`pouch-${f.nombre}`}>
                  Sobre para {f.nombre}
                </FieldLabel>
                <SelectField
                  id={`pouch-${f.nombre}`}
                  aria-label={`Sobre pouch para ${f.nombre}`}
                  value={seleccionado}
                  disabled={disabled || !activo}
                  options={[
                    { value: "", label: "No ofrecer en este formato" },
                    ...opciones.map((p) => ({ value: p.id, label: p.nombre })),
                    ...(seleccionado &&
                    !opciones.some((p) => p.id === seleccionado)
                      ? [
                          {
                            value: seleccionado,
                            label: "Sobre guardado no disponible",
                          },
                        ]
                      : []),
                  ]}
                  onChange={(varianteId) =>
                    onChange({
                      ...value,
                      formatos: [
                        ...value.formatos.filter((x) => x.tamano !== f.nombre),
                        ...(varianteId
                          ? [{ tamano: f.nombre, varianteId }]
                          : []),
                      ],
                    })
                  }
                />
              </Field>
            );
          })}
          <FieldDescription>
            Se toma el costo unitario del inventario, aunque se compre por
            paquete. El borde sellado debe dejar lugar para la hoja completa.
          </FieldDescription>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
