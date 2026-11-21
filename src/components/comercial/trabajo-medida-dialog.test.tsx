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
  estaciones: [{ id: "estacion-taller", nombre: "Taller de prueba" }],
  rutas: [
    {
      id: "ruta-prueba",
      nombre: "Ruta de prueba",
      pasos: [
        {
          id: "paso-ruta",
          nombre: "Diseño de prueba",
          familiaCodigo: "trabajo_manual",
        },
      ],
    },
  ],
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
  vi.stubGlobal("CSS", { escape: (value: string) => value });
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
const editarInput = (input: HTMLInputElement, valor: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const editar = (id: string, valor: string) => editarInput(campo(id), valor);
const materialesAgregados = () =>
  document.querySelector<HTMLElement>(
    'section[aria-label="Materiales agregados"]',
  );
async function agregarCostoManual(nombre: string, importe: string) {
  await act(async () => boton("Agregar otro costo").click());
  await editarInput(
    document.querySelector<HTMLInputElement>("#gasto-0")!,
    nombre,
  );
  await editarInput(
    document.querySelector<HTMLInputElement>("#importe-0")!,
    importe,
  );
}
async function seleccionar(campo: string, opcion: string) {
  const label = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === campo,
  )!;
  const control = document.getElementById(label.htmlFor)!;
  await act(async () => control.click());
  const fila = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((o) => o.textContent === opcion);
  expect(fila).toBeDefined();
  await act(async () => fila!.click());
}
const elegirRuta = () => seleccionar("Ruta de producción", "Ruta de prueba");
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
  await elegirRuta();
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
  await elegirRuta();
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
  await elegirRuta();
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

it("desglosa materiales por unidad, superficie y longitud y admite costos manuales por separado", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  api.mockImplementation(async (url) => {
    if (url.includes("opciones-stock"))
      return { data: materialesDePrueba, pages: 1 };
    if (url.endsWith("/calcular")) return resultado(500);
    return opciones;
  });
  await render();
  await elegirRuta();
  await act(async () => boton("Desglosar costos").click());
  expect(campo("costo-total")).toBeNull();
  expect(campo("materiales")).toBeNull();
  expect(materialesAgregados()).toBeNull();
  await agregarCostoManual("Flete", "25");

  await elegir("FUE-12");
  expect(boton("Revisar cálculo").disabled).toBe(false);
  await editar("consumo", "3");
  await act(async () => boton("Sumar material").click());
  expect(materialesAgregados()?.textContent).toContain("$ 300,00");

  await elegir("VIN-120");
  await editar("consumo", "1.5");
  await act(async () => boton("Sumar material").click());
  expect(materialesAgregados()?.textContent).toContain("$ 480,00");

  await elegir("VIN-120");
  await act(async () => campo("unidad-consumo").click());
  const area = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((n) => n.textContent?.trim() === "m²");
  expect(area).toBeDefined();
  await act(async () => area!.click());
  await editar("consumo", "2.5");
  await revisar();
  expect(materialesAgregados()?.textContent).toContain("$ 730,00");
  expect(boton("Sumar material")).toBeUndefined();
  expect(boton("Agregar trabajo").disabled).toBe(false);
  const request = JSON.parse(String(api.mock.lastCall?.[1]?.body));
  expect(request.costos.materiales).toBe(730);
  expect(request.costos.otros).toEqual([{ nombre: "Flete", costo: 25 }]);
  expect(request.costos.detalleMateriales).toMatch(
    /Fuente de prueba.*3 unidad.*300/,
  );
  expect(request.costos.detalleMateriales).toMatch(
    /Vinilo de prueba.*1,5 m lineal.*180/,
  );
  expect(request.costos.detalleMateriales).toMatch(
    /Vinilo de prueba.*2,5 m².*250/,
  );
  await revisar();
  expect(JSON.parse(String(api.mock.lastCall?.[1]?.body)).costos).toEqual(
    request.costos,
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
  await elegirRuta();
  await act(async () => boton("Desglosar costos").click());
  await agregarCostoManual("Instalación", "120");
  await elegir("FUE-12");
  expect(boton("Sumar material").disabled).toBe(true);
  expect(document.body.textContent).toContain("no tiene precio de referencia");
  await revisar();
  expect(api.mock.calls.some(([url]) => url.endsWith("/calcular"))).toBe(false);
  expect(boton("Agregar trabajo").disabled).toBe(true);
  await act(async () => boton("Descartar selección").click());
  expect(materialesAgregados()).toBeNull();
  expect(document.querySelector<HTMLInputElement>("#importe-0")?.value).toBe(
    "120",
  );
  expect(boton("Revisar cálculo").disabled).toBe(false);
});

