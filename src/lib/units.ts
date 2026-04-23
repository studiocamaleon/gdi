/**
 * Fase B — Normalización de unidades de longitud (frontend).
 *
 * Espejo exacto de `apps/api/src/common/units.ts`. Mantener en sync.
 *
 * Convención de claves en JSON de atributos:
 *   - `<base>Mm` → milímetros (canónica del motor)
 *   - `<base>Cm` → centímetros (canónica de la UI)
 *   - `<base>M`  → metros (catálogo gran formato)
 *
 * El motor SIEMPRE consume mm. La UI elige la unidad según familia para
 * mostrar/editar (cm para hojas, m para rollos).
 */

export type LongitudUnit = "mm" | "cm" | "m";

/**
 * Devuelve la longitud en MILÍMETROS leyendo (en orden) `<base>Mm`,
 * `<base>Cm`, `<base>M`, fallback a `<base>` asumido en metros (compat
 * con catálogo de gran formato histórico).
 */
export function getLongitudMm(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): number | null {
  if (!attrs || typeof attrs !== "object") return null;

  const probe = (key: string, factor: number): number | null => {
    const v = attrs[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
    return v * factor;
  };

  return (
    probe(`${baseKey}Mm`, 1) ??
    probe(`${baseKey}Cm`, 10) ??
    probe(`${baseKey}M`, 1000) ??
    probe(baseKey, 1000) ??
    null
  );
}

/**
 * Devuelve la longitud en CENTÍMETROS (para la UI).
 */
export function getLongitudCm(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): number | null {
  const mm = getLongitudMm(attrs, baseKey);
  return mm == null ? null : mm / 10;
}

/**
 * Devuelve la longitud en METROS (para rollos en la UI).
 */
export function getLongitudM(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): number | null {
  const mm = getLongitudMm(attrs, baseKey);
  return mm == null ? null : mm / 1000;
}

/**
 * Setea una longitud en el sufijo apropiado y limpia los otros sufijos
 * del mismo baseKey para evitar ambigüedad.
 */
export function setLongitud(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
  valor: number,
  unidad: LongitudUnit,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(attrs ?? {}) };
  delete next[`${baseKey}Mm`];
  delete next[`${baseKey}Cm`];
  delete next[`${baseKey}M`];
  delete next[baseKey];
  const suffix = unidad === "mm" ? "Mm" : unidad === "cm" ? "Cm" : "M";
  next[`${baseKey}${suffix}`] = valor;
  return next;
}

/**
 * Devuelve la unidad detectada para `baseKey`, o `null` si ningún sufijo
 * tiene valor válido. Útil para que la UI decida cómo formatear sin
 * forzar conversión.
 */
export function detectLongitudUnit(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): LongitudUnit | null {
  if (!attrs || typeof attrs !== "object") return null;
  const isValid = (k: string): boolean => {
    const v = attrs[k];
    return typeof v === "number" && Number.isFinite(v) && v > 0;
  };
  if (isValid(`${baseKey}Mm`)) return "mm";
  if (isValid(`${baseKey}Cm`)) return "cm";
  if (isValid(`${baseKey}M`)) return "m";
  if (isValid(baseKey)) return "m"; // legacy: asumido metros
  return null;
}
