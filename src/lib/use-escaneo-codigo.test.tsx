// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionButton } from "@/components/design-system/action-button";
import { useEscaneoCodigo } from "./use-escaneo-codigo";

let root: Root;
let contenedor: HTMLDivElement;
let tiempo: number;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
  tiempo = 1000;
});
afterEach(async () => {
  await act(() => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});
function tecla(
  target: HTMLElement,
  key: string,
  type: "keydown" | "keyup" = "keydown",
  gap = 10,
  opciones: KeyboardEventInit = {},
) {
  tiempo += gap;
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...opciones,
  });
  Object.defineProperty(event, "timeStamp", { value: tiempo });
  target.dispatchEvent(event);
  return event;
}
function escanear(target: HTMLElement, texto: string, terminador = "Enter") {
  for (const key of texto) {
    tecla(target, key);
    tecla(target, key, "keyup");
  }
  return tecla(target, terminador);
}
function Lector({
  onCodigo,
  activo = true,
}: {
  onCodigo: (c: string) => boolean | void;
  activo?: boolean;
}) {
  useEscaneoCodigo({ activo, onCodigo });
  return null;
}

describe("prioridad del escaneo sobre el botón enfocado", () => {
  it.each(["Enter", "Tab"])(
    "abre la entrega y consume %s aunque Imprimir etiqueta tenga el foco",
    async (terminador) => {
      const onImprimir = vi.fn();
      const recibido = vi.fn();
      const keyupImprimir = vi.fn();
      function Vista() {
        const [codigo, setCodigo] = useState("");
        useEscaneoCodigo({
          activo: !codigo,
          onCodigo: (valor) => {
            recibido(valor);
            setCodigo(valor);
          },
        });
        return (
          <>
            <ActionButton onPress={onImprimir}>Imprimir etiqueta</ActionButton>
            {codigo && <div role="dialog">Entrega {codigo}</div>}
          </>
        );
      }
      await act(() => root.render(<Vista />));
      const boton = contenedor.querySelector("button")!;
      boton.addEventListener("keyup", keyupImprimir);
      await act(() => boton.focus());
      let fin!: KeyboardEvent;
      await act(() => {
        fin = escanear(boton, "OT-2026-0060", terminador);
      });
      // El callback ya desactivó el lector; todavía debe consumir la suelta.
      let suelta!: KeyboardEvent;
      await act(() => {
        suelta = tecla(boton, terminador, "keyup");
      });
      expect(recibido).toHaveBeenCalledExactlyOnceWith("OT-2026-0060");
      expect(contenedor.querySelector('[role="dialog"]')?.textContent).toBe(
        "Entrega OT-2026-0060",
      );
      expect(onImprimir).not.toHaveBeenCalled();
      expect(keyupImprimir).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: terminador }),
      );
      expect(fin.defaultPrevented).toBe(true);
      expect(suelta.defaultPrevented).toBe(true);
    },
  );

  it("conserva la activación manual de Imprimir etiqueta con Enter", async () => {
    const onImprimir = vi.fn();
    const onCodigo = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector onCodigo={onCodigo} />
          <ActionButton onPress={onImprimir}>Imprimir etiqueta</ActionButton>
        </>,
      ),
    );
    const boton = contenedor.querySelector("button")!;
    await act(() => boton.focus());
    await act(() => {
      tecla(boton, "Enter", "keydown", 500);
      tecla(boton, "Enter", "keyup");
    });
    expect(onImprimir).toHaveBeenCalledTimes(1);
    expect(onCodigo).not.toHaveBeenCalled();
  });

  it("no interpreta escritura pausada como lector ni consume un Enter posterior", async () => {
    const onCodigo = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector onCodigo={onCodigo} />
          <button>Acción</button>
        </>,
      ),
    );
    const boton = contenedor.querySelector("button")!;
    for (const key of "OT-2026-0060") tecla(boton, key, "keydown", 150);
    expect(tecla(boton, "Enter", "keydown", 200).defaultPrevented).toBe(false);
    expect(onCodigo).not.toHaveBeenCalled();
  });

  it.each(["input", "textarea", "select", "contenteditable"])(
    "respeta los campos %s",
    async (campo) => {
      const onCodigo = vi.fn();
      await act(() => root.render(<Lector onCodigo={onCodigo} />));
      const editable = document.createElement(
        campo === "contenteditable" ? "div" : campo,
      );
      if (campo === "contenteditable")
        editable.setAttribute("contenteditable", "true");
      contenedor.append(editable);
      expect(escanear(editable, "OT-2026-0060").defaultPrevented).toBe(false);
      expect(onCodigo).not.toHaveBeenCalled();
    },
  );

  it("deja a los otros listeners globales reconocer cupones u órdenes sin duplicarlos", async () => {
    const entrega = vi.fn();
    const cupon = vi.fn();
    const accion = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector
            onCodigo={(c) => {
              if (!c.startsWith("OT-")) return false;
              entrega(c);
              return true;
            }}
          />
          <Lector
            onCodigo={(c) => {
              if (c.startsWith("OT-")) return false;
              cupon(c);
              return true;
            }}
          />
          <button onKeyDown={accion}>Acción</button>
        </>,
      ),
    );
    const boton = contenedor.querySelector("button")!;
    await act(() => {
      escanear(boton, "OT-2026-0060");
      tecla(boton, "Enter", "keyup");
      escanear(boton, "PROMO20");
      tecla(boton, "Enter", "keyup");
    });
    expect(entrega).toHaveBeenCalledExactlyOnceWith("OT-2026-0060");
    expect(cupon).toHaveBeenCalledExactlyOnceWith("PROMO20");
    expect(accion).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "Enter" }),
    );
  });

  it("no consume el terminador de códigos que ningún listener reconoce", async () => {
    const onCodigo = vi.fn(() => false);
    const accion = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector onCodigo={onCodigo} />
          <button onKeyDown={accion}>Acción</button>
        </>,
      ),
    );
    const fin = escanear(contenedor.querySelector("button")!, "DESCONOCIDO");
    expect(fin.defaultPrevented).toBe(false);
    expect(accion).toHaveBeenCalledWith(
      expect.objectContaining({ key: "Enter" }),
    );
  });

  it("ignora el escaneo desactivado y vuelve a detectar al activarse", async () => {
    const onCodigo = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector activo={false} onCodigo={onCodigo} />
          <button>Acción</button>
        </>,
      ),
    );
    expect(
      escanear(contenedor.querySelector("button")!, "OT-2026-0060")
        .defaultPrevented,
    ).toBe(false);
    await act(() =>
      root.render(
        <>
          <Lector activo onCodigo={onCodigo} />
          <button>Acción</button>
        </>,
      ),
    );
    escanear(contenedor.querySelector("button")!, "OT-2026-0061");
    expect(onCodigo).toHaveBeenCalledExactlyOnceWith("OT-2026-0061");
  });

  it("conserva mayúsculas del lector que intercala Shift y suelta Enter sin repetir la acción", async () => {
    const onCodigo = vi.fn();
    await act(() =>
      root.render(
        <>
          <Lector onCodigo={onCodigo} />
          <button>Acción</button>
        </>,
      ),
    );
    const boton = contenedor.querySelector("button")!;
    for (const key of "OT-2026-0060") {
      tecla(boton, "Shift");
      tecla(boton, key, "keydown", 10, { shiftKey: true });
      tecla(boton, key, "keyup");
      tecla(boton, "Shift", "keyup");
    }
    tecla(boton, "Enter");
    expect(
      tecla(boton, "Enter", "keydown", 100, { repeat: true }).defaultPrevented,
    ).toBe(true);
    tecla(boton, "Enter", "keyup");
    expect(onCodigo).toHaveBeenCalledExactlyOnceWith("OT-2026-0060");
    expect(tecla(boton, "Enter", "keydown", 500).defaultPrevented).toBe(false);
  });
});
