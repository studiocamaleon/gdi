/**
 * Lógica pura del editor de parámetros propios de una familia
 * (`paramsPasoSchema`). El componente que la usa es
 * `components/productos-servicios/params-familia-fields.tsx`.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */

/**
 * Familias cuyos `paramsPasoSchema` se editan desde la UI genérica.
 *
 * OPT-IN a propósito. Varias familias declaran params que el motor NO lee
 * —`tipoPliegue` no lo lee nadie— y exponerlos sería pedirle al modelador que
 * configure cosas que no hacen nada, justo el problema que este trabajo vino a
 * corregir. Se agrega una familia acá recién cuando se verificó que el motor
 * consume sus params.
 *
 * Tampoco entran las que ya tienen UI a medida para los mismos campos
 * (`pre_prensa`, `montaje_sobre_sustrato`, `diseno_grafico`): se duplicarían
 * los controles.
 */
export const FAMILIAS_CON_PARAMS_EDITABLES = new Set([
  "modificacion_pre",
  "colocacion_ojales",
]);

/** Etiquetas humanas de los valores de enum conocidos. */
export const ETIQUETAS_VALOR_PARAM: Record<string, string> = {
  superior: "Superior",
  inferior: "Inferior",
  izquierdo: "Izquierdo",
  derecho: "Derecho",
  bolsillo: "Bolsillo",
  refuerzo: "Refuerzo",
};

export const DESCRIPCIONES_VALOR_PARAM: Record<string, string> = {
  bolsillo: "Demasía grande para que entre el caño. Suele ir arriba y abajo.",
  refuerzo: "Demasía chica para reforzar el borde. Suele ir en los 4 lados.",
};

/**
 * Presets del `subTipo` de `modificacion_pre`. Bolsillo y refuerzo son la
 * misma primitiva con valores distintos, así que el sub-tipo sólo precarga.
 */
export const PRESETS_SUBTIPO: Record<string, Record<string, unknown>> = {
  bolsillo: { lados: ["superior", "inferior"], demasiaMm: 100 },
  refuerzo: {
    lados: ["superior", "inferior", "izquierdo", "derecho"],
    demasiaMm: 40,
  },
};

export function etiquetaValorParam(valor: string): string {
  return ETIQUETAS_VALOR_PARAM[valor] ?? valor;
}

export function paramVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  return Array.isArray(valor) && valor.length === 0;
}

/**
 * Patch al elegir un valor de enum. Si el campo es `subTipo` y hay preset,
 * completa los campos que estén VACÍOS — nunca pisa lo que el modelador ya
 * escribió, porque el preset es una ayuda, no una regla.
 */
export function patchParaEnum(
  campo: string,
  valor: string,
  paramsActuales: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { [campo]: valor || null };
  if (campo !== "subTipo") return patch;

  const preset = PRESETS_SUBTIPO[valor];
  if (!preset) return patch;

  for (const [campoPreset, valorPreset] of Object.entries(preset)) {
    if (paramVacio(paramsActuales[campoPreset])) patch[campoPreset] = valorPreset;
  }
  return patch;
}

/**
 * Nueva lista al marcar/desmarcar una opción de un `multi-enum`.
 * Devuelve los valores en el ORDEN CANÓNICO del schema, no en el orden en que
 * el usuario fue clickeando: así `lados` llega al backend siempre igual y dos
 * pasos equivalentes no se ven distintos.
 */
export function toggleMultiEnum(
  valoresPermitidos: string[],
  seleccionActual: unknown,
  valor: string,
  activo: boolean,
): string[] {
  const actuales = Array.isArray(seleccionActual)
    ? seleccionActual.map(String)
    : [];
  return valoresPermitidos.filter((permitido) =>
    permitido === valor ? activo : actuales.includes(permitido),
  );
}

/**
 * Estado de un checkbox booleano: el valor guardado si existe, si no el
 * default del schema (y `true` cuando el schema tampoco lo declara).
 */
/**
 * Campos que el modelador dejó abiertos para que el comercial los cambie al
 * cotizar. Lo modelado pasa a ser la SUGERENCIA.
 * Espejo de `apps/api/src/motor-universal/params-runtime.ts`.
 */
export const CAMPO_EDITABLES = "camposEditablesComercial";

export function camposEditablesComercial(
  params: Record<string, unknown>,
): string[] {
  const declarados = params[CAMPO_EDITABLES];
  if (!Array.isArray(declarados)) return [];
  return declarados.filter((c): c is string => typeof c === "string");
}

/** Patch al marcar/desmarcar "el comercial puede cambiarlo" en un campo. */
export function toggleCampoEditable(
  params: Record<string, unknown>,
  campo: string,
  abierto: boolean,
): Record<string, unknown> {
  const actuales = camposEditablesComercial(params);
  const siguiente = abierto
    ? Array.from(new Set([...actuales, campo]))
    : actuales.filter((c) => c !== campo);
  return { [CAMPO_EDITABLES]: siguiente };
}

export function valorBooleanoParam(
  valorGuardado: unknown,
  defaultSchema: unknown,
): boolean {
  if (valorGuardado === undefined || valorGuardado === null) {
    return defaultSchema !== false;
  }
  return valorGuardado !== false;
}
