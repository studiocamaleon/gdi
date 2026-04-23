/**
 * Fase B — Normalización de unidades de longitud.
 *
 * Atributos que representan longitudes (ancho, alto, largo, espesor, etc.)
 * pueden almacenarse en JSON con distintas unidades según el origen:
 *   - Rollo gran formato: `{ ancho: 1.06, largo: 50 }` → metros
 *   - Hoja: `{ anchoMm: 320, altoMm: 450 }` → milímetros
 *   - Hoja legacy (UI vieja): `{ anchoCm: 21, altoCm: 29.7 }` → centímetros
 *
 * En lugar de forzar una unidad única (rompería datos legados), la
 * convención es marcar la unidad en el SUFIJO de la clave:
 *   - `<base>Mm` → milímetros (canónica del motor)
 *   - `<base>Cm` → centímetros (canónica de la UI)
 *   - `<base>M`  → metros (canónica del catálogo de gran formato)
 *
 * El motor SIEMPRE consume mm internamente; estas funciones convierten
 * según el sufijo encontrado.
 *
 * IMPORTANTE: existe una copia espejo en el frontend
 * (`src/lib/units.ts`) — mantener ambas en sync.
 */

export type LongitudUnit = 'mm' | 'cm' | 'm';

/**
 * Devuelve la longitud en MILÍMETROS leyendo (en orden) `<base>Mm`,
 * `<base>Cm`, `<base>M`. Como último fallback intenta `<base>` asumiendo
 * **metros** (convención histórica del catálogo gran formato; las hojas
 * legadas guardadas como `ancho: 21` cm están bugueadas y deben migrar
 * a sufijo explícito).
 *
 * Devuelve `null` si no encuentra nada o todos los valores son inválidos.
 */
export function getLongitudMm(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): number | null {
  if (!attrs || typeof attrs !== 'object') return null;

  const probe = (key: string, factor: number): number | null => {
    const v = attrs[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
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
 * Devuelve la longitud en CENTÍMETROS (para mostrar en la UI). Misma cadena
 * de fallback que `getLongitudMm`.
 */
export function getLongitudCm(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
): number | null {
  const mm = getLongitudMm(attrs, baseKey);
  return mm == null ? null : mm / 10;
}

/**
 * Setea una longitud en el sufijo apropiado y limpia los otros sufijos del
 * mismo baseKey para evitar ambigüedad.
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
  const suffix = unidad === 'mm' ? 'Mm' : unidad === 'cm' ? 'Cm' : 'M';
  next[`${baseKey}${suffix}`] = valor;
  return next;
}

/**
 * Lee una longitud en mm con fallback explícito (en mm). Útil para campos
 * que SIEMPRE deberían existir.
 */
export function getLongitudMmOrDefault(
  attrs: Record<string, unknown> | null | undefined,
  baseKey: string,
  defaultMm: number,
): number {
  return getLongitudMm(attrs, baseKey) ?? defaultMm;
}
