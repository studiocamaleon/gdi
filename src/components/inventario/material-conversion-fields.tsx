"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  materialCoefficientFields,
  updateMaterialCoefficient,
} from "@/lib/material-coefficients";
import {
  unidadMateriaPrimaItems,
  type UnidadMateriaPrima,
} from "@/lib/materias-primas";
import {
  normalizeMaterialUnit,
  type MaterialEquivalence,
  materialPriceInUseUnit,
  materialUnitConversion,
  validateMaterialUnits,
  type MaterialUnitContext,
} from "@/lib/material-units";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import styles from "./materiales.module.css";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 8 });
const coefficientNumber = new Intl.NumberFormat("es-AR", {
  useGrouping: false,
  maximumFractionDigits: 20,
});
const plurals: Record<string, string> = {
  unidad: "unidades",
  botella: "botellas",
  pieza: "piezas",
  hoja: "hojas",
  placa: "placas",
  metro_lineal: "metros lineales",
  caja: "cajas",
  rollo: "rollos",
  resma: "resmas",
  pack: "packs",
  litro: "litros",
  gramo: "gramos",
  par: "pares",
};
const label = (unit: string) =>
  ({ m2: "m²", m3: "m³" })[unit] ??
  unidadMateriaPrimaItems.find((item) => item.value === unit)?.label ??
  unit;

function CoefficientInput({
  id,
  value,
  onValueChange,
  ariaLabel,
  descriptionId,
}: {
  id: string;
  value?: number;
  onValueChange: (value: number) => void;
  ariaLabel: string;
  descriptionId?: string;
}) {
  const [draft, setDraft] = useState({
    value,
    text: value === undefined ? "" : coefficientNumber.format(value),
  });

  // Mantener "0," y "0." durante la edición, sincronizando cambios externos.
  if (!Object.is(draft.value, value)) {
    setDraft({
      value,
      text: value === undefined ? "" : coefficientNumber.format(value),
    });
  }

  return (
    <InputGroupInput
      id={id}
      aria-label={ariaLabel}
      aria-invalid={
        (value !== undefined && (value <= 0 || !Number.isFinite(value))) ||
        undefined
      }
      aria-describedby={descriptionId}
      type="text"
      inputMode="decimal"
      value={draft.text}
      placeholder="0"
      onChange={(event) => {
        const text = event.target.value.trim();
        if (!/^\d*(?:[.,]\d*)?$/.test(text)) return;
        const parsed = Number(text.replace(",", "."));
        const next = Number.isFinite(parsed) ? parsed : 0;
        setDraft({ value: next, text });
        onValueChange(next);
      }}
    />
  );
}

