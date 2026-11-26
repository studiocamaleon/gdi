// @vitest-environment jsdom
import { act, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DespachoOrden } from "@/lib/ordenes-trabajo";
import { DespachoOrdenCampo } from "./despacho-orden";

const api = vi.hoisted(() => ({ getClientes: vi.fn() }));
vi.mock("@/lib/clientes-api", () => api);
type Cliente = NonNullable<
  ComponentProps<typeof DespachoOrdenCampo>["cliente"]
>;
const cliente: Cliente = {
  id: "cliente-prueba",
  ciudad: "Río Gallegos",
  direcciones: [],
};
let root: Root, contenedor: HTMLDivElement;
const onChange = vi.fn();

function Ficha({
  inicial = null,
  ficha = cliente,
  editable = true,
}: {
  inicial?: DespachoOrden | null;
  ficha?: Cliente;
  editable?: boolean;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <DespachoOrdenCampo
      cliente={ficha}
      editable={editable}
      valor={valor}
      onChange={(v) => {
        onChange(v);
        setValor(v);
      }}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("CSS", { escape: (s: string) => s });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

function boton(nombre: string) {
  const btn = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === nombre,
  );
  if (!btn) throw new Error(`No se encontró el botón ${nombre}`);
  return btn;
}
async function pulsar(nombre: string) {
  await act(async () => boton(nombre).click());
}
function campos() {
  return [
    ...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input'),
  ];
}
async function escribir(input: HTMLInputElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("empieza en el local y permite guardar sólo la localidad, editarla o volver a retiro", async () => {
  await act(async () => root.render(<Ficha />));
  expect(boton("Retiro en el local").hasAttribute("data-selected")).toBe(true);
  expect(campos()).toHaveLength(0);
  await pulsar("Despacho por transporte");
  expect(campos().map((i) => [i.value, i.required])).toEqual([
    ["Río Gallegos", true],
    ["", false],
    ["", false],
  ]);
  await escribir(campos()[0], "   ");
  expect(boton("Guardar despacho").disabled).toBe(true);
  await escribir(campos()[0], "  Puerto Deseado  ");
  await pulsar("Guardar despacho");
  expect(onChange).toHaveBeenLastCalledWith({
    localidad: "Puerto Deseado",
    direccion: "",
    transporte: "",
  });
  expect(contenedor.textContent).toContain("Despacho a Puerto Deseado");
  expect(boton("Despacho por transporte").hasAttribute("data-selected")).toBe(
    true,
  );
  await pulsar("Editar despacho");
  expect(campos()[0].value).toBe("Puerto Deseado");
  await escribir(campos()[0], "Otro destino");
  await pulsar("Cancelar");
  expect(onChange).toHaveBeenCalledTimes(1);
  await pulsar("Retiro en el local");
  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(api.getClientes).not.toHaveBeenCalled();
});

it("prefiere el domicilio de entrega y descarta un despacho nuevo al cancelar", async () => {
  const entrega = {
    id: "envio",
    descripcion: "",
    tipo: "entrega" as const,
    principal: false,
    pais: "AR",
    ciudad: "El Calafate",
    direccion: "Calle de prueba",
    numero: "12",
    codigoPostal: "9405",
  };
  await act(async () =>
    root.render(<Ficha ficha={{ ...cliente, direcciones: [entrega] }} />),
  );
  await pulsar("Despacho por transporte");
  expect(campos().map((i) => i.value)).toEqual([
    "El Calafate",
    "Calle de prueba 12 (CP 9405)",
    "",
  ]);
  await pulsar("Cancelar");
  expect(onChange).not.toHaveBeenCalled();
  expect(boton("Retiro en el local").hasAttribute("data-selected")).toBe(true);
});

it("carga el cliente fuera de la página al abrir y respeta el texto ya editado", async () => {
  let resolver!: (clientes: Cliente[]) => void;
  api.getClientes.mockReturnValue(
    new Promise<Cliente[]>((resolve) => {
      resolver = resolve;
    }),
  );
  await act(async () => root.render(<Ficha ficha={{ id: cliente.id }} />));
  expect(api.getClientes).not.toHaveBeenCalled();
  await pulsar("Despacho por transporte");
  expect(api.getClientes).toHaveBeenCalledWith(
    { id: cliente.id, limit: 1, incluirInactivos: true },
    true,
  );
  await escribir(campos()[2], "Expreso de prueba");
  await act(async () => resolver([cliente]));
  expect(campos().map((i) => i.value)).toEqual([
    "Río Gallegos",
    "",
    "Expreso de prueba",
  ]);
});

it("muestra los datos acordados en una OT de sólo lectura", async () => {
  await act(async () =>
    root.render(
      <Ficha
        editable={false}
        inicial={{
          localidad: "Otra localidad",
          direccion: "Sucursal original",
          transporte: "Expreso original",
        }}
      />,
    ),
  );
  await pulsar("Ver despacho");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Sucursal original",
  );
  expect(campos()).toHaveLength(0);
  expect(onChange).not.toHaveBeenCalled();
});
