import type { SimulacionItem } from './motor/flujo-produccion';
type Trabajo = {
  id: string;
  parentItemId: string | null;
  contieneLotesEntrega: boolean;
  loteEntregaId: string | null;
};

export function descendientesEntrega<T extends Trabajo>(
  items: T[],
  raiz: T,
): T[] {
  const ids = new Set([raiz.id]);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const i of items)
      if (i.parentItemId && ids.has(i.parentItemId) && !ids.has(i.id)) {
        ids.add(i.id);
        cambio = true;
      }
  }
  return items.filter((i) => ids.has(i.id));
}

/** Sólo agrega fechas de disponibilidad. Nunca agrega operaciones/carga otra vez. */
export function agregarEtaEntregas(
  porItem: Map<string, SimulacionItem>,
  items: Trabajo[],
) {
  const originales = new Map(porItem);
  for (const raiz of items.filter(
    (i) => i.contieneLotesEntrega || i.loteEntregaId,
  )) {
    const resultados = descendientesEntrega(items, raiz)
      .filter((i) => !i.contieneLotesEntrega)
      .map((i) => originales.get(i.id));
    if (!resultados.length) continue;
    const incompleto = resultados.some((r) => !r?.finEstimado);
    porItem.set(raiz.id, {
      finEstimado: incompleto
        ? null
        : new Date(
            Math.max(...resultados.map((r) => r!.finEstimado!.getTime())),
          ),
      sinEstimar: resultados.some((r) => !r || r.sinEstimar),
      parcial: resultados.some((r) => r?.parcial),
      asumeDesbloqueo: resultados.some((r) => r?.asumeDesbloqueo),
    });
  }
  return porItem;
}
