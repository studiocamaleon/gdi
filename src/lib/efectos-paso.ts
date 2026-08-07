/**
 * EFECTOS de paso — lo que un paso le exige al trabajo, del lado del editor.
 * Espejo de `apps/api/src/motor-universal/efectos-paso.ts`.
 * Ver docs/efectos-de-paso-diseno.md
 *
 * Un paso de producción no sólo consume tiempo y materiales: a veces le exige
 * algo al trabajo. "Tensado de lona" necesita 100 mm más por lado para poder
 * envolver el bastidor. Eso es del paso REAL, no de una familia-artefacto.
 */

export const LADOS_PIEZA = [
  "superior",
  "inferior",
  "izquierdo",
  "derecho",
] as const;

export type LadoPieza = (typeof LADOS_PIEZA)[number];

export const ETIQUETA_LADO: Record<LadoPieza, string> = {
  superior: "Arriba",
  inferior: "Abajo",
  izquierdo: "Izquierda",
  derecho: "Derecha",
};

export interface EfectoDemasiaMedida {
  lados: LadoPieza[];
  mm: number;
  /** La demasía deja una banda plana perforable (refuerzo) en vez de un tubo
   *  (bolsillo). Los ojales lo miran para centrarse sobre esa banda. */
  refuerza: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parsearLados(value: unknown): LadoPieza[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value.map((v) => String(v).trim()));
  return LADOS_PIEZA.filter((lado) => set.has(lado));
}

/** ¿La familia del paso admite que se le pida material extra alrededor? */
export function soportaDemasiaMedida(
  familia: { efectosSoportados?: string[] } | null | undefined,
): boolean {
  return familia?.efectosSoportados?.includes("demasiaMedida") === true;
}

/**
 * Lee el efecto configurado. Acepta el formato NUEVO (`efectos.demasiaMedida`)
 * y el VIEJO de `modificacion_pre` (`lados` + `demasiaMm` + `subTipo` en la
 * raíz), que es como están guardadas las rutas de hoy.
 */
export function leerEfectoDemasia(
  paramsPasoJson: unknown,
): EfectoDemasiaMedida | null {
  const params = asRecord(paramsPasoJson);
  const nuevo = asRecord(asRecord(params.efectos).demasiaMedida);
  const crudo = Object.keys(nuevo).length > 0 ? nuevo : params;

  const lados = parsearLados(crudo.lados);
  if (lados.length === 0) return null;

  const mm = Number(crudo.mm ?? crudo.demasiaMm ?? NaN);
  if (!Number.isFinite(mm) || mm <= 0) return null;

  const refuerza =
    typeof crudo.refuerza === "boolean"
      ? crudo.refuerza
      : String(params.subTipo ?? "").trim() === "refuerzo";

  return { lados, mm, refuerza };
}

/** ¿El paso DECLARA el efecto, aunque le falte un dato? Distingue "no exige
 *  nada" de "lo pidió a medias" — el editor tiene que marcar lo segundo. */
export function declaraEfectoDemasia(paramsPasoJson: unknown): boolean {
  const params = asRecord(paramsPasoJson);
  if (Object.keys(asRecord(asRecord(params.efectos).demasiaMedida)).length > 0) {
    return true;
  }
  return params.lados !== undefined || params.demasiaMm !== undefined;
}

/**
 * Patch para guardar el efecto. Escribe SIEMPRE en el formato nuevo y, si el
 * paso venía con los campos viejos en la raíz, los limpia — así un paso no
 * queda con dos verdades que el lector tendría que desempatar.
 */
export function patchEfectoDemasia(
  paramsActuales: unknown,
  efecto: EfectoDemasiaMedida | null,
): Record<string, unknown> {
  const params = asRecord(paramsActuales);
  const efectos = { ...asRecord(params.efectos) };

  if (efecto) {
    efectos.demasiaMedida = {
      lados: LADOS_PIEZA.filter((lado) => efecto.lados.includes(lado)),
      mm: efecto.mm,
      refuerza: efecto.refuerza,
    };
  } else {
    delete efectos.demasiaMedida;
  }

  const patch: Record<string, unknown> = {
    efectos: Object.keys(efectos).length > 0 ? efectos : null,
  };
  // El formato viejo se apaga en cuanto el paso pasa por el editor nuevo.
  if (params.lados !== undefined) patch.lados = null;
  if (params.demasiaMm !== undefined) patch.demasiaMm = null;
  if (params.subTipo !== undefined) patch.subTipo = null;
  return patch;
}

/** "100 mm arriba y abajo", para el resumen colapsado de la card. */
export function resumirEfectoDemasia(efecto: EfectoDemasiaMedida): string {
  const nombres = efecto.lados.map((lado) =>
    ETIQUETA_LADO[lado].toLowerCase(),
  );
  const lados =
    efecto.lados.length === 4
      ? "en los 4 lados"
      : nombres.length === 1
        ? nombres[0]
        : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return `${efecto.mm} mm ${lados}${efecto.refuerza ? " · deja banda plana" : ""}`;
}
