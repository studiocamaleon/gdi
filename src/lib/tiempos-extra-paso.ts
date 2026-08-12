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
 *
 * Con `paramsActuales` además **poda los overrides huérfanos**: los niveles
 * pisan minutos por id de bloque, y al borrar un bloque esos overrides quedaban
 * apuntando a la nada. El motor los ignora (recorre los bloques que existen),
 * pero el resumen los sumaba y mostraba tiempos que nadie iba a trabajar.
 */
export function patchTiemposExtra(
  bloques: TiempoExtraPaso[],
  paramsActuales?: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    tiemposExtra: bloques.length > 0 ? bloques : null,
  };
  const niveles = podarOverridesHuerfanos(paramsActuales, bloques);
  if (niveles !== undefined) patch.niveles = niveles;
  return patch;
}

/** `undefined` = no hay nada que podar (no toca la clave). */
function podarOverridesHuerfanos(
  paramsActuales: Record<string, unknown> | undefined,
  bloques: TiempoExtraPaso[],
): unknown {
  const raw = paramsActuales?.niveles;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const config = raw as Record<string, unknown>;
  const opciones = Array.isArray(config.opciones) ? config.opciones : null;
  if (!opciones) return undefined;
  const vivos = new Set(bloques.map((bloque) => bloque.id));
  let podado = false;
  const siguientes = opciones.map((item) => {
    const opcion = { ...((item ?? {}) as Record<string, unknown>) };
    const overrides = opcion.overrides as Record<string, unknown> | undefined;
    const minutos = overrides?.tiemposExtraMin as
      | Record<string, unknown>
      | undefined;
    if (!minutos) return opcion;
    const limpios = Object.fromEntries(
      Object.entries(minutos).filter(([id]) => vivos.has(id)),
    );
    if (Object.keys(limpios).length === Object.keys(minutos).length) {
      return opcion;
    }
    podado = true;
    const siguientesOverrides = { ...overrides };
    if (Object.keys(limpios).length > 0) {
      siguientesOverrides.tiemposExtraMin = limpios;
    } else {
      delete siguientesOverrides.tiemposExtraMin;
    }
    opcion.overrides = siguientesOverrides;
    return opcion;
  });
  return podado ? { ...config, opciones: siguientes } : undefined;
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
