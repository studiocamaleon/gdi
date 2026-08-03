/**
 * Cobertura de tóner por nivel. Eje ORTOGONAL al perfil (que se resuelve
 * automático): sólo modula cuánto tóner consume una impresión. Los 3 niveles son
 * fijos del sistema. Ver docs/cobertura-toner-por-nivel-diseno.md.
 */

/** Niveles de cobertura, del que menos tóner gasta al que más. */
export const NIVELES_COBERTURA = ['borrador', 'normal', 'alta'] as const;
export type NivelCobertura = (typeof NIVELES_COBERTURA)[number];

/** Nivel por defecto cuando el trabajo no declara cobertura (= consumoBase). */
export const NIVEL_COBERTURA_DEFAULT: NivelCobertura = 'normal';

export const NIVEL_COBERTURA_LABELS: Record<NivelCobertura, string> = {
  borrador: 'Borrador',
  normal: 'Normal',
  alta: 'Alta',
};

/**
 * Normaliza un valor libre a un nivel de cobertura. Acepta el código o el label
 * (case-insensitive), y sinónimos usuales. Desconocido/ausente → Normal (default),
 * así el fallback nunca rompe ni cambia el costo (consumoBase = columna Normal).
 */
export function normalizarNivelCobertura(value: unknown): NivelCobertura {
  if (typeof value !== 'string') return NIVEL_COBERTURA_DEFAULT;
  const v = value.trim().toLowerCase();
  if (!v) return NIVEL_COBERTURA_DEFAULT;
  if (['borrador', 'draft', 'baja', 'low'].includes(v)) return 'borrador';
  if (['normal', 'estandar', 'estándar', 'standard', 'media'].includes(v)) {
    return 'normal';
  }
  if (['alta', 'full', 'full-color', 'fullcolor', 'high'].includes(v)) {
    return 'alta';
  }
  return NIVEL_COBERTURA_DEFAULT;
}

/**
 * g/m² de un consumible para un nivel. Usa `consumoPorCoberturaJson` si declara
 * el nivel con un valor positivo; si no, cae a `consumoBase` (que por el backfill
 * de la migración equivale a la columna Normal). Devuelve 0 si no hay ninguno.
 */
export function consumoGm2DeCobertura(
  consumible: {
    consumoBase: number | null;
    consumoPorCoberturaJson?: unknown;
  },
  nivel: NivelCobertura,
): number {
  const json = consumible.consumoPorCoberturaJson;
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const raw = (json as Record<string, unknown>)[nivel];
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
  }
  return Number(consumible.consumoBase ?? 0);
}
