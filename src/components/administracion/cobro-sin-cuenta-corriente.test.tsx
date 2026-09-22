import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import RegistrarCobroPage from "@/app/(dashboard)/administracion/cobros/nuevo/page";
import { RegistrarCobroView } from "./registrar-cobro-view";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
import { capacidadDeRuta } from "@/lib/capacidades";

const mocks = vi.hoisted(() => ({
  cuenta: vi.fn(),
  orden: vi.fn(),
  cliente: vi.fn(),
  capacidad: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => ({
  getCuentaCorriente: mocks.cuenta,
  getCobros: vi.fn().mockResolvedValue([]),
  getCuentasFondos: vi.fn().mockResolvedValue([]),
  getMetodosPago: vi.fn().mockResolvedValue([]),
  crearCobro: vi.fn(),
}));
vi.mock("@/lib/ordenes-trabajo-api", () => ({ getOrdenTrabajo: mocks.orden }));
vi.mock("@/lib/clientes-api", () => ({ getClienteById: mocks.cliente }));
vi.mock("@/lib/capacidades-server", () => ({
  tieneCapacidad: mocks.capacidad,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("404");
  },
}));
vi.mock("./cobro-formulario", () => ({
  CobroFormulario: () => <button>Registrar pago</button>,
}));
beforeEach(() => vi.clearAllMocks());

it("obtiene el cliente sin consultar su extracto cuando cuentas por cobrar no está incluida", async () => {
  mocks.capacidad.mockImplementation(
    async (clave: string) => clave !== "cuentas_cobrar",
  );
  mocks.cliente.mockResolvedValue({ id: "cliente", nombre: "Imprenta" });
  const pagina = await RegistrarCobroPage({
    searchParams: Promise.resolve({ clienteId: "cliente" }),
  });
  expect(mocks.cuenta).not.toHaveBeenCalled();
  expect(mocks.cliente).toHaveBeenCalledWith("cliente");
  expect(pagina.props.contexto).toEqual({
    tipo: "cliente",
    id: "cliente",
    nombre: "Imprenta",
    saldo: null,
  });
});

it("con la función incluida mantiene el saldo para sugerir el importe", async () => {
  mocks.capacidad.mockResolvedValue(true);
  mocks.cuenta.mockResolvedValue({
    cliente: { id: "cliente", nombre: "Imprenta" },
    saldo: 125,
  });
  const pagina = await RegistrarCobroPage({
    searchParams: Promise.resolve({ clienteId: "cliente" }),
  });
  expect(mocks.cuenta).toHaveBeenCalledWith("cliente");
  expect(mocks.cliente).not.toHaveBeenCalled();
  expect(pagina.props.contexto.saldo).toBe(125);
});

it("permite registrar un pago sin mostrar deuda cero ni volver a una cuenta excluida", () => {
  const html = renderToStaticMarkup(
    <CapacidadesProvider capacidades={{ funciones: { cuentas_cobrar: false } }}>
      <RegistrarCobroView
        contexto={{
          tipo: "cliente",
          id: "cliente",
          nombre: "Imprenta",
          saldo: null,
        }}
        metodos={[]}
        cuentas={[]}
      />
    </CapacidadesProvider>,
  );
  expect(html).toContain("Registrar pago");
  expect(html).toContain('href="/crm/clientes/cliente"');
  expect(html).not.toContain("cuenta-corriente");
  expect(html).not.toContain("Saldo deudor");
});

it.each([
  "/administracion/deudores",
  "/crm/clientes/a/cuenta-corriente",
  "/clientes/a/cuenta-corriente",
])(
  "identifica la capacidad de %s sin bloquear la ficha del cliente",
  (ruta) => {
    expect(capacidadDeRuta(ruta)).toBe("cuentas_cobrar");
    expect(capacidadDeRuta("/crm/clientes/a")).toBeNull();
  },
);

it("sin F01 bloquea los anticipos nuevos de cliente", async () => {
  mocks.capacidad.mockResolvedValue(false);
  const pagina = await RegistrarCobroPage({
    searchParams: Promise.resolve({ clienteId: "cliente" }),
  });
  expect(renderToStaticMarkup(pagina)).toContain("Función no incluida");
  expect(mocks.cliente).not.toHaveBeenCalled();
});
it.each([true, false])(
  "sin F01 conserva el cobro de una OT sólo si fue habilitado al emitir: %s",
  async (habilitada) => {
    mocks.capacidad.mockResolvedValue(false);
    mocks.orden.mockResolvedValue({
      id: "orden",
      numero: "OT",
      estado: "pendiente",
      total: 100,
      cobradoTotal: 0,
      cobrosHabilitadosEmision: habilitada,
    });
    const pagina = await RegistrarCobroPage({
      searchParams: Promise.resolve({ ordenId: "orden" }),
    });
    if (habilitada) expect(pagina.props.contexto.tipo).toBe("orden");
    else expect(renderToStaticMarkup(pagina)).toContain("Función no incluida");
  },
);
