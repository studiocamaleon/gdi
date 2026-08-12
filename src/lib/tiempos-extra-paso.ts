/**
 * TIEMPO EXTRA del paso, lado editor: leer y escribir
 * `paramsPasoJson.tiemposExtra`.
 *
 * El motor tiene su propio lector (`apps/api/src/motor-universal/tiempo-extra.ts`),
 * tolerante con lo que encuentre; acá la forma es la canónica porque esta es la
 * puerta de escritura. Ver docs/cargos-por-paso-analisis-y-plan.md §7.
 */

export interface TiempoExtraPaso {
  /** Estable dentro del paso: los niveles pisan los minutos POR id. */
  id: string;
  etiqueta: string;
  minutos: number;
  /** null = el centro del paso. */
  centroCostoId: string | null;
  /** null = la dotación del paso. */
  dotacion: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function leerTiemposExtra(
  paramsPasoJson: unknown,
): TiempoExtraPaso[] {
  const raw = asRecord(paramsPasoJson).tiemposExtra;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, indice) => {
    const bloque = asRecord(item);
    const minutos = Number(bloque.minutos);
    const dotacion = Number(bloque.dotacion);
    return {
      id:
        typeof bloque.id === "string" && bloque.id.trim()
          ? bloque.id.trim()
          : `extra_${indice}`,
      etiqueta:
        typeof bloque.etiqueta === "string" ? bloque.etiqueta : "Tiempo extra",
      minutos: Number.isFinite(minutos) && minutos > 0 ? minutos : 0,
      centroCostoId:
        typeof bloque.centroCostoId === "string" && bloque.centroCostoId.trim()
          ? bloque.centroCostoId.trim()
          : null,
      dotacion: Number.isFinite(dotacion) && dotacion > 0 ? dotacion : null,
    };
  });
}

/**
 * Patch shallow sobre `paramsPasoJson`. Lista vacía = borrar la clave.
 *
 * NO filtra por minutos: el editor guarda en cada tecla, y filtrar acá hacía
 * desaparecer el bloque al vaciar el campo para escribir otro número. Un
 * bloque en 0 es config válida y el motor lo ignora al cotizar; para sacarlo
 * está el tacho.
 */
export function patchTiemposExtra(
  bloques: TiempoExtraPaso[],
): Record<string, unknown> {
  return { tiemposExtra: bloques.length > 0 ? bloques : null };
}

/** Resumen de una línea para la card cerrada del editor. */
export function resumirTiemposExtra(paramsPasoJson: unknown): string | null {
  const bloques = leerTiemposExtra(paramsPasoJson).filter((b) => b.minutos > 0);
  if (bloques.length === 0) return null;
  const total = bloques.reduce((acc, bloque) => acc + bloque.minutos, 0);
  const detalle = bloques
    .map((bloque) => `${bloque.etiqueta} ${bloque.minutos} min`)
    .join(" · ");
  return bloques.length === 1 ? detalle : `${total} min — ${detalle}`;
}
