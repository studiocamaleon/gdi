/**
 * Selección de material por MENOR_CAPACIDAD_QUE_CUMPLA: de las variantes válidas,
 * elige la de MENOR capacidad que igual cubre el requerimiento (ej. el espiral de
 * menor diámetro que aguanta las hojas del libro).
 *
 * El campo de capacidad (ej. `capacidadMaxHojas`) vive en `atributosVarianteJson`
 * — `cargarVariantePorId` sólo aplana `anchoMm` —, así que se lee de ahí, con
 * fallback top-level por si algún loader lo aplanó. Ver
 * docs/anilladora-encuadernacion-espiral-diseno.md §4.bis (Etapa A).
 */

/** Capacidad declarada de una variante para un campo (atributos o top-level). */
export function capacidadDeVariante(
  variante: { atributosVarianteJson?: unknown },
  campoCapacidad: string,
): number {
  if (!campoCapacidad) return 0;
  const rec = variante as unknown as Record<string, unknown>;
  const attrs = (variante.atributosVarianteJson ?? {}) as Record<
    string,
    unknown
  >;
  return Number(rec[campoCapacidad] ?? attrs[campoCapacidad] ?? 0);
}

/**
 * De `validos`, la variante de MENOR capacidad con `capacidad >= inputRequerido`.
 * Devuelve null si ninguna cubre (o la lista está vacía).
 */
export function seleccionarMenorCapacidadQueCumpla<
  T extends { atributosVarianteJson?: unknown },
>(validos: T[], campoCapacidad: string, inputRequerido: number): T | null {
  return (
    validos
      .map((v) => ({ v, cap: capacidadDeVariante(v, campoCapacidad) }))
      .filter((x) => x.cap >= inputRequerido)
      .sort((a, b) => a.cap - b.cap)[0]?.v ?? null
  );
}
