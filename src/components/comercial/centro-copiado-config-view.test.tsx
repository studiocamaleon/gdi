// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CentroCopiadoConfigView } from "./centro-copiado-config-view";
import type { CentroCopiadoConfig } from "@/lib/centro-copiado-api";

const mocks = vi.hoisted(() => ({
  cargar: vi.fn(),
  guardar: vi.fn(),
  cotizar: vi.fn(),
  gestionar: true,
  terminaciones: false,
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => mocks.gestionar,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: (cap: string) =>
    cap === "terminaciones_copiado" && mocks.terminaciones,
}));
vi.mock("@/components/configuracion/configuracion-workspace", () => ({
  useConfiguracionInicio: vi.fn(),
  ConfiguracionPage: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ConfiguracionHeader: ({ acciones }: { acciones: ReactNode }) => (
    <div>{acciones}</div>
  ),
  GuardarConfiguracion: ({
    cambios,
    onGuardar,
  }: {
    cambios: number;
    onGuardar: () => void;
  }) => (
    <button disabled={!cambios} onClick={onGuardar}>
      Guardar cambios
    </button>
  ),
}));
vi.mock("@/lib/centro-copiado-api", async (original) => ({
  ...(await original<object>()),
  getConfigCentroCopiado: mocks.cargar,
  actualizarConfigCentroCopiado: mocks.guardar,
  cotizarCentroCopiado: mocks.cotizar,
  saludCentroCopiado: async () => null,
  historialCentroCopiado: async () => [],
}));

const config: CentroCopiadoConfig = {
  productoId: null,
  version: 1,
  actualizadoEl: null,
  activo: true,
  cobraSetup: false,
  margenPct: 40,
  margenMinimoPct: 25,
  politicaPrecio: "MARGEN_FIJO",
  tramosMargen: [{ desdeCantidad: 1, margenPct: 40 }],
  minimoHojasFacturables: 0,
  setupMin: 0,
  cleanupMin: 0,
  papeles: null,
  tamanos: null,
  terminaciones: [],
  tiposAnillo: [],
  maquinaColorId: null,
  maquinaBnId: null,
  maquinaAnilladoraId: null,
  tapaFrontalMateriaPrimaId: null,
  tapaContratapaMateriaPrimaId: null,
  disponibles: {
    papeles: [
      {
        materiaPrimaId: "papel-ficticio",
        nombre: "Obra de prueba",
        gramajes: [80, 150],
        formatosProducibles: ["A4", "A3"],
        formatosPorGramaje: [
          { gramaje: 80, tamanos: ["A4", "A3"] },
          { gramaje: 150, tamanos: ["A4"] },
        ],
      },
    ],
    formatos: [
      { nombre: "A4", anchoMm: 210, altoMm: 297 },
      { nombre: "A3", anchoMm: 297, altoMm: 420 },
    ],
    maquinas: [],
    anilladoras: [],
    tapas: [],
    tiposAnillo: [],
    terminaciones: [],
    terminacionesCatalogo: [],
  },
};
let root: Root;
let el: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.gestionar = true;
  mocks.terminaciones = false;
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    PointerEvent: MouseEvent,
  });
  mocks.cargar.mockResolvedValue(structuredClone(config));
  mocks.guardar.mockImplementation(async (cambios) => ({
    ...config,
    ...cambios,
    version: 2,
  }));
  mocks.cotizar.mockResolvedValue({ totales: { total: 100, hojas: 50 } });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
const boton = (texto: string) =>
  [...el.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === texto,
  )!;
const control = (label: string) =>
  el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
const modo = (texto: string) =>
  [...el.querySelectorAll<HTMLButtonElement>("[role=radio]")].find(
    (b) => b.textContent === texto,
  )!;
async function montar() {
  await act(async () => root.render(<CentroCopiadoConfigView />));
}
async function oferta() {
  await act(async () => boton("Oferta").click());
}

