// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { EntregaModal } from "./entrega-modal";
import { PagosStagingTab } from "../comercial/pagos-staging-tab";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
const mocks = vi.hoisted(() => ({
  escanear: vi.fn(),
  entregar: vi.fn(),
  metodos: vi.fn(),
  cuentas: vi.fn(),
}));
vi.mock("@/lib/entrega-api", () => ({
  escanearOrden: mocks.escanear,
  entregarItems: mocks.entregar,
  revertirEntrega: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => ({
  getMetodosPago: mocks.metodos,
  getCuentasFondos: mocks.cuentas,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../administracion/cobro-formulario", () => ({
  CobroFormulario: () => <span>Formulario de cobro</span>,
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => vi.clearAllMocks());
it("la entrega manual exige confirmar preparación y no carga ni envía cobros excluidos", async () => {
  mocks.escanear.mockResolvedValue({
    id: "orden",
    numero: "OT",
    estado: "pendiente",
    creadaEl: "2026-09-21",
    total: 100,
    saldo: 100,
    cobrado: 0,
    puedeCobrar: false,
    produccionControlada: false,
    requiereConfirmacionManual: true,
    cliente: null,
    items: [
      {
        id: "item",
        nombre: "Plano",
        cantidad: 1,
        cantidadUnidad: "unidad",
        total: 100,
        listo: true,
        pasosHechos: 0,
        pasosTotal: 0,
        entregadoEl: null,
      },
    ],
  });
  mocks.entregar.mockResolvedValue({
    entregados: 1,
    ordenCerrada: true,
    cobro: null,
  });
  const container = document.createElement("div"),
    root = createRoot(container);
  try {
    await act(async () =>
      root.render(<EntregaModal codigo="OT" onClose={vi.fn()} />),
    );
    expect(mocks.metodos).not.toHaveBeenCalled();
    expect(mocks.cuentas).not.toHaveBeenCalled();
    const boton = Array.from(container.querySelectorAll("button")).find((b) =>
      /Entregar/.test(b.textContent ?? ""),
    )!;
    expect(boton.disabled).toBe(true);
    const checkbox = container.querySelector(
      'label input[type="checkbox"]',
    ) as HTMLInputElement;
    await act(async () => checkbox.click());
    expect(boton.disabled).toBe(false);
    await act(async () => boton.click());
    expect(mocks.entregar).toHaveBeenCalledWith("orden", {
      itemIds: ["item"],
      confirmarPreparacionManual: true,
    });
  } finally {
    await act(async () => root.unmount());
  }
});
it("sin F01 la OT en preparación no ofrece señas ni consulta catálogos de cobro", async () => {
  const container = document.createElement("div"),
    root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <CapacidadesProvider capacidades={{ funciones: { cobros: false } }}>
          <PagosStagingTab
            total={100}
            cobros={[]}
            onAgregar={vi.fn()}
            onQuitar={vi.fn()}
          />
        </CapacidadesProvider>,
      ),
    );
    expect(container.textContent).toContain("Función no incluida");
    expect(container.textContent).not.toContain("Formulario de cobro");
    expect(mocks.metodos).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
  }
});
