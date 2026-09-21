import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import TesoreriaPage from "../tesoreria/page";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
const mocks = vi.hoisted(() => ({
  incluida: vi.fn(),
  gastos: vi.fn(),
  tesoreria: vi.fn(),
  egresos: vi.fn(),
}));
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: mocks.incluida }));
vi.mock("@/lib/gastos-fijos-api", () => ({ getGastosFijos: mocks.gastos }));
vi.mock("@/lib/administracion-api", () => ({
  getCuentasFondos: async () => [],
  getMetodosPago: async () => [],
  getTesoreria: mocks.tesoreria,
}));
vi.mock("@/lib/egresos-api", () => ({
  getCategoriasEgreso: async () => [],
  getEgresos: mocks.egresos,
  getResumenEgresos: async () => ({}),
}));
vi.mock("@/lib/proveedores-api", () => ({ getProveedores: async () => [] }));
vi.mock("@/components/administracion/egresos-view", () => ({
  EgresosView: () => null,
}));
vi.mock("@/components/administracion/tesoreria-view", () => ({
  TesoreriaView: () => null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.egresos.mockResolvedValue({ egresos: [] });
});
it("carga Egresos sin consultar Gastos fijos cuando el plan no los incluye", async () => {
  mocks.incluida.mockImplementation(async (clave) => clave === "cuentas_pagar");
  const pagina = await Page({ searchParams: Promise.resolve({}) });
  expect(pagina.type).not.toBe(FuncionNoIncluida);
  expect(pagina.props.gastosFijos).toEqual([]);
  expect(mocks.egresos).toHaveBeenCalledOnce();
  expect(mocks.gastos).not.toHaveBeenCalled();
});
it("al entrar por URL rechaza Egresos y Tesorería antes de cargar sus datos", async () => {
  mocks.incluida.mockResolvedValue(false);
  expect((await Page({ searchParams: Promise.resolve({}) })).type).toBe(
    FuncionNoIncluida,
  );
  expect((await TesoreriaPage()).type).toBe(FuncionNoIncluida);
  expect(mocks.egresos).not.toHaveBeenCalled();
  expect(mocks.tesoreria).not.toHaveBeenCalled();
});
