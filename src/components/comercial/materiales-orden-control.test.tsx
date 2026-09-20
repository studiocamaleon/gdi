// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialesOrdenControl } from "./materiales-orden-control";
import {
  operarMateriales,
  type MaterialesOrden,
} from "@/lib/materiales-orden-api";
import { usePuede } from "@/components/navigation/permisos-provider";
vi.mock("@/lib/materiales-orden-api", () => ({ operarMateriales: vi.fn() }));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: vi.fn(() => true),
}));
vi.mock("@/components/inventario/stock-conversion-fields", () => ({
  stockUnitLabel: (u: string) => u,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: ReactNode;
  }) => (isOpen ? <div role="dialog">{children}</div> : null),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
    type,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: "button" | "submit";
  }) => (
    <button type={type ?? "button"} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
const fixture = (): MaterialesOrden => ({
  ordenId: "ot1",
  revision: "r1",
  pendientes: [],
  resumen: {
    variantes: 1,
    calculadas: 1,
    porRevisar: 0,
    desgastesExcluidos: 0,
  },
  necesidades: [
    {
      varianteId: "v1",
      nombre: "Papel A4",
      estado: "calculada",
      cantidad: 8,
      unidad: "hoja",
      origenes: [],
    },
  ],
  control: {
    habilitado: true,
    iniciado: false,
    estadoOrden: "pendiente",
    materiales: [
      {
        varianteId: "v1",
        unidad: "hoja",
        cantidad: 8,
        consumida: 0,
        reservada: 0,
        fisico: 5,
        libre: 5,
        pendiente: 8,
        faltante: 3,
        fuente: "calculo",
        revisar: false,
        excluida: false,
        motivo: null,
        reservas: [],
      },
    ],
  },
});
describe("Operaciones de materiales en la OT", () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(usePuede).mockReturnValue(true);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === text,
    )!;
  it("explica el abastecimiento de la OT emitida y conserva la clave al reintentar un error de red", async () => {
    const onChanged = vi.fn();
    vi.mocked(operarMateriales)
      .mockRejectedValueOnce(new Error("Conexión interrumpida"))
      .mockResolvedValueOnce({ ok: true, repetida: true });
    await act(async () =>
      root.render(
        <MaterialesOrdenControl data={fixture()} onChanged={onChanged} />,
      ),
    );
    expect(container.textContent).toContain("Pendiente de abastecimiento");
    await act(async () => button("Reservar disponible").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Conexión interrumpida",
    );
    expect(onChanged).not.toHaveBeenCalled();
    await act(async () => button("Reservar disponible").click());
    expect(vi.mocked(operarMateriales).mock.calls[0][1].clave).toBe(
      vi.mocked(operarMateriales).mock.calls[1][1].clave,
    );
    expect(onChanged).toHaveBeenCalledOnce();
  });
  it("oculta las escrituras sin permiso o con el control desactivado", async () => {
    vi.mocked(usePuede).mockReturnValue(false);
    await act(async () =>
      root.render(
        <MaterialesOrdenControl data={fixture()} onChanged={() => {}} />,
      ),
    );
    expect(button("Reservar disponible")).toBeUndefined();
    vi.mocked(usePuede).mockReturnValue(true);
    const data = fixture();
    data.control!.habilitado = false;
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    expect(button("Reservar disponible")).toBeUndefined();
    expect(container.textContent).toContain("desactivado");
  });
  it("no ofrece reservar cantidades históricas sin confirmar", async () => {
    const data = fixture();
    Object.assign(data.control!.materiales[0], {
      cantidad: null,
      pendiente: null,
      faltante: null,
      revisar: true,
    });
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    expect(button("Reservar disponible").disabled).toBe(true);
    expect(button("Definir cantidad")).toBeTruthy();
  });
  it("liberar requiere una acción explícita y muestra que conserva consumos", async () => {
    const data = fixture();
    Object.assign(data.control!.materiales[0], {
      reservada: 5,
      consumida: 3,
      pendiente: 0,
      reservas: [{ ubicacionId: "u1", nombre: "Depósito", cantidad: 5 }],
    });
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    await act(async () => button("Liberar").click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "El consumo ya registrado se conserva",
    );
    expect(operarMateriales).not.toHaveBeenCalled();
  });
  it("en automático explica el modo y permite completar una reserva sin convertirlo en un paso obligatorio", async () => {
    const data = fixture();
    data.control!.modoReserva = "AL_EMITIR";
    data.control!.iniciado = true;
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    expect(container.textContent).toContain(
      "Stock reservado y consumido para esta orden",
    );
    expect(button("Reservar disponible")).toBeUndefined();
    expect(button("Reservar stock disponible ahora")).toBeTruthy();
    expect(operarMateriales).not.toHaveBeenCalled();
  });
  it("no pide reservar una OT automática cuando no hay stock libre ni habla de emitirla", async () => {
    const data = fixture();
    data.control!.modoReserva = "AL_EMITIR";
    data.control!.iniciado = true;
    data.control!.materiales[0].libre = 0;
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    expect(button("Reservar stock disponible ahora")).toBeUndefined();
    expect(container.textContent).not.toContain("continuar cotizando");
    expect(container.textContent).not.toContain("emitir la OT");
    expect(container.textContent).toContain("Pendiente de abastecimiento");
  });
  it("una OT anterior pide incorporación explícita y no reserva al abrir la pantalla", async () => {
    const data = fixture();
    data.control!.modoReserva = "AL_EMITIR";
    await act(async () =>
      root.render(<MaterialesOrdenControl data={data} onChanged={() => {}} />),
    );
    expect(container.textContent).toContain(
      "Esta OT se emitió antes de activar el control",
    );
    expect(button("Incorporar y reservar disponible")).toBeTruthy();
    expect(operarMateriales).not.toHaveBeenCalled();
  });
});
