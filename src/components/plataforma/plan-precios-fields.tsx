"use client";

import { Input } from "@heroui/react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  PRECIOS_PLAN_PENDIENTES,
  type PreciosPlan,
  type ContenidoPlan,
} from "../../../apps/api/src/plataforma/planes/catalogo-planes";
import { SelectField } from "@/components/design-system/select-field";
import fieldFocus from "@/components/design-system/field-focus.module.css";

const CAMPOS = [
  ["mensual", "Plan mensual"],
  ["anual", "Plan anual"],
  ["usuarioMensual", "Usuario adicional mensual"],
  ["usuarioAnual", "Usuario adicional anual"],
] as const;

export function PlanPreciosFields({
  id,
  nombre,
  precios,
  adicionales,
  readonly,
  onChange,
}: {
  id: string;
  nombre: string;
  precios?: PreciosPlan;
  adicionales: boolean;
  readonly: boolean;
  onChange: (precios: PreciosPlan) => void;
}) {
  const valor = precios ?? PRECIOS_PLAN_PENDIENTES;
  return (
    <FieldSet>
      <FieldLegend>Precios en USD</FieldLegend>
      <FieldDescription>
        Importes por período, antes de impuestos. El anual es el total de los
        doce meses. Un campo vacío queda por definir.
      </FieldDescription>
      <FieldGroup>
        {CAMPOS.filter(
          ([campo]) => adicionales || !campo.startsWith("usuario"),
        ).map(([campo, label]) => {
          const importe = valor[campo];
          const invalido =
            importe !== null &&
            (!Number.isFinite(importe) ||
              importe <= 0 ||
              importe > 1000000 ||
              Math.abs(importe * 100 - Math.round(importe * 100)) > 0.000001);
          return (
            <Field key={campo} data-invalid={invalido}>
              <FieldLabel htmlFor={`${id}-${campo}`}>{label}</FieldLabel>
              <Input
                id={`${id}-${campo}`}
                aria-label={`${label} · ${nombre}`}
                aria-invalid={invalido}
                className={fieldFocus.singleBorder}
                fullWidth
                type="number"
                inputMode="decimal"
                min={0.01}
                max={1000000}
                step="0.01"
                placeholder="Por definir"
                value={importe ?? ""}
                disabled={readonly}
                onChange={(e) =>
                  onChange({
                    ...valor,
                    [campo]:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          );
        })}
      </FieldGroup>
      <FieldDescription>
        Guardá y publicá la versión. Grafo sincronizará sus precios en Paddle al
        activar la oferta.
      </FieldDescription>
    </FieldSet>
  );
}

export function PlanComercialFields({
  id,
  nombre,
  comercial,
  readonly,
  onChange,
}: {
  id: string;
  nombre: string;
  comercial?: ContenidoPlan["comercial"];
  readonly: boolean;
  onChange: (valor: NonNullable<ContenidoPlan["comercial"]>) => void;
}) {
  const valor = comercial ?? {
    acceso: "publico" as const,
    trialDias: 14,
    implementacion: 0,
  };
  return (
    <FieldSet>
      <FieldLegend>Alta e implementación</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel>Disponibilidad</FieldLabel>
          <SelectField
            aria-label={`Disponibilidad · ${nombre}`}
            value={valor.acceso}
            disabled={readonly}
            options={[
              { value: "publico", label: "Registro público" },
              { value: "invitacion", label: "Sólo por invitación" },
            ]}
            onChange={(acceso) =>
              onChange({ ...valor, acceso: acceso as typeof valor.acceso })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-trial`}>Días de prueba</FieldLabel>
          <Input
            id={`${id}-trial`}
            aria-label={`Días de prueba · ${nombre}`}
            className={fieldFocus.singleBorder}
            type="number"
            min={1}
            max={90}
            value={valor.trialDias}
            disabled={readonly}
            onChange={(e) =>
              onChange({ ...valor, trialDias: Number(e.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-implementacion`}>
            Implementación en USD
          </FieldLabel>
          <Input
            id={`${id}-implementacion`}
            aria-label={`Implementación en USD · ${nombre}`}
            className={fieldFocus.singleBorder}
            type="number"
            min={0}
            max={1000000}
            step="0.01"
            value={valor.implementacion}
            disabled={readonly}
            onChange={(e) =>
              onChange({ ...valor, implementacion: Number(e.target.value) })
            }
          />
          <FieldDescription>
            Una sola vez por empresa al contratar. Cero significa sin cargo;
            tampoco se cobrará al cambiar de plan o reactivar.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
