import { describe, expect, it } from "vitest";
import { inventoryContext, inventoryHref } from "./inventario-navigation";

describe("navegación entre ficha, stock e historial", () => {
  const context = {
    materiaPrimaId: "30e9ccfe-9119-4e48-9e2e-ff462a166492",
    varianteId: "6d7f887a-d578-4e6d-9805-bee6fa149891",
    almacenId: "37f9f9e7-b47c-4b39-af60-191c1ce663c5",
    ubicacionId: "c7c1bba4-8c13-4154-971a-46af02a60f65",
  };
  it.each(["stock", "movimientos"] as const)(
    "conserva todo el contexto al abrir %s",
    (view) => {
      const url = new URL(inventoryHref(view, context), "https://grafo.test");
      expect(inventoryContext(url.searchParams)).toEqual(context);
      expect(url.pathname).toBe(
        `/inventario/${view === "stock" ? "centro-stock" : view}`,
      );
    },
  );
  it("descarta identificadores inválidos sin convertirlos en filtros de API", () => {
    const parsed = inventoryContext(
      new URLSearchParams("varianteId=undefined&almacenId=all&ubicacionId="),
    );
    expect(Object.values(parsed).every((value) => value === undefined)).toBe(
      true,
    );
    expect(inventoryHref("stock", parsed)).toBe("/inventario/centro-stock");
  });
});
