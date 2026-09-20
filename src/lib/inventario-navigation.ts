const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const inventoryId = (value: string | null | undefined) =>
  value && uuid.test(value) ? value : undefined;

export type InventoryContext = {
  materiaPrimaId?: string;
  varianteId?: string;
  almacenId?: string;
  ubicacionId?: string;
};

export function inventoryContext(
  params: Pick<URLSearchParams, "get">,
): InventoryContext {
  return Object.fromEntries(
    ["materiaPrimaId", "varianteId", "almacenId", "ubicacionId"].map((key) => [
      key,
      inventoryId(params.get(key)),
    ]),
  );
}

export function inventoryHref(
  view: "stock" | "movimientos",
  context: InventoryContext,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(context))
    if (inventoryId(value)) params.set(key, value!);
  return `/inventario/${view === "stock" ? "centro-stock" : "movimientos"}${params.size ? `?${params}` : ""}`;
}

export const INVENTORY_CHANGED = "grafo:inventario-actualizado";
export function notifyInventoryChanged() {
  window.dispatchEvent(new Event(INVENTORY_CHANGED));
}
