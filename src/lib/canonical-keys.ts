const LEGACY_UNIT_SUFFIX_RE =
  /(Cm|Mm|M2|M3|Ml|Kg|Gm2|V|A|Wm|W|K|Lm|Mm2|Min|Hora|Horas)$/;

export function hasUnitSuffixInKey(key: string) {
  const compact = key.replace(/[_\s-]/g, "");
  return LEGACY_UNIT_SUFFIX_RE.test(compact);
}

export function assertCanonicalTemplateKeys(
  templateId: string,
  fieldKeys: string[],
  options?: { allowUnitSuffixKeys?: string[] },
) {
  const allow = new Set(options?.allowUnitSuffixKeys ?? []);
  const invalid = fieldKeys.filter((key) => !allow.has(key) && hasUnitSuffixInKey(key));
  if (invalid.length > 0) {
    throw new Error(
      `[${templateId}] claves no canonicas (incluyen unidad en key): ${invalid.join(", ")}`,
    );
  }
}

export function assertAnchoAntesDeAlto(templateId: string, keys: string[]) {
  const anchoIdx = keys.indexOf("ancho");
  const altoIdx = keys.indexOf("alto");
  if (anchoIdx >= 0 && altoIdx >= 0 && anchoIdx > altoIdx) {
    throw new Error(
      `[${templateId}] orden invalido de dimensiones: "ancho" debe estar antes que "alto".`,
    );
  }
}
