// @vitest-environment jsdom
import { act, type ReactNode, type InputHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompraForm } from "./compra-form";
import {
  crearCompra,
  type CatalogoCompras,
  type NecesidadCompra,
} from "@/lib/compras-api";
vi.mock("@/lib/compras-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/compras-api")>()),
  crearCompra: vi.fn(),
}));
vi.mock("@heroui/react", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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
  SelectField: ({
    value,
    options,
    onChange,
    ...props
  }: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (v: string) => void;
    "aria-label": string;
  }) => (
    <select
      aria-label={props["aria-label"]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" />
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/inventario/inventory-variant-picker", () => ({
  InventoryVariantPicker: () => null,
}));
vi.mock("@/components/inventario/stock-conversion-fields", () => ({
  stockUnitLabel: (u: string) => u,
}));
let root: Root, container: HTMLDivElement;
const oferta = {
  id: "f",
  proveedorId: "p",
  varianteId: "v",
  codigoProveedor: null,
  unidadCompra: "RESMA",
  unidadStock: "HOJA",
  factorStock: 500,
  precio: 5000,
  moneda: "ARS",
  minimo: 1,
  multiplo: 1,
  reposicionDias: null,
  reposicionTipo: null,
  vigenteHasta: null,
  activo: true,
  version: 1,
};
const catalogo = (): CatalogoCompras => ({
  proveedores: [
    {
      id: "p",
      nombre: "Papelera",
      reposicionDias: 2,
      reposicionTipo: "HABILES",
    },
  ],
  variantes: [
    {
      id: "v",
      nombreVariante: "A4",
      atributosVarianteJson: {},
      unidadCompra: "RESMA",
      unidadStock: "HOJA",
      proveedorReferenciaId: "p",
      materiaPrima: {
        nombre: "Papel",
        unidadCompra: "RESMA",
        unidadStock: "HOJA",
      },
      ofertasCompra: [{ ...oferta }],
    },
  ],
  ubicaciones: [
    { id: "u", nombre: "Principal", almacen: { nombre: "Depósito" } },
  ],
  monedaStock: "ARS",
  unidades: ["HOJA", "RESMA"],
});
const n = (id: string, qty: number): NecesidadCompra => ({
  id,
  orden: { id: "o" + id, numero: "OT-" + id },
  varianteId: "v",
  nombre: "Papel A4",
  unidad: "hoja",
  revision: "r",
  revisar: false,
  cantidad: qty,
  reservada: 0,
  consumida: 0,
  pendiente: qty,
  enCompra: 0,
  porCubrir: qty,
  libre: 0,
  compras: [],
  proveedor: {
    id: "p",
    nombre: "Papelera",
    reposicionDias: 2,
    reposicionTipo: "HABILES",
  },
});
async function render(c = catalogo()) {
  await act(async () => {
    root.render(
      <CompraForm
        catalogo={c}
        necesidades={[n("1", 300), n("2", 400)]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
  });
}
function input(label: string) {
  return container.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  )!;
}
async function cambiar(label: string, value: string) {
  await act(async () => {
    const el = input(label);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function guardar() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function seleccionar(label: string, value: string) {
  await act(async () => {
    const el = container.querySelector<HTMLSelectElement>(
      `select[aria-label="${label}"]`,
    )!;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(crearCompra).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe("Preparar compra desde necesidades", () => {
  it("consolida por variante, redondea a presentación y conserva cada OT", async () => {
    await render();
    expect(input("Cantidad material 1").value).toBe("2");
    vi.mocked(crearCompra).mockResolvedValue({ ordenId: "oc" });
    await guardar();
    expect(crearCompra).toHaveBeenCalledWith(
      expect.objectContaining({
        proveedorId: "p",
        ubicacionId: "u",
        lineas: [
          expect.objectContaining({
            cantidad: 2,
            factorStock: 500,
            precio: 5000,
            asignaciones: [
              { necesidadId: "1", revision: "r", cantidad: 300 },
              { necesidadId: "2", revision: "r", cantidad: 400 },
            ],
          }),
        ],
      }),
    );
  });
  it("no precarga como ARS una oferta en USD y pide confirmar el precio", async () => {
    const c = catalogo();
    c.variantes[0].ofertasCompra[0].moneda = "USD";
    await render(c);
    expect(input("Precio material 1").value).toBe("");
    await guardar();
    expect(crearCompra).not.toHaveBeenCalled();
    expect(container.textContent).toContain("La oferta está en USD");
  });
  it("reintenta con la misma clave después de perder la respuesta, y renueva si cambian datos", async () => {
    await render();
    vi.mocked(crearCompra).mockRejectedValue(new Error("Sin conexión"));
    await guardar();
    await guardar();
    const [a, b] = vi.mocked(crearCompra).mock.calls;
    expect(a[0].clave).toBe(b[0].clave);
    await cambiar("Cantidad material 1", "3");
    await guardar();
    expect(vi.mocked(crearCompra).mock.calls[2][0].clave).not.toBe(a[0].clave);
  });
  it("cambiar moneda limpia los precios para no reinterpretarlos", async () => {
    await render();
    await cambiar("Moneda de la compra", "USD");
    expect(input("Precio material 1").value).toBe("");
    expect(input("Tipo de cambio de la compra").value).toBe("");
  });
  it("precarga el costo del inventario y su conversión aunque no haya oferta", async () => {
    const c = catalogo();
    c.variantes[0].ofertasCompra = [];
    c.variantes[0].precioReferencia = 12;
    c.variantes[0].moneda = "ARS";
    c.variantes[0].contextoUnidades = {
      unidadStock: "HOJA",
      unidadCompra: "RESMA",
      unidadPrecio: "HOJA",
      equivalencias: [{ origen: "RESMA", destino: "HOJA", factor: 500 }],
    };
    await render(c);
    expect(input("Precio material 1").value).toBe("6000");
    expect(input("Contenido material 1").value).toBe("500");
    expect(input("Contenido material 1").readOnly).toBe(true);
    expect(container.textContent).toContain("Costo del inventario");
    await seleccionar("Unidad material 1", "HOJA");
    expect(input("Precio material 1").value).toBe("12");
    expect(input("Cantidad material 1").value).toBe("700");
    await guardar();
    expect(crearCompra).toHaveBeenCalledWith(
      expect.objectContaining({
        lineas: [
          expect.objectContaining({
            cantidad: 700,
            factorStock: 1,
            precio: 12,
          }),
        ],
      }),
    );
  });
  it("cambiar unidad conserva el total y el precio negociado manualmente", async () => {
    await render();
    await cambiar("Precio material 1", "4500");
    await seleccionar("Unidad material 1", "HOJA");
    expect(input("Precio material 1").value).toBe("9");
    expect(input("Cantidad material 1").value).toBe("1000");
    await seleccionar("Unidad material 1", "RESMA");
    expect(input("Precio material 1").value).toBe("4500");
    expect(input("Cantidad material 1").value).toBe("2");
  });
});
