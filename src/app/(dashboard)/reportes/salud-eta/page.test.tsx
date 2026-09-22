vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn(async () => true) }));
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelSaludEta: vi.fn() }));
vi.mock("@/components/panel/reporte-salud-eta", () => ({
  ReporteSaludEta: () => null,
}));
import Page from "./page";
import {
  getPanelSaludEta,
  type SaludEtaPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteSaludEta } from "@/components/panel/reporte-salud-eta";

describe("página Salud del ETA", () => {
  it("entrega la respuesta nueva y el rango original en cada navegación", async () => {
    const primero = {
      meta: { fuente: "Septiembre" },
    } as TabPanel<SaludEtaPanel>;
    const segundo = { meta: { fuente: "Agosto" } } as TabPanel<SaludEtaPanel>;
    vi.mocked(getPanelSaludEta)
      .mockResolvedValueOnce(primero)
      .mockResolvedValueOnce(segundo);
    const septiembre = await Page({
      searchParams: Promise.resolve({
        desde: "2026-09-02",
        hasta: "2026-09-12",
      }),
    });
    const agosto = await Page({
      searchParams: Promise.resolve({
        desde: "2026-08-02",
        hasta: "2026-08-12",
      }),
    });
    expect(getPanelSaludEta).toHaveBeenNthCalledWith(1, {
      desde: "2026-09-02",
      hasta: "2026-09-12",
    });
    expect(getPanelSaludEta).toHaveBeenNthCalledWith(2, {
      desde: "2026-08-02",
      hasta: "2026-08-12",
    });
    expect(septiembre.type).toBe(ReporteSaludEta);
    expect(septiembre.props.d).toBe(primero);
    expect(agosto.props.d).toBe(segundo);
  });
});
