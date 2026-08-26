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
  por_separacion: "Distribuidos por los lados",
  solo_esquinas: "Sólo cuatro esquinas",
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
export const CAMPO_FIJADOS = "camposFijadosComercial";

export function camposEditablesComercial(
  params: Record<string, unknown>,
): string[] {
  const declarados = params[CAMPO_EDITABLES];
  if (!Array.isArray(declarados)) return [];
  return declarados.filter((c): c is string => typeof c === "string");
}

/**
 * Campos que el modelador FIJÓ explícitamente aunque la familia los exponga por
 * defecto (`expuestoAlComercial`). Espejo de `params-runtime.ts` del motor.
 */
export function camposFijadosComercial(
  params: Record<string, unknown>,
): string[] {
  const declarados = params[CAMPO_FIJADOS];
  if (!Array.isArray(declarados)) return [];
  return declarados.filter((c): c is string => typeof c === "string");
}

/**
 * ¿El campo queda editable por el comercial? El DEFAULT lo pone la familia
 * (`expuestoAlComercial`), pero la elección explícita del modelador manda:
 *  - expuesto por la familia → editable salvo que lo haya fijado;
 *  - no expuesto → fijo salvo que lo haya abierto.
 */
export function esEditableComercial(
  params: Record<string, unknown>,
  campo: string,
  expuestoAlComercial: boolean,
): boolean {
  // `fijados` gana sobre todo; si no, editable si el modelador lo abrió o la
  // familia lo expone por default.
  if (camposFijadosComercial(params).includes(campo)) return false;
  return (
    expuestoAlComercial ||
    camposEditablesComercial(params).includes(campo)
  );
}

/**
 * Patch al mover el toggle Fijo/Editable. Cada param queda a lo sumo en UNA
 * lista, y sólo si se desvía del default de la familia: un no-expuesto se abre
 * agregándolo a `editables`; un expuesto se cierra agregándolo a `fijados`. Al
 * cambiar, se limpia la lista opuesta (evita que quede en las dos).
 */
export function toggleEditableComercial(
  params: Record<string, unknown>,
  campo: string,
  abierto: boolean,
  expuestoAlComercial: boolean,
): Record<string, unknown> {
  const editables = camposEditablesComercial(params).filter((c) => c !== campo);
  const fijados = camposFijadosComercial(params).filter((c) => c !== campo);
  if (abierto) {
    // Editable: si el default ya es abierto (expuesto), alcanza con no fijarlo;
    // si el default es fijo, hay que abrirlo explícitamente.
    if (!expuestoAlComercial) editables.push(campo);
  } else {
    // Fijo: si el default es abierto (expuesto), hay que cerrarlo explícito;
    // si el default ya es fijo, alcanza con no abrirlo.
    if (expuestoAlComercial) fijados.push(campo);
  }
  return { [CAMPO_EDITABLES]: editables, [CAMPO_FIJADOS]: fijados };
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