export function MaterialConversionFields({
  context,
  price,
  moneda,
  onChange,
  children,
}: {
  context: MaterialUnitContext;
  price?: number | null;
  moneda: Moneda;
  children: ReactNode;
  onChange: (patch: {
    unidadPrecio?: UnidadMateriaPrima | null;
    equivalenciaCompra?: number | null;
    equivalencias?: MaterialEquivalence[];
  }) => void;
}) {
  const id = useId();
  const {
    unidadStock,
    unidadUso,
    unidadCompra,
    unidadPrecio,
    equivalenciaCompra,
    equivalencias,
    templateId,
    atributos,
  } = context;
  const stableContext = useMemo(
    () => ({
      unidadStock,
      unidadUso,
      unidadCompra,
      unidadPrecio,
      equivalenciaCompra,
      equivalencias,
      templateId,
      atributos,
    }),
    [
      unidadStock,
      unidadUso,
      unidadCompra,
      unidadPrecio,
      equivalenciaCompra,
      equivalencias,
      templateId,
      atributos,
    ],
  );
  // Un cambio de importe o moneda no reconstruye las conversiones ni las
  // opciones del selector. Las unidades, medidas y coeficientes sí las invalidan.
  const { coefficients, conversion, invalid, priceOptions, usage } = useMemo(
    () => ({
      coefficients: materialCoefficientFields(stableContext),
      conversion: materialUnitConversion(
        stableContext,
        unidadCompra,
        unidadStock,
      ),
      invalid: validateMaterialUnits(stableContext),
      priceOptions: [
        { value: "", label: "Unidad" },
        ...unidadMateriaPrimaItems
          .filter(
            (item) =>
              item.value === unidadPrecio ||
              item.value === unidadCompra ||
              item.value === unidadStock ||
              materialUnitConversion(stableContext, item.value, unidadStock).ok,
          )
          .map((item) => ({
            ...item,
            label: `/ ${label(item.value).toLowerCase()}`,
          })),
      ],
      usage: materialUnitConversion(
        stableContext,
        unidadStock,
        unidadUso ?? unidadStock,
      ),
    }),
    [stableContext, unidadCompra, unidadStock, unidadPrecio, unidadUso],
  );
  const setRelations = (equivalencias: MaterialEquivalence[]) =>
    onChange({ equivalencias, equivalenciaCompra: null });
  const convertedPrice = useMemo(
    () => (price == null ? null : materialPriceInUseUnit(stableContext, price)),
    [stableContext, price],
  );
  const sameUnits =
    normalizeMaterialUnit(context.unidadCompra) ===
    normalizeMaterialUnit(context.unidadStock);
  const useUnitLabel = label(
    context.unidadUso ?? context.unidadStock,
  ).toLowerCase();
  const stockLabel = label(context.unidadStock).toLowerCase();
  const purchaseLabel = label(context.unidadCompra).toLowerCase();
  const pendingPriceUnit = !context.unidadPrecio;
  const costLabel = convertedPrice?.ok
    ? `${formatearMoneda(convertedPrice.precio, moneda, { decimales: convertedPrice.precio < 1 ? 6 : 2 })}/${useUnitLabel}`
    : null;

  return (
    <FieldGroup className={styles.conversionFields}>
      <div className={styles.materialPriceRow}>
        <div className={styles.materialPriceInput}>{children}</div>
        <SelectField
          id={`${id}-price-unit`}
          className={styles.materialPriceUnit}
          aria-label="Unidad del precio informado"
          value={context.unidadPrecio ?? ""}
          options={priceOptions}
          onChange={(value) =>
            onChange({
              unidadPrecio: (value || null) as UnidadMateriaPrima | null,
            })
          }
        />
      </div>
      {pendingPriceUnit && (
        <div className={styles.materialPricePending}>
          <span>Precio anterior sin unidad.</span>
          <ActionButton
            variant="ghost"
            size="sm"
            onPress={() =>
              onChange({
                unidadPrecio: context.unidadCompra as UnidadMateriaPrima,
              })
            }
          >
            Confirmar por {purchaseLabel}
          </ActionButton>
        </div>
      )}
      {coefficients.map((coefficient) => {
        const inputId = `${id}-${coefficient.key}`;
        const numerator =
          coefficient.factor === 1
            ? label(coefficient.destino).toLowerCase()
            : (plurals[coefficient.destino] ??
              label(coefficient.destino).toLowerCase());
        const units = `${numerator} por ${label(coefficient.origen).toLowerCase()}`;
        const invalidFactor =
          coefficient.factor !== undefined &&
          (!Number.isFinite(coefficient.factor) || coefficient.factor <= 0);
        return (
          <Field
            key={coefficient.key}
            className={styles.coefficientField}
            data-invalid={invalidFactor}
          >
            <FieldLabel htmlFor={inputId}>{coefficient.label}</FieldLabel>
            <InputGroup>
              <CoefficientInput
                id={inputId}
                ariaLabel={`${coefficient.label}: ${units}`}
                descriptionId={invalid ? `${id}-error` : undefined}
                value={coefficient.factor}
                onValueChange={(factor) =>
                  setRelations(
                    updateMaterialCoefficient(context, {
                      key: coefficient.key,
                      factor,
                    }),
                  )
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{units}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        );
      })}
      {invalid && coefficients.length === 0 && (
        <ActionButton
          variant="secondary"
          size="sm"
          onPress={() => setRelations(updateMaterialCoefficient(context))}
        >
          Usar conversión automática
        </ActionButton>
      )}
      {invalid ? (
        <FieldDescription id={`${id}-error`} role="alert">
          {invalid}
        </FieldDescription>
      ) : (
        <p className={styles.materialConversionLine} aria-live="polite">
          {usage.ok &&
            normalizeMaterialUnit(context.unidadUso ?? context.unidadStock) !==
              normalizeMaterialUnit(context.unidadStock) && (
              <span>
                1 {stockLabel} = {number.format(usage.factor)}{" "}
                {plurals[normalizeMaterialUnit(context.unidadUso ?? "")] ??
                  useUnitLabel}
              </span>
            )}
          {costLabel &&
            (!sameUnits ||
              context.unidadUso !== context.unidadStock ||
              normalizeMaterialUnit(context.unidadPrecio ?? "") !==
                normalizeMaterialUnit(context.unidadStock)) && (
              <span>Costo de consumo: {costLabel}</span>
            )}
          {context.unidadPrecio && convertedPrice && !convertedPrice.ok && (
            <span>
              {coefficients.some(
                (coefficient) => coefficient.factor === undefined,
              )
                ? "Completá los coeficientes indicados para calcular el costo."
                : conversion.ok
                  ? convertedPrice.mensaje
                  : "Revisá la conversión del material."}
            </span>
          )}
        </p>
      )}
    </FieldGroup>
  );
}
