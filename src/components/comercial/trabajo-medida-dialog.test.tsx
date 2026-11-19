// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { monedaDe } from "@/lib/monedas";
import { apiRequest } from "@/lib/api";
import type { PropuestaItem } from "@/lib/propuestas";
import { materialesDePrueba } from "@/app/dev/diseno/materiales-a-medida/materiales-de-prueba";
import { TrabajoMedidaDialog } from "./trabajo-medida-dialog";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const opciones = {
  moneda: monedaDe("ARS"),
  periodo: "2099-01",
  centros: [],
  maquinas: [],
  rutas: [],
};
const fechaEntrega = "2099-01-10";
const api = vi.mocked(apiRequest);
const props = {
  open: true,
  item: null,
  clienteId: null,
  fechaEntrega,
  onOpenChange: vi.fn(),
  onGuardar: vi.fn(),
};
let root: Root;
let el: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  el = document.body.appendChild(document.createElement("div"));
  root = createRoot(el);
  api.mockResolvedValue(opciones);
});

afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const render = (
  cambios: Partial<ComponentProps<typeof TrabajoMedidaDialog>> = {},
) =>
  act(async () => root.render(<TrabajoMedidaDialog {...props} {...cambios} />));
const campo = (id: string) =>
  document.querySelector<HTMLInputElement>(`#medida-${id}`)!;
const boton = (texto: string) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === texto,
  )!;
