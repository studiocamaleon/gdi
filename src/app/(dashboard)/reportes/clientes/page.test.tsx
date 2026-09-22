vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn(async () => true) }));
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelClientes: vi.fn() }));
vi.mock("@/components/panel/reporte-clientes", () => ({
  ReporteClientes: () => null,
}));
import Page from "./page";
import {
  getPanelClientes,
  type ClientesPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteClientes } from "@/components/panel/reporte-clientes";

describe("Página del reporte Clientes", () => {
  it("consulta el período pedido y pasa los permisos y datos nuevos en cada navegación", async () => {
    const primera = {
      meta: { fuente: "fixture" },
      margenesVisibles: false,
    } as TabPanel<ClientesPanel>;
    const segunda = { ...primera, margenesVisibles: true };
    vi.mocked(getPanelClientes)
      .mockResolvedValueOnce(primera)
      .mockResolvedValueOnce(segunda);
    const params = { desde: "2026-09-02", hasta: "2026-09-12" };
    const page = await Page({ searchParams: Promise.resolve(params) });
    expect(getPanelClientes).toHaveBeenLastCalledWith(params);
    expect(page.type).toBe(ReporteClientes);
    expect(page.props.d).toBe(primera);
    const siguiente = await Page({
      searchParams: Promise.resolve({
        desde: "2026-08-01",
        hasta: "2026-08-31",
      }),
    });
    expect(siguiente.props.d).toBe(segunda);
  });
});
