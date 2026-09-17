import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({
  zonaHorariaDelTenant: vi.fn(async () => "America/Argentina/Buenos_Aires"),
}));
vi.mock("@/lib/panel-api", () => ({ getPanelProducto: vi.fn() }));
vi.mock("@/components/panel/reporte-producto", () => ({
  ReporteProducto: () => null,
}));
import Page from "./page";
import {
  getPanelProducto,
  type ProductoPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { ReporteProducto } from "@/components/panel/reporte-producto";
describe("Página Ventas y producto", () => {
  it("conserva el período, los permisos y el rango usado para consultar categorías", async () => {
    const datos = {
      meta: { fuente: "fixture" },
      margenesVisibles: false,
    } as TabPanel<ProductoPanel>;
    vi.mocked(getPanelProducto).mockResolvedValue(datos);
    const rango = { desde: "2026-09-02", hasta: "2026-09-12" };
    const page = await Page({ searchParams: Promise.resolve(rango) });
    expect(getPanelProducto).toHaveBeenCalledWith(rango);
    expect(page.type).toBe(ReporteProducto);
    expect(page.props.d).toBe(datos);
    expect(page.props.rango).toEqual(rango);
  });
});
