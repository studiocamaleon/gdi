// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import {
  AgregarProductoSheet,
  buildJobContext,
  DEFAULT_MOTOR_CONFIG,
} from "./agregar-producto-sheet";

const api = vi.hoisted(() => ({ cotizar: vi.fn(), producto: vi.fn() }));
vi.mock("./tipo-cambio-documento", () => ({
  useMotorConTipoCambio: () => ({
    cotizar: api.cotizar,
    cotizarEnSegundoPlano: api.cotizar,
  }),
}));
vi.mock("@/lib/productos-servicios-api", async (original) => ({
  ...(await original<typeof import("@/lib/productos-servicios-api")>()),
  getProductoById: api.producto,
  getCatalogoFamilias: async () => ({ familias: [] }),
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => false,
}));
vi.mock("@/hooks/use-receta-cotizacion", () => ({
  useRecetaCotizacion: () => null,
}));
vi.mock("@/components/nesting/plan-lotes-cotizacion", () => ({
  PlanLotesCotizacion: () => null,
}));
vi.mock("./producto-sheet-header", () => ({
  ProductoSheetHeaderConstelacion: () => null,
}));

function producto(modo = "OPCIONAL"): ProductoDetalle {
  return {
    id: "vinilo",
    codigo: "VIN",
    nombre: "Ploteo de prueba",
    activo: true,
    estructuraProducto: "SIMPLE",
    unidadComercial: "m2",
    modoMedidas: "FIJA",
    medidaDefaultAnchoMm: "1000",
    medidaDefaultAltoMm: "12000",
    atributosComercialesJson: {},
    medidasPredefinidasJson: [],
    precioConfigJson: {},
    cargosDirectosCotizacion: [],
    pasosExtras: [],
    subcategoriaComercial: {
      codigo: "vinilos",
      nombre: "Vinilos",
      atributosSchemaJson: [],
      categoria: { codigo: "carteleria", nombre: "Cartelería" },
    },
    rutasAlternativas: [
      {
        id: "ruta",
        nombre: "Estándar",
        esPreferida: true,
        ruta: { id: "base", codigo: "BASE", nombre: "Ploteo", pasos: [] },
        configPasos: [
          {
            id: "desploteo",
            rutaPasoId: "paso",
            nombreVisible: "Desploteo",
            modoTiempo: "T-2",
            rutaPaso: {
              id: "paso",
              orden: 1,
              activo: true,
              familiaCodigo: "trabajo_manual",
            },
            modoActivacion: modo,
            multiplicadoresActivos: [],
            paramsPasoJson: {
              productivityQuantitySource: "cantidad_manual",
              productivityValue: 8,
              cantidadManual: {
                etiqueta: "Superficie a desplotear",
                unidad: "m²",
              },
            },
            maquinaM1: null,
            perfilM1: null,
            cargosDirectosPaso: [],
            slotsMateriales: [],
          },
        ],
      },
    ],
  } as unknown as ProductoDetalle;
}
const calculo = {
  cantidadEfectiva: 1,
  pasos: [],
  costos: { total: 35000, unitario: 35000 },
  precio: { precioTotal: 70000, precioUnitario: 70000 },
  cargosDirectosCotizacion: [],
};
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
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
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const avanzarCalculo = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
const boton = (texto: string) =>
  [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.includes(texto),
  )!;

it("separa las medidas y conserva la cantidad del paso en el snapshot", () => {
  const ctx = buildJobContext(
    producto(),
    {
      ...DEFAULT_MOTOR_CONFIG,
      cantidadManualPorPaso: { desploteo: 5 },
      opcionalesActivados: { desploteo: true },
    },
    1,
    [],
  );
  expect(ctx.cantidadManual_desploteo).toBe(5);
  expect(ctx.piezaAreaTotalM2).toBe(12);
});
it("sólo exige el campo activo, recotiza al cambiarlo y lo conserva al agregar", async () => {
  const p = producto();
  api.producto.mockResolvedValue(p);
  api.cotizar.mockResolvedValue({
    exitoso: true,
    cotizacion: calculo,
    errores: [],
  });
  const agregar = vi.fn();
  await act(async () =>
    root.render(
      <AgregarProductoSheet
        open
        onOpenChange={vi.fn()}
        productos={[p]}
        fechaEntregaDefault="2099-12-01"
        onAddItem={agregar}
      />,
    ),
  );
  await act(async () =>
    el.querySelector<HTMLButtonElement>('button[role="option"]')!.click(),
  );
  await avanzarCalculo();
  const input = () =>
    el.querySelector<HTMLInputElement>(
      'input[placeholder="Ingresá la cantidad total del paso"]',
    );
  expect(input()).toBeNull();
  await act(async () => boton("Desploteo").click());
  await avanzarCalculo();
  expect(input()).not.toBeNull();
  expect(boton("Guardar y agregar otro").disabled).toBe(true);
  const escribir = async (valor: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input(), valor);
      input()!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await escribir("5");
  await avanzarCalculo();
  expect(
    api.cotizar.mock.lastCall?.[0].jobContext.cantidadManual_desploteo,
  ).toBe(5);
  expect(boton("Guardar y agregar otro").disabled).toBe(false);
  await escribir("");
  await avanzarCalculo();
  expect(boton("Guardar y agregar otro").disabled).toBe(true);
  await escribir("5");
  await avanzarCalculo();
  await act(async () => boton("Guardar y agregar otro").click());
  expect(agregar).toHaveBeenCalledOnce();
  const guardado = agregar.mock.calls[0][0];
  expect(guardado.jobContext.cantidadManual_desploteo).toBe(5);
  await act(async () =>
    root.render(
      <AgregarProductoSheet
        open
        onOpenChange={vi.fn()}
        productos={[p]}
        editingItem={guardado}
        fechaEntregaDefault="2099-12-01"
        onAddItem={agregar}
        onSaveItem={vi.fn()}
      />,
    ),
  );
  await avanzarCalculo();
  expect(input()?.value).toBe("5");
});

