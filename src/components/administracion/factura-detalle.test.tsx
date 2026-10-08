// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FacturarOrdenModal } from "./facturacion-orden";
import { FacturacionView } from "./facturacion-view";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type { OrdenFacturable } from "@/lib/administracion";
const api = vi.hoisted(() => ({
  facturarOrden: vi.fn(),
  facturarLote: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => api);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let el: HTMLDivElement, root: Root;
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === label,
  )!;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  api.facturarOrden.mockResolvedValue({
    id: "f",
    estado: "emitido",
    numeroCompleto: "B 0001-00000001",
  });
  api.facturarLote.mockResolvedValue({ modo: "agrupada", resultados: [] });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function modal() {
  await act(async () =>
    root.render(
      <DesignSystemProvider theme="brand" appearance="light">
        <FacturarOrdenModal
          ordenId="ot"
          numero="OT-1"
          saldoSinFacturar={363.25}
          onClose={vi.fn()}
          onFacturada={vi.fn()}
        />
      </DesignSystemProvider>,
    ),
  );
}
it("una OT ofrece detalle por defecto y envía el importe con centavos", async () => {
  await modal();
  expect(button("Productos y cargos").getAttribute("aria-checked")).toBe(
    "true",
  );
  await act(async () => button("Emitir factura").click());
  expect(api.facturarOrden).toHaveBeenCalledWith(
    "ot",
    expect.objectContaining({ detalle: "items", monto: 363.25 }),
  );
});
it("permite elegir resumen explícitamente", async () => {
  await modal();
  await act(async () => button("Resumen por OT").click());
  await act(async () => button("Emitir factura").click());
  expect(api.facturarOrden).toHaveBeenCalledWith(
    "ot",
    expect.objectContaining({ detalle: "orden" }),
  );
});
it("facturas agrupadas parten de resumen y permiten detalle completo antes de confirmar", async () => {
  const ordenes: OrdenFacturable[] = [1, 2].map((n) => ({
    ordenId: `ot-${n}`,
    numero: `OT-${n}`,
    estado: "finalizada",
    clienteId: "cliente",
    clienteNombre: "Cliente ficticio",
    clienteCondicionFiscal: "RI",
    fechaFinalizada: "2026-10-01",
    total: 363.25,
    facturado: 0,
    cobrado: 363.25,
    saldoSinFacturar: 363.25,
  }));
  await act(async () =>
    root.render(
      <DesignSystemProvider theme="brand" appearance="light">
        <PermisosProvider permisos={["administracion.facturacion.gestionar"]}>
          <FacturacionView initialOrdenes={ordenes} />
        </PermisosProvider>
      </DesignSystemProvider>,
    ),
  );
  await act(async () =>
    document
      .querySelector<HTMLInputElement>(
        'input[aria-label="Seleccionar todas las órdenes visibles"]',
      )!
      .click(),
  );
  await act(async () => button("Agrupada").click());
  expect(button("Resumen por OT").getAttribute("aria-checked")).toBe("true");
  await act(async () => button("Productos y cargos").click());
  await act(async () => button("Emitir factura").click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Productos y cargos",
  );
  expect(api.facturarLote).not.toHaveBeenCalled();
  await act(async () => button("Confirmar y emitir").click());
  expect(api.facturarLote).toHaveBeenCalledWith({
    ordenIds: ["ot-1", "ot-2"],
    modo: "agrupada",
    detalle: "items",
  });
});

it("filtra por cliente sin acentos también en facturación", async () => {
  const ordenes: OrdenFacturable[] = ["María Núñez", "Otro cliente"].map(
    (nombre, n) => ({
      ordenId: `ot-${n}`,
      numero: `OT-${n}`,
      estado: "finalizada",
      clienteId: `c-${n}`,
      clienteNombre: nombre,
      clienteCondicionFiscal: "CF",
      fechaFinalizada: null,
      total: 100,
      facturado: 0,
      cobrado: 100,
      saldoSinFacturar: 100,
    }),
  );
  await act(async () =>
    root.render(
      <DesignSystemProvider theme="brand" appearance="light">
        <PermisosProvider permisos={["administracion.facturacion.gestionar"]}>
          <FacturacionView initialOrdenes={ordenes} />
        </PermisosProvider>
      </DesignSystemProvider>,
    ),
  );
  const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "maria nunez");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(
    el.querySelector('input[aria-label="Seleccionar OT-0"]'),
  ).not.toBeNull();
  expect(el.querySelector('input[aria-label="Seleccionar OT-1"]')).toBeNull();
});
