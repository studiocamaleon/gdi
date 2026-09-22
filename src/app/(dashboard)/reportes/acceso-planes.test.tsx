import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROPUESTA_PLANES } from "../../../../apps/api/src/plataforma/planes/catalogo-planes";
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn() }));
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: vi.fn(async () => true) }));
vi.mock("@/lib/auth-server", () => ({ zonaHorariaDelTenant: vi.fn(async () => "UTC") }));
vi.mock("@/lib/panel-api", () => ({
  getPanelResumen: vi.fn(), getPanelComercial: vi.fn(), getPanelEmbudo: vi.fn(), getPanelFinanzas: vi.fn(),
  getPanelProducto: vi.fn(), getPanelClientes: vi.fn(), getPanelProduccion: vi.fn(), getPanelEquipo: vi.fn(), getPanelSaludEta: vi.fn(),
}));
import { tieneCapacidad } from "@/lib/capacidades-server";
import { tienePermiso } from "@/lib/permisos-server";
import * as api from "@/lib/panel-api";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import Resumen from "./resumen/page";
import Comercial from "./comercial/page";
import Embudo from "./embudo/page";
import Finanzas from "./finanzas/page";
import Producto from "./producto/page";
import Clientes from "./clientes/page";
import Produccion from "./produccion/page";
import Equipo from "./equipo/page";
import Salud from "./salud-eta/page";
import Layout from "./layout";

const paginas = [
  ["resumen", "reportes_resumen", Resumen, api.getPanelResumen],
  ["comercial", "reportes_resumen", Comercial, api.getPanelComercial],
  ["embudo", "reportes_resumen", Embudo, api.getPanelEmbudo],
  ["finanzas", "reportes_finanzas", Finanzas, api.getPanelFinanzas],
  ["producto", "reportes_comerciales", Producto, api.getPanelProducto],
  ["clientes", "reportes_comerciales", Clientes, api.getPanelClientes],
  ["produccion", "reportes_produccion", Produccion, api.getPanelProduccion],
  ["equipo", "reportes_produccion", Equipo, api.getPanelEquipo],
  ["salud-eta", "reportes_produccion", Salud, api.getPanelSaludEta],
] as const;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(tienePermiso).mockResolvedValue(true); });

describe("acceso directo a reportes", () => {
  it.each([0, 1, 2])("plan %s: sólo consulta los datos de las páginas contratadas", async indice => {
    const funciones = PROPUESTA_PLANES[indice].contenido.funciones;
    vi.mocked(tieneCapacidad).mockImplementation(async clave => funciones[clave]);
    for (const [nombre, capacidad, Page, consulta] of paginas) {
      const pagina = await Page({ searchParams: Promise.resolve({ desde: "2026-08-01", hasta: "2026-08-31" }) });
      expect(pagina.type === FuncionNoIncluida, nombre).toBe(!funciones[capacidad]);
      expect(vi.mocked(consulta).mock.calls.length, nombre).toBe(funciones[capacidad] ? 1 : 0);
    }
  });
  it("una retirada bloquea la siguiente visita sin volver a pedir datos", async () => {
    vi.mocked(tieneCapacidad).mockResolvedValueOnce(true).mockResolvedValue(false);
    await Finanzas({ searchParams: Promise.resolve({}) });
    const pagina = await Finanzas({ searchParams: Promise.resolve({}) });
    expect(pagina.type).toBe(FuncionNoIncluida);
    expect(api.getPanelFinanzas).toHaveBeenCalledTimes(1);
  });
  it("el layout exige el permiso de Reportes antes de mostrar sus vistas", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(false);
    expect((await Layout({ children: "Contenido" })).type).toBe(SinPermiso);
  });
});
