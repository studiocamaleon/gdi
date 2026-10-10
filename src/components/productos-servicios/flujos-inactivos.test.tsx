// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlujosInactivos } from "./flujos-inactivos";
import { ProductoEdicion } from "./producto-ui";
vi.mock("@/lib/productos-servicios-api", () => ({
  actualizarProductoRutaAlt: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { actualizarProductoRutaAlt } from "@/lib/productos-servicios-api";
import { toast } from "sonner";
let el: HTMLDivElement, root: Root;
const onCambio = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(actualizarProductoRutaAlt).mockResolvedValue({} as never);
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
async function montar(disabled = false) {
  await act(async () =>
    root.render(
      <ProductoEdicion disabled={disabled}>
        <FlujosInactivos
          flujos={[{ id: "flujo-ficticio", nombre: "Flujo anterior" }]}
          onCambio={onCambio}
        />
      </ProductoEdicion>,
    ),
  );
}
it("permite reactivar el flujo anterior y refresca el catálogo", async () => {
  await montar();
  await act(async () => el.querySelector<HTMLButtonElement>("button")!.click());
  expect(actualizarProductoRutaAlt).toHaveBeenCalledWith("flujo-ficticio", {
    activo: true,
  });
  expect(onCambio).toHaveBeenCalledOnce();
});
it("la vista de producto de sólo lectura no permite reactivarlo", async () => {
  await montar(true);
  await act(async () => el.querySelector<HTMLButtonElement>("button")!.click());
  expect(actualizarProductoRutaAlt).not.toHaveBeenCalled();
});
it("conserva el flujo y explica si no pudo reactivarlo", async () => {
  vi.mocked(actualizarProductoRutaAlt).mockRejectedValue(
    new Error("No se pudo reactivar"),
  );
  await montar();
  await act(async () => el.querySelector<HTMLButtonElement>("button")!.click());
  expect(onCambio).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith("No se pudo reactivar");
  expect(el.textContent).toContain("Flujo anterior");
});
