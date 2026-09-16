import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type {
  CuentaFondos,
  TesoreriaKpis,
  CobroPendienteAcreditacion,
  ValorTesoreria,
} from "@/lib/administracion";
import { TesoreriaView } from "./tesoreria-view";
import { AcreditacionesView } from "./acreditaciones-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
const cuenta: CuentaFondos = {
  id: "banco",
  tipo: "banco",
  nombre: "Banco ARS",
  banco: "Entidad",
  cbuAlias: null,
  moneda: "ARS",
  saldo: 1234.56,
  permiteSaldoNegativo: false,
  ultimoMovimiento: null,
  activo: true,
};
const kpis: TesoreriaKpis = {
  posicionLocal: 1234.56,
  posiciones: { ARS: 1234.56, USD: 50.25 },
  efectivo: 0,
  bancos: 1234.56,
  cajasActivas: 0,
  cuentasLocales: 1,
  aAcreditar: 87.65,
  aAcreditarPorMoneda: { ARS: 87.65, USD: 12.34 },
  valoresEnCartera: 0,
  valoresPorMoneda: { CLP: 3500 },
};
const cobro: CobroPendienteAcreditacion = {
  id: "cobro",
  fecha: "2026-09-16",
  fechaAcreditacionEstimada: null,
  metodoNombre: "Tarjeta",
  metodoTipo: "tarjeta",
  cuentaDestinoNombre: "Banco ARS",
  clienteNombre: "Cliente electrónico",
  ordenId: "ot",
  ordenNumero: "OT-60",
  montoBruto: 100.98,
  netoAcreditado: 90.87,
  disponibleReal: 80.76,
  moneda: "ARS",
  esCheque: false,
  valorEstado: null,
  valorNumero: null,
};
const valor: ValorTesoreria = {
  id: "v1",
  origen: "tercero",
  formato: "echeq",
  modalidad: "diferido",
  numero: "001",
  banco: "Entidad emisora",
  identificadorBancario: "ID-01",
  importe: 50.25,
  moneda: "USD",
  fechaEmision: "2026-09-16",
  fechaPago: "2026-09-30",
  estado: "cartera",
  motivoRechazo: null,
  depositadoEl: null,
  acreditadoEl: null,
  endosadoEl: null,
  debitadoEl: null,
  anuladoEl: null,
  rechazadoEl: null,
  clienteNombre: "Cliente cheque",
  proveedorNombre: null,
  cobroId: "cheque",
  numeroRecibo: "REC-1",
  cobroAnulado: false,
  cuentaDeposito: null,
  pagoId: null,
  pagoNumero: null,
  pagoAnulado: false,
  cuentaOrigen: null,
  eventos: [],
};
const render = (
  children: ReactNode,
  permisos = ["administracion.gestionar", "administracion.anular"],
) =>
  renderToStaticMarkup(
    <DesignSystemProvider theme="brand" appearance="light">
      <PermisosProvider permisos={permisos}>{children}</PermisosProvider>
    </DesignSystemProvider>,
  );
const tesoreria = (cuentas = [cuenta], permisos?: string[]) =>
  render(
    <TesoreriaView
      initialCuentas={cuentas}
      initialKpis={kpis}
      monedaLocal="ARS"
    />,
    permisos,
  );
const valores = (
  items: ValorTesoreria[],
  permisos?: string[],
  filas: CobroPendienteAcreditacion[] = [],
) =>
  render(
    <AcreditacionesView
      initialValores={items}
      initialFilas={filas}
      cuentas={[cuenta]}
    />,
    permisos,
  );
const buttons = (html: string) =>
  (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).join("\n");

