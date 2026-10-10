"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { FormatosPorGramaje } from "@/lib/centro-copiado-api";

export function CentroCopiadoFormatosPapel({
  disponibles,
  seleccion,
  generales,
  onChange,
  disabled,
}: {
  disponibles: FormatosPorGramaje[];
  seleccion: FormatosPorGramaje[] | null;
  generales: Set<string>;
  onChange: (seleccion: FormatosPorGramaje[] | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <FieldSet disabled={disabled}>
      <Field orientation="horizontal">
        <Checkbox
          id={`${id}-personalizar`}
          checked={seleccion != null}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? disponibles.map((r) => ({ ...r, tamanos: [...r.tamanos] }))
                : null,
            )
          }
        />
        <FieldLabel htmlFor={`${id}-personalizar`}>
          Elegir formatos por gramaje
        </FieldLabel>
      </Field>
      <FieldDescription>
        {seleccion == null
          ? "Se ofrecen los formatos generales que este papel puede producir."
          : "Marcá lo que vendés. Sin formatos marcados, ese gramaje no se ofrece. Los formatos generales también deben estar habilitados."}
      </FieldDescription>
      {seleccion != null &&
        disponibles.map((regla) => (
          <FieldSet key={regla.gramaje ?? "sin-gramaje"}>
            <FieldLegend variant="label">
              {regla.gramaje == null ? "Sin gramaje" : `${regla.gramaje} g`}
            </FieldLegend>
            <FieldGroup className="flex-row flex-wrap">
              {regla.tamanos.map((tamano) => {
                const controlId = `${id}-${regla.gramaje}-${tamano}`;
                const elegidos =
                  seleccion.find((r) => r.gramaje === regla.gramaje)?.tamanos ??
                  [];
                return (
                  <Field
                    key={tamano}
                    orientation="horizontal"
                    className="w-auto"
                    data-disabled={!generales.has(tamano)}
                  >
                    <Checkbox
                      id={controlId}
                      disabled={!generales.has(tamano)}
                      checked={elegidos.includes(tamano)}
                      onCheckedChange={(checked) => {
                        const nuevos = checked
                          ? [...elegidos, tamano]
                          : elegidos.filter((t) => t !== tamano);
                        onChange([
                          ...seleccion.filter(
                            (r) => r.gramaje !== regla.gramaje,
                          ),
                          { gramaje: regla.gramaje, tamanos: nuevos },
                        ]);
                      }}
                    />
                    <FieldLabel htmlFor={controlId}>{tamano}</FieldLabel>
                  </Field>
                );
              })}
            </FieldGroup>
            {!regla.tamanos.length && (
              <FieldDescription>Sin formatos producibles.</FieldDescription>
            )}
          </FieldSet>
        ))}
    </FieldSet>
  );
}
