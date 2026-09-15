import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: vi.fn() }));
vi.mock("@/lib/tablero-produccion-server", () => ({
  cargarDatosTableroProduccion: vi.fn(),
}));
vi.mock("@/lib/estaciones-api", () => ({
  getFamiliasPasos: vi.fn(),
  getRecursosEstaciones: vi.fn(),
}));
vi.mock("@/components/produccion/estaciones-view", () => ({
  EstacionesView: () => null,
}));
vi.mock("@/components/navigation/sin-permiso", () => ({
  SinPermiso: () => null,
}));
import Page from "./page";
import { tienePermiso } from "@/lib/permisos-server";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";
import { getFamiliasPasos, getRecursosEstaciones } from "@/lib/estaciones-api";
import { EstacionesView } from "@/components/produccion/estaciones-view";
import { SinPermiso } from "@/components/navigation/sin-permiso";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cargarDatosTableroProduccion).mockResolvedValue({
    initialItems: [],
    estaciones: [],
    initialPartialWarning: null,
  } as unknown as Awaited<ReturnType<typeof cargarDatosTableroProduccion>>);
  vi.mocked(getFamiliasPasos).mockResolvedValue([]);
  vi.mocked(getRecursosEstaciones).mockResolvedValue({
    empleados: [],
    maquinas: [],
  });
});
describe("acceso a Estaciones", () => {
  it("permite consultar producción sin solicitar recursos reservados al editor", async () => {
    vi.mocked(tienePermiso).mockImplementation(
      async (p) => p === "produccion.ver",
    );
    const page = await Page();
    expect(page.type).toBe(EstacionesView);
    expect(cargarDatosTableroProduccion).toHaveBeenCalledWith({ soloPendientes: true });
    expect(page.props.configuracionDisponible).toBe(false);
    expect(getRecursosEstaciones).not.toHaveBeenCalled();
    expect(getFamiliasPasos).not.toHaveBeenCalled();
  });
  it("carga los recursos de configuración sólo con el permiso correspondiente", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(true);
    const page = await Page();
    expect(page.props.configuracionDisponible).toBe(true);
    expect(getRecursosEstaciones).toHaveBeenCalledOnce();
  });
  it("conserva la vista operativa pero bloquea editar si faltan recursos", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(true);
    vi.mocked(getRecursosEstaciones).mockRejectedValue(
      new Error("Sin recursos"),
    );
    const page = await Page();
    expect(page.type).toBe(EstacionesView);
    expect(page.props.configuracionDisponible).toBe(false);
  });
  it("no carga datos para quien carece de acceso a producción", async () => {
    vi.mocked(tienePermiso).mockResolvedValue(false);
    const page = await Page();
    expect(page.type).toBe(SinPermiso);
    expect(cargarDatosTableroProduccion).not.toHaveBeenCalled();
  });
});
