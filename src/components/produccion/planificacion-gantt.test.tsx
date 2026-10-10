// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EjeLaboral } from "@/lib/eje-laboral";
import { PlanificacionGantt, type PosicionCalendarioPlan } from "./planificacion-gantt";

const eje: EjeLaboral = {
  jornadaMin: 480, totalMin: 2400, ventana: { desde: 540, hasta: 1020 },
  dias: [{ fecha: "2026-10-13", etiqueta: "mar 13/10", x: 0, ancho: 480, desdeMin: 540 }],
  aX: () => 0,
};
let root: Root;
let host: HTMLDivElement;
let posicion: PosicionCalendarioPlan | null;
let ancho: number;
const leerPosicion = () => posicion;
const guardarPosicion = (valor: PosicionCalendarioPlan) => { posicion = valor; };
const props = {
  grupos: [{ id: "estacion-demo", nombre: "Impresión", detalle: "Equipo de ejemplo", tipo: "estacion" as const, operaciones: [], hijos: [], entrega: null }],
  entregas: [], modo: "recursos" as const, eje, desde: "2026-10-13", hasta: "2026-10-19",
  zona: "America/Argentina/Buenos_Aires", ahora: new Date("2026-10-13T12:00:00Z"),
  zoom: 100, volverAlInicio: 0, abiertos: {}, alternar: vi.fn(), seleccionId: null,
  relacionadas: new Set<string>(), mostrarDependencias: true, seleccionar: vi.fn(), riesgo: new Set<string>(),
  leerPosicion, guardarPosicion,
};
function calendario() { return host.querySelector<HTMLDivElement>('[data-mode="recursos"]')!; }
async function render(otros: Partial<typeof props> = {}) {
  await act(async () => { root.render(<PlanificacionGantt {...props} {...otros} />); });
}
async function desplazar(izquierda: number, arriba: number) {
  await act(async () => {
    calendario().scrollLeft = izquierda;
    calendario().scrollTop = arriba;
    calendario().dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}
beforeEach(() => {
  ancho = 900;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(2700);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => ancho);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => "300" } as unknown as CSSStyleDeclaration);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); posicion = null;
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("posición del calendario al ampliar la planificación", () => {
  it("recupera el desplazamiento horizontal y vertical después de trasladarlo al modal", async () => {
    await render(); await desplazar(720, 280);
    await act(async () => root.render(null));
    await render();
    expect(calendario().scrollLeft).toBe(720);
    expect(calendario().scrollTop).toBe(280);
  });
  it("mantiene el punto temporal al cambiar la escala y conserva la fila visible", async () => {
    await render(); await desplazar(720, 280);
    await act(async () => root.render(null));
    await render({ zoom: 150 });
    expect(calendario().scrollLeft).toBe(1080);
    expect(calendario().scrollTop).toBe(280);
  });
  it("usa el ancho real del modal para restaurar el punto temporal", async () => {
    await render(); await desplazar(720, 280);
    await act(async () => root.render(null));
    ancho = 1500;
    await render();
    expect(calendario().scrollLeft).toBe(1200);
    expect(calendario().scrollTop).toBe(280);
  });
  it("conserva el extremo derecho al ampliar y volver aunque cambie el espacio visible", async () => {
    await render(); await desplazar(1800, 0);
    await act(async () => root.render(null));
    ancho = 1500;
    await render();
    expect(calendario().scrollLeft).toBe(1200);
    await act(async () => root.render(null));
    ancho = 900;
    await render();
    expect(calendario().scrollLeft).toBe(1800);
  });
  it("vuelve al inicio cuando se solicita Ahora aunque se conserve el mismo período", async () => {
    await render(); await desplazar(720, 280);
    await render({ volverAlInicio: 1 });
    expect(calendario().scrollLeft).toBe(0);
    expect(calendario().scrollTop).toBe(0);
  });
  it("no aplica el desplazamiento de otra agrupación o fecha", async () => {
    posicion = { modo: "ordenes", desde: "2026-10-12", volverAlInicio: 0, izquierda: 900, arriba: 200, alFinal: false, escala: 1 };
    await render();
    expect(calendario().scrollLeft).toBe(0);
    expect(calendario().scrollTop).toBe(0);
  });
});
