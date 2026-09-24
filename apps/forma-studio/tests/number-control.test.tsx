import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Inicializar el DOM antes de cargar ReactDOM: su sistema de eventos comprueba
// la disponibilidad del navegador al importar el módulo.
await vi.hoisted(async () => {
  const { parseHTML } = await import("linkedom");
  const { window } = parseHTML("<html><body></body></html>");
  Object.defineProperty(window, "location", {
    value: new URL("http://localhost/"),
    configurable: true,
  });
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "Node",
    "MutationObserver",
  ] as const)
    vi.stubGlobal(key, key === "window" ? window : window[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Linkedom no anuncia los eventos disponibles como lo hace un navegador.
  window.document.oninput = null;
});

import { act, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NumberControl } from "../src/components/Controls";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
  vi.useRealTimers();
});

async function mount(
  overrides: Partial<ComponentProps<typeof NumberControl>> = {},
) {
  const changed = vi.fn();
  function Form() {
    const [value, setValue] = useState(overrides.value ?? 35);
    return (
      <>
        <NumberControl
          label="Medida"
          min={10}
          max={100}
          step={0.1}
          {...overrides}
          value={value}
          onChange={(n) => {
            changed(n);
            setValue(n);
          }}
        />
        <output>{value}</output>
        <button onClick={() => setValue(50)}>Restaurar</button>
      </>
    );
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Form />));
  return { input: container.querySelector("input")!, changed };
}

async function type(input: HTMLInputElement, text: string) {
  await act(() => {
    // El setter del prototipo simula escritura del navegador, sin tocar el
    // rastreador que React instala en la instancia del input.
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function key(input: HTMLInputElement, key: string) {
  await act(() => {
    const event = new window.Event("keydown", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "key", { value: key });
    input.dispatchEvent(event);
  });
}
async function blur(input: HTMLInputElement) {
  await act(() =>
    input.dispatchEvent(new window.Event("focusout", { bubbles: true })),
  );
}
async function pause(ms = 400) {
  await act(() => vi.advanceTimersByTime(ms));
}

describe("Edición manual de medidas", () => {
  it("permite vaciar y escribir dígitos menores al mínimo; Enter adelanta la aplicación", async () => {
    const { input, changed } = await mount();
    for (const text of ["", "2", "25"]) {
      await type(input, text);
      expect(input.value).toBe(text);
      expect(changed).not.toHaveBeenCalled();
      expect(container.querySelector("output")!.textContent).toBe("35");
    }
    await key(input, "Enter");
    expect(changed).toHaveBeenCalledExactlyOnceWith(25);
    await blur(input);
    await pause();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it.each(["12,50", "12.50"])(
    "acepta el decimal %s y lo confirma al salir",
    async (text) => {
      const { input, changed } = await mount();
      for (let i = 1; i <= text.length; i++)
        await type(input, text.slice(0, i));
      expect(input.value).toBe(text);
      expect(changed).not.toHaveBeenCalled();
      await blur(input);
      expect(changed).toHaveBeenCalledExactlyOnceWith(12.5);
      expect(input.value).toBe("12.5");
    },
  );

  it.each(["", "-", "abc", "12mm", "1,2,3", "5", "101"])(
    "rechaza %s al confirmar sin cambiar la última medida válida",
    async (text) => {
      const { input, changed } = await mount();
      await type(input, text);
      await key(input, "Enter");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(changed).not.toHaveBeenCalled();
      await type(input, "28");
      await blur(input);
      expect(changed).toHaveBeenCalledExactlyOnceWith(28);
      expect(container.querySelector('[role="alert"]')).toBeNull();
    },
  );

  it("permite signos negativos y Escape cancela sin modificar el modelo", async () => {
    const { input, changed } = await mount({ min: -20 });
    await type(input, "-");
    expect(input.value).toBe("-");
    await type(input, "-2,5");
    await key(input, "Enter");
    expect(changed).toHaveBeenLastCalledWith(-2.5);
    await type(input, "15");
    await key(input, "Escape");
    await blur(input);
    expect(input.value).toBe("-2.5");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("conserva flechas, paso decimal y límites del control", async () => {
    const { input, changed } = await mount({ value: 99.9 });
    await key(input, "ArrowUp");
    expect(input.value).toBe("100");
    await key(input, "ArrowUp");
    expect(changed).toHaveBeenCalledTimes(1);
    await type(input, "10");
    await key(input, "ArrowDown");
    expect(input.value).toBe("10");
    await key(input, "ArrowUp");
    expect(input.value).toBe("10.1");
  });

  it("sincroniza cambios externos aunque hubiera una edición pendiente", async () => {
    const { input, changed } = await mount();
    await type(input, "22");
    await act(() => container.querySelector("button")!.click());
    expect(input.value).toBe("50");
    await pause();
    expect(changed).not.toHaveBeenCalled();
  });

  it("aplica una sola medida al pausar, reiniciando el debounce con cada tecla", async () => {
    const { input, changed } = await mount();
    await type(input, "2");
    await pause(500);
    expect(changed).not.toHaveBeenCalled();
    await type(input, "25");
    await pause(300);
    await type(input, "25,5");
    await pause(399);
    expect(changed).not.toHaveBeenCalled();
    await pause(1);
    expect(changed).toHaveBeenCalledExactlyOnceWith(25.5);
    expect(container.querySelector("output")!.textContent).toBe("25.5");
    await blur(input);
    await pause();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("conserva el texto decimal al aplicar automáticamente y permite seguir escribiendo", async () => {
    const { input, changed } = await mount();
    await type(input, "12,50");
    await pause();
    expect(changed).toHaveBeenLastCalledWith(12.5);
    expect(input.value).toBe("12,50");
    await type(input, "12,505");
    await pause();
    expect(changed).toHaveBeenLastCalledWith(12.505);
    expect(input.value).toBe("12,505");
  });

  it("no aplica valores vacíos, incompletos o fuera de rango durante las pausas", async () => {
    const { input, changed } = await mount();
    for (const text of ["", "-", "12,", "12.", "abc", "5", "101"]) {
      await type(input, text);
      await pause(1000);
      expect(changed).not.toHaveBeenCalled();
      expect(input.value).toBe(text);
    }
  });

  it("Escape cancela la aplicación pendiente y desmontar limpia el temporizador", async () => {
    const { input, changed } = await mount();
    await type(input, "25");
    await pause(300);
    await key(input, "Escape");
    await pause();
    expect(changed).not.toHaveBeenCalled();
    expect(input.value).toBe("35");
    await type(input, "28");
    await act(() => root.render(null));
    await pause();
    expect(changed).not.toHaveBeenCalled();
  });

  it("usa el callback más reciente sin reiniciar la pausa por un render ajeno al campo", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const first = vi.fn(),
      latest = vi.fn();
    await act(() =>
      root.render(<NumberControl label="Medida" value={35} onChange={first} />),
    );
    const input = container.querySelector("input")!;
    await type(input, "25");
    await pause(300);
    await act(() =>
      root.render(
        <NumberControl label="Medida" value={35} onChange={latest} />,
      ),
    );
    await pause(100);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith(25);
  });
});
