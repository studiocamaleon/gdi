// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CentroStockPanel } from "./centro-stock-panel";
import {
  registrarMovimientoStock,
  registrarTransferenciaStock,
} from "@/lib/inventario-stock-api";
import { monedaDe } from "@/lib/monedas";

const mocks = vi.hoisted(() => ({ canManage: true, refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => mocks.canManage,
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useConfigRegional: () => ({ moneda: monedaDe("ARS") }),
}));
vi.mock("@/lib/inventario-stock-api", () => ({
  createAlmacen: vi.fn(),
  registrarMovimientoStock: vi.fn(async () => ({})),
  registrarTransferenciaStock: vi.fn(async () => ({})),
}));
vi.mock("@/lib/materias-primas-api", () => ({
  updateVariantePrecioReferencia: vi.fn(),
}));
vi.mock("./use-inventory-query", () => ({
  useInventoryQuery: () => ({ page: 1, update: vi.fn() }),
}));
vi.mock("./use-stock-page", () => ({
  useStockPage: () => ({
    loading: false,
    error: null,
    refresh: vi.fn(),
    result: {
      total: 1,
      page: 1,
      pageSize: 50,
      items: [
        {
          id: "saldo",
          varianteId: "variante",
          materiaPrimaId: "material",
          materiaPrimaNombre: "Placa",
          ubicacionId: "secundaria",
          ubicacionNombre: "Estante",
          almacenId: "deposito",
          almacenNombre: "Taller",
          cantidadDisponible: 10,
          unidadStock: "PLACA",
          costoPromedio: 3,
          valorStock: 30,
        },
      ],
    },
  }),
}));
// Se reemplaza sólo el contenedor de portal y los selectores; se ejercitan los handlers reales.
vi.mock("@/components/design-system/form-sheet", () => ({
  FormSheet: ({
    title,
    children,
    footer,
  }: {
    title: string;
    children: ReactNode;
    footer: ReactNode;
  }) => (
    <section role="dialog" aria-label={title}>
      {children}
      {footer}
    </section>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    options,
    onChange,
    value,
    "aria-label": label,
  }: {
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    value: string;
    "aria-label": string;
  }) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("./inventory-variant-picker", () => ({
  InventoryVariantPicker: () => null,
}));

const warehouses: ComponentProps<typeof CentroStockPanel>["initialAlmacenes"] =
  [
    {
      id: "deposito",
      codigo: "TALLER",
      nombre: "Taller",
      descripcion: "",
      activo: true,
      createdAt: "",
      updatedAt: "",
      ubicaciones: [
        {
          id: "principal",
          codigo: "PRINCIPAL",
          nombre: "Principal",
          descripcion: "",
          activo: true,
        },
        {
          id: "secundaria",
          codigo: "ESTANTE",
          nombre: "Estante",
          descripcion: "",
          activo: true,
        },
        {
          id: "inactiva",
          codigo: "VIEJA",
          nombre: "Vieja",
          descripcion: "",
          activo: false,
        },
      ],
    },
  ];
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.canManage = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(
      <CentroStockPanel initialAlmacenes={warehouses} materiasPrimas={[]} />,
    );
  });
}
function button(name: string) {
  const found = [...container.querySelectorAll("button")].find(
    (item) =>
      (item.getAttribute("aria-label") ?? item.textContent)?.trim() === name,
  );
  expect(found, `Botón ${name}`).toBeDefined();
  return found!;
}

describe("operaciones sobre una ubicación secundaria", () => {
  it("el movimiento conserva la ubicación de la fila, no la principal del depósito", async () => {
    await render();
    await act(async () => {
      button("Movimiento").click();
    });
    await act(async () => {
      button("Registrar movimiento").click();
    });
    expect(registrarMovimientoStock).toHaveBeenCalledWith(
      expect.objectContaining({
        varianteId: "variante",
        ubicacionId: "secundaria",
        cantidad: 1,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("permite transferir a otra ubicación activa dentro del mismo depósito", async () => {
    await render();
    expect(button("Transferir desde esta ubicación").disabled).toBe(false);
    await act(async () => {
      button("Transferir desde esta ubicación").click();
    });
    const destination = container.querySelector(
      'select[aria-label="Ubicación de destino"]',
    ) as HTMLSelectElement;
    expect([...destination.options].map((option) => option.value)).toEqual([
      "principal",
    ]);
    await act(async () => {
      button("Transferir").click();
    });
    expect(registrarTransferenciaStock).toHaveBeenCalledWith(
      expect.objectContaining({
        ubicacionOrigenId: "secundaria",
        ubicacionDestinoId: "principal",
        cantidad: 1,
      }),
    );
  });
  it("un usuario de consulta no recibe acciones de escritura", async () => {
    mocks.canManage = false;
    await render();
    const labels = [...container.querySelectorAll("button")].map(
      (item) => item.getAttribute("aria-label") ?? item.textContent,
    );
    expect(labels).not.toContain("Ingresar stock");
    expect(labels).not.toContain("Movimiento");
    expect(labels).not.toContain("Transferir desde esta ubicación");
    await act(async () => {
      button("Depósitos").click();
    });
    expect(container.textContent).not.toContain("Nuevo depósito");
    expect(registrarMovimientoStock).not.toHaveBeenCalled();
  });
});
