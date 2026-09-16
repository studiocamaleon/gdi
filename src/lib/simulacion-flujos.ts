import type { TableroItemData } from "./tablero-produccion";

/** El producto y sus componentes comparten flujo por ID de lote, no por nombre. */
export function contextoFlujoSimulacion(
  item: Pick<TableroItemData, "ordenId" | "ordenNumero" | "loteEntregaId" | "loteEntrega">,
) {
  const loteId = item.loteEntregaId ?? item.loteEntrega?.id;
  const loteNombre = loteId ? (item.loteEntrega?.nombre ?? "Lote") : null;
  return {
    flujoClave: loteId ? `orden:${item.ordenId}:lote:${loteId}` : `orden:${item.ordenId}`,
    flujoNombre: [item.ordenNumero, loteNombre].filter(Boolean).join(" · "),
    loteNombre,
  };
}

/** Inspeccionar un paso tiene prioridad sobre una búsqueda general de la OT. */
export function focoFlujosSimulacion<T extends { flujoClave: string }>(
  bloques: T[],
  hover: string | null,
  seleccionado: T | null,
  coincide?: (bloque: T) => boolean,
): Set<string> | null {
  if (hover) return new Set([hover]);
  if (seleccionado) return new Set([seleccionado.flujoClave]);
  if (coincide) return new Set(bloques.filter(coincide).map((b) => b.flujoClave));
  return null;
}
