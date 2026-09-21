import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
const mocks = vi.hoisted(() => ({
  incluida: vi.fn(),
  resumen: vi.fn(),
  permiso: vi.fn(),
}));
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: mocks.incluida }));
vi.mock("@/lib/fidelizacion-api", () => ({
  getFidelizacionResumen: mocks.resumen,
}));
vi.mock("@/lib/permisos-server", () => ({ tienePermiso: mocks.permiso }));
vi.mock("@/components/crm/fidelizacion-view", () => ({
  FidelizacionView: () => null,
}));
vi.mock("@/components/design-system/appearance", () => ({
  DesignSystemProvider: () => null,
}));
beforeEach(() => vi.clearAllMocks());

it("comprueba el plan antes de consultar fidelización al entrar por URL", async () => {
  mocks.incluida.mockResolvedValue(false);
  const pagina = await Page();
  expect(pagina.type).toBe(FuncionNoIncluida);
  expect(mocks.resumen).not.toHaveBeenCalled();
  expect(mocks.permiso).not.toHaveBeenCalled();
});

it("carga los datos y mantiene el permiso personal cuando la función está incluida", async () => {
  mocks.incluida.mockResolvedValue(true);
  mocks.resumen.mockResolvedValue({});
  mocks.permiso.mockResolvedValue(false);
  const pagina = await Page();
  expect(pagina.type).not.toBe(FuncionNoIncluida);
  expect(mocks.resumen).toHaveBeenCalledOnce();
  expect(mocks.permiso).toHaveBeenCalledWith("crm.configurar_fidelizacion");
});