it("guarda formatos explícitos aunque todos los papeles estén seleccionados y los recupera", async () => {
  await montar();
  await oferta();
  await act(async () => modo("Personalizar").click());
  await act(async () => control("A3 para 80 g").click());
  await act(async () => boton("Guardar cambios").click());
  expect(mocks.guardar.mock.calls[0][0].papeles).toEqual([
    {
      materiaPrimaId: "papel-ficticio",
      formatosPorGramaje: expect.arrayContaining([
        { gramaje: 80, tamanos: ["A4"] },
        { gramaje: 150, tamanos: ["A4"] },
      ]),
    },
  ]);
  expect(control("A3 para 80 g").getAttribute("aria-pressed")).toBe("false");
  expect(boton("Guardar cambios").disabled).toBe(true);
  await act(async () => modo("Formatos generales").click());
  await act(async () => boton("Guardar cambios").click());
  expect(mocks.guardar.mock.calls.at(-1)![0].papeles).toBeNull();
});

it("la prueba rápida omite gramajes sin oferta y usa el primer formato permitido", async () => {
  mocks.cargar.mockResolvedValue({
    ...config,
    papeles: [
      {
        materiaPrimaId: "papel-ficticio",
        formatosPorGramaje: [
          { gramaje: 80, tamanos: [] },
          { gramaje: 150, tamanos: ["A4"] },
        ],
      },
    ],
  });
  await montar();
  await act(async () => boton("Probar cotización").click());
  expect(mocks.cotizar.mock.calls[0][0].documentos[0]).toMatchObject({
    gramaje: 150,
    tamano: "A4",
  });
});

it("no permite editar formatos sin permiso de gestión", async () => {
  mocks.gestionar = false;
  await montar();
  await oferta();
  await act(async () => modo("Personalizar").click());
  expect(modo("Personalizar").getAttribute("aria-checked")).toBe("false");
  expect(mocks.guardar).not.toHaveBeenCalled();
});

it("permite dejar un gramaje sin formatos y no habilita formatos desactivados globalmente", async () => {
  mocks.cargar.mockResolvedValue({ ...config, tamanos: ["A4"] });
  await montar();
  await oferta();
  await act(async () => modo("Personalizar").click());
  await act(async () => control("A4 para 150 g").click());
  expect(control("A3 para 80 g").disabled).toBe(true);
  await act(async () => boton("Guardar cambios").click());
  expect(
    mocks.guardar.mock.calls[0][0].papeles[0].formatosPorGramaje,
  ).toContainEqual({ gramaje: 150, tamanos: [] });
});

it("conserva el pouch por formato al habilitarlo y no usa null como todas las terminaciones", async () => {
  mocks.terminaciones = true;
  const pouch = {
    centroCostoId: "centro-ficticio",
    minutosPorHoja: 0.75,
    formatos: [{ tamano: "A4", varianteId: "sobre-ficticio" }],
  };
  mocks.cargar.mockResolvedValue({ ...config, pouch });
  await montar();
  await act(async () =>
    [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((t) => t.textContent?.includes("Ruta y terminaciones"))!
      .click(),
  );
  await act(async () => control("Ofrecer Plastificado pouch").click());
  await act(async () => boton("Guardar cambios").click());
  expect(mocks.guardar).toHaveBeenCalledWith(
    expect.objectContaining({ terminaciones: ["Plastificado pouch"], pouch }),
  );
});

it("no permite habilitar pouch sin permiso de gestión", async () => {
  mocks.terminaciones = true;
  mocks.gestionar = false;
  await montar();
  await act(async () =>
    [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((t) => t.textContent?.includes("Ruta y terminaciones"))!
      .click(),
  );
  expect(
    control("Ofrecer Plastificado pouch").getAttribute("aria-disabled"),
  ).toBe("true");
  await act(async () => control("Ofrecer Plastificado pouch").click());
  expect(mocks.guardar).not.toHaveBeenCalled();
});
