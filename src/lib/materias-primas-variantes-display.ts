import { getMateriaPrimaTemplate } from "@/lib/materia-prima-templates";
import { getReplacementComponentLabel } from "@/lib/materia-prima-templates";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";
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

const unidadVidaUtilLabelMap: Record<string, string> = {
  copias_a4_equiv: "Copias A4 equivalentes",
  m2: "Metros cuadrados",
  metros_lineales: "Metros lineales",
  horas: "Horas",
  ciclos: "Ciclos",
  piezas: "Piezas",
};

function formatTemplateTextValue(fieldKey: string, value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (fieldKey === "tipoComponenteDesgaste") {
    return getReplacementComponentLabel(normalized);
  }
  if (fieldKey === "unidadVidaUtil") {
    return unidadVidaUtilLabelMap[normalized] ?? normalized;
  }
  if (fieldKey === "plantillasCompatibles" || fieldKey === "plantillaCompatible") {
    return getPlantillaMaquinariaLabel(
      normalized as Parameters<typeof getPlantillaMaquinariaLabel>[0],
    );
  }
  return normalized;
}

function formatFieldValue(
  fieldKey: string,
  value: unknown,
  type: "text" | "number" | "boolean",
  unit?: UnitCode,
) {
  if (type === "number") {
    const num = asFiniteNumber(value);
    if (num === null) return "";
    const suffix = unit ? ` ${getUnitDefinition(unit)?.symbol ?? unit}` : "";
    return `${numberFormatter.format(num)}${suffix}`;
  }

  if (type === "text" && Array.isArray(value)) {
    const values = value
      .map((item) => formatTemplateTextValue(fieldKey, asText(item)))
      .filter((item) => item.length > 0);
    return values.join(", ");
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return "";
  }

  return formatTemplateTextValue(fieldKey, asText(value));
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
      ? formatFieldValue(key, rawValue, field.type, field.unit)
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

export function getVarianteOptionChips(
  materiaPrima: MateriaPrima,
  variante: MateriaPrimaVariante,
  options?: { maxDimensiones?: number },
) {
  const template = getMateriaPrimaTemplate(materiaPrima.templateId);
  if (!template) {
    return [] as Array<{ key: string; label: string; value: string }>;
  }

  const attrs = variante.atributosVariante ?? {};
  const fieldByKey = new Map(template.camposTecnicos.map((field) => [field.key, field]));
  const maxDimensiones = Math.max(1, options?.maxDimensiones ?? 5);
  const chips: Array<{ key: string; label: string; value: string }> = [];

  for (const key of template.dimensionesVariante) {
    const rawValue = attrs[key];
    const field = fieldByKey.get(key);
    const value = field
      ? formatFieldValue(key, rawValue, field.type, field.unit)
      : asText(rawValue);
    if (!value) {
      continue;
    }
    chips.push({
      key,
      label: field?.label ?? key,
      value,
    });
    if (chips.length >= maxDimensiones) {
      break;
    }
  }

  return chips;
}
