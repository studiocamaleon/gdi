// @vitest-environment jsdom
import { act, StrictMode, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BandejasDetectadasField } from "./bandejas-detectadas-field";

const buscar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/qz-impresion", () => ({ buscarBandejas: buscar }));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    options,
    value,
    disabled,
    onChange,
  }: {
    options: { value: string; label: string; disabled?: boolean }[];
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
  }) => (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    onPress,
    isDisabled,
    children,
  }: {
    onPress: () => void;
    isDisabled?: boolean;
    children: ReactNode;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  buscar.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
function Formulario({ impresora = "Ricoh" }: { impresora?: string }) {
  const [codigo, setCodigo] = useState("");
  return (
    <BandejasDetectadasField
      key={impresora}
      tenantId="tenant"
      host="192.168.88.164"
      impresora={impresora}
      existentes={["top"]}
      value={codigo}
      onChange={setCodigo}
      disabled={false}
    />
  );
}
async function consultar() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}
it("consulta una sola vez en StrictMode, deshabilita bandejas existentes y limpia la selección al actualizar", async () => {
  buscar.mockResolvedValue(["top", "manual"]);
  await act(async () =>
    root.render(
      <StrictMode>
        <Formulario />
      </StrictMode>,
    ),
  );
  expect(container.querySelector("select")!.disabled).toBe(true);
  await consultar();
  expect(buscar).toHaveBeenCalledExactlyOnceWith(
    "192.168.88.164",
    "tenant",
    "Ricoh",
  );
  expect(
    container.querySelector<HTMLOptionElement>('option[value="top"]')!.disabled,
  ).toBe(true);
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "manual";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(select.value).toBe("manual");
  buscar.mockResolvedValue(["top"]);
  await act(async () => container.querySelector("button")!.click());
  expect(select.value).toBe("");
  expect(select.disabled).toBe(true);
  await consultar();
  expect(container.textContent).toContain(
    "Todas las bandejas detectadas ya están agregadas",
  );
});
it("muestra un error accionable y permite reintentar si el controlador no informa bandejas", async () => {
  buscar.mockRejectedValueOnce(new Error("No se pudo conectar con QZ Tray"));
  await act(async () => root.render(<Formulario />));
  await consultar();
  expect(container.querySelector('[role="alert"]')!.textContent).toContain(
    "No se pudo conectar",
  );
  expect(container.querySelector("select")!.disabled).toBe(true);
  buscar.mockResolvedValue([]);
  await act(async () => container.querySelector("button")!.click());
  await consultar();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("El controlador no informa bandejas");
});
it("ignora respuestas de un formulario cerrado al abrir otra impresora", async () => {
  let anterior!: (bandejas: string[]) => void;
  buscar.mockImplementationOnce(
    () =>
      new Promise<string[]>((resolve) => {
        anterior = resolve;
      }),
  );
  await act(async () => root.render(<Formulario />));
  await consultar();
  buscar.mockResolvedValue(["manual"]);
  await act(async () => root.render(<Formulario impresora="Otra impresora" />));
  await consultar();
  await act(async () => anterior(["bandeja-antigua"]));
  expect(container.textContent).toContain("manual");
  expect(container.textContent).not.toContain("bandeja-antigua");
});
