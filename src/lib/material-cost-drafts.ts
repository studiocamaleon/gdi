import type { MaterialEquivalence } from "./material-units";
import type { MateriaPrima, UnidadMateriaPrima } from "./materias-primas";
import type { BulkUpdateCostosPayload } from "./materias-primas-api";
import {
  changedMaterialUnits,
  type MaterialUnitDraft,
} from "./material-unit-drafts";

export type MaterialConversionDraft = {
  unidadPrecio?: UnidadMateriaPrima | null;
  equivalenciaCompra?: number | null;
  equivalencias?: MaterialEquivalence[];
};

export type MaterialVariantCostDraft = {
  precio?: string;
  moneda?: string;
  conversion?: MaterialConversionDraft;
};

export type MaterialCostDraft = {
  units?: MaterialUnitDraft;
  variantes?: Record<string, MaterialVariantCostDraft>;
};

export function parseMaterialCost(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function changeMaterialCostUnit(
  material: MateriaPrima,
  draft: MaterialCostDraft,
  key: keyof MaterialUnitDraft,
  value: UnidadMateriaPrima,
): MaterialCostDraft {
  const next = { ...draft, units: { ...draft.units, [key]: value } };
  if (key !== "unidadCompra") return next;
  next.variantes = { ...draft.variantes };
  for (const variant of material.variantes) {
    const previous = draft.variantes?.[variant.id];
    next.variantes[variant.id] = {
      ...previous,
      conversion: {
        ...previous?.conversion,
        unidadPrecio: value,
        equivalencias:
          previous?.conversion?.equivalencias ?? variant.equivalencias,
        equivalenciaCompra: null,
      },
    };
  }
  return next;
}

export function changeMaterialVariantCost(
  draft: MaterialCostDraft,
  variantId: string,
  patch: MaterialVariantCostDraft,
): MaterialCostDraft {
  const previous = draft.variantes?.[variantId];
  return {
    ...draft,
    variantes: {
      ...draft.variantes,
      [variantId]: {
        ...previous,
        ...patch,
        ...(patch.conversion
          ? {
              conversion: { ...previous?.conversion, ...patch.conversion },
            }
          : {}),
      },
    },
  };
}

/** Sólo recorre las variantes de los materiales editados; el resto no se toca. */
export function buildMaterialCostChanges(
  materials: MateriaPrima[],
  drafts: Record<string, MaterialCostDraft>,
  currency: string,
): BulkUpdateCostosPayload {
  const variantes: NonNullable<BulkUpdateCostosPayload["variantes"]> = [];
  const materiales: NonNullable<BulkUpdateCostosPayload["materiales"]> = [];
  for (const material of materials) {
    const draft = drafts[material.id];
    if (!draft) continue;
    const units = changedMaterialUnits(material, draft.units);
    if (Object.keys(units).length > 0)
      materiales.push({ id: material.id, ...units });
    const unitChange = Boolean(units.unidadStock || units.unidadCompra);
    for (const variant of material.variantes) {
      const edit = draft.variantes?.[variant.id];
      const price =
        edit?.precio === undefined ? null : parseMaterialCost(edit.precio);
      const priceChange = price !== null && price !== variant.precioReferencia;
      // Conserva las relaciones originales al cambiar el rol de una unidad.
      const keepRelations = unitChange && variant.equivalencias !== undefined;
      const conversion = {
        ...(keepRelations ? { equivalencias: variant.equivalencias } : {}),
        ...edit?.conversion,
      };
      const conversionChange =
        keepRelations ||
        (conversion.equivalencias !== undefined &&
          JSON.stringify(conversion.equivalencias) !==
            JSON.stringify(variant.equivalencias ?? [])) ||
        (conversion.unidadPrecio !== undefined &&
          conversion.unidadPrecio !== variant.unidadPrecio) ||
        (conversion.equivalenciaCompra !== undefined &&
          conversion.equivalenciaCompra !==
            (variant.equivalenciaCompra ?? null));
      const currencyChange =
        edit?.moneda && edit.moneda !== (variant.moneda || currency);
      if (!priceChange && !conversionChange && !currencyChange) continue;
      variantes.push({
        id: variant.id,
        ...(priceChange ? { precioReferencia: price } : {}),
        ...conversion,
        ...(currencyChange ? { moneda: edit.moneda } : {}),
      });
    }
  }
  return { variantes, materiales };
}
