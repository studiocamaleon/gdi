import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PanelGeneralData,
  PanelGeneralEntrega,
} from "@/lib/panel-general-api";
import { PanelGeneralView } from "./panel-general-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const entrega: PanelGeneralEntrega = {
  id: "hoy-1",
  numero: "OT-HOY",
  cliente: "Cliente",
  producto: "Cartel",
  productos: [{ id: "producto-1", nombre: "Cartel", progresoPct: null }],
  fechaEntrega: "2026-09-15",
  progresoPct: null,
  riesgo: "hoy",
  pasoActual: null,
  estacionActual: null,
  href: "/produccion/ordenes/hoy-1",
};
const data: PanelGeneralData = {
  generadoEl: "2026-09-15T15:00:00Z",
  fechaLocal: "2026-09-15",
  kpis: [],
  atencion: [],
  atencionTotal: 0,
  entregas: {
    hoy: { items: [entrega], total: 1 },
    atrasada: {
      items: [
        {
          ...entrega,
          id: "atrasada-1",
          numero: "OT-ATRASADA",
          riesgo: "atrasada",
        },
      ],
      total: 8,
    },
    proxima: { items: [], total: 0 },
  },
  taller: null,
  accionesRapidas: [],
};
const render = (initialData = data) =>
  renderToStaticMarkup(
    <PanelGeneralView initialData={initialData} nombreUsuario="Lucas" />,
  );

afterEach(() => vi.useRealTimers());

describe("Panel de administrador", () => {
  it("muestra las entregas de hoy del grupo completo, sin filtrarlas del resumen limitado", () => {
    const html = render();
    expect(html).toContain("OT-HOY");
    expect(html).not.toContain("OT-ATRASADA");
    expect(html).toContain('aria-label="Atrasadas 8"');
    expect(html).toContain("Mostrando 1 de 1 orden.");
  });

  it("distingue una orden sin ruta de una producción completada", () => {
    const html = render();
    expect(html).toContain("Sin ruta de producción");
    expect(html).not.toContain("Producción completada");
    expect(html).not.toContain("Lista para retirar");
    expect(html).toContain("Sin avance calculable");
  });

  it("usa un reloj inicial estable aunque pase tiempo entre servidor e hidratación", () => {
    vi.useFakeTimers().setSystemTime(new Date(data.generadoEl));
    const servidor = render().match(/Actualizado [^<]+/)?.[0];
    vi.setSystemTime(new Date("2026-09-15T15:00:35Z"));
    const clienteInicial = render().match(/Actualizado [^<]+/)?.[0];
    expect(servidor).toBe("Actualizado ahora");
    expect(clienteInicial).toBe(servidor);
  });
});
