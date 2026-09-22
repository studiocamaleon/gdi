vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn(async () => true) }));
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelProduccion: vi.fn() }));
vi.mock("@/components/panel/reporte-produccion", () => ({
  ReporteProduccion: () => null,
}));
import Page from "./page";
import {
  getPanelProduccion,
  type ProduccionPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteProduccion } from "@/components/panel/reporte-produccion";

describe("página de reporte Producción", () => {
  it("conserva el rango personalizado y la respuesta de la consulta original", async () => {
    const response = {
      meta: { fuente: "fixture" },
    } as TabPanel<ProduccionPanel>;
    vi.mocked(getPanelProduccion).mockResolvedValue(response);
    const page = await Page({
      searchParams: Promise.resolve({
        desde: "2026-09-02",
        hasta: "2026-09-12",
      }),
    });
    expect(getPanelProduccion).toHaveBeenCalledWith({
      desde: "2026-09-02",
      hasta: "2026-09-12",
    });
    expect(page.type).toBe(ReporteProduccion);
    expect(page.props.d).toBe(response);
  });
});
