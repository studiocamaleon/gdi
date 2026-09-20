// @vitest-environment jsdom
import { act, type ReactNode, type InputHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompraDetalle } from "./compra-detalle";
import {
  getCompra,
  recibirCompra,
  type Compra,
  type CatalogoCompras,
} from "@/lib/compras-api";
vi.mock("@/lib/compras-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/compras-api")>()),
  getCompra: vi.fn(),
  recibirCompra: vi.fn(),
  accionCompra: vi.fn(),
}));
vi.mock("@heroui/react", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TextArea: () => null,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
    isPending,
    type,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    isPending?: boolean;
    type?: "button" | "submit";
  }) => (
    <button
      type={type ?? "button"}
      disabled={isDisabled || isPending}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: () => null,
}));
vi.mock("@/components/inventario/stock-conversion-fields", () => ({
  stockUnitLabel: (u: string) => u,
}));
let root: Root, container: HTMLDivElement;
const compra = (): Compra => ({
  id: "oc",
  numero: 1,
  estado: "EMITIDA",
  version: 2,
  proveedorId: "p",
  proveedorNombre: "Papelera",
  ubicacionId: "u",
  ubicacion: { nombre: "Principal", almacen: { nombre: "Depósito" } },
  fechaPedido: "2026-09-18",
  moneda: "ARS",
  monedaStock: "ARS",
  tipoCambio: 1,
  notas: null,
  motivoCierre: null,
  lineas: [
    {
      id: "l",
      varianteId: "v",
      nombre: "Papel A4",
      unidadCompra: "RESMA",
      unidadStock: "HOJA",
      factorStock: 500,
      cantidad: 2,
      recibida: 0,
      precio: 5000,
      fechaEstimada: "2026-09-22",
      fechaConfirmada: null,
      plazoDias: 2,
      plazoTipo: "HABILES",
    },
  ],
  recepciones: [],
});
const catalogo = {
  ubicaciones: [
    { id: "u", nombre: "Principal", almacen: { nombre: "Depósito" } },
  ],
} as CatalogoCompras;
async function render(canManage = true) {
  await act(async () => {
    root.render(
      <CompraDetalle
        id="oc"
        catalogo={catalogo}
        canManage={canManage}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
  });
}
async function click(text: string) {
  await act(async () => {
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === text)!
      .click();
  });
}
async function cantidad(value: string) {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>(
      'input[aria-label="Recibir Papel A4"]',
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(getCompra).mockResolvedValue(compra());
  vi.mocked(recibirCompra).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("Confirmar recepción", () => {
  it("pide cantidades explícitas y usa la conversión guardada para una recepción parcial", async () => {
    await render();
    await click("Recibir materiales");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Recibir Papel A4"]',
      )!.value,
    ).toBe("");
    await submit();
    expect(recibirCompra).not.toHaveBeenCalled();
    await cantidad("1");
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Stock recibido Papel A4"]',
      )!.value,
    ).toBe("500");
    vi.mocked(recibirCompra).mockResolvedValue({ ordenId: "oc" });
    await submit();
    expect(recibirCompra).toHaveBeenCalledWith(
      "oc",
      expect.objectContaining({
        version: 2,
        ubicacionId: "u",
        lineas: [{ lineaId: "l", cantidad: 1, cantidadStock: 500 }],
      }),
    );
  });
  it("reintentar una recepción con error conserva su clave", async () => {
    await render();
    await click("Recibir materiales");
    await cantidad("1");
    vi.mocked(recibirCompra).mockRejectedValue(new Error("Sin conexión"));
    await submit();
    await submit();
    const calls = vi.mocked(recibirCompra).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1].clave).toBe(calls[1][1].clave);
  });
  it("consulta sin gestión no ofrece recibir ni cancelar", async () => {
    await render(false);
    expect(container.textContent).not.toContain("Recibir materiales");
    expect(container.textContent).not.toContain("Cancelar compra");
    expect(container.textContent).toContain("Papel A4");
  });
  it("una compra recibida no vuelve a ofrecer ingreso de stock", async () => {
    const c = compra();
    c.estado = "RECIBIDA";
    c.lineas[0].recibida = 2;
    vi.mocked(getCompra).mockResolvedValue(c);
    await render();
    expect(container.textContent).not.toContain("Recibir materiales");
  });
});
