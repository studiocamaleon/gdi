// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { FacturarOrdenAccion } from "./facturacion-orden";
const api = vi.hoisted(() => ({
  getFacturacionHabilitada: vi.fn(),
  getComprobantes: vi.fn(),
  facturarOrden: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => api);
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
import { toast } from "sonner";
let el: HTMLDivElement, root: Root;
const onFacturada = vi.fn();
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
  api.getFacturacionHabilitada.mockResolvedValue(true);
  api.getComprobantes.mockResolvedValue([]);
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
async function montar({
  permisos = ["administracion.facturacion.gestionar"],
  bloqueada = false,
  habilitada = true,
  capacidad = true,
  facturado = 0,
  total = 1000,
} = {}) {
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{ funciones: { fiscal_argentina: capacidad } }}
      >
        <PermisosProvider permisos={["acceso.por_vista", ...permisos]}>
          <FacturarOrdenAccion
            ordenId="ot-ficticia"
            numero="OT-QA"
            total={total}
            facturado={facturado}
            bloqueada={bloqueada}
            habilitada={habilitada}
            onFacturada={onFacturada}
          />
        </PermisosProvider>
      </CapacidadesProvider>,
    ),
  );
}
async function abrir() {
  await act(async () => el.querySelector<HTMLButtonElement>("button")!.click());
}
it("ofrece Facturar en lectura con permiso fiscal, sin requerir editar OT ni emitir al abrir", async () => {
  await montar();
  expect(el.querySelector("button")!.textContent).toBe("Facturar");
  await abrir();
  expect(api.getComprobantes).toHaveBeenCalledWith({ ordenId: "ot-ficticia" });
  expect(el.querySelector('[role="dialog"]')).not.toBeNull();
  expect(api.facturarOrden).not.toHaveBeenCalled();
});
it.each([
  { total: 1000.67, mitad: "500.34" },
  { total: 0.49, mitad: "0.25" },
  { total: 1000.01, mitad: "500.01" },
])("conserva centavos al facturar y en los atajos: $total", async ({ total, mitad }) => {
  await montar({ total });
  await abrir();
  const input = el.querySelector<HTMLInputElement>('input[type="number"]')!;
  const boton = (texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent?.trim() === texto)!;
  expect(input.value).toBe(String(total));
  expect(input.step).toBe("0.01");
  expect(boton("Emitir factura").disabled).toBe(false);
  expect(el.textContent).not.toContain("No se puede facturar más que el saldo");
  await act(async () => boton("50%").click());
  expect(input.value).toBe(mitad);
  await act(async () => boton("100% del saldo").click());
  expect(input.value).toBe(String(total));
  api.facturarOrden.mockResolvedValue({ estado: "emitido", numeroCompleto: "FICTICIA" });
  await act(async () => boton("Emitir factura").click());
  expect(api.facturarOrden).toHaveBeenCalledWith("ot-ficticia", {
    monto: total,
    concepto: "Trabajos de impresión — OT-QA",
  });
});
it.each([
  { permisos: ["comercial.ordenes.gestionar"] },
  { permisos: ["administracion.facturacion.ver"] },
  { capacidad: false },
  { habilitada: false },
  { facturado: 1000 },
])(
  "no ofrece una emisión sin autorización, capacidad o saldo: %j",
  async (opciones) => {
    await montar(opciones);
    expect(el.querySelector("button")).toBeNull();
    expect(api.facturarOrden).not.toHaveBeenCalled();
  },
);
it("espera a guardar o descartar cambios antes de abrir la emisión", async () => {
  await montar({ bloqueada: true });
  expect(el.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
  await abrir();
  expect(api.getComprobantes).not.toHaveBeenCalled();
});
it("usa el saldo actualizado y las notas de crédito al abrir", async () => {
  api.getComprobantes.mockResolvedValue([
    {
      estado: "emitido",
      tipo: "factura",
      total: 900,
      ordenes: [{ ordenId: "ot-ficticia", monto: 400 }],
    },
    {
      estado: "emitido",
      tipo: "nota_credito",
      total: 100,
      ordenes: [{ ordenId: "ot-ficticia", monto: 100 }],
    },
    { estado: "rechazado", tipo: "factura", total: 700, ordenes: [] },
  ]);
  await montar();
  await abrir();
  expect(
    el.querySelector<HTMLInputElement>('input[type="number"]')!.value,
  ).toBe("700");
});
it.each(["en_proceso", "por_verificar"])(
  "no abre otra emisión si hay un comprobante %s",
  async (estado) => {
    api.getComprobantes.mockResolvedValue([{ estado }]);
    await montar();
    await abrir();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(toast.error).toHaveBeenCalled();
  },
);
it("si otra persona ya facturó, actualiza la ficha sin abrir una nueva emisión", async () => {
  api.getComprobantes.mockResolvedValue([
    { estado: "emitido", tipo: "factura", total: 1000, ordenes: [] },
  ]);
  await montar();
  await abrir();
  expect(el.querySelector('[role="dialog"]')).toBeNull();
  expect(onFacturada).toHaveBeenCalled();
});
it.each([false, new Error("Sin conexión")])(
  "explica por qué la facturación no está disponible: %s",
  async (estado) => {
    if (estado instanceof Error)
      api.getFacturacionHabilitada.mockRejectedValue(estado);
    else api.getFacturacionHabilitada.mockResolvedValue(estado);
    await montar();
    expect(el.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
    expect(
      document.getElementById(
        el.querySelector("button")!.getAttribute("aria-describedby")!,
      )!.textContent,
    ).toMatch(/Activá|No se pudo/);
  },
);
