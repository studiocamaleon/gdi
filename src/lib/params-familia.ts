/**
 * Lógica pura del editor de parámetros propios de una familia
 * (`paramsPasoSchema`). El componente que la usa es
 * `components/productos-servicios/params-familia-fields.tsx`.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */

/**
 * ¿Los `paramsPasoSchema` de la familia se editan desde la UI genérica?
 *
 * La familia lo DECLARA (`editorParamsGenerico`) — sigue siendo opt-in a
 * propósito: una familia lo declara recién cuando el motor consume sus
 * params, y no lo declara si tiene UI a medida para los mismos campos
 * (`pre_prensa`, `montaje_sobre_sustrato`, `diseno_grafico`): se duplicarían
 * los controles. [Tanda B: era la lista FAMILIAS_CON_PARAMS_EDITABLES acá]
 */
export function familiaConParamsEditables(
  familia: { editorParamsGenerico?: boolean } | null | undefined,
): boolean {
  return familia?.editorParamsGenerico === true;
}

/** Etiquetas humanas de los valores de enum conocidos. */
export const ETIQUETAS_VALOR_PARAM: Record<string, string> = {
  superior: "Superior",
  inferior: "Inferior",
  izquierdo: "Izquierdo",
  derecho: "Derecho",
  simple: "Simple (marco plano)",
  doble: "Doble (cajón)",
  area: "Por área (grilla sobre la cara)",
  recorrido: "Por recorrido (siguiendo el trazo)",
};

export const DESCRIPCIONES_VALOR_PARAM: Record<string, string> = {};

export function etiquetaValorParam(valor: string): string {
  return ETIQUETAS_VALOR_PARAM[valor] ?? valor;
}

export function paramVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  return Array.isArray(valor) && valor.length === 0;
}

/**
 * Patch al elegir un valor de enum.
 *
 * [F4 efectos] Antes había presets: elegir `subTipo: refuerzo` precargaba
 * lados y milímetros. Murieron con `modificacion_pre` — la demasía dejó de ser
 * un param de familia y pasó a ser un EFECTO del paso, con su propia card.
 */
export function patchParaEnum(
  campo: string,
  valor: string,
): Record<string, unknown> {
  return { [campo]: valor || null };
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
