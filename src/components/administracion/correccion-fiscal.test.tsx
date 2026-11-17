// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ClienteSelectorComprobante,
  type ClienteOpcionFiscal,
} from "./cliente-selector-comprobante";
import { ComprobanteCorreccionView } from "./comprobante-correccion-view";
import { listClientes } from "@/lib/clientes-api";
import { crearNotaCreditoTotal } from "@/lib/administracion-api";
import type { Comprobante } from "@/lib/administracion";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/clientes-api", () => ({ listClientes: vi.fn() }));
vi.mock("@/lib/administracion-api", () => ({ crearNotaCreditoTotal: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/design-system/appearance", () => ({
  useDesignScope: () => ({}),
  useDesignTheme: () => "",
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    options,
    value,
    onChange,
    disabled,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Cliente del comprobante"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    isDisabled?: boolean;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
const inicial: ClienteOpcionFiscal = {
  id: "cliente-1",
  nombre: "Alfa",
  razonSocial: "Alfa SA",
  cuit: "",
  condicionFiscal: "consumidor_final",
};
const ultimo: ClienteOpcionFiscal = {
  ...inicial,
  id: "cliente-889",
  nombre: "Último",
  razonSocial: "Último SA",
  condicionFiscal: "RI",
  cuit: "30000000015",
};
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const respuesta = (data: ClienteOpcionFiscal[], total: number, page = 1) =>
  ({ data, total, page, limit: 30, pages: Math.ceil(total / 30) }) as Awaited<
    ReturnType<typeof listClientes>
  >;
function Selector() {
  const [value, setValue] = useState<ClienteOpcionFiscal | null>(null);
  return (
    <ClienteSelectorComprobante
      iniciales={[inicial]}
      value={value}
      onChange={setValue}
    />
  );
}
async function tiempo(ms = 230) {
  await act(async () => vi.advanceTimersByTime(ms));
}
async function buscar(texto: string) {
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await tiempo();
}
const boton = (texto: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  )!;
it("busca fuera de los primeros 200, permite recorrer páginas y conserva el cliente elegido", async () => {
  vi.mocked(listClientes)
    .mockResolvedValueOnce(respuesta([inicial], 889))
    .mockResolvedValueOnce(respuesta([ultimo], 889, 2))
    .mockResolvedValueOnce(respuesta([ultimo], 1));
  await act(async () => root.render(<Selector />));
  await tiempo();
  expect(container.textContent).toContain("889 clientes");
  await act(async () => boton("Siguiente").click());
  await tiempo();
  expect(listClientes).toHaveBeenLastCalledWith(
    { q: "", page: 2, limit: 30 },
    true,
  );
  expect(container.textContent).toContain("Página 2 de 30");
  await buscar("Último SA");
  expect(listClientes).toHaveBeenLastCalledWith(
    { q: "Último SA", page: 1, limit: 30 },
    true,
  );
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = ultimo.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  vi.mocked(listClientes).mockResolvedValueOnce(respuesta([inicial], 889));
  await buscar("");
  expect(select.value).toBe(ultimo.id);
  expect(select.textContent).toContain("Último SA");
});
it("descarta respuestas viejas y bloquea la selección cuando falla una búsqueda", async () => {
  let antigua: (value: Awaited<ReturnType<typeof listClientes>>) => void;
  vi.mocked(listClientes).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        antigua = resolve;
      }),
  );
  await act(async () => root.render(<Selector />));
  await tiempo();
  vi.mocked(listClientes).mockResolvedValueOnce(respuesta([ultimo], 1));
  await buscar("ultimo");
  await act(async () => antigua!(respuesta([inicial], 889)));
  expect(container.textContent).toContain("1 cliente");
  vi.mocked(listClientes).mockRejectedValueOnce(new Error("sin conexión"));
  await buscar("otra");
  expect(container.textContent).toContain("No se pudieron cargar");
  expect(container.querySelector("select")!.disabled).toBe(true);
  expect(boton("Reintentar")).toBeDefined();
});
it("prepara la nota desde la factura original sin selector de otro receptor ni emisión fiscal", async () => {
  const origen = {
    id: "factura-ficticia",
    tipo: "factura",
    estado: "emitido",
    numeroCompleto: "B 0001-00000001",
    clienteNombre: "Taller ficticio",
    clienteRazonSocial: "Receptor original",
    clienteCuit: "30000000015",
    letra: "B",
    moneda: "ARS",
    total: 121,
    ordenes: [{ ordenId: "ot-ficticia", numero: "OT-FICTICIA", monto: 121 }],
  } as Comprobante;
  vi.mocked(crearNotaCreditoTotal).mockResolvedValue({
    id: "nota-ficticia",
  } as Comprobante);
  await act(async () =>
    root.render(<ComprobanteCorreccionView origen={origen} />),
  );
  expect(container.textContent).toContain("Receptor original");
  expect(container.textContent).toContain("121");
  expect(container.querySelector("select")).toBeNull();
  await act(async () => boton("Crear borrador de nota de crédito").click());
  expect(crearNotaCreditoTotal).toHaveBeenCalledWith("factura-ficticia");
  expect(push).toHaveBeenCalledWith(
    "/administracion/comprobantes/nota-ficticia",
  );
});
