// @vitest-environment jsdom
import { act, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlantaSelector } from "./planta-selector";
import { createPlanta } from "@/lib/costos-api";
import type { Planta } from "@/lib/costos";

const acceso = vi.hoisted(() => ({
  gestionar: true,
  maquinaria: true,
  centros: false,
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => acceso.gestionar,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: (clave: string) =>
    clave === "maquinaria" ? acceso.maquinaria : acceso.centros,
}));
vi.mock("@/lib/costos-api", () => ({ createPlanta: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@heroui/react", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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
    <button type={type} disabled={isDisabled} onClick={onPress}>
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
  }: {
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Planta"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Seleccionar</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const planta = {
  id: "planta-nueva",
  codigo: "PLT-001",
  nombre: "Taller de prueba",
  activa: true,
} as Planta;
describe("Alta de planta dentro de maquinaria", () => {
  let container: HTMLDivElement, root: Root;
  const submitMaquina = vi.fn();
  const altaAbierta = vi.fn();
  function Maquina({ plantas = [] }: { plantas?: Planta[] }) {
    const [value, setValue] = useState("");
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitMaquina();
        }}
      >
        <input
          aria-label="Nombre de máquina"
          defaultValue="Router que estaba completando"
        />
        <PlantaSelector
          plantas={plantas}
          value={value}
          onChange={setValue}
          onAltaAbiertaChange={altaAbierta}
        />
      </form>
    );
  }
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text,
    )!;
  const input = (text: string) => {
    const label = Array.from(container.querySelectorAll("label")).find(
      (l) => l.textContent?.trim() === text,
    )!;
    return document.getElementById(label.htmlFor) as HTMLInputElement;
  };
  async function escribir(label: string, value: string) {
    await act(async () => {
      const field = input(label);
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(acceso, {
      gestionar: true,
      maquinaria: true,
      centros: false,
    });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.mocked(createPlanta).mockResolvedValue(planta);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  async function abrir(plantas: Planta[] = []) {
    await act(async () => root.render(<Maquina plantas={plantas} />));
    await act(async () => button("Nueva planta").click());
  }
  it("crea y selecciona la primera planta sin perder la máquina ni enviar el formulario padre", async () => {
    await abrir();
    expect(container.querySelector("select")!.disabled).toBe(true);
    expect(input("Código de la planta").value).toBe("PLT-001");
    await escribir("Nombre de la planta", " Taller de prueba ");
    await act(async () => button("Guardar planta").click());
    expect(createPlanta).toHaveBeenCalledWith({
      codigo: "PLT-001",
      nombre: "Taller de prueba",
    });
    expect(container.querySelector("select")!.value).toBe(planta.id);
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Nombre de máquina"]',
      )!.value,
    ).toBe("Router que estaba completando");
    expect(altaAbierta.mock.calls).toEqual([[true], [false]]);
    expect(submitMaquina).not.toHaveBeenCalled();
  });
  it("Enter guarda una sola planta y no envía la máquina mientras espera", async () => {
    let completar!: (p: Planta) => void;
    vi.mocked(createPlanta).mockReturnValue(
      new Promise((resolve) => {
        completar = resolve;
      }),
    );
    await abrir();
    await escribir("Nombre de la planta", "Taller de prueba");
    await act(async () => {
      for (let i = 0; i < 2; i++) {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        });
        input("Nombre de la planta").dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
    });
    expect(createPlanta).toHaveBeenCalledTimes(1);
    expect(submitMaquina).not.toHaveBeenCalled();
    await act(async () => completar(planta));
    expect(container.querySelector("select")!.value).toBe(planta.id);
  });
  it("conserva los datos ante un código duplicado y permite corregirlo", async () => {
    vi.mocked(createPlanta).mockRejectedValueOnce(
      new Error("Ya existe una planta con ese código."),
    );
    await abrir([{ ...planta, id: "anterior", activa: false }]);
    expect(input("Código de la planta").value).toBe("PLT-002");
    await escribir("Nombre de la planta", "Taller de prueba");
    await act(async () => button("Guardar planta").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Ya existe una planta",
    );
    expect(input("Nombre de la planta").value).toBe("Taller de prueba");
    await escribir("Código de la planta", "PLT-003");
    await act(async () => button("Guardar planta").click());
    expect(createPlanta).toHaveBeenLastCalledWith({
      codigo: "PLT-003",
      nombre: "Taller de prueba",
    });
    expect(container.querySelector("select")!.value).toBe(planta.id);
  });
  it.each([
    { gestionar: false, maquinaria: true, centros: true },
    { gestionar: true, maquinaria: false, centros: false },
  ])(
    "no ofrece altas sin permiso o sin una capacidad habilitante: %j",
    async (permisos) => {
      Object.assign(acceso, permisos);
      await act(async () => root.render(<Maquina />));
      expect(button("Nueva planta")).toBeUndefined();
      expect(createPlanta).not.toHaveBeenCalled();
    },
  );
});
