import type {
  MateriaPrima,
  MateriaPrimaVariante,
  UnidadMateriaPrima,
} from "./materias-primas";

export const materialUnitColumns = [
  { key: "unidadCompra", label: "Unidad de compra" },
  { key: "unidadStock", label: "Unidad de stock" },
  { key: "unidadUso", label: "Unidad de consumo" },
] as const;

type UnitKey = (typeof materialUnitColumns)[number]["key"];
type MaterialUnits = Pick<MateriaPrima, UnitKey>;
type VariantUnits = Pick<MateriaPrimaVariante, UnitKey>;
// Sólo contiene las unidades elegidas durante esta edición. Una selección
// explícita también reemplaza las excepciones de las variantes.
export type MaterialUnitDraft = Partial<Record<UnitKey, UnidadMateriaPrima>>;

export function resolveMaterialVariantUnits(
  material: MaterialUnits,
  variant: VariantUnits,
  draft: MaterialUnitDraft = {},
): Record<UnitKey, UnidadMateriaPrima> {
  return {
    unidadCompra: draft.unidadCompra ?? variant.unidadCompra ?? material.unidadCompra,
    unidadStock: draft.unidadStock ?? variant.unidadStock ?? material.unidadStock,
    unidadUso: draft.unidadUso ?? variant.unidadUso ?? material.unidadUso ?? material.unidadStock,
  };
}

export function changedMaterialUnits(
  material: MaterialUnits & { variantes: VariantUnits[] },
  draft: MaterialUnitDraft = {},
): MaterialUnitDraft {
  const changes: MaterialUnitDraft = {};
  for (const { key } of materialUnitColumns) {
    const next = draft[key];
    const original = material[key] ?? material.unidadStock;
    if (next !== undefined && (
      next !== original ||
      material.variantes.some(variant => (variant[key] ?? original) !== next)
    )) changes[key] = next;
  }
  return changes;
}
