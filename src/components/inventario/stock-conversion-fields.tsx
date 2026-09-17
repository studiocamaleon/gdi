"use client";

import { Input } from "@heroui/react";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { unidadMateriaPrimaItems } from "@/lib/materias-primas";
import {
  materialUnitConversion,
  normalizeMaterialUnit,
  type MaterialUnitContext,
} from "@/lib/material-units";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 });
export const stockUnitLabel = (unit: string) =>
  unidadMateriaPrimaItems.find(
    (item) => item.value === normalizeMaterialUnit(unit),
  )?.label ?? unit;

export function StockConversionFields({
  context,
  unidad,
  onUnidad,
  cantidad,
  cantidadStock,
  onCantidadStock,
  ingreso,
}: {
  context?: MaterialUnitContext;
  unidad: string;
  onUnidad: (value: string) => void;
  cantidad: string;
  cantidadStock: string;
  onCantidadStock: (value: string) => void;
  ingreso: boolean;
}) {
  if (!context) return null;
  const selected = unidad || context.unidadStock;
  const actualCount =
    ingreso &&
    ["kg", "gramo"].includes(selected) &&
    ["hoja", "placa", "unidad"].includes(normalizeMaterialUnit(context.unidadStock));
  const conversion = materialUnitConversion(
    context,
    selected,
    context.unidadStock,
  );
  const quantity =
    actualCount && cantidadStock !== ""
      ? Number(cantidadStock)
      : conversion.ok
        ? Number(cantidad) * conversion.factor
        : null;
  const options = unidadMateriaPrimaItems.filter(
    (item) =>
      item.value === selected ||
      [context.unidadCompra, context.unidadStock, context.unidadUso]
        .map((unit) => normalizeMaterialUnit(unit ?? ""))
        .includes(item.value) ||
      materialUnitConversion(context, item.value, context.unidadStock).ok,
  );
  return (
    <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <Field>
        <FieldLabel>Unidad de la cantidad</FieldLabel>
        <SelectField
          aria-label="Unidad de la cantidad"
          value={selected}
          options={options}
          onChange={(value) => {
            onUnidad(value);
            onCantidadStock("");
          }}
        />
      </Field>
      {actualCount && (
        <Field>
          <FieldLabel>
            Cantidad real en {stockUnitLabel(context.unidadStock).toLowerCase()}{" "}
            (opcional)
          </FieldLabel>
          <Input
            aria-label="Cantidad real recibida en stock"
            type="number"
            min="0.00000001"
            step="any"
            value={cantidadStock}
            onChange={(event) => onCantidadStock(event.target.value)}
            placeholder="Usar equivalencia del material"
          />
          <FieldDescription>
            Si el peso varía, indicá la cantidad recibida. Se usa sólo para este
            ingreso.
          </FieldDescription>
        </Field>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {quantity != null && Number.isFinite(quantity)
          ? `${ingreso ? "Se agregan" : "Se descuentan"} ${number.format(quantity)} ${stockUnitLabel(context.unidadStock).toLowerCase()} al stock.`
          : conversion.ok
            ? "Indicá una cantidad."
            : conversion.mensaje}
      </p>
    </div>
  );
}
