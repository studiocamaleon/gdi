"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/design-system/select-field";
import {
  RETENCION_REGIMENES,
  RETENCION_REGIMEN_LABELS,
  type ReglaRetencion,
} from "@/lib/administracion";

export const AGENTES_RETENCION = [
  { value: "procesador", label: "Procesador de pagos" },
  { value: "banco", label: "Banco" },
  { value: "cliente", label: "Cliente" },
];

export function RetencionesConfigEditor({
  reglas,
  onChange,
  soloCliente = false,
}: {
  reglas: ReglaRetencion[];
  soloCliente?: boolean;
  onChange: (reglas: ReglaRetencion[]) => void;
}) {
  const editar = (id: string, patch: Partial<ReglaRetencion>) =>
    onChange(reglas.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <FieldGroup>
      {reglas.map((r, i) => (
        <FieldSet key={r.id}>
          <FieldLegend>Retención {i + 1}</FieldLegend>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${r.id}-regimen`}>Régimen</FieldLabel>
                <SelectField
                  id={`${r.id}-regimen`}
                  aria-label="Régimen de retención"
                  value={r.regimen}
                  onChange={(v) => editar(r.id, { regimen: v })}
                  options={[...RETENCION_REGIMENES, "otro"].map((value) => ({
                    value,
                    label: RETENCION_REGIMEN_LABELS[value],
                  }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${r.id}-agente`}>
                  Quién retiene
                </FieldLabel>
                <SelectField
                  id={`${r.id}-agente`}
                  aria-label="Quién retiene"
                  value={r.agente}
                  onChange={(v) =>
                    editar(r.id, { agente: v as ReglaRetencion["agente"] })
                  }
                  options={
                    soloCliente
                      ? AGENTES_RETENCION.filter((a) => a.value === "cliente")
                      : AGENTES_RETENCION
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${r.id}-jurisdiccion`}>
                  Jurisdicción
                </FieldLabel>
                <Input
                  id={`${r.id}-jurisdiccion`}
                  value={r.jurisdiccion}
                  maxLength={60}
                  placeholder="Ej. Santa Cruz"
                  onChange={(e) =>
                    editar(r.id, { jurisdiccion: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${r.id}-alicuota`}>
                  Alícuota (%)
                </FieldLabel>
                <Input
                  id={`${r.id}-alicuota`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.001"
                  value={r.alicuota}
                  onChange={(e) =>
                    editar(r.id, { alicuota: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${r.id}-base`}>Calcular sobre</FieldLabel>
              <SelectField
                id={`${r.id}-base`}
                aria-label="Base de la retención"
                value={r.baseCalculo}
                onChange={(v) =>
                  editar(r.id, {
                    baseCalculo: v as ReglaRetencion["baseCalculo"],
                  })
                }
                options={[
                  { value: "bruto", label: "Total cobrado al cliente" },
                  {
                    value: "neto_liquidacion",
                    label: "Cobrado menos comisión e IVA de la comisión",
                  },
                ]}
              />
              <FieldDescription>
                Elegí la base de tu liquidación. Si el régimen usa otra base,
                cargá su importe manualmente al registrar el cobro.
              </FieldDescription>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${r.id}-desde`}>Vigente desde</FieldLabel>
                <Input
                  id={`${r.id}-desde`}
                  type="date"
                  value={r.vigenteDesde ?? ""}
                  onChange={(e) =>
                    editar(r.id, { vigenteDesde: e.target.value || undefined })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${r.id}-hasta`}>Vigente hasta</FieldLabel>
                <Input
                  id={`${r.id}-hasta`}
                  type="date"
                  value={r.vigenteHasta ?? ""}
                  onChange={(e) =>
                    editar(r.id, { vigenteHasta: e.target.value || undefined })
                  }
                />
              </Field>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(reglas.filter((x) => x.id !== r.id))}
            >
              <Trash2Icon data-icon="inline-start" />
              Quitar retención {i + 1}
            </Button>
          </FieldGroup>
        </FieldSet>
      ))}
      <Button
        variant="outline"
        disabled={reglas.length >= 20}
        onClick={() =>
          onChange([
            ...reglas,
            {
              id: crypto.randomUUID(),
              regimen: "SIRTAC",
              jurisdiccion: "",
              agente: soloCliente ? "cliente" : "procesador",
              alicuota: 0,
              baseCalculo: "bruto",
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        Agregar retención
      </Button>
      <FieldDescription>
        Usá la alícuota informada por el agente. Son anticipos fiscales: reducen
        el dinero recibido sin volver a sumar IIBB al costo del producto. Sin
        reglas, las retenciones se cargan manualmente.
      </FieldDescription>
    </FieldGroup>
  );
}
