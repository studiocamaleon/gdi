// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxComposer, type BorradoresInbox } from "./inbox-composer";
import type { EnviarTextoInbox, RespuestaInbox } from "@/lib/meta-inbox-api";
import { ApiError } from "@/lib/api";
let root: Root, container: HTMLDivElement;
let enviar: ReturnType<typeof vi.fn<EnviarTextoInbox>>;
let actualizar: ReturnType<typeof vi.fn>;
let borradores: BorradoresInbox;
const aceptado = {
  id: "envio",
  clave: "clave",
  estado: "ACEPTADO",
  texto: null,
  codigo: null,
  creadoEl: new Date().toISOString(),
  mensajeId: "mensaje",
};
function ventana(): RespuestaInbox {
  const ahora = Date.now();
  return {
    habilitado: true,
    abierta: true,
    hasta: new Date(ahora + 3600000).toISOString(),
    servidorEl: new Date(ahora).toISOString(),
  };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  borradores = new Map();
  enviar = vi.fn<EnviarTextoInbox>().mockResolvedValue(aceptado);
  actualizar = vi.fn().mockResolvedValue(true);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = (scope = "uno", respuesta = ventana()) =>
  act(async () =>
    root.render(
      <InboxComposer
        key={scope}
        scope={scope}
        canalId="canal"
        conversacionId={scope}
        destino={scope}
        respuesta={respuesta}
        enviar={enviar}
        actualizar={actualizar}
        borradores={borradores}
      />,
    ),
  );
async function escribir(texto: string) {
  const input = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, texto);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function enviarFormulario() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function tecla(ctrlKey = false) {
  await act(async () => {
    container.querySelector("textarea")!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}
it("no envía al abrir ni con Enter simple; Ctrl+Enter envía una vez y limpia el borrador", async () => {
  await render();
  await escribir("Hola\nTu pedido está listo 🖨️");
  await tecla();
  expect(enviar).not.toHaveBeenCalled();
  await tecla(true);
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(enviar.mock.calls[0][0]).toBe("uno");
  expect(enviar.mock.calls[0][1]).toMatchObject({
    texto: "Hola\nTu pedido está listo 🖨️",
    canalId: "canal",
  });
  expect(enviar.mock.calls[0][1].clave).toMatch(/^[a-f0-9-]{36}$/);
  expect(container.querySelector("textarea")!.value).toBe("");
  expect(actualizar).toHaveBeenCalledOnce();
});
it("un doble envío mientras espera conserva un solo intento", async () => {
  let resolver!: (v: typeof aceptado) => void;
  enviar.mockImplementation(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await render();
  await escribir("Hola");
  await enviarFormulario();
  await enviarFormulario();
  expect(enviar).toHaveBeenCalledOnce();
  await act(async () => resolver(aceptado));
});
it.each([
  new Error("red cortada"),
  new ApiError("Sesión cerrada durante el envío", 403),
])(
  "un fallo conserva la misma clave incluso tras desmontar y nunca reenvía solo: %s",
  async (error) => {
    enviar.mockRejectedValueOnce(error);
    await render();
    await escribir("No duplicar");
    await enviarFormulario();
    const clave = enviar.mock.calls[0][1].clave;
    expect(container.querySelector("textarea")!.readOnly).toBe(true);
    expect(container.textContent).toContain("Comprobar envío");
    await render("dos");
    await render("uno");
    expect(enviar).toHaveBeenCalledOnce();
    await enviarFormulario();
    expect(enviar.mock.calls[1][1].clave).toBe(clave);
  },
);
it("cambiar de conversación cancela la espera, mantiene su intento y descarta un resultado tardío", async () => {
  let resolver!: (v: typeof aceptado) => void;
  enviar.mockImplementation(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await render();
  await escribir("Mensaje de uno");
  await enviarFormulario();
  const signal = enviar.mock.calls[0][2];
  await render("dos");
  expect(signal?.aborted).toBe(true);
  await escribir("Borrador de dos");
  await act(async () => resolver(aceptado));
  expect(container.querySelector("textarea")!.value).toBe("Borrador de dos");
  expect(actualizar).not.toHaveBeenCalled();
  await render("uno");
  expect(container.querySelector("textarea")!.value).toBe("Mensaje de uno");
  expect(container.textContent).toContain("Comprobar envío");
});
it("guarda borradores separados por conversación y no los transmite al cambiar", async () => {
  await render();
  await escribir("Uno");
  await render("dos");
  expect(container.querySelector("textarea")!.value).toBe("");
  await escribir("Dos");
  await render("uno");
  expect(container.querySelector("textarea")!.value).toBe("Uno");
  expect(enviar).not.toHaveBeenCalled();
});
it("impide texto nuevo cuando la ventana está cerrada incluso por teclado o submit", async () => {
  borradores.set("uno", { texto: "Pendiente" });
  await render("uno", { ...ventana(), abierta: false });
  expect(container.querySelector("textarea")!.disabled).toBe(true);
  await tecla(true);
  await enviarFormulario();
  expect(enviar).not.toHaveBeenCalled();
  expect(container.textContent).toContain("plantilla aprobada");
});
it("vence según el reloj del servidor, aunque el reloj de la computadora sea distinto", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  const respuesta = {
    habilitado: true,
    abierta: true,
    servidorEl: "2030-01-01T12:00:00Z",
    hasta: "2030-01-01T12:00:01Z",
  };
  await render("uno", respuesta);
  await escribir("Hola");
  expect(container.querySelector("textarea")!.disabled).toBe(false);
  await act(async () => vi.advanceTimersByTime(2000));
  expect(container.querySelector("textarea")!.disabled).toBe(true);
  await enviarFormulario();
  expect(enviar).not.toHaveBeenCalled();
});
it("un intento ya iniciado se puede comprobar después del cierre de ventana", async () => {
  borradores.set("uno", { texto: "Anterior", clave: "clave-original" });
  await render("uno", { ...ventana(), abierta: false });
  await enviarFormulario();
  expect(enviar.mock.calls[0][1].clave).toBe("clave-original");
});
it("no permite contenido vacío ni un borrador que exceda el límite", async () => {
  borradores.set("uno", { texto: "a".repeat(4097) });
  await render();
  await enviarFormulario();
  expect(enviar).not.toHaveBeenCalled();
  await escribir("  ");
  await enviarFormulario();
  expect(enviar).not.toHaveBeenCalled();
  expect(container.querySelector("textarea")!.maxLength).toBe(4096);
});

it("muestra micrófono al estar vacío y lo sustituye por enviar cuando hay texto", async () => {
  await render();
  expect(container.querySelector('[aria-label="Nota de voz"]')).not.toBeNull();
  expect(container.querySelector('button[type="submit"]')).toBeNull();
  await escribir("Hola");
  expect(container.querySelector('[aria-label="Nota de voz"]')).toBeNull();
  expect(container.querySelector('button[type="submit"]')).not.toBeNull();
  expect(enviar).not.toHaveBeenCalled();
});
