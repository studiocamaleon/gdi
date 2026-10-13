"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Check, SlidersHorizontal, Layers } from "lucide-react";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { FieldSet, FieldLegend } from "@/components/ui/field";
import { Button } from "./centro-copiado-ui";
import type { FormatosPorGramaje } from "@/lib/centro-copiado-api";
import s from "./centro-copiado-config.module.css";

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
  const disponiblesActivos = () =>
    disponibles.map((r) => ({
      ...r,
      tamanos: r.tamanos.filter((t) => generales.has(t)),
    }));
  return (
    <div className={s.formatsEditor}>
      <div className={s.formatMode}>
        <SegmentedControl
          aria-label="Origen de formatos del papel"
          value={seleccion == null ? "general" : "propios"}
          isDisabled={disabled}
          options={[
            { value: "general", label: "Formatos generales", icon: <Layers /> },
            {
              value: "propios",
              label: "Personalizar",
              icon: <SlidersHorizontal />,
            },
          ]}
          onChange={(v) =>
            onChange(v === "general" ? null : disponiblesActivos())
          }
        />
        {seleccion != null && (
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(disponiblesActivos())}
          >
            Marcar todos los disponibles
          </Button>
        )}
      </div>
      <p className={s.help}>
        {seleccion == null
          ? "Este papel usa todos los tamaños habilitados que puede producir. Elegí Personalizar para limitar la oferta de cada gramaje."
          : "Seleccioná los tamaños que ofrecés en cada gramaje. Sin tamaños seleccionados, ese gramaje queda fuera de la oferta."}
      </p>
      <div className={s.formatRows}>
        {disponibles.map((regla) => {
          const etiqueta =
            regla.gramaje == null ? "Sin gramaje" : `${regla.gramaje} g`;
          const elegidos =
            seleccion == null
              ? regla.tamanos.filter((t) => generales.has(t))
              : (seleccion.find((r) => r.gramaje === regla.gramaje)?.tamanos ??
                []);
          const cantidad = elegidos.filter(
            (t) => generales.has(t) && regla.tamanos.includes(t),
          ).length;
          return (
            <FieldSet key={etiqueta} className={s.formatRow}>
              <FieldLegend variant="label">{etiqueta}</FieldLegend>
              <ToggleButtonGroup
                aria-label={`Tamaños para ${etiqueta}`}
                selectionMode="multiple"
                isDetached
                isDisabled={disabled || seleccion == null}
                selectedKeys={new Set(elegidos.filter((t) => generales.has(t)))}
                className={s.formatChoices}
                onSelectionChange={(keys) => {
                  if (disabled || seleccion == null) return;
                  onChange([
                    ...seleccion.filter((r) => r.gramaje !== regla.gramaje),
                    {
                      gramaje: regla.gramaje,
                      tamanos: regla.tamanos.filter(
                        (t) => keys.has(t) && generales.has(t),
                      ),
                    },
                  ]);
                }}
              >
                {regla.tamanos.map((tamano) => (
                  <ToggleButton
                    id={tamano}
                    key={tamano}
                    aria-label={`${tamano} para ${etiqueta}`}
                    isDisabled={!generales.has(tamano)}
                    className={s.formatChoice}
                  >
                    <Check aria-hidden="true" />
                    <span>{tamano}</span>
                    {!generales.has(tamano) && <small>No habilitado</small>}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <span className={s.formatCount} data-empty={!cantidad}>
                {cantidad
                  ? `${cantidad} ${cantidad === 1 ? "tamaño" : "tamaños"}`
                  : "No se ofrece"}
              </span>
            </FieldSet>
          );
        })}
        {!disponibles.length && (
          <p className={s.help}>
            Seleccioná al menos un gramaje para configurar sus tamaños.
          </p>
        )}
      </div>
    </div>
  );
}
