export type ModoTablero = "items" | "kanban";
/** Las preferencias retiradas vuelven al listado; Estaciones tiene su propia ruta. */
export function modoTableroGuardado(value: string | null): ModoTablero {
  return value === "kanban" ? "kanban" : "items";
}
