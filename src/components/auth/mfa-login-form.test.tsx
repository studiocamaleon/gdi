// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MfaLoginForm } from "./mfa-login-form";
const mocks = vi.hoisted(() => ({ verificar: vi.fn() }));
vi.mock("@/lib/auth", () => ({ verificarMfa: mocks.verificar }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it.each([false, true])(
  "recordar es opcional, también en backoffice=%s",
  async (backoffice) => {
    const success = vi.fn();
    mocks.verificar
      .mockRejectedValueOnce(new Error("Código inválido"))
      .mockResolvedValueOnce({ accessToken: "sesion" });
    await act(async () =>
      root.render(
        <MfaLoginForm
          challenge={{
            requiereMfa: true,
            challengeToken: "desafio",
            expiresIn: 300,
            accessToken: null,
          }}
          onSuccess={success}
          onBack={vi.fn()}
          backoffice={backoffice}
        />,
      ),
    );
    const checkbox = container.querySelector<HTMLElement>('[role="checkbox"]')!;
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    const enviar = () =>
      act(async () => {
        container
          .querySelector("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          );
      });
    await enviar();
    expect(mocks.verificar).toHaveBeenLastCalledWith("desafio", "", false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Código inválido",
    );
    expect(success).not.toHaveBeenCalled();
    await act(async () => checkbox.click());
    await enviar();
    expect(mocks.verificar).toHaveBeenLastCalledWith("desafio", "", true);
    expect(success).toHaveBeenCalledWith("sesion");
  },
);
