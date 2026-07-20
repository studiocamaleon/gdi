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

/** Campos que el modelador dejó abiertos al comercial en este paso. */
export function camposEditablesComercial(paramsPasoJson: unknown): string[] {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;
  const declarados = params[CAMPO_EDITABLES];
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
): Record<string, unknown> {
  const base = { ...((paramsPasoJson ?? {}) as Record<string, unknown>) };
  const editables = camposEditablesComercial(paramsPasoJson);
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
