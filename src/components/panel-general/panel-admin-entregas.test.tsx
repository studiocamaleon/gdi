// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  PanelGeneralData,
  PanelGeneralEntrega,
} from "@/lib/panel-general-api";
import { Entregas } from "./panel-admin-entregas";

let root: Root;
let contenedor: HTMLDivElement;
const animacionesOriginal = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getAnimations",
);
beforeEach(() => {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  if (animacionesOriginal)
    Object.defineProperty(
      Element.prototype,
      "getAnimations",
      animacionesOriginal,
    );
  else Reflect.deleteProperty(Element.prototype, "getAnimations");
  vi.unstubAllGlobals();
});
const entrega = (
  id: string,
  riesgo: PanelGeneralEntrega["riesgo"],
  fechaEntrega: string | null,
): PanelGeneralEntrega => ({
  id,
  numero: id,
  cliente: "Cliente ficticio",
  producto: "Impresión ficticia",
  productos: [],
  fechaEntrega,
  progresoPct: null,
  riesgo,
  pasoActual: null,
  estacionActual: null,
  href: `/produccion/ordenes/${id}`,
});
async function tab(nombre: string) {
  const boton = Array.from(
    contenedor.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((b) => b.textContent?.startsWith(nombre));
  expect(boton).toBeDefined();
  await act(async () => boton!.click());
}
it("separa las finalizadas para retirar sin marcarlas atrasadas ni inventar avance", async () => {
  const grupos: NonNullable<PanelGeneralData["entregas"]> = {
    hoy: { items: [], total: 0 },
    atrasada: {
      items: [entrega("OT-PENDIENTE", "atrasada", "2026-10-01")],
      total: 1,
    },
    proxima: { items: [], total: 0 },
    lista: {
      items: [
        entrega("OT-LISTA", "lista", "2026-10-01"),
        entrega("OT-SIN-FECHA", "lista", null),
      ],
      total: 2,
    },
  };
  await act(async () =>
    root.render(<Entregas grupos={grupos} abrir={vi.fn()} />),
  );
  await tab("Para retirar");
  const panel = contenedor.querySelector('[role="tabpanel"]')!;
  expect(panel.textContent).toContain("OT-LISTA");
  expect(panel.textContent).toContain("OT-SIN-FECHA");
  expect(panel.textContent).toContain("Lista para retirar");
  expect(panel.textContent).toContain("Sin fecha de entrega");
  expect(panel.textContent).not.toContain("Atrasada");
  expect(panel.querySelector('[role="progressbar"]')).toBeNull();
  expect(panel.querySelector("time")?.getAttribute("datetime")).toBe(
    "2026-10-01",
  );
  await tab("Atrasadas");
  expect(contenedor.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "OT-PENDIENTE",
  );
  expect(
    contenedor.querySelector('[role="tabpanel"]')?.textContent,
  ).not.toContain("OT-LISTA");
});
