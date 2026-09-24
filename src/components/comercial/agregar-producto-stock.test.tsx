// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import type { CotizarResponse } from "@/lib/productos-servicios-api";
import { AgregarProductoSheet } from "./agregar-producto-sheet";

const api = vi.hoisted(() => ({ cotizar: vi.fn(), producto: vi.fn() }));
vi.mock("./tipo-cambio-documento", () => ({
  useMotorConTipoCambio: () => ({ cotizar: api.cotizar, cotizarEnSegundoPlano: api.cotizar }),
}));
vi.mock("@/lib/productos-servicios-api", async (original) => ({
  ...await original<typeof import("@/lib/productos-servicios-api")>(),
  getProductoById: api.producto,
  getCatalogoFamilias: async () => ({ familias: [] }),
}));
vi.mock("@/components/navigation/permisos-provider", () => ({ usePuede: () => false }));
vi.mock("@/hooks/use-receta-cotizacion", () => ({ useRecetaCotizacion: () => null }));
vi.mock("@/components/nesting/plan-lotes-cotizacion", () => ({ PlanLotesCotizacion: () => null }));
vi.mock("./producto-sheet-header", () => ({ ProductoSheetHeaderConstelacion: () => null }));

function producto(politicaStock: "PREFERIR_DISPONIBLES" | "SOLO_DISPONIBLES"): ProductoDetalle {
  return {
    id: "vinilo", codigo: "VIN", nombre: "Vinilo de prueba", activo: true,
    estructuraProducto: "SIMPLE", unidadComercial: "unidad", modoMedidas: "FIJA",
    medidaDefaultAnchoMm: "300", medidaDefaultAltoMm: "400",
    atributosComercialesJson: {}, medidasPredefinidasJson: [], precioConfigJson: {},
    cargosDirectosCotizacion: [], pasosExtras: [],
    subcategoriaComercial: {
      codigo: "vinilos", nombre: "Vinilos", atributosSchemaJson: [],
      categoria: { codigo: "gran_formato", nombre: "Gran formato" },
    },
    rutasAlternativas: [{
      id: "ruta", nombre: "Estándar", esPreferida: true,
      ruta: { id: "base", codigo: "BASE", nombre: "Impresión", pasos: [] },
      configPasos: [{
        id: "impresion", rutaPasoId: "paso",
        rutaPaso: { id: "paso", orden: 1, activo: true, familiaCodigo: "impresion_area" },
        modoActivacion: "OBLIGATORIO", multiplicadoresActivos: [], paramsPasoJson: {},
        maquinaM1: null, perfilM1: null, cargosDirectosPaso: [],
        slotsMateriales: [{
          slotCodigo: "sustrato_principal", modoSeleccion: "MOTOR_ELIGE_AUTO", politicaStock,
          formula: "por_area", candidatos: [{
            materiaPrimaId: "material", defaultVarianteId: "v0",
            materiaPrima: { nombre: "Vinilo", templateId: "sustrato_rollo_flexible_v1" },
            variantes: [1.06, 1.37, 1.52].map((ancho, i) => ({ variante: {
              id: `v${i}`, sku: `VIN-${i}`, precioReferencia: 100,
              atributosVarianteJson: { ancho, largo: 50, acabado: "Brillante" },
            } })),
          }],
        }],
      }],
    }],
  } as unknown as ProductoDetalle;
}

const calculo = {
  cantidadEfectiva: 1, pasos: [], costos: { total: 100, unitario: 100 },
  precio: { precioTotal: 150, precioUnitario: 150 },
};

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks();
});
const avanzarCalculo = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const boton = (texto: string) => [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(texto))!;

it.each(["PREFERIR_DISPONIBLES", "SOLO_DISPONIBLES"] as const)(
  "con %s conserva la elección, recotiza esa variante y permite volver a automático",
  async (politica) => {
    const p = producto(politica);
    api.producto.mockResolvedValue(p);
    api.cotizar.mockImplementation(async ({ jobContext }) => {
      const selected = jobContext.slotMateriales?.impresion_sustrato_principal;
      const estricto = politica === "SOLO_DISPONIBLES";
      return {
        exitoso: !!selected || !estricto,
        cotizacion: selected || !estricto ? calculo : undefined,
        errores: selected ? [] : [{
          codigo: estricto ? "material_auto_sin_stock_suficiente" : "material_auto_requiere_reposicion",
          severidad: estricto ? "ERROR" : "WARNING", mensaje: "Falta stock",
          contexto: { configPasoId: "impresion", slotCodigo: "sustrato_principal", recomendadoVarianteId: "v1", alternativas: [{ id: "v0" }, { id: "v1" }, { id: "v2" }] },
        }],
      } as unknown as CotizarResponse;
    });
    await act(async () => root.render(<AgregarProductoSheet open onOpenChange={vi.fn()} productos={[p]} fechaEntregaDefault="2026-09-30" onAddItem={vi.fn()} />));
    await act(async () => el.querySelector<HTMLButtonElement>('button[role="option"]')!.click());
    await avanzarCalculo();
    expect(el.querySelector(".ap-foot-total")?.textContent).toContain("Elegí el material a reponer");
    const cards = () => [...el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
    const recomendada = () => el.querySelector('button[aria-label*="Recomendado por el sistema"]');
    expect(cards()).toHaveLength(3);
    expect(recomendada()?.textContent).toContain("1,37 m");
    await act(async () => cards().find((c) => c.textContent?.includes("1,37 m"))!.click());
    // El efecto de limpieza del sheet ya corrió: la elección debe sobrevivir.
    expect(el.textContent).toContain("Material elegido manualmente");
    expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("1,37 m");
    expect(recomendada()?.textContent).toContain("1,37 m");
    await avanzarCalculo();
    expect(api.cotizar.mock.lastCall?.[0].jobContext.slotMateriales).toEqual({ impresion_sustrato_principal: "v1" });
    expect(el.querySelector(".ap-foot-total")?.textContent).not.toContain("Elegí el material a reponer");
    expect(boton("Guardar y agregar otro").disabled).toBe(false);
    expect(recomendada()?.textContent).toContain("1,37 m");
    // Elegir otra variante no convierte esa elección en la recomendada.
    await act(async () => cards().find((c) => c.textContent?.includes("1,52 m"))!.click());
    await avanzarCalculo();
    expect(recomendada()?.textContent).toContain("1,37 m");
    expect(el.querySelector('[aria-checked="true"]')?.textContent).toContain("1,52 m");
    // La recomendación anterior deja de ser válida cuando cambia el trabajo.
    await act(async () => boton("200").click());
    expect(recomendada()).toBeNull();
    await avanzarCalculo();
    expect(api.cotizar.mock.lastCall?.[0].jobContext.cantidad).toBe(200);
    expect(recomendada()).toBeNull();
    await act(async () => boton("Volver a selección automática").click());
    await avanzarCalculo();
    expect(api.cotizar.mock.lastCall?.[0].jobContext.slotMateriales).toBeUndefined();
    expect(el.querySelector(".ap-foot-total")?.textContent).toContain("Elegí el material a reponer");
    expect(boton("Guardar y agregar otro").disabled).toBe(true);
    expect(recomendada()?.textContent).toContain("1,37 m");
  },
);
