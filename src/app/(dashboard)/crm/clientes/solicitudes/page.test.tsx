import { describe, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  permiso: vi.fn(),
  listar: vi.fn(),
  api: vi.fn(),
}));
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: f.permiso }));
vi.mock("@/lib/clientes-autoregistro-api", () => ({
  listarAltas: f.listar,
  raizAltas: "/solicitudes-alta-clientes",
}));
vi.mock("@/lib/api", () => ({ apiRequest: f.api }));
vi.mock("@/components/clientes/solicitudes-alta", () => ({
  SolicitudesAlta: () => null,
}));
import Page from "./page";
describe("Permiso de la bandeja de altas", () => {
  it("no consulta datos si falta el permiso específico", async () => {
    f.permiso.mockResolvedValue(false);
    await Page();
    expect(f.permiso).toHaveBeenCalledWith("crm.aprobar_altas", {
      exigirConfirmacion: true,
    });
    expect(f.listar).not.toHaveBeenCalled();
    expect(f.api).not.toHaveBeenCalled();
  });
  it("carga la bandeja con el permiso de revisión", async () => {
    f.permiso.mockResolvedValue(true);
    f.listar.mockResolvedValue({ items: [], total: 0, pagina: 1 });
    f.api.mockResolvedValue({ token: null });
    await Page();
    expect(f.listar).toHaveBeenCalledWith("PENDIENTE", 1);
  });
});