describe("Tesorería y valores · presentación y operaciones disponibles", () => {
  it("conserva centavos y separa las posiciones por moneda", () => {
    const html = tesoreria();
    expect(html).toContain("1.234,56");
    expect(html).toContain("50,25");
    expect(html).toContain("USD");
    expect(html).toContain("CLP");
    expect(html).toContain("3.500");
    expect(html).not.toContain("3.500,00");
    expect(html).toContain("12,34");
  });
  it("oculta mutaciones al usuario de consulta y mantiene el acceso a valores", () => {
    const html = tesoreria([cuenta], ["administracion.ver"]);
    expect(buttons(html)).not.toMatch(
      /Nueva cuenta|Transferir|Desactivar|Ajuste|Arqueo|Editar/,
    );
    expect(html).toContain('href="/administracion/tesoreria/acreditaciones"');
    expect(buttons(html)).toContain("CSV");
  });
  it("permite arqueo sólo en cajas activas y conserva saldos negativos e inactivos", () => {
    expect(buttons(tesoreria())).not.toContain("Arqueo");
    expect(buttons(tesoreria([{ ...cuenta, tipo: "caja" }]))).toContain(
      "Arqueo",
    );
    const html = tesoreria([
      { ...cuenta, tipo: "caja", activo: false, saldo: -123.45 },
    ]);
    expect(html).toContain("-123,45");
    expect(html).toContain("Inactiva");
    expect(buttons(html)).toContain("Activar");
    expect(buttons(html)).not.toMatch(/Arqueo|>Ajuste</);
  });
  it("deshabilita transferencias si no hay dos cuentas activas", () => {
    const html = tesoreria([
      cuenta,
      { ...cuenta, id: "inactiva", activo: false },
    ]);
    const transfer = (
      html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
    ).find((b) => b.includes("Transferir"));
    expect(transfer).toContain("disabled");
    const empty = tesoreria([]);
    expect(empty).toContain("No hay cuentas");
    expect(empty).not.toContain("Cuenta seleccionada");
  });
  it("muestra el disponible real de cobros y evita duplicar cheques como electrónicos", () => {
    const html = valores([valor], undefined, [
      cobro,
      {
        ...cobro,
        id: "duplicado",
        esCheque: true,
        clienteNombre: "No duplicar este cheque",
      },
    ]);
    expect(html).toContain("100,98");
    expect(html).toContain("80,76");
    expect(html).not.toContain("90,87");
    expect(html).not.toContain("No duplicar este cheque");
    expect(html).toContain("Cliente cheque");
    expect(html).toContain("USD");
    expect(html).toContain("50,25");
  });
  it("conserva las acciones de cartera, depósito y cheque propio por estado", () => {
    const cartera = buttons(valores([valor]));
    expect(cartera).toMatch(/Depositar/);
    expect(cartera).toMatch(/Endosar/);
    expect(cartera).toMatch(/Rechazar/);
    expect(cartera).not.toMatch(/Confirmar débito|Deshacer depósito/);
    const deposito = buttons(valores([{ ...valor, estado: "depositado" }]));
    expect(deposito).toMatch(/Acreditar/);
    expect(deposito).toMatch(/Deshacer depósito/);
    expect(deposito).not.toMatch(/Endosar|Depositar/);
    const propio = buttons(
      valores([
        { ...valor, origen: "propio", estado: "emitido", pagoId: "pago1" },
      ]),
    );
    expect(propio).toMatch(/Confirmar débito/);
    expect(propio).toMatch(/Informar rechazo/);
    expect(propio).toMatch(/Anular emisión/);
    expect(propio).not.toMatch(/Depositar|Endosar/);
  });
  it("distingue permisos de gestión, anulación y consulta de valores", () => {
    const deposito = { ...valor, estado: "depositado" as const };
    const gestionar = buttons(
      valores([deposito], ["administracion.gestionar"]),
    );
    expect(gestionar).toContain("Acreditar");
    expect(gestionar).not.toMatch(/Deshacer depósito|Rechazar/);
    const anular = buttons(valores([deposito], ["administracion.anular"]));
    expect(anular).toMatch(/Deshacer depósito/);
    expect(anular).not.toContain("Acreditar");
    const consultar = buttons(
      valores([deposito], ["administracion.ver"], [cobro]),
    );
    expect(consultar).not.toMatch(/Acreditar|Deshacer depósito|Rechazar/);
  });
  it("muestra estados vacíos sin inventar valores y excluye cheques propios del total recibido", () => {
    const html = valores([]);
    expect(html).toContain("Sin pendientes");
    expect(html).toContain("Sin valores");
    expect(html).toContain("No hay valores para este filtro");
    const propio = valores([{ ...valor, origen: "propio", estado: "emitido" }]);
    expect(propio).toContain("Sin valores");
    expect(propio).toContain("Cheque propio");
  });
});
