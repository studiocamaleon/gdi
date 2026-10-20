// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DatosPantalla, EntregaPantalla } from "@/lib/pantalla-produccion";
import { PantallaProduccion } from "./pantalla-produccion";

vi.mock("@/components/design-system/appearance", () => ({
  useDesignTheme: () => "grafo",
}));

const fila = (
  id: string,
  extras: Partial<EntregaPantalla> = {},
): EntregaPantalla => ({
  id,
  orden: `OT-${id}`,
  cliente: "Cliente ficticio",
  producto: id,
  cantidad: 1,
  unidad: "un",
  fecha: "2026-10-19",
  atrasada: false,
  estado: "pendiente",
  etapa: "Pendiente · Corte",
  pasosHechos: 0,
  pasosTotal: 1,
  ...extras,
});
const datos: DatosPantalla = {
  empresa: "Taller ficticio",
  pantalla: "TV de prueba",
  zona: "America/Argentina/Buenos_Aires",
  hoy: "2026-10-19",
  actualizadoEl: "2026-10-19T15:00:00Z",
  intervaloSegundos: 15,
  resumen: { atrasadas: 1, hoy: 1, listas: 1 },
  filas: [
    fila("ATRASADA", { fecha: "2026-10-18", atrasada: true }),
    fila("HOY"),
    fila("LISTA", {
      fecha: "2026-10-01",
      estado: "lista",
      etapa: "Lista para entregar",
      pasosHechos: 1,
    }),
  ],
};
let root: Root;
let contenedor: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(datos.actualizadoEl));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/datos")
          ? datos
          : { estado: "vinculada", nombre: datos.pantalla },
    })),
  );
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("rota atrasadas, pendientes de hoy y listas sin llamar hoy o atrasado a un trabajo terminado", async () => {
  await act(async () => root.render(<PantallaProduccion />));
  const tarjeta = () => contenedor.querySelector("article")!;
  expect(tarjeta().textContent).toContain("Atrasada · 18/10/2026");
  expect(tarjeta().getAttribute("data-late")).toBe("true");

  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(tarjeta().textContent).toContain("OT-HOY");
  expect(tarjeta().textContent).toContain("Entrega hoy");

  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(tarjeta().textContent).toContain("OT-LISTA");
  expect(tarjeta().textContent).toContain("Lista para entregar");
  expect(tarjeta().textContent).toContain("Entrega · 01/10/2026");
  expect(tarjeta().textContent).not.toContain("Atrasada");
  expect(tarjeta().textContent).not.toContain("Entrega hoy");
  expect(tarjeta().getAttribute("data-late")).toBe("false");
  expect(tarjeta().getAttribute("data-ready")).toBe("true");

  await act(async () => vi.advanceTimersByTimeAsync(15_000));
  expect(tarjeta().textContent).toContain("OT-ATRASADA");
});
