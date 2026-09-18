/** Piloto de láminas fijas; no habilita todavía planos de las OT. */
export type ConfiguracionCad = {
  anchoRolloMm: number;
  margenMm: number;
  origenPapel: string;
  usarOrigenPredeterminado: boolean;
};
export type FormatoPruebaCad = 'A1' | 'PERSONALIZADO';
export const FORMATOS_PRUEBA_CAD = {
  A1: { nombre: 'A1', anchoMm: 594, altoMm: 841 },
  PERSONALIZADO: { nombre: '900 × 350 mm', anchoMm: 900, altoMm: 350 },
} as const;

export function esConfiguracionCad(value: unknown): value is ConfiguracionCad {
  if (!value || typeof value !== 'object') return false;
  const c = value as ConfiguracionCad;
  return (
    Number.isFinite(c.anchoRolloMm) &&
    c.anchoRolloMm >= 300 &&
    c.anchoRolloMm <= 914.4 &&
    c.margenMm === 5 &&
    typeof c.origenPapel === 'string' &&
    c.origenPapel.length <= 100 &&
    // eslint-disable-next-line no-control-regex
    !/[\x00-\x1f\x7f]/.test(c.origenPapel) &&
    typeof c.usarOrigenPredeterminado === 'boolean' &&
    (c.usarOrigenPredeterminado
      ? c.origenPapel === ''
      : c.origenPapel.trim().length > 0)
  );
}

export function planPruebaCad(c: ConfiguracionCad, formato: FormatoPruebaCad) {
  const original = FORMATOS_PRUEBA_CAD[formato];
  if (!original) throw new Error('Elegí una lámina de prueba CAD válida.');
  return planPaginaCad(c, original);
}

/** Geometría a tamaño real; compartida por cotización y pruebas. */
export function planPaginaCad(
  c: ConfiguracionCad,
  original: { anchoMm: number; altoMm: number; nombre?: string },
) {
  if (!esConfiguracionCad(c))
    throw new Error('Revisá el ancho del rollo y su origen de papel.');
  if (
    ![original.anchoMm, original.altoMm].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 100_000,
    )
  )
    throw new Error('Las medidas de la página no son válidas.');
  const util = c.anchoRolloMm - 2 * c.margenMm;
  const opciones = [
    { giro: 0, anchoMm: original.anchoMm, altoMm: original.altoMm },
    { giro: 90, anchoMm: original.altoMm, altoMm: original.anchoMm },
  ]
    .filter((p) => p.anchoMm <= util)
    .sort((a, b) => a.altoMm - b.altoMm || a.giro - b.giro);
  const elegida = opciones[0];
  if (!elegida)
    throw new Error(
      `La lámina no entra en los ${util.toLocaleString('es-AR')} mm útiles del rollo. No se reducirá.`,
    );
  return {
    original,
    ...elegida,
    anchoSalidaMm: c.anchoRolloMm,
    largoSalidaMm: elegida.altoMm + 2 * c.margenMm,
    desplazamientoXMm: (c.anchoRolloMm - elegida.anchoMm) / 2,
    desplazamientoYMm: c.margenMm,
    escala: 100 as const,
  };
}
