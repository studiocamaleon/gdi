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

function producto(familia: string): ProductoDetalle {
  return {
    id: "rigido",
    codigo: "RIG",
    nombre: "Rígido de prueba",
    activo: true,
    estructuraProducto: "SIMPLE",
    unidadComercial: "unidad",
    modoMedidas: "FIJA",
    medidaDefaultAnchoMm: "200",
    medidaDefaultAltoMm: "100",
    atributosComercialesJson: {
      geometriasComerciales: {
        version: 1,
        modo: "AMBAS",
        fuentes: [],
        permitirCotizacionManual: true,
      },
    },
    medidasPredefinidasJson: [],
    precioConfigJson: {},
    cargosDirectosCotizacion: [],
    pasosExtras: [],
    subcategoriaComercial: {
      codigo: "rigidos",
      nombre: "Rígidos",
      atributosSchemaJson: [],
      categoria: { codigo: "carteleria", nombre: "Cartelería" },
    },
    rutasAlternativas: [
      {
        id: "ruta",
        nombre: "Corte",
        esPreferida: true,
        ruta: { id: "base", codigo: "BASE", nombre: "Corte", pasos: [] },
        configPasos: [
          {
            id: "corte",
            rutaPasoId: "paso",
            rutaPaso: {
              id: "paso",
              orden: 1,
              activo: true,
              familiaCodigo: familia,
              herramientasCotizacion: ["diseno_vectorial"],
            },
            modoActivacion: "OBLIGATORIO",
            multiplicadoresActivos: [],
            paramsPasoJson: {},
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
  cargosDirectosCotizacion: [],
  cantidadEfectiva: 1,
  pasos: [],
  costos: { total: 100, unitario: 100 },
  precio: { precioTotal: 150, precioUnitario: 150 },
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


function lineal(familia = "plotter_corte") {
  const p = producto(familia);
  p.unidadComercial = "metro_lineal";
  p.modoMedidas = "LIBRE";
  p.atributosComercialesJson = {};
  p.rutasAlternativas[0].configPasos[0].rutaPaso.herramientasCotizacion = [];
  return p;
}
async function abrir(p: ProductoDetalle, extras = {}) {
  api.producto.mockResolvedValue(p);
  api.cotizar.mockImplementation(async ({ jobContext }) => ({
    exitoso: true, errores: [], cotizacion: {
      ...calculo,
      cantidadPedida: jobContext.cantidad,
      cantidadComercialReal: jobContext.metrosLineales ?? jobContext.cantidad,
    },
  }));
  await act(async () => root.render(<AgregarProductoSheet open onOpenChange={vi.fn()}
    productos={[p]} fechaEntregaDefault="2026-10-10" onAddItem={vi.fn()} {...extras} />));
  const opcion = el.querySelector<HTMLButtonElement>('button[role="option"]');
  if (opcion) await act(async () => opcion.click());
  await avanzarCalculo();
}
const input = () => el.querySelector<HTMLInputElement>('input[aria-label="Cantidad"]')!;
async function escribir(texto: string) {
  await act(async () => {
    const campo = input();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, texto);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const boton = (nombre: string) => [...el.querySelectorAll<HTMLButtonElement>("button")]
  .find(b => b.textContent?.trim() === nombre)!;

it.each(["plotter_corte", "impresion_por_area", "corte_manual"])(
  "%s permite escribir 0,5 metro paso a paso y preserva la fracción al cotizar", async (familia) => {
    await abrir(lineal(familia));
    for (const texto of ["", "0", "0,", "0,5"]) {
      await escribir(texto);
      expect(input().value).toBe(texto);
    }
    await avanzarCalculo();
    expect(api.cotizar.mock.lastCall?.[0].jobContext).toMatchObject({
      cantidad: 1, metrosLineales: 0.5, cantidadComercial: 0.5,
    });
  },
);

it("acepta punto, centésimas y los botones no eliminan la fracción", async () => {
  await abrir(lineal());
  for (const texto of ["0", "0.", "0.25"]) {
    await escribir(texto);
    expect(input().value).toBe(texto);
  }
  await avanzarCalculo();
  expect(api.cotizar.mock.lastCall?.[0].jobContext.metrosLineales).toBe(0.25);
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Aumentar cantidad"]')!.click());
  expect(input().value).toBe("0,35");
  await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Disminuir cantidad"]')!.click());
  expect(input().value).toBe("0,25");
});

it("guarda medio metro en la OT y al reabrir no lo reemplaza por la unidad técnica", async () => {
  const p = lineal();
  const agregar = vi.fn();
  await abrir(p, { onAddItem: agregar });
  await escribir("0,5");
  await avanzarCalculo();
  await act(async () => boton("Agregar a la OT").click());
  expect(agregar).toHaveBeenCalledOnce();
  const item = agregar.mock.calls[0][0];
  expect(item.cantidad).toBe(0.5);
  expect(item.jobContext).toMatchObject({ cantidad: 1, metrosLineales: 0.5 });
  await abrir(p, { editingItem: item });
  expect(input().value).toBe("0,5");
});

it("al vaciar la cantidad no cotiza un metro por defecto ni permite agregarlo", async () => {
  await abrir(lineal());
  api.cotizar.mockClear();
  await escribir("");
  await avanzarCalculo();
  expect(api.cotizar).not.toHaveBeenCalled();
  expect(boton("Agregar a la OT").disabled).toBe(true);
});


it("medio metro genera una sola franja de 500 mm y no media pieza", () => {
  const slots = [{ configPasoId: "corte", slotCodigo: "sustrato_principal", formula: "por_metro_lineal",
    candidatos: [{ defaultVarianteId: "rollo", variantes: [{ variantId: "rollo", anchoMm: 600 }] }],
  }] as Parameters<typeof buildJobContext>[3];
  const ctx = buildJobContext(lineal(), DEFAULT_MOTOR_CONFIG, 0.5, slots);
  expect(ctx.cantidad).toBe(1);
  expect(ctx.largoMaterialMm).toBe(500);
  expect(ctx.piezas).toEqual([{ cantidad: 1, anchoMm: 600, altoMm: 500 }]);
  expect(ctx.piezaAreaTotalM2).toBe(0.3);
});

it("conserva cantidades enteras en productos por unidad y no acepta negativos", async () => {
  const p = lineal();
  p.unidadComercial = "unidad";
  p.modoMedidas = "FIJA";
  await abrir(p);
  await escribir("2");
  for (const invalido of ["2,5", "-1", "1e3", "abc"]) {
    await escribir(invalido);
    expect(input().value).toBe("2");
  }
  await avanzarCalculo();
  expect(api.cotizar.mock.lastCall?.[0].jobContext.cantidad).toBe(2);
});

it("deja ingresar medio metro cuando se factura un mínimo sin quitar el aviso comercial", async () => {
  const p = lineal();
  p.minimoComercialPolitica = "ADVERTIR_FACTURAR_MINIMO";
  p.minimoComercialCantidad = "1";
  p.minimoComercialBase = "cantidad_comercial";
  await abrir(p);
  await escribir("0,5");
  await avanzarCalculo();
  expect(api.cotizar.mock.lastCall?.[0].jobContext.metrosLineales).toBe(0.5);
  expect(el.querySelector(".ap-minimum-alert")?.textContent).toContain("1");
  expect(boton("Agregar a la OT").disabled).toBe(false);
});
