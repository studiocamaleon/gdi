import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ incluida: vi.fn(), resumen: vi.fn(), permiso: vi.fn(), usuario: vi.fn() }));
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: mocks.incluida }));
vi.mock("@/lib/fidelizacion-api", () => ({ getFidelizacionResumen: mocks.resumen }));
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: mocks.permiso }));
vi.mock("@/lib/auth-server", () => ({ getCurrentUserCached: mocks.usuario }));
vi.mock("@/components/crm/fidelizacion-view", () => ({ FidelizacionView: () => null }));
vi.mock("@/components/design-system/appearance", () => ({ DesignSystemProvider: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.incluida.mockResolvedValue(true);
  mocks.permiso.mockResolvedValue(true);
  mocks.resumen.mockResolvedValue({});
  mocks.usuario.mockResolvedValue({ currentUser: { tenantActual: { suscripcion: { soloLectura: false } } } });
});
it("conserva saldos e historial sin permitir gestión cuando se retira la función", async () => {
  mocks.incluida.mockResolvedValue(false);
  const pagina = await Page();
  expect(mocks.resumen).toHaveBeenCalledOnce();
  expect(pagina.props.children.props).toMatchObject({ conFidelizacion: false, puedeConfigurar: false });
});
it("permite configurar con plan y permiso", async () => {
  const pagina = await Page();
  expect(pagina.props.children.props).toMatchObject({ conFidelizacion: true, puedeConfigurar: true });
});
it("conserva el permiso personal aunque esté incluida", async () => {
  mocks.permiso.mockResolvedValue(false);
  const pagina = await Page();
  expect(pagina.props.children.props.puedeConfigurar).toBe(false);
});
it("sólo lectura conserva consulta sin ofrecer guardar", async () => {
  mocks.usuario.mockResolvedValue({ currentUser: { tenantActual: { suscripcion: { soloLectura: true } } } });
  const pagina = await Page();
  expect(pagina.props.children.props.puedeConfigurar).toBe(false);
});
