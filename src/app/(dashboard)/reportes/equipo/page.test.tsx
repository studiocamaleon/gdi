import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelEquipo: vi.fn() }));
vi.mock("@/components/panel/reporte-equipo", () => ({
  ReporteEquipo: () => null,
}));
import Page from "./page";
import {
  getPanelEquipo,
  type EquipoPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteEquipo } from "@/components/panel/reporte-equipo";

describe("Página del reporte Equipo", () => {
  it("consulta el período pedido y pasa los permisos y datos nuevos en cada navegación", async () => {
    const primera = {
      meta: { fuente: "fixture" },
      margenesVisibles: false,
      comisionesVisibles: false,
    } as TabPanel<EquipoPanel>;
    const segunda = { ...primera, comisionesVisibles: true };
    vi.mocked(getPanelEquipo)
      .mockResolvedValueOnce(primera)
      .mockResolvedValueOnce(segunda);
    const params = { desde: "2026-09-02", hasta: "2026-09-12" };
    const page = await Page({ searchParams: Promise.resolve(params) });
    expect(getPanelEquipo).toHaveBeenLastCalledWith(params);
    expect(page.type).toBe(ReporteEquipo);
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
