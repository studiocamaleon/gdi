/**
 * PLANCHA_TERMICA — deriva la productividad (piezas/hora) del ciclo de prensado.
 *
 *   segundosCiclo = preplanchado + planchado + postplanchado
 *   productividad = 3600 / segundosCiclo   [piezas/h]
 *
 * El operario razona por ciclo (segundos), no en piezas/hora; guardamos el nº
 * derivado en productivityValue para que el motor lo consuma en T-3 sin cambios.
 * Devuelve null si el detalle no trae el planchado (no es una plancha por ciclo)
 * — el caller conserva lo que venga en el payload.
 *
 * NOTA (decisión 2026-08-04): el ciclo cuenta SOLO el tiempo ACTIVO. En pelado en
 * frío el enfriamiento (minutos) NO se suma: se asume que el operario trabaja en
 * paralelo la siguiente prenda mientras una enfría. Si un taller espera de brazos
 * cruzados, haría falta un modelo de paralelismo (pendiente).
 *
 * Módulo puro (sin dependencias del DTO/Nest) para que sea testeable aislado.
 */
export function deriveProductividadPlanchaTermica(
  detalle: Record<string, unknown> | null | undefined,
): { productivityValue: number; productivityUnit: 'piezas_h' } | null {
  if (!detalle) return null;
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };
  const planchado = num(detalle.tiempoPrensadoSeg);
  if (planchado === null) return null;
  const preplanchado = num(detalle.tiempoPreplanchadoSeg) ?? 0;
  const postplanchado = num(detalle.tiempoPostplanchadoSeg) ?? 0;
  const segundosCiclo = preplanchado + planchado + postplanchado;
  if (segundosCiclo <= 0) return null;
  const productividad = 3600 / segundosCiclo;
  return { productivityValue: productividad, productivityUnit: 'piezas_h' };
}