it("muestra y exige una cantidad arrastrada sin guardar el arrastre como elección del usuario", async () => {
  const p = producto();
  const ruta = p.rutasAlternativas[0];
  ruta.configPasos.push({ ...ruta.configPasos[0], id: "instalacion", nombreVisible: "Instalación",
    rutaPasoId: "paso-instalacion", rutaPaso: { ...ruta.configPasos[0].rutaPaso, id: "paso-instalacion", orden: 2 },
    paramsPasoJson: {}, requiereRutaPasoIds: ["paso"] });
  api.producto.mockResolvedValue(p);
  api.cotizar.mockResolvedValue({ exitoso: true, cotizacion: calculo, errores: [] });
  await act(async () => root.render(<AgregarProductoSheet open onOpenChange={vi.fn()} productos={[p]} fechaEntregaDefault="2099-12-01" onAddItem={vi.fn()} />));
  await act(async () => el.querySelector<HTMLButtonElement>('button[role="option"]')!.click());
  await avanzarCalculo();
  await act(async () => boton("Instalación").click());
  await avanzarCalculo();
  expect(el.querySelector('input[placeholder="Ingresá la cantidad total del paso"]')).not.toBeNull();
  expect(boton("Guardar y agregar otro").disabled).toBe(true);
  const ctx = buildJobContext(p, { ...DEFAULT_MOTOR_CONFIG, opcionalesActivados: { instalacion: true }, cantidadManualPorPaso: { desploteo: 5 } }, 1, []);
  expect(ctx.opcionalesActivados).toEqual({ instalacion: true });
  expect(ctx.cantidadManual_desploteo).toBe(5);
});

it("muestra la cantidad condicional y deja de exigirla cuando otro paso la excluye", async () => {
  const p = producto("CONDICIONAL");
  const ruta = p.rutasAlternativas[0];
  const paso = ruta.configPasos[0];
  paso.condicionActivacionJson = { "==": [{ var: "pasoActivo_paso-diseno" }, 0] };
  ruta.configPasos.push({ ...paso, id: "diseno", nombreVisible: "Diseño",
    rutaPasoId: "paso-diseno", rutaPaso: { ...paso.rutaPaso, id: "paso-diseno", orden: 2 },
    modoActivacion: "OPCIONAL", condicionActivacionJson: null, paramsPasoJson: {} });
  api.producto.mockResolvedValue(p);
  api.cotizar.mockResolvedValue({ exitoso: true, cotizacion: calculo, errores: [] });
  await act(async () => root.render(<AgregarProductoSheet open onOpenChange={vi.fn()} productos={[p]} fechaEntregaDefault="2099-12-01" onAddItem={vi.fn()} />));
  await act(async () => el.querySelector<HTMLButtonElement>('button[role="option"]')!.click());
  await avanzarCalculo();
  const input = () => el.querySelector('input[placeholder="Ingresá la cantidad total del paso"]');
  expect(input()).not.toBeNull();
  expect(boton("Guardar y agregar otro").disabled).toBe(true);
  await act(async () => boton("Diseño").click());
  await avanzarCalculo();
  expect(input()).toBeNull();
  expect(boton("Guardar y agregar otro").disabled).toBe(false);
  await act(async () => boton("Diseño").click());
  await avanzarCalculo();
  expect(input()).not.toBeNull();
  expect(boton("Guardar y agregar otro").disabled).toBe(true);
});
