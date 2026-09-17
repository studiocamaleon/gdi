"use client";

import { memo, useCallback, useMemo } from "react";
import { Chip, Input } from "@heroui/react";
import { PackageIcon } from "lucide-react";
import { SelectField } from "@/components/design-system/select-field";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  type MateriaPrima,
  type MateriaPrimaVariante,
  type UnidadMateriaPrima,
  unidadMateriaPrimaItems,
} from "@/lib/materias-primas";
import {
  getVarianteDisplayName,
  getVarianteOptionChips,
} from "@/lib/materias-primas-variantes-display";
import {
  materialUnitColumns,
  resolveMaterialVariantUnits,
  type MaterialUnitDraft,
} from "@/lib/material-unit-drafts";
import {
  parseMaterialCost,
  type MaterialCostDraft,
  type MaterialConversionDraft,
  type MaterialVariantCostDraft,
} from "@/lib/material-cost-drafts";
import { monedaDe } from "@/lib/monedas";
import { MaterialConversionFields } from "./material-conversion-fields";
import s from "./costos-materiales.module.css";

type VariantChange = (
  materialId: string,
  variantId: string,
  patch: MaterialVariantCostDraft,
) => void;
type Props = {
  materia: MateriaPrima;
  draft?: MaterialCostDraft;
  monedaCodigo: string;
  onUnitChange: (
    material: MateriaPrima,
    key: keyof MaterialUnitDraft,
    value: UnidadMateriaPrima,
  ) => void;
  onVariantChange: VariantChange;
};

const unidadLabel = (value: string) =>
  unidadMateriaPrimaItems.find((item) => item.value === value)?.label ?? value;

// La referencia de draft sólo cambia para el material editado. Los demás
// grupos conservan sus filas y selectores aunque el contador se actualice.
export const MaterialCostRows = memo(function MaterialCostRows({
  materia,
  draft,
  monedaCodigo,
  onUnitChange,
  onVariantChange,
}: Props) {
  return (
    <>
      <TableRow className={s.groupRow}>
        <TableCell>
          <div className={s.materialGroup}>
            <PackageIcon size={18} aria-hidden />
            <div>
              <strong>{materia.nombre}</strong>
              <span className="text-xs text-muted-foreground">
                {materia.variantes.length} variante(s)
                {materia.esConsumible ? " · consumible" : ""}
              </span>
            </div>
          </div>
        </TableCell>
        {materialUnitColumns.map(({ key, label }) => (
          <TableCell key={key}>
            <SelectField
              value={draft?.units?.[key] ?? materia[key] ?? materia.unidadStock}
              onChange={(value) =>
                onUnitChange(materia, key, value as UnidadMateriaPrima)
              }
              aria-label={`${label} de ${materia.nombre}`}
              options={unidadMateriaPrimaItems}
              className={s.unitSelect}
            />
          </TableCell>
        ))}
        <TableCell />
      </TableRow>
      {materia.variantes.map((variante) => (
        <MaterialVariantCostRow
          key={variante.id}
          materia={materia}
          variante={variante}
          units={draft?.units}
          draft={draft?.variantes?.[variante.id]}
          monedaCodigo={monedaCodigo}
          onChange={onVariantChange}
        />
      ))}
    </>
  );
});

const MaterialVariantCostRow = memo(function MaterialVariantCostRow({
  materia,
  variante,
  units,
  draft,
  monedaCodigo,
  onChange,
}: {
  materia: MateriaPrima;
  variante: MateriaPrimaVariante;
  units?: MaterialUnitDraft;
  draft?: MaterialVariantCostDraft;
  monedaCodigo: string;
  onChange: VariantChange;
}) {
  const chips = useMemo(
    () => getVarianteOptionChips(materia, variante, { maxDimensiones: 6 }),
    [materia, variante],
  );
  const variantName = useMemo(
    () => getVarianteDisplayName(materia, variante),
    [materia, variante],
  );
  const variantUnits = useMemo(
    () => resolveMaterialVariantUnits(materia, variante, units),
    [materia, variante, units],
  );
  const conversion = draft?.conversion;
  const context = useMemo(
    () => ({
      ...variantUnits,
      equivalencias: conversion?.equivalencias ?? variante.equivalencias,
      unidadPrecio:
        conversion?.unidadPrecio === undefined
          ? variante.unidadPrecio
          : conversion.unidadPrecio,
      equivalenciaCompra:
        conversion?.equivalenciaCompra === undefined
          ? variante.equivalenciaCompra
          : conversion.equivalenciaCompra,
      templateId: materia.templateId,
      atributos: variante.atributosVariante,
    }),
    [variantUnits, conversion, variante, materia.templateId],
  );
  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set([monedaCodigo, "USD", variante.moneda].filter(Boolean)),
      ).map((value) => ({ value, label: value })),
    [monedaCodigo, variante.moneda],
  );
  const changeConversion = useCallback(
    (patch: MaterialConversionDraft) => {
      onChange(materia.id, variante.id, { conversion: patch });
    },
    [onChange, materia.id, variante.id],
  );
  const nombre = variante.nombreVariante?.trim();
  const price =
    draft?.precio ??
    (variante.precioReferencia == null
      ? ""
      : String(variante.precioReferencia));

  return (
    <TableRow>
      <TableCell className={s.variantName}>
        <div className="flex flex-col gap-1">
          {nombre ? (
            <span className="text-sm">{nombre}</span>
          ) : chips.length === 0 ? (
            <span className="text-sm text-muted-foreground">{variantName}</span>
          ) : null}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <Chip
                  key={chip.key}
                  size="sm"
                  variant="soft"
                  className={s.optionChip}
                >
                  <span className="font-medium text-foreground/70">
                    {chip.label}:
                  </span>
                  {chip.value}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      {materialUnitColumns.map(({ key }) => (
        <TableCell key={key} className="text-xs text-muted-foreground">
          {unidadLabel(variantUnits[key])}
        </TableCell>
      ))}
      <TableCell className="text-right">
        <MaterialConversionFields
          context={context}
          price={parseMaterialCost(price)}
          moneda={monedaDe(draft?.moneda || variante.moneda || monedaCodigo)}
          onChange={changeConversion}
        >
          <div className={s.priceField}>
            <SelectField
              className="w-24 shrink-0"
              aria-label={`Moneda de ${materia.nombre}, ${variantName}`}
              value={draft?.moneda || variante.moneda || monedaCodigo}
              options={currencyOptions}
              onChange={(value) =>
                onChange(materia.id, variante.id, { moneda: value })
              }
            />
            <Input
              type="number"
              min="0"
              step="0.000001"
              inputMode="decimal"
              className={s.priceInput}
              aria-label={`Precio de referencia de ${materia.nombre}, ${variantName}`}
              placeholder="—"
              value={price}
              onChange={(event) =>
                onChange(materia.id, variante.id, {
                  precio: event.target.value,
                })
              }
            />
          </div>
        </MaterialConversionFields>
      </TableCell>
    </TableRow>
  );
});
