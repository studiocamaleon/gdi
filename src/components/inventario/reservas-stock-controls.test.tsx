// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfiguracionReservas } from "./reservas-stock-controls";
import {
  getPoliticaReservas,
  savePoliticaReservas,
} from "@/lib/materiales-orden-api";
vi.mock("@/lib/materiales-orden-api", () => ({
  getPoliticaReservas: vi.fn(),
  savePoliticaReservas: vi.fn(),
}));
vi.mock("./stock-conversion-fields", () => ({
  stockUnitLabel: (v: string) => v,
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
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    value,
    options,
    onChange,
    disabled,
    "aria-label": label,
  }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    disabled: boolean;
    "aria-label": string;
  }) => (
    <select
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

describe("Configuración de reservas por empresa", () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    vi.resetAllMocks();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.mocked(getPoliticaReservas).mockResolvedValue({
      modo: "AL_EMITIR",
      habilitada: true,
      incluirConsumibles: false,
      version: 3,
    });
    vi.mocked(savePoliticaReservas).mockResolvedValue({
      modo: "MANUAL",
      habilitada: true,
      incluirConsumibles: false,
      version: 4,
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === text,
    )!;
  async function abrir() {
    await act(async () => root.render(<ConfiguracionReservas />));
    await act(async () => button("Reservas por OT").click());
  }
  it("muestra automático como recomendado y explica el alcance sin mutar al abrir", async () => {
    await abrir();
    expect(container.querySelector("select")?.value).toBe("AL_EMITIR");
    expect(container.textContent).toContain(
      "Los presupuestos y borradores no apartan stock",
    );
    expect(container.textContent).toContain(
      "Cambiar el modo no reserva ni libera stock de inmediato",
    );
    expect(savePoliticaReservas).not.toHaveBeenCalled();
  });
  it("guarda el modo manual elegido con la versión recibida", async () => {
    await abrir();
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "MANUAL";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => button("Guardar").click());
    expect(savePoliticaReservas).toHaveBeenCalledWith({
      modo: "MANUAL",
      habilitada: true,
      incluirConsumibles: false,
      version: 3,
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("un conflicto conserva el formulario y no anuncia un cambio guardado", async () => {
    vi.mocked(savePoliticaReservas).mockRejectedValue(
      new Error("La configuración cambió."),
    );
    await abrir();
    await act(async () => button("Guardar").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "La configuración cambió.",
    );
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
