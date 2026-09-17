import {
  materialEquivalences,
  materialUnitConversion,
  normalizeMaterialUnit,
  validateMaterialUnits,
  type MaterialEquivalence,
  type MaterialUnitContext,
} from "./material-units";

export type MaterialCoefficient = {
  key: string;
  label: string;
  /** Se lee factor destino por origen; coincide con el contrato persistido. */
  origen: string;
  destino: string;
  factor?: number;
};

const withRelations = (
  context: MaterialUnitContext,
  equivalencias: MaterialEquivalence[],
): MaterialUnitContext => ({
  ...context,
  equivalencias,
  equivalenciaCompra: null,
});

// Permite editar una fila aunque otra tenga un valor incompleto o inválido.
function validRelations(context: MaterialUnitContext) {
  const relations: MaterialEquivalence[] = [];
  for (const relation of materialEquivalences(context)) {
    if (
      !validateMaterialUnits(withRelations(context, [...relations, relation]))
    ) {
      relations.push(relation);
    }
  }
  return relations;
}

/** Campos mínimos para conectar compra, stock, consumo y, si difiere, precio. */
export function materialCoefficientFields(
  context: MaterialUnitContext,
): MaterialCoefficient[] {
  const purchase = normalizeMaterialUnit(context.unidadCompra);
  const stock = normalizeMaterialUnit(context.unidadStock);
  const use = normalizeMaterialUnit(context.unidadUso ?? context.unidadStock);
  const price = normalizeMaterialUnit(
    context.unidadPrecio ?? context.unidadCompra,
  );
  const fields: MaterialCoefficient[] = [];
  const structure: MaterialEquivalence[] = [];
  const usable = withRelations(context, validRelations(context));

  const add = (from: string, to: string, label: string) => {
    if (
      !from ||
      !to ||
      materialUnitConversion(withRelations(context, structure), from, to).ok
    )
      return;
    // Peso por unidad de destino (kg/m²); contenido por envase (cajas/pallet).
    const byWeight = ["kg", "gramo"].includes(from);
    const origen = byWeight ? to : from;
    const destino = byWeight ? from : to;
    const direct = materialEquivalences(context).find(
      (relation) =>
        normalizeMaterialUnit(relation.origen) === origen &&
        normalizeMaterialUnit(relation.destino) === destino,
    );
    const conversion = materialUnitConversion(usable, origen, destino);
    fields.push({
      key: `${origen}:${destino}`,
      label,
      origen,
      destino,
      factor: direct
        ? direct.factor
        : conversion.ok
          ? conversion.factor
          : undefined,
    });
    // Sólo importa la conectividad: no convertir estos factores estructurales en datos.
    structure.push({ origen, destino, factor: 1 });
  };

  if (materialUnitConversion(context, stock, use, false).ok) {
    add(purchase, use, "Coeficiente de consumo");
  } else {
    add(purchase, stock, "Compra a stock");
  }
  add(stock, use, "Stock a consumo");
  add(price, use, "Coeficiente del precio");
  return fields;
}

/**
 * Normaliza sólo al editar. Leer un material nunca modifica sus relaciones.
 * Sustituye relaciones redundantes/inversas y conserva las ramas adicionales
 * (por ejemplo otro envase), sin ciclos que contradigan el nuevo coeficiente.
 */
export function updateMaterialCoefficient(
  context: MaterialUnitContext,
  change?: { key: string; factor: number },
): MaterialEquivalence[] {
  const fields = materialCoefficientFields(context);
  const next: MaterialEquivalence[] = [];
  const structure: MaterialEquivalence[] = [];
  for (const field of fields) {
    const factor = change?.key === field.key ? change.factor : field.factor;
    if (factor === undefined) continue;
    next.push({ origen: field.origen, destino: field.destino, factor });
    structure.push({ origen: field.origen, destino: field.destino, factor: 1 });
  }
  for (const relation of validRelations(context)) {
    if (
      materialUnitConversion(
        withRelations(context, structure),
        relation.origen,
        relation.destino,
      ).ok
    )
      continue;
    next.push(relation);
    structure.push({ ...relation, factor: 1 });
  }
  return next;
}