const editar = (id: string, valor: string) =>
  act(async () => {
    const input = campo(id);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const revisar = () => act(async () => boton("Revisar cálculo").click());
const resultado = (total: number) => ({
  resumen: {
    neto: total,
    impuestos: 0,
    total,
    costoTotal: 0,
    margen: total,
    contribucion: total,
  },
});

function pendiente() {
  let resolver!: (valor: unknown) => void;
  const promesa = new Promise((resolve) => {
    resolver = resolve;
  });
  api.mockReturnValueOnce(promesa);
  return (valor: unknown) => act(async () => resolver(valor));
}

it("mantiene el campo, el foco y la entrega elegida al actualizarse la ficha del mismo ítem", async () => {
  const item = { id: "item-de-prueba" } as PropuestaItem;
  await render({ item });
  const nombre = campo("nombre");
  await act(async () => nombre.focus());
  await editar("nombre", "Prueba en edición");
  await editar("entrega", "2099-02-01");
  await render({ item: { ...item }, fechaEntrega: "2099-03-01" });
  expect(campo("nombre")).toBe(nombre);
  expect(document.activeElement).toBe(nombre);
  expect(campo("nombre").value).toBe("Prueba en edición");
  expect(campo("entrega").value).toBe("2099-02-01");
  expect(api).toHaveBeenCalledTimes(1);
});

it("mantiene el resumen al recalcular y descarta importes si la revisión falla", async () => {
  await render();
  api.mockResolvedValueOnce(resultado(120));
  await revisar();
  const total = document.querySelectorAll("dd")[2];
  const valor = total.textContent;
  expect(valor).toContain("120");
  let rechazar!: (error: Error) => void;
  api.mockReturnValueOnce(
    new Promise((_, reject) => {
      rechazar = reject;
    }),
  );
  const accion = boton("Revisar cálculo");
  await act(async () => accion.focus());
  await revisar();
  expect(document.activeElement).toBe(accion);
  expect(accion.disabled).toBe(false);
  expect(document.querySelectorAll("dd")[2]).toBe(total);
  expect(total.textContent).toBe(valor);
  expect(boton("Agregar trabajo").disabled).toBe(true);
  await act(async () => rechazar(new Error("No se pudo revisar")));
  expect(total.textContent).toBe("—");
  expect(boton("Agregar trabajo").disabled).toBe(true);
});

it("permite corregir la cantidad mientras calcula y sólo habilita el resultado vigente", async () => {
  await render();
  const anterior = pendiente();
  await revisar();
  await editar("cantidad", "");
  expect(campo("cantidad").value).toBe("");
  await editar("cantidad", "2");
  const actual = pendiente();
  await revisar();
  await anterior(resultado(10));
  expect(boton("Calculando…").getAttribute("aria-disabled")).toBe("true");
  expect(boton("Agregar trabajo").disabled).toBe(true);
  await actual(resultado(20));
  expect(document.querySelectorAll("dd")[2].textContent).toContain("20");
  expect(boton("Agregar trabajo").disabled).toBe(false);
});

it("conserva el borrador y exige recalcular si cambia el cliente durante la revisión", async () => {
  await render();
  await editar("nombre", "Cartel de prueba");
  await editar("precio", "120");
  const terminar = pendiente();
  await revisar();
  await render({ clienteId: "otro-cliente-ficticio" });
  await terminar(resultado(120));
  expect(campo("nombre").value).toBe("Cartel de prueba");
  expect(campo("precio").value).toBe("120");
  expect(boton("Agregar trabajo").disabled).toBe(true);
  expect(
    api.mock.calls.filter(([url]) => url.endsWith("/opciones")),
  ).toHaveLength(1);
  api.mockResolvedValueOnce(resultado(100));
  await revisar();
  expect(JSON.parse(String(api.mock.lastCall?.[1]?.body)).clienteId).toBe(
    "otro-cliente-ficticio",
  );
  expect(boton("Agregar trabajo").disabled).toBe(false);
});

it("reabre con los datos nuevos aunque siga pendiente la consulta del trabajo anterior", async () => {
  const terminarCarga = pendiente();
  await render({ item: { id: "anterior" } as PropuestaItem });
  await render({ open: false });
  await render({ fechaEntrega: "2099-04-01" });
  await editar("nombre", "Nuevo trabajo");
  await terminarCarga(opciones);
  expect(campo("nombre").value).toBe("Nuevo trabajo");
  expect(campo("entrega").value).toBe("2099-04-01");
});

async function elegir(sku: string) {
  const busqueda = campo("inventario");
  await act(async () => busqueda.focus());
  await editar("inventario", sku);
  const opcion = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((n) => n.textContent?.includes(sku));
  expect(opcion).toBeDefined();
  await act(async () => opcion!.click());
}

it("suma fuentes por unidad y vinilo por superficie o longitud al importe del trabajo completo", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  api.mockImplementation(async (url) => {
    if (url.includes("opciones-stock"))
      return { data: materialesDePrueba, pages: 1 };
    if (url.endsWith("/calcular")) return resultado(500);
    return opciones;
  });
  await render();
  await act(async () => boton("Desglosar costos").click());
  await editar("materiales", "25");

  await elegir("FUE-12");
  expect(boton("Revisar cálculo").disabled).toBe(true);
  await editar("consumo", "3");
  await act(async () => boton("Sumar material").click());
  expect(campo("materiales").value).toBe("325");

  await elegir("VIN-120");
  await editar("consumo", "1.5");
  await act(async () => boton("Sumar material").click());
  expect(campo("materiales").value).toBe("505");

  await elegir("VIN-120");
  await act(async () => campo("unidad-consumo").click());
  const area = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((n) => n.textContent?.trim() === "m²");
  expect(area).toBeDefined();
  await act(async () => area!.click());
  await editar("consumo", "2.5");
  await act(async () => boton("Sumar material").click());
  expect(campo("materiales").value).toBe("755");
  await revisar();
  const request = JSON.parse(String(api.mock.lastCall?.[1]?.body));
  expect(request.costos.materiales).toBe(755);
  expect(request.costos.detalleMateriales).toMatch(
    /Fuente de prueba.*3 unidad.*300/,
  );
  expect(request.costos.detalleMateriales).toMatch(
    /Vinilo de prueba.*1,5 m lineal.*180/,
  );
  expect(request.costos.detalleMateriales).toMatch(
    /Vinilo de prueba.*2,5 m².*250/,
  );
});

it("impide sumar una variante sin precio y permite continuar con el costo manual", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  const fuente = materialesDePrueba[0];
  api.mockImplementation(async (url) =>
    url.includes("opciones-stock")
      ? {
          data: [
            {
              ...fuente,
              variantes: [{ ...fuente.variantes[0], precioReferencia: null }],
            },
          ],
          pages: 1,
        }
      : opciones,
  );
  await render();
  await act(async () => boton("Desglosar costos").click());
  await editar("materiales", "120");
  await elegir("FUE-12");
  expect(boton("Sumar material").disabled).toBe(true);
  expect(document.body.textContent).toContain("no tiene precio de referencia");
  await act(async () => boton("Descartar selección").click());
  expect(campo("materiales").value).toBe("120");
  expect(boton("Revisar cálculo").disabled).toBe(false);
});
