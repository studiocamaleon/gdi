import type { ModoTablero } from "./tablero-modos";

/** Los accesos a una estación abren Lista sin cambiar la vista predeterminada. */
export function modoTableroEnUrl(params: Pick<URLSearchParams, "get">): ModoTablero | null {
  const vista = params.get("vista");
  if (vista === "lista") return "items";
  if (vista === "kanban") return "kanban";
  return params.get("estacion") || params.get("estado") === "blocked" ? "items" : null;
}

export function urlTableroEstacion(estacionId: string, modo: ModoTablero = "items", busqueda = "") {
  const params = new URLSearchParams(busqueda);
  if (estacionId) params.set("estacion", estacionId);
  else params.delete("estacion");
  params.set("vista", modo === "items" ? "lista" : "kanban");
  return `/produccion/tablero?${params.toString()}`;
}
