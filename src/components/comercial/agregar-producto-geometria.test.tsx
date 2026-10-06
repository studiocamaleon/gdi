// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import type { CotizarResponse } from "@/lib/productos-servicios-api";
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

it.each(["cnc", "troquelado_digital", "corte_laser"])(
  "%s cambia entre modalidades sin mezclar medidas, archivo ni placas",
  async (familia) => {
    const p = producto(familia);
    api.producto.mockResolvedValue(p);
    api.cotizar.mockResolvedValue({
      exitoso: true,
      cotizacion: calculo,
      errores: [],
    } as unknown as CotizarResponse);
    await act(async () =>
      root.render(
        <AgregarProductoSheet
          open
          onOpenChange={vi.fn()}
          productos={[p]}
          fechaEntregaDefault="2026-09-30"
          onAddItem={vi.fn()}
        />,
      ),
    );
    await act(async () =>
      el.querySelector<HTMLButtonElement>('button[role="option"]')!.click(),
    );
    await avanzarCalculo();
    const modo = (texto: string) =>
      [
        ...el.querySelectorAll<HTMLButtonElement>(
          '[aria-label="Geometría del producto"] button',
        ),
      ].find((b) => b.textContent === texto)!;
    expect(modo("Rectangular").getAttribute("aria-pressed")).toBe("true");
    expect(
      api.cotizar.mock.lastCall?.[0].jobContext.modoCotizacionVectorial,
    ).toBe("medidas");
    await act(async () => modo("Por placas").click());
    await avanzarCalculo();
    expect(modo("Por placas").getAttribute("aria-pressed")).toBe("true");
    expect(modo("Archivo SVG / DXF").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(el.textContent).toContain("Placas totales del trabajo");
    expect(el.textContent).toContain("Entradas de corte por placa");
    const manual = api.cotizar.mock.lastCall?.[0].jobContext;
    expect(manual.modoCotizacionVectorial).toBe("placas");
    expect(manual.placasVectorialesManuales).toBeGreaterThan(0);
    expect(manual.piezas).toBeUndefined();
    expect(manual.medidaCustomMm).toBeUndefined();
    expect(manual.disenoVectorialFuente).toBeUndefined();
    await act(async () => modo("Archivo SVG / DXF").click());
    expect(modo("Archivo SVG / DXF").getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelector("#vector-manual-plates")).toBeNull();
    await act(async () => modo("Rectangular").click());
    await avanzarCalculo();
    const rectangular = api.cotizar.mock.lastCall?.[0].jobContext;
    expect(rectangular.modoCotizacionVectorial).toBe("medidas");
    expect(rectangular.placasVectorialesManuales).toBeUndefined();
    expect(rectangular.metrosCortePorPlacaVectorial).toBeUndefined();
    expect(rectangular.entradasCortePorPlacaVectorial).toBeUndefined();
  },
);

it("ofrece importar PDF automáticamente sólo al ingresar piezas rectangulares libres", async () => {
  const p = producto("cnc");
  p.modoMedidas = "LIBRE";
  p.dimensionesRequeridas = ["ANCHO", "ALTO"];
  api.producto.mockResolvedValue(p);
  api.cotizar.mockResolvedValue({
    exitoso: true,
    cotizacion: calculo,
    errores: [],
  });
  await act(async () =>
    root.render(
      <AgregarProductoSheet
        open
        onOpenChange={vi.fn()}
        productos={[p]}
        fechaEntregaDefault="2026-09-30"
        onAddItem={vi.fn()}
      />,
    ),
  );
  await act(async () =>
    el.querySelector<HTMLButtonElement>('button[role="option"]')!.click(),
  );
  expect(el.textContent).toContain("Importar medidas desde PDF");
  const modo = (texto: string) =>
    [
      ...el.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Geometría del producto"] button',
      ),
    ].find((b) => b.textContent === texto)!;
  await act(async () => modo("Por placas").click());
  expect(el.textContent).not.toContain("Importar medidas desde PDF");
  await act(async () => modo("Rectangular").click());
  expect(el.textContent).toContain("Importar medidas desde PDF");
});

it("el sello se activa por fabricación y cuerpo y se oculta al cambiar a una ruta de reventa", async () => {
  const p = producto("pre_prensa");
  p.atributosComercialesJson = {};
  const ruta = p.rutasAlternativas[0];
  ruta.nombre = "Fabricación";
  ruta.configPasos[0].rutaPaso.herramientasCotizacion = [];
  const ensamble = {
    ...ruta.configPasos[0],
    id: "ensamble",
    rutaPasoId: "paso-ensamble",
    rutaPaso: {
      ...ruta.configPasos[0].rutaPaso,
      id: "paso-ensamble",
      familiaCodigo: "ensamble_estructural",
    },
    slotsMateriales: [
      {
        id: "cuerpo",
        slotCodigo: "cuerpo",
        modoSeleccion: "HARDCODED",
        candidatos: [],
        materialVariante: {
          id: "trodat",
          nombreVariante: "Modelo personalizado",
          atributosVarianteJson: {
            anchoPolimero: 47,
            altoPolimero: 18,
            lineasTexto: 5,
          },
          materiaPrima: {
            id: "sello",
            nombre: "Cuerpo",
            familia: "SELLOS",
            subfamilia: "SELLOS_AUTOMATICOS",
            templateId: "sello_automatico_v1",
          },
        },
      },
    ],
  } as unknown as ProductoDetalle["rutasAlternativas"][number]["configPasos"][number];
  ruta.configPasos.push(ensamble);
  p.rutasAlternativas.push({
    ...ruta,
    id: "reventa",
    nombre: "Sólo cuerpo",
    esPreferida: false,
    configPasos: [ensamble],
  });
  api.producto.mockResolvedValue(p);
  api.cotizar.mockResolvedValue({
    exitoso: true,
    cotizacion: calculo,
    errores: [],
  });
  await act(async () =>
    root.render(
      <AgregarProductoSheet
        open
        onOpenChange={vi.fn()}
        productos={[p]}
        fechaEntregaDefault="2026-09-30"
        onAddItem={vi.fn()}
      />,
    ),
  );
  await act(async () =>
    el.querySelector<HTMLButtonElement>('button[role="option"]')!.click(),
  );
  expect(el.textContent).toContain("Diseñar sello");
  const otra = [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.includes("Sólo cuerpo"),
  );
  expect(otra).toBeTruthy();
  await act(async () => otra!.click());
  expect(el.textContent).not.toContain("Diseñar sello");
});

