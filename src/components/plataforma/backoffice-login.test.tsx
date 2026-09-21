// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BackofficeLogin } from "./backoffice-login";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  verifyMfa: vi.fn(),
  session: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/auth", () => ({
  loginPlataforma: mocks.login,
  verificarMfa: mocks.verifyMfa,
}));
vi.mock("@/lib/session", () => ({ setSessionToken: mocks.session }));

let root: Root, container: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<BackofficeLogin />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function fill(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function credentials() {
  await fill("staff-email", "equipo@example.com");
  await fill("staff-password", "clave-de-prueba");
}
const challenge = {
  requiereMfa: true,
  challengeToken: "challenge-prueba",
  expiresIn: 300,
  accessToken: null,
};

it("guarda la sesión antes de entrar a Plataforma y evita envíos duplicados", async () => {
  let resolve!: (value: { accessToken: string }) => void;
  mocks.login.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await credentials();
  await submit();
  await submit();
  expect(mocks.login).toHaveBeenCalledTimes(1);
  expect(mocks.login).toHaveBeenCalledWith(
    "equipo@example.com",
    "clave-de-prueba",
  );
  expect(container.querySelector("form")!.getAttribute("aria-busy")).toBe(
    "true",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => resolve({ accessToken: "token-prueba" }));
  expect(mocks.session).toHaveBeenCalledWith("token-prueba");
  expect(mocks.replace).toHaveBeenCalledWith("/plataforma");
  expect(mocks.session.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.replace.mock.invocationCallOrder[0],
  );
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("informa errores y permite reintentar sin abrir una sesión incompleta", async () => {
  mocks.login
    .mockRejectedValueOnce(new Error("Credenciales inválidas"))
    .mockResolvedValueOnce({ accessToken: null });
  await credentials();
  await submit();
  expect(container.querySelector('[role="alert"]')!.textContent).toBe(
    "Credenciales inválidas",
  );
  expect(
    container.querySelector<HTMLInputElement>("#staff-password")!.disabled,
  ).toBe(false);
  await submit();
  expect(container.querySelector('[role="alert"]')!.textContent).toBe(
    "No se pudo iniciar sesión.",
  );
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("requiere verificar MFA antes de guardar la sesión y conserva el reintento", async () => {
  mocks.login.mockResolvedValue(challenge);
  mocks.verifyMfa
    .mockRejectedValueOnce(new Error("Código inválido"))
    .mockResolvedValueOnce({ accessToken: "token-mfa" });
  await credentials();
  await submit();
  expect(container.textContent).toContain("Confirmá que sos vos");
  expect(mocks.session).not.toHaveBeenCalled();
  await fill("mfa-login-codigo", "123456");
  await submit();
  expect(container.querySelector('[role="alert"]')!.textContent).toBe(
    "Código inválido",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  await fill("mfa-login-codigo", "654321");
  await submit();
  expect(mocks.verifyMfa).toHaveBeenLastCalledWith(
    "challenge-prueba",
    "654321",
    false,
  );
  expect(mocks.session).toHaveBeenCalledWith("token-mfa");
  expect(mocks.replace).toHaveBeenCalledWith("/plataforma");
});

it("permite volver de MFA sin retener la contraseña", async () => {
  mocks.login.mockResolvedValue(challenge);
  await credentials();
  await submit();
  const back = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Volver al inicio de sesión",
  )!;
  await act(async () => back.click());
  expect(container.querySelector<HTMLInputElement>("#staff-email")!.value).toBe(
    "equipo@example.com",
  );
  expect(
    container.querySelector<HTMLInputElement>("#staff-password")!.value,
  ).toBe("");
  expect(mocks.session).not.toHaveBeenCalled();
});