it("permite corregir la cantidad y reintentar un cálculo fallido sin duplicar el material", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  api.mockImplementation(async (url) => {
    if (url.includes("opciones-stock"))
      return { data: materialesDePrueba, pages: 1 };
    if (url.endsWith("/calcular")) return resultado(500);
    return opciones;
  });
  await render();
  await elegirRuta();
  await act(async () => boton("Desglosar costos").click());
  await elegir("FUE-12");
  await editar("consumo", "0");
  await revisar();
  expect(api.mock.calls.some(([url]) => url.endsWith("/calcular"))).toBe(false);
  expect(document.body.textContent).toContain(
    "Ingresá una cantidad mayor que cero.",
  );
  expect(materialesAgregados()).toBeNull();

  await editar("consumo", "3");
  api.mockRejectedValueOnce(new Error("Cálculo interrumpido"));
  await revisar();
  expect(document.body.textContent).toContain("Cálculo interrumpido");
  expect(boton("Agregar trabajo").disabled).toBe(true);
  await revisar();
  const intentos = api.mock.calls
    .filter(([url]) => url.endsWith("/calcular"))
    .map(([, init]) => JSON.parse(String(init?.body)).costos);
  expect(intentos).toHaveLength(2);
  expect(intentos[0]).toEqual(intentos[1]);
  expect(intentos[1].materiales).toBe(300);
  expect(boton("Agregar trabajo").disabled).toBe(false);
});

it("conserva los materiales de un trabajo anterior y permite volver del costo total al desglose", async () => {
  const costos = {
    materiales: 150,
    detalleMateriales: "PVC de prueba",
    otros: [{ nombre: "Flete", costo: 20 }],
  };
  api.mockImplementation(async (url) => {
    if (url.endsWith("/guardado"))
      return {
        nombre: "Cartel de prueba",
        descripcion: "",
        cantidad: 1,
        unidad: "unidad",
        precio: 500,
        basePrecio: "TOTAL",
        tipoPrecio: "FINAL",
        categoriaFiscal: "general",
        costos,
        produccion: false,
        operaciones: [],
      };
    if (url.includes("opciones-stock")) return { data: [], pages: 1 };
    if (url.endsWith("/calcular")) return resultado(500);
    return opciones;
  });
  await render({
    item: { id: "local", cotizacionItemId: "guardado" } as PropuestaItem,
  });
  await elegirRuta();
  expect(materialesAgregados()?.textContent).toContain("PVC de prueba");
  expect(materialesAgregados()?.textContent).toContain("$ 150,00");
  expect(campo("materiales")).toBeNull();
  await revisar();
  expect(JSON.parse(String(api.mock.lastCall?.[1]?.body)).costos).toEqual(
    costos,
  );

  await act(async () => boton("Costo total").click());
  await editar("costo-total", "480");
  expect(boton("Agregar otro costo")).toBeUndefined();
  expect(materialesAgregados()).toBeNull();
  await revisar();
  expect(JSON.parse(String(api.mock.lastCall?.[1]?.body)).costos).toEqual({
    modo: "TOTAL",
    totalEstimado: 480,
    materiales: 0,
    otros: [],
  });
  await act(async () => boton("Desglosar costos").click());
  expect(materialesAgregados()?.textContent).toContain("PVC de prueba");
  await act(async () => boton("Quitar materiales").click());
  expect(materialesAgregados()).toBeNull();
  await revisar();
  expect(JSON.parse(String(api.mock.lastCall?.[1]?.body)).costos).toEqual({
    modo: "DESGLOSADO",
    materiales: 0,
    detalleMateriales: "",
    otros: costos.otros,
  });
});

it("pide estación sólo en los pasos agregados manualmente y exige ruta antes de calcular", async () => {
  await render();
  expect(document.body.textContent).not.toContain("Sin seguimiento");
  await revisar();
  expect(document.body.textContent).toContain(
    "al menos un paso manual con estación",
  );
  expect(api.mock.calls.some(([url]) => url.endsWith("/calcular"))).toBe(false);
  await elegirRuta();
  expect(
    [...document.querySelectorAll("label")].some(
      (l) => l.textContent === "Estación",
    ),
  ).toBe(false);
  await act(async () => boton("Agregar paso").click());
  await revisar();
  expect(document.body.textContent).toContain("Elegí la estación del paso 2.");
  expect(api.mock.calls.some(([url]) => url.endsWith("/calcular"))).toBe(false);
  await seleccionar("Estación", "Taller de prueba");
  api.mockResolvedValueOnce(resultado(120));
  await revisar();
  const request = JSON.parse(String(api.mock.lastCall?.[1]?.body));
  expect(request.produccion).toBe(true);
  expect(request.operaciones[0]).toMatchObject({ clave: "paso-ruta" });
  expect(request.operaciones[1]).toMatchObject({
    estacionId: "estacion-taller",
  });
  expect(boton("Agregar trabajo").disabled).toBe(false);
});