it.each(["ruta", "extra", "nodo-propio"])(
  "ofrece un solo selector de niveles en Troquelado opcional (%s) y envía la elección al motor",
  async (origen) => {
    const p = producto("impresion_por_area");
    p.atributosComercialesJson = {};
    const ruta = p.rutasAlternativas[0];
    const corte = {
      ...ruta.configPasos[0],
      id: "troquelado",
      rutaPasoId: "paso-corte",
      nombreVisible: "Troquelado",
      rutaPaso: {
        id: "paso-corte",
        orden: 2,
        activo: true,
        familiaCodigo:
          origen === "nodo-propio"
            ? "nodo-personalizado-demo"
            : "plotter_corte",
      },
      modoActivacion: "OPCIONAL",
      modoTiempo: "T-3",
      maquinaM1: {
        id: "plotter",
        codigo: "PL",
        nombre: "Plotter ficticio",
        plantilla: "PLOTTER_DE_CORTE",
        perfilesOperativos: [
          {
            id: "simple",
            nombre: "Simple",
            tipoPerfil: "CORTE",
            productivityValue: 8,
            activo: true,
          },
          {
            id: "complejo",
            nombre: "Complejo",
            tipoPerfil: "CORTE",
            productivityValue: 4,
            activo: true,
          },
        ],
      },
      perfilM1: { id: "simple", nombre: "Simple" },
      paramsPasoJson: {
        niveles: {
          etiqueta: "Nivel de troquelado",
          opciones: [
            {
              codigo: "simple",
              nombre: "Simple",
              esDefault: true,
              overrides: { perfilesPorMaquina: { plotter: "simple" } },
            },
            {
              codigo: "complejo",
              nombre: "Complejo",
              overrides: { perfilesPorMaquina: { plotter: "complejo" } },
            },
          ],
        },
      },
    } as unknown as (typeof ruta.configPasos)[number];
    if (origen === "extra")
      ruta.pasosExtras = [
        {
          ...corte,
          familiaCodigo: "plotter_corte",
          activo: true,
          ordenInterno: 0,
          insertarDespuesDeRutaPasoId: ruta.configPasos[0].rutaPasoId,
        },
      ] as any;
    else ruta.configPasos.push(corte);
    api.producto.mockResolvedValue(p);
    api.cotizar.mockResolvedValue({
      exitoso: true,
      cotizacion: calculo,
      errores: [],
    });
    await act(async () =>
      root.render(
        <AgregarProductoSheet
          open
          onOpenChange={vi.fn()}
          productos={[p]}
          fechaEntregaDefault="2026-10-06"
          onAddItem={vi.fn()}
        />,
      ),
    );
    await act(async () =>
      el.querySelector<HTMLButtonElement>('button[role="option"]')!.click(),
    );
    await avanzarCalculo();
    const opcional = [...el.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) =>
        b.className.includes("ap-adi") && b.textContent?.includes("Troquelado"),
    );
    expect(opcional).toBeDefined();
    await act(async () => opcional!.click());
    await avanzarCalculo();
    const complejo = [
      ...el.querySelectorAll<HTMLButtonElement>("button"),
    ].filter((b) => b.textContent === "Complejo");
    expect(complejo).toHaveLength(1);
    expect(el.textContent).not.toContain("Complejidad del corte");
    await act(async () => complejo[0].click());
    await avanzarCalculo();
    expect(api.cotizar.mock.lastCall?.[0].jobContext.nivelPaso_troquelado).toBe(
      "complejo",
    );
    expect(
      api.cotizar.mock.lastCall?.[0].jobContext.opcionalesActivados.troquelado,
    ).toBe(true);
  },
);

it("conserva el perfil anterior al recotizar una configuración convertida a niveles", () => {
  const p = producto("plotter_corte");
  p.atributosComercialesJson = {};
  const paso = p.rutasAlternativas[0].configPasos[0];
  paso.paramsPasoJson = {
    niveles: {
      opciones: [
        {
          codigo: "perfil_simple",
          esDefault: true,
          overrides: { perfilesPorMaquina: { plotter: "simple" } },
        },
        {
          codigo: "perfil_complejo",
          overrides: { perfilesPorMaquina: { plotter: "complejo" } },
        },
      ],
    },
  };
  const config = {
    ...DEFAULT_MOTOR_CONFIG,
    rutaAlternativaId: p.rutasAlternativas[0].id,
    seleccionPerfil: { [paso.id]: "complejo" },
  };
  expect(buildJobContext(p, config, 1, [])[`nivelPaso_${paso.id}`]).toBe(
    "perfil_complejo",
  );
  expect(
    buildJobContext(
      p,
      { ...config, seleccionNivel: { [paso.id]: "perfil_simple" } },
      1,
      [],
    )[`nivelPaso_${paso.id}`],
  ).toBe("perfil_simple");
});
