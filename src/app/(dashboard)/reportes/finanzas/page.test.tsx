import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelFinanzas: vi.fn() }));
vi.mock("@/components/panel/reporte-finanzas", () => ({
  ReporteFinanzas: () => null,
}));
vi.mock("@/components/navigation/sin-permiso", () => ({
  SinPermiso: () => null,
}));
import Page from "./page";
import { tienePermiso } from "@/lib/permisos-server";
import { getPanelFinanzas, type FinanzasData } from "@/lib/panel-api";
import { ReporteFinanzas } from "@/components/panel/reporte-finanzas";
import { SinPermiso } from "@/components/navigation/sin-permiso";

beforeEach(() => {
  vi.clearAllMocks();
});
describe("acceso al reporte Finanzas", () => {
  it("no solicita información financiera si falta el permiso de márgenes", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(false);
    const page = await Page({ searchParams: Promise.resolve({}) });
    expect(page.type).toBe(SinPermiso);
    expect(tienePermiso).toHaveBeenCalledWith("finanzas.ver_margenes");
    expect(getPanelFinanzas).not.toHaveBeenCalled();
  });
  it("conserva el rango personalizado y entrega la respuesta original a la vista", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(true);
    const response = { meta: { fuente: "fixture" } } as FinanzasData;
    vi.mocked(getPanelFinanzas).mockResolvedValue(response);
    const page = await Page({
      searchParams: Promise.resolve({
        desde: "2026-09-02",
        hasta: "2026-09-12",
      }),
    });
    expect(getPanelFinanzas).toHaveBeenCalledWith({
      desde: "2026-09-02",
      hasta: "2026-09-12",
    });
    expect(page.type).toBe(ReporteFinanzas);
    expect(page.props.d).toBe(response);
  });
});
