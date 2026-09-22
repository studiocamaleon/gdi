// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ComprasPanel } from "./compras-panel";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  getCompra,
  getCompras,
  getCatalogoCompras,
  getNecesidadesCompra,
  accionCompra,
  recibirCompra,
  type Compra,
} from "@/lib/compras-api";

vi.mock("@/lib/compras-api", async (original) => ({
  ...(await original<typeof import("@/lib/compras-api")>()),
  getCompra: vi.fn(),
  getCompras: vi.fn(),
  getCatalogoCompras: vi.fn(),
  getNecesidadesCompra: vi.fn(),
  accionCompra: vi.fn(),
  recibirCompra: vi.fn(),
}));
vi.mock("@/components/design-system/appearance", () => ({
  useDesignScope: () => ({}),
  useDesignTheme: () => "",
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));

let container: HTMLDivElement, root: Root;
const compra = {
  id: "compra-1",
  numero: 1,
  estado: "EMITIDA",
  proveedorNombre: "Papelera de prueba",
  moneda: "ARS",
  monedaStock: "ARS",
  tipoCambio: 1,
  ubicacionId: "u",
  ubicacion: { nombre: "Principal", almacen: { nombre: "Depósito" } },
  fechaPedido: "2026-09-21",
  notas: null,
  lineas: [
    {
      id: "l",
      varianteId: "v",
      nombre: "Papel A4",
      cantidad: 2,
      recibida: 0,
      precio: 5000,
      unidadCompra: "RESMA",
      unidadStock: "HOJA",
      factorStock: 500,
      fechaEstimada: null,
      fechaConfirmada: null,
    },
  ],
  recepciones: [],
} as unknown as Compra;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(getCompras).mockResolvedValue({
    data: [compra],
    total: 1,
    page: 1,
    pageSize: 50,
  });
  vi.mocked(getCompra).mockResolvedValue(compra);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(
  permisos = [
    "inventario.ver",
    "inventario.gestionar",
    "finanzas.ver_margenes",
  ],
) {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={permisos}>
        <CapacidadesProvider
          capacidades={{ funciones: { compras: false, recepciones: false } }}
        >
          <ComprasPanel />
        </CapacidadesProvider>
      </PermisosProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 230));
  });
}
it("abre el historial sin cargar catálogos ni necesidades, y conserva detalle sin acciones", async () => {
  await render();
  expect(container.textContent).toContain("Historial de compras");
  expect(container.textContent).toContain("Papelera de prueba");
  expect(getCatalogoCompras).not.toHaveBeenCalled();
  expect(getNecesidadesCompra).not.toHaveBeenCalled();
  const abrir = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Abrir compra",
  )!;
  await act(async () => abrir.click());
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
    "Papel A4",
  );
  for (const label of [
    "Nueva compra",
    "Preparar compra",
    "Agregar oferta",
    "Recibir materiales",
    "Cancelar compra",
    "Guardar fecha",
  ])
    expect(container.textContent).not.toContain(label);
  expect(accionCompra).not.toHaveBeenCalled();
  expect(recibirCompra).not.toHaveBeenCalled();
});
it("no consulta importes sin permiso para ver costos", async () => {
  await render(["inventario.ver"]);
  expect(container.textContent).toContain("Permiso de costos requerido");
  expect(getCompras).not.toHaveBeenCalled();
  expect(getCatalogoCompras).not.toHaveBeenCalled();
});
