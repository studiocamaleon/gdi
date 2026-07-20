/**
 * Filtro de specs para el seguimiento PÚBLICO del cliente.
 *
 * `specsJson` es la proyección que vio el comercial al armar la OT, e incluye
 * datos que son de taller, no del cliente. El endpoint público declara que
 * devuelve "sólo la proyección cliente-facing" — esto lo hace cumplir.
 *
 * Ver docs/tracking-publico-diseno.md y
 * docs/modificaciones-fisicas-lona-diseno.md §7.
 */

/**
 * Etiquetas (en minúscula) que NO viajan al cliente.
 *
 * `medida de corte`: cuando un paso `modificacion_pre` agranda la medida
 * (bolsillo, refuerzo), el taller corta más grande que lo que se pidió. El
 * cliente pidió 150×100 y mostrarle "158×108" lo haría pensar que le estamos
 * haciendo otra cosa. Es un número para el operario.
 */
const ETIQUETAS_SPEC_INTERNAS = new Set(['medida de corte']);

export function filtrarSpecsPublicas<T extends { etiqueta: string }>(
  specs: T[],
): T[] {
  return specs.filter(
    (spec) => !ETIQUETAS_SPEC_INTERNAS.has(spec.etiqueta.trim().toLowerCase()),
  );
}
