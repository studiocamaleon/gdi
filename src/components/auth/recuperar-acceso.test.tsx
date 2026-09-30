// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RecuperarAcceso } from "./recuperar-acceso";
const mocks = vi.hoisted(() => ({
  pedir: vi.fn(),
  verificar: vi.fn(),
  restablecer: vi.fn(),
}));
vi.mock("@/lib/recuperacion-api", () => ({
  solicitarRecuperacion: mocks.pedir,
  confirmarCorreo: mocks.verificar,
  restablecerClave: mocks.restablecer,
}));
let root: Root, container: HTMLDivElement;
const token = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  window.history.replaceState(null, "", "/recuperar-acceso");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function montar(hash = "") {
  window.location.hash = hash;
  await act(async () => root.render(<RecuperarAcceso />));
}
async function ingresar(id: string, valor: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function enviar() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("abrir un enlace no lo consume ni deja su secreto en la dirección", async () => {
  await montar(`modo=verificar&token=${token}`);
  expect(window.location.hash).toBe("");
  expect(mocks.verificar).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Confirmá tu correo");
  mocks.verificar.mockResolvedValue({ ok: true });
  await enviar();
  expect(mocks.verificar).toHaveBeenCalledWith(token);
  expect(container.textContent).toContain("Correo confirmado");
});
it("un enlace alterado muestra el pedido de recuperación sin contactar al servidor", async () => {
  await montar("modo=restablecer&token=alterado");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "no es válido",
  );
  expect(mocks.restablecer).not.toHaveBeenCalled();
});
it("envía sólo correo y conserva una confirmación genérica", async () => {
  mocks.pedir.mockResolvedValue({
    ok: true,
    mensaje:
      "Si la cuenta tiene un correo verificado, vas a recibir un enlace para continuar.",
  });
  await montar();
  await ingresar("rec-email", "ficticio@example.invalid");
  await enviar();
  expect(mocks.pedir).toHaveBeenCalledWith("ficticio@example.invalid");
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "Si la cuenta",
  );
});
it("no cambia la clave si las dos entradas difieren; el éxito invita al login y conserva MFA", async () => {
  await montar(`modo=restablecer&token=${token}`);
  await ingresar("rec-clave", "Nueva ficticia 123");
  await ingresar("rec-repetida", "Otra ficticia 123");
  await enviar();
  expect(mocks.restablecer).not.toHaveBeenCalled();
  expect(container.textContent).toContain("no coinciden");
  await ingresar("rec-repetida", "Nueva ficticia 123");
  mocks.restablecer.mockResolvedValue({ ok: true });
  await enviar();
  expect(mocks.restablecer).toHaveBeenCalledWith(token, "Nueva ficticia 123");
  expect(container.textContent).toContain("segundo factor");
  expect(container.querySelector('input[type="password"]')).toBeNull();
});
it("un enlace vencido muestra el rechazo sin simular que se cambió la clave", async () => {
  mocks.restablecer.mockRejectedValue(new Error("El enlace venció."));
  await montar(`modo=restablecer&token=${token}`);
  await ingresar("rec-clave", "Nueva ficticia 123");
  await ingresar("rec-repetida", "Nueva ficticia 123");
  await enviar();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "El enlace venció.",
  );
  expect(container.querySelector('[role="status"]')).toBeNull();
});
