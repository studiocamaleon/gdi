// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AcreditacionesView } from "./acreditaciones-view";
import type { CobroPendienteAcreditacion } from "@/lib/administracion";

const mocks = vi.hoisted(() => ({
  acreditar: vi.fn(),
  refresh: vi.fn(),
  gestionar: true,
  toast: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => mocks.gestionar,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
vi.mock("@/lib/administracion-api", async (original) => ({
  ...(await original<object>()),
  acreditarCobrosLote: mocks.acreditar,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toast, error: mocks.toast },
}));
vi.mock("./tesoreria-dialog", () => ({
  TesoreriaDialog: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
vi.mock("@heroui/react", async (original) => ({
  ...(await original<object>()),
  Modal: {
    Body: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Footer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement, root: Root;
const filas = [1, 2, 3].map((n): CobroPendienteAcreditacion => ({
  id: `cobro-${n}`,
  fecha: "2026-09-01",
  fechaAcreditacionEstimada: null,
  metodoNombre: "Tarjeta ficticia",
  metodoTipo: "tarjeta_debito",
  cuentaDestinoNombre: "Banco ficticio",
  clienteNombre: `Cliente ${n}`,
  ordenId: `orden-${n}`,
  ordenNumero: `OT-${n}`,
  montoBruto: 100,
  comisionMonto: n,
  comisionIvaMonto: 0,
  retenciones: [],
  netoAcreditado: 100 - n,
  disponibleReal: 100 - n,
  moneda: "ARS",
  esCheque: false,
  valorEstado: null,
  valorNumero: null,
}));
function button(text: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === text,
  )!;
}
async function input(id: string, value: string) {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>(`#${id}`)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.clearAllMocks();
  mocks.gestionar = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(restringido = false) {
  await act(async () =>
    root.render(
      <AcreditacionesView
        initialFilas={filas}
        initialValores={[]}
        cuentas={[]}
        accesoRestringido={restringido}
      />,
    ),
  );
}
it("selecciona varios, usa una LIQ común y conserva comisiones individuales sin doble envío", async () => {
  await render();
  await act(async () => {
    (
      container.querySelector(
        '[aria-label="Seleccionar cobro OT-1"]',
      ) as HTMLElement
    ).click();
    (
      container.querySelector(
        '[aria-label="Seleccionar cobro OT-2"]',
      ) as HTMLElement
    ).click();
  });
  expect(container.textContent).toContain("2 seleccionados");
  await act(async () => button("Acreditar seleccionados").click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(button("Acreditar 2 cobros").disabled).toBe(true);
  await input("lote-liq", "LIQ-PRUEBA");
  await act(async () =>
    (container.querySelector("#lote-revisado") as HTMLElement).click(),
  );
  let resolver!: (v: unknown) => void;
  mocks.acreditar.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await act(async () => {
    button("Acreditar 2 cobros").click();
    button("Acreditar 2 cobros").click();
  });
  expect(mocks.acreditar).toHaveBeenCalledTimes(1);
  expect(mocks.acreditar.mock.calls[0][0].cobros).toEqual(
    [1, 2].map((n) =>
      expect.objectContaining({
        id: `cobro-${n}`,
        referencia: "LIQ-PRUEBA",
        comisionMonto: n,
        fecha: expect.any(String),
      }),
    ),
  );
  await act(async () =>
    resolver({ ids: ["cobro-1", "cobro-2"], acreditados: 2 }),
  );
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).not.toContain("OT-1");
  expect(container.textContent).toContain("OT-3");
});
it("conserva selección y LIQ al fallar para poder reintentar", async () => {
  await render();
  await act(async () =>
    (
      container.querySelector(
        '[aria-label="Seleccionar hasta 50 cobros"]',
      ) as HTMLElement
    ).click(),
  );
  await act(async () => button("Acreditar seleccionados").click());
  await input("lote-liq", "LIQ-REINTENTO");
  await act(async () =>
    (container.querySelector("#lote-revisado") as HTMLElement).click(),
  );
  mocks.acreditar.mockRejectedValue(new Error("Respuesta perdida"));
  await act(async () => button("Acreditar 3 cobros").click());
  expect(container.querySelector<HTMLInputElement>("#lote-liq")?.value).toBe(
    "LIQ-REINTENTO",
  );
  expect(container.textContent).toContain("3 seleccionados");
  expect(mocks.toast).toHaveBeenCalledWith("Respuesta perdida");
});
it("no ofrece acreditar sin permiso ni con cuentas restringidas", async () => {
  mocks.gestionar = false;
  await render();
  expect(container.textContent).not.toContain("Acreditar seleccionados");
  mocks.gestionar = true;
  await render(true);
  expect(container.textContent).not.toContain("Acreditar seleccionados");
  expect(mocks.acreditar).not.toHaveBeenCalled();
});
