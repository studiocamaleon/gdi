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
  mocks.tesoreria.mockResolvedValue({ cuentas: [], kpis: {}, monedaLocal: "ARS" });
});
it("carga Egresos sin consultar Gastos fijos cuando el plan no los incluye", async () => {
  mocks.incluida.mockImplementation(async (clave) => clave === "cuentas_pagar");
  const pagina = await Page({ searchParams: Promise.resolve({}) });
  expect(pagina.type).not.toBe(FuncionNoIncluida);
  expect(pagina.props.gastosFijos).toEqual([]);
  expect(mocks.egresos).toHaveBeenCalledOnce();
  expect(mocks.gastos).not.toHaveBeenCalled();
});
it("conserva Egresos y Tesorería como historial sin cargar catálogos de gestión ni abrir altas por URL", async () => {
  mocks.incluida.mockResolvedValue(false);
  const egresos = await Page({ searchParams: Promise.resolve({ accion: "nuevo" }) });
  expect(egresos.type).not.toBe(FuncionNoIncluida);
  expect(egresos.props.altaInicial).toBe(false);
  expect(egresos.props.proveedores).toEqual([]);
  expect(egresos.props.metodosPago).toEqual([]);
  expect(egresos.props.cuentas).toEqual([]);
  expect((await TesoreriaPage()).type).not.toBe(FuncionNoIncluida);
  expect(mocks.egresos).toHaveBeenCalledOnce();
  expect(mocks.tesoreria).toHaveBeenCalledOnce();
  expect(mocks.gastos).not.toHaveBeenCalled();
});
