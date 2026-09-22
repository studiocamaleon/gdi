vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn(async () => true) }));
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelEmbudo: vi.fn() }));
vi.mock("@/components/panel/reporte-embudo", () => ({
  ReporteEmbudo: () => null,
}));
import Page from "./page";
import {
  getPanelEmbudo,
  type EmbudoPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteEmbudo } from "@/components/panel/reporte-embudo";

describe("Página del reporte Embudo", () => {
  it("consulta el período pedido y pasa los indicadores y datos nuevos en cada navegación", async () => {
    const primera = {
      meta: { fuente: "fixture" },
      sinComparativa: false,
    } as TabPanel<EmbudoPanel>;
    const segunda = { ...primera, sinComparativa: true };
    vi.mocked(getPanelEmbudo)
      .mockResolvedValueOnce(primera)
      .mockResolvedValueOnce(segunda);
    const params = { desde: "2026-09-02", hasta: "2026-09-12" };
    const page = await Page({ searchParams: Promise.resolve(params) });
    expect(getPanelEmbudo).toHaveBeenLastCalledWith(params);
    expect(page.type).toBe(ReporteEmbudo);
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
