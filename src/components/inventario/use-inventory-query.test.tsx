// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInventoryQuery } from "./use-inventory-query";

// La transición de Next todavía no entregó los nuevos searchParams.
vi.mock("next/navigation", () => ({
  usePathname: () => "/inventario/centro-stock",
  useSearchParams: () => new URLSearchParams(),
}));
let state: ReturnType<typeof useInventoryQuery>;
let root: Root;
let container: HTMLDivElement;
const varianteId = "6d7f887a-d578-4e6d-9805-bee6fa149891";
const almacenId = "37f9f9e7-b47c-4b39-af60-191c1ce663c5";
function Probe() {
  const query = useInventoryQuery();
  useEffect(() => {
    state = query;
  }, [query]);
  return <span>{query.varianteId}</span>;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/inventario/centro-stock?page=3");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("sincronización inmediata de filtros de inventario", () => {
  it("actualiza la variante visible sin esperar al router y reinicia la página", async () => {
    await act(async () => {
      state.update({ varianteId });
    });
    expect(container.textContent).toBe(varianteId);
    expect(state.page).toBe(1);
    expect(new URLSearchParams(window.location.search).get("varianteId")).toBe(
      varianteId,
    );
  });
  it("conserva cambios rápidos de dos filtros antes del siguiente render", async () => {
    await act(async () => {
      state.update({ varianteId });
      state.update({ almacenId });
    });
    expect(state).toMatchObject({ varianteId, almacenId });
    await act(async () => {
      state.update({ page: "2" }, false);
    });
    expect(state).toMatchObject({ varianteId, almacenId, page: 2 });
  });
  it("restaura los filtros cuando se navega por el historial del navegador", async () => {
    await act(async () => {
      window.history.replaceState(
        null,
        "",
        `/inventario/centro-stock?varianteId=${varianteId}&page=2`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(state).toMatchObject({ varianteId, page: 2 });
  });
});
