import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "@/app/(dashboard)/(cobros)/administracion/cobros/nuevo/page";
import Layout from "@/app/(dashboard)/(cobros)/layout";
const m = vi.hoisted(() => ({
  permiso: vi.fn(),
  orden: vi.fn(),
  cobros: vi.fn(),
  cuentas: vi.fn(),
  metodos: vi.fn(),
  cliente: vi.fn(),
  cuentaCorriente: vi.fn(),
}));
vi.mock("@/lib/permisos-server", () => ({
  tienePermiso: m.permiso,
  tieneSeccion: async () => false,
}));
vi.mock("@/lib/capacidades-server", () => ({
  tieneCapacidad: async () => true,
}));
vi.mock("@/lib/administracion-api", () => ({
  getCobros: m.cobros,
  getCuentasFondos: m.cuentas,
  getMetodosPago: m.metodos,
  getCuentaCorriente: m.cuentaCorriente,
}));
vi.mock("@/lib/ordenes-trabajo-api", () => ({ getOrdenTrabajo: m.orden }));
vi.mock("@/lib/clientes-api", () => ({ getClienteById: m.cliente }));
vi.mock("@/components/administracion/registrar-cobro-view", () => ({
  RegistrarCobroView: () => <span>Formulario de cobro</span>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.permiso.mockImplementation(async (p: string) =>
    ["administracion.cobrar", "comercial.ordenes.ver"].includes(p),
  );
  m.orden.mockResolvedValue({
    id: "orden",
    numero: "OT ficticia",
    total: 100,
    estado: "pendiente",
  });
  m.cobros.mockResolvedValue([{ montoBruto: 80, montoAplicadoOrden: 20 }]);
  m.cuentas.mockResolvedValue([]);
  m.metodos.mockResolvedValue([]);
});
it("el cobrador sin acceso general a Administración llega al formulario", async () => {
  const pagina = await Page({
    searchParams: Promise.resolve({ ordenId: "orden" }),
  });
  const html = renderToStaticMarkup(await Layout({ children: pagina }));
  expect(html).toContain("Formulario de cobro");
});
it("sin autorización no consulta datos ni ofrece el formulario", async () => {
  m.permiso.mockResolvedValue(false);
  const pagina = await Page({
    searchParams: Promise.resolve({ ordenId: "orden" }),
  });
  expect(renderToStaticMarkup(pagina)).not.toContain("Formulario de cobro");
  expect(m.orden).not.toHaveBeenCalled();
  expect(m.cuentas).not.toHaveBeenCalled();
});
it("el saldo descuenta sólo la parte aplicada a esta orden", async () => {
  const pagina = await Page({
    searchParams: Promise.resolve({ ordenId: "orden" }),
  });
  expect(pagina.props.contexto.cobradoBruto).toBe(20);
});

it("cobrar desde la ficha de cliente no consulta deudas sin permiso de cuenta corriente", async () => {
  m.permiso.mockImplementation(async (p: string) =>
    ["administracion.cobrar", "crm.clientes.ver"].includes(p),
  );
  m.cliente.mockResolvedValue({ id: "cliente", nombre: "Cliente ficticio" });
  const pagina = await Page({
    searchParams: Promise.resolve({ clienteId: "cliente" }),
  });
  expect(m.cuentaCorriente).not.toHaveBeenCalled();
  expect(m.cliente).toHaveBeenCalledWith("cliente");
  expect(pagina.props.contexto).toEqual({
    tipo: "cliente",
    id: "cliente",
    nombre: "Cliente ficticio",
    saldo: null,
  });
});
it("el permiso para cobrar no habilita por sí solo la consulta de cualquier OT", async () => {
  m.permiso.mockImplementation(
    async (p: string) => p === "administracion.cobrar",
  );
  const pagina = await Page({
    searchParams: Promise.resolve({ ordenId: "orden" }),
  });
  expect(renderToStaticMarkup(pagina)).not.toContain("Formulario de cobro");
  expect(m.orden).not.toHaveBeenCalled();
});
