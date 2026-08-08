/**
 * Params del paso que el COMERCIAL puede cambiar al cotizar.
 *
 * El modelador declara en `paramsPasoJson.camposEditablesComercial` qué campos
 * quedan abiertos; lo que él configuró pasa a ser la SUGERENCIA. El comercial
 * los sobrescribe desde el cotizador y el valor viaja en
 * `jobContext.configPasoRuntime[configPasoId]`.
 *
 * El filtro por whitelist NO es cosmético: sin él, cualquiera que llame a la
 * API podría pisar params que el modelador quiso fijos (la demasía de un
 * refuerzo, el tipo de modificación) y cotizar cualquier cosa.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */

export const CAMPO_EDITABLES = 'camposEditablesComercial';
export const CAMPO_FIJADOS = 'camposFijadosComercial';

/** Campos que el modelador dejó abiertos al comercial en este paso. */
export function camposEditablesComercial(paramsPasoJson: unknown): string[] {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;
  const declarados = params[CAMPO_EDITABLES];
  if (!Array.isArray(declarados)) return [];
  return declarados.filter((c): c is string => typeof c === 'string');
}

/**
 * Campos que el modelador FIJÓ explícitamente aunque la familia los exponga por
 * defecto (`expuestoAlComercial`). El default de esos params es "editable"; esta
 * lista es la forma de que el modelador los cierre. Vacía = nada cerrado (el
 * comportamiento histórico). El toggle Fijo/Editable del editor es la autoridad:
 * la familia sólo pone el default.
 */
export function camposFijadosComercial(paramsPasoJson: unknown): string[] {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;
  const declarados = params[CAMPO_FIJADOS];
  if (!Array.isArray(declarados)) return [];
  return declarados.filter((c): c is string => typeof c === 'string');
}

/**
 * Params efectivos del paso: lo modelado, con los campos ABIERTOS pisados por
 * lo que eligió el comercial.
 *
 * Un campo que el comercial mandó pero el modelador no abrió se ignora en
 * silencio: no es un error del usuario, es un input que no corresponde.
 */
export function paramsEfectivos(
  paramsPasoJson: unknown,
  runtimeDelPaso: unknown,
  /**
   * Campos editables POR DISEÑO de una herramienta (ej. el configurador 3D de
   * cartelería), sin que el modelador tenga que declararlos abiertos. Los
   * aporta el caller según la familia del paso.
   */
  editablesExtra: string[] = [],
): Record<string, unknown> {
  const base = { ...((paramsPasoJson ?? {}) as Record<string, unknown>) };
  // Abiertos = lo que el modelador abrió ∪ lo que la familia expone por
  // default, MENOS lo que el modelador fijó explícitamente. `fijados` gana
  // sobre TODO: si un campo quedó en las dos listas, manda el Fijo.
  const fijados = new Set(camposFijadosComercial(paramsPasoJson));
  const editables = [
    ...camposEditablesComercial(paramsPasoJson),
    ...editablesExtra,
  ].filter((campo) => !fijados.has(campo));
  if (editables.length === 0) return base;

  const runtime = (runtimeDelPaso ?? {}) as Record<string, unknown>;
  for (const campo of editables) {
    if (!(campo in runtime)) continue;
    const valor = runtime[campo];
    // `undefined` = el comercial no eligió nada: queda la sugerencia del
    // modelador. Un array vacío SÍ se respeta: es una elección (y la valida
    // el motor, que corta si el paso queda sin lados).
    if (valor === undefined || valor === null) continue;
    base[campo] = valor;
  }
  return base;
}
