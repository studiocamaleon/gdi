import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ capacidad: vi.fn(), usuario: vi.fn(), listar: vi.fn() }));
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: mocks.capacidad }));
vi.mock("@/lib/auth-server", () => ({ getCurrentUserCached: mocks.usuario }));
vi.mock("@/lib/cupones-api", () => ({ listarCupones: mocks.listar }));
vi.mock("@/components/comercial/cupones-view", () => ({ CuponesView: () => null }));
vi.mock("@/components/design-system/appearance", () => ({ DesignSystemProvider: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.usuario.mockResolvedValue({ currentUser: { tenantActual: {
    rol: "administrador", permisos: ["crm.ver", "comercial.aprobar_descuento"],
  } } });
  mocks.listar.mockResolvedValue({ items: [{ codigo: "HISTORICO" }] });
});
it("conserva el historial por URL sin conceder la edición en un plan sin Cupones", async () => {
  mocks.capacidad.mockResolvedValue(false);
  const pagina = await Page();
  expect(mocks.listar).toHaveBeenCalledWith({ limit: 24 });
  expect(pagina.props.children.props).toMatchObject({
    conCupones: false, puedeEditar: false, initial: { items: [{ codigo: "HISTORICO" }] },
  });
});
it("permite gestionar al supervisor autorizado cuando el plan incluye Cupones", async () => {
  mocks.capacidad.mockResolvedValue(true);
  expect((await Page()).props.children.props).toMatchObject({ conCupones: true, puedeEditar: true });
});
it.each([
  { rol: "operador", permisos: ["comercial.aprobar_descuento"] },
  { rol: "administrador", permisos: ["crm.ver"] },
  { rol: "administrador", permisos: ["comercial.aprobar_descuento"], suscripcion: { soloLectura: true } },
])("mantiene lectura sin ofrecer acciones cuando faltan permisos o la cuenta es de consulta: %j", async tenantActual => {
  mocks.capacidad.mockResolvedValue(true);
  mocks.usuario.mockResolvedValue({ currentUser: { tenantActual } });
  expect((await Page()).props.children.props.puedeEditar).toBe(false);
});
