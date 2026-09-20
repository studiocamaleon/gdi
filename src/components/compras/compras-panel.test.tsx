// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ComprasPanel } from "./compras-panel";
import type { CompraForm } from "./compra-form";

const mocks = vi.hoisted(() => ({ form: vi.fn(), canManage: true }));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => mocks.canManage,
}));
vi.mock("@/components/design-system/appearance", () => ({
  useDesignScope: () => ({}),
  useDesignTheme: () => "",
}));
vi.mock("@/components/design-system/navigation-tab-list", () => ({
  NavigationTabList: () => null,
}));
vi.mock("./compra-form", () => ({
  CompraForm: (props: ComponentProps<typeof CompraForm>) => {
    mocks.form(props);
    return null;
  },
}));
vi.mock("@/components/inventario/use-stock-page", () => ({
  useInventoryPage: () => ({
    loading: false,
    error: null,
    refresh: vi.fn(),
    result: {
      catalogo: {
        variantes: [
          { id: "v", materiaPrima: { nombre: "Tinta" }, ofertasCompra: [] },
        ],
      },
      necesidades: {
        total: 3,
        pageSize: 50,
        data: [
          {
            id: "n1",
            varianteId: "v",
            nombre: "Cian",
            orden: { id: "o1", numero: "OT-1" },
            porCubrir: 4.05,
            pendiente: 4.05,
            unidad: "ML",
            libre: 0,
            enCompra: 0,
            compras: [],
          },
          {
            id: "n2",
            varianteId: "v",
            nombre: "Cian",
            orden: { id: "o2", numero: "OT-2" },
            porCubrir: 10,
            pendiente: 10,
            unidad: "ML",
            libre: 0,
            enCompra: 0,
            compras: [],
          },
          {
            id: "n3",
            varianteId: "v",
            nombre: "Cian",
            orden: { id: "o3", numero: "OT-3" },
            porCubrir: 0,
            pendiente: 0,
            unidad: "ML",
            libre: 0,
            enCompra: 0,
            compras: [],
          },
        ],
      },
    },
  }),
}));
let root: Root, container: HTMLDivElement;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.form.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ComprasPanel />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("permite elegir y quitar materiales con el checkbox real, y preparar las OT seleccionadas", async () => {
  // No se simula HeroUI: este test detecta si falta Checkbox.Content.
  const boxes = container.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  expect(boxes).toHaveLength(3);
  const preparar = () =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Preparar compra"),
    )!;
  expect(preparar().disabled).toBe(true);
  await act(async () => boxes[0].click());
  expect(boxes[0].checked).toBe(true);
  expect(preparar().textContent).toContain("(1)");
  await act(async () => boxes[1].click());
  expect(preparar().textContent).toContain("(2)");
  await act(async () => boxes[0].click());
  expect(boxes[0].checked).toBe(false);
  expect(preparar().textContent).toContain("(1)");
  expect(boxes[2].disabled).toBe(true);
  await act(async () => preparar().click());
  expect(mocks.form.mock.lastCall?.[0].necesidades).toEqual([
    expect.objectContaining({ id: "n2", orden: { id: "o2", numero: "OT-2" } }),
  ]);
});
