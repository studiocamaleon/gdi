import { getMateriaPrimaTemplate } from "@/lib/materia-prima-templates";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import type { UnitCode } from "@/lib/unidades";
import { getUnitDefinition } from "@/lib/unidades";

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 3,
});

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asText(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return "";
}

function formatFieldValue(value: unknown, type: "text" | "number" | "boolean", unit?: UnitCode) {
  if (type === "number") {
    const num = asFiniteNumber(value);
    if (num === null) return "";
    const suffix = unit ? ` ${getUnitDefinition(unit)?.symbol ?? unit}` : "";
    return `${numberFormatter.format(num)}${suffix}`;
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return "";
  }

  return asText(value);
}

export function getVarianteDisplayName(
  materiaPrima: MateriaPrima,
  variante: MateriaPrimaVariante,
  options?: { maxDimensiones?: number },
) {
  const nombreVariante = variante.nombreVariante?.trim();
  if (nombreVariante) return nombreVariante;

  const template = getMateriaPrimaTemplate(materiaPrima.templateId);
  if (!template) return variante.sku;

  const attrs = variante.atributosVariante ?? {};
  const fieldByKey = new Map(template.camposTecnicos.map((field) => [field.key, field]));
  const maxDimensiones = Math.max(1, options?.maxDimensiones ?? 5);
  const parts: string[] = [];

  for (const key of template.dimensionesVariante) {
    const rawValue = attrs[key];
    const field = fieldByKey.get(key);
    const value = field
      ? formatFieldValue(rawValue, field.type, field.unit)
      : asText(rawValue);

    if (!value) continue;
    parts.push(value);
    if (parts.length >= maxDimensiones) break;
  }

  if (parts.length > 0) return parts.join(" - ");
  return variante.sku;
}

export function getMateriaPrimaVarianteLabel(
  materiaPrima: MateriaPrima,
  variante: MateriaPrimaVariante,
  options?: { maxDimensiones?: number },
) {
  const varianteNombre = getVarianteDisplayName(materiaPrima, variante, options);
  return `${materiaPrima.nombre} - ${varianteNombre}`;
}
