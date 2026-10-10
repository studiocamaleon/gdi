import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: vi.fn() }));
vi.mock("@/lib/ordenes-trabajo-api", () => ({
  getOrdenTrabajo: vi.fn(),
  getOrdenesTrabajo: vi.fn(),
}));
vi.mock("@/lib/clientes-api", () => ({ getClientes: vi.fn(async () => []) }));
vi.mock("@/lib/productos-servicios-api", () => ({
  getProductos: vi.fn(async () => []),
  getCargosDirectosCatalogo: vi.fn(async () => []),
}));
vi.mock("@/lib/desarrollo-documental-api", () => ({
  getEstadoDocumentalOrden: vi.fn(async () => null),
}));
vi.mock("@/components/comercial/propuesta-ficha", () => ({
  PropuestaFicha: () => null,
}));
vi.mock("@/components/produccion/ordenes-trabajo-view", () => ({
  OrdenesTrabajoView: () => null,
}));
import { tienePermiso } from "@/lib/permisos-server";
import { getOrdenTrabajo, getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import { getClientes } from "@/lib/clientes-api";
import { getEstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";
import { ApiError } from "@/lib/api";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import DetallePage from "./[ordenId]/page";
import ListadoPage from "./page";

const detalle = () =>
  DetallePage({
    params: Promise.resolve({ ordenId: "ot-ficticia" }),
    searchParams: Promise.resolve({}),
  });
const listado = () => ListadoPage({ searchParams: Promise.resolve({}) });
beforeEach(() => vi.resetAllMocks());
describe("acceso directo a la ficha comercial de OT", () => {
  it.each([detalle, listado])(
    "exige el permiso de órdenes antes de consultar datos",
    async (pagina) => {
      vi.mocked(tienePermiso).mockResolvedValue(false);
      expect((await pagina()).type).toBe(SinPermiso);
      expect(tienePermiso).toHaveBeenCalledWith("comercial.ordenes.ver", {
        exigirConfirmacion: true,
      });
      for (const consulta of [
        getOrdenTrabajo,
        getOrdenesTrabajo,
        getClientes,
        getEstadoDocumentalOrden,
      ])
        expect(consulta).not.toHaveBeenCalled();
    },
  );
  it.each([detalle, listado])(
    "un permiso revocado en la API muestra acceso denegado sin romper la vista",
    async (pagina) => {
      vi.mocked(tienePermiso).mockResolvedValue(true);
      vi.mocked(getOrdenTrabajo).mockRejectedValue(
        new ApiError("Sin permiso", 403),
      );
      vi.mocked(getOrdenesTrabajo).mockRejectedValue(
        new ApiError("Sin permiso", 403),
      );
      expect((await pagina()).type).toBe(SinPermiso);
      expect(getClientes).not.toHaveBeenCalled();
      expect(getEstadoDocumentalOrden).not.toHaveBeenCalled();
    },
  );
  it("la vista comercial autorizada conserva el detalle", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(true);
    vi.mocked(getOrdenTrabajo).mockResolvedValue({
      id: "ot-ficticia",
      total: 100,
    } as Awaited<ReturnType<typeof getOrdenTrabajo>>);
    vi.mocked(getEstadoDocumentalOrden).mockResolvedValue(null as never);
    expect((await detalle()).props.orden.total).toBe(100);
  });
});
