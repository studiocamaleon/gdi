// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  PanelGeneralData,
  PanelGeneralEntrega,
} from "@/lib/panel-general-api";
import { Entregas } from "./panel-admin-entregas";
import { PanelAdminView } from "./panel-admin-view";

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
  expect(
    contenedor.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toContain("Atrasadas");
  expect(contenedor.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "1 de 1 producto o lote",
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

it("los indicadores abren su misma lista y explican el alcance del vendedor", async () => {
  const grupos: NonNullable<PanelGeneralData["entregas"]> = {
    hoy: { items: [], total: 0 },
    atrasada: {
      items: [entrega("ATRASADA", "atrasada", "2026-10-01")],
      total: 1,
    },
    proxima: { items: [], total: 0 },
    lista: { items: [entrega("LISTA", "lista", "2026-10-20")], total: 1 },
  };
  const data: PanelGeneralData = {
    alcanceEntregas: "propias",
    generadoEl: "2026-10-20T15:00:00Z",
    fechaLocal: "2026-10-20",
    entregas: grupos,
    atencion: [],
    atencionTotal: 0,
    taller: null,
    accionesRapidas: [],
    kpis: [
      {
        id: "entregas-hoy",
        etiqueta: "Pendientes para hoy",
        valor: 0,
        formato: "cantidad",
        tono: "ok",
        detalle: "Productos o lotes sin terminar para hoy",
        href: "/produccion/ordenes",
      },
      {
        id: "listos-retiro",
        etiqueta: "Listos para retirar",
        valor: 1,
        formato: "cantidad",
        tono: "neutro",
        detalle: "Terminados",
        href: "/produccion/ordenes",
      },
    ],
  };
  await act(async () =>
    root.render(
      <PanelAdminView
        data={data}
        nombre="Persona"
        fecha="20 oct"
        saludo="Buen día"
        actualizado="ahora"
        ahora={Date.parse(data.generadoEl)}
        cargando={false}
        error={null}
        abrir={vi.fn()}
      />,
    ),
  );
  expect(contenedor.textContent).toContain("Mostrando tus órdenes asignadas");
  const hoy = contenedor.querySelector<HTMLAnchorElement>(
    '[data-kind="entregas-hoy"]',
  )!;
  expect(hoy.getAttribute("href")).toBe("#entregas-priorizar");
  await act(async () => hoy.click());
  expect(
    contenedor.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toContain("Pendientes para hoy0");
  expect(contenedor.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "Sin trabajo pendiente para hoy",
  );
  await act(async () =>
    contenedor
      .querySelector<HTMLAnchorElement>('[data-kind="listos-retiro"]')!
      .click(),
  );
  expect(contenedor.querySelector('[role="tabpanel"]')?.textContent).toContain(
    "LISTA",
  );
});
