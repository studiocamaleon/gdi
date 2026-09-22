import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST, DELETE } from "./route";
import {
  MFA_COOKIES,
  MFA_HEADERS,
  MFA_RECORDADO_HEADER,
} from "../../../../../apps/api/src/auth/mfa-dispositivo-cookie";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks }));
const token = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
function llamar(path: string, method = "POST", headers = {}) {
  const request = new Request(`http://localhost/api/backend/${path}`, {
    method,
    headers,
  });
  return (method === "DELETE" ? DELETE : POST)(request, {
    params: Promise.resolve({ path: path.split("/") }),
  });
}
it.each(["tenant", "plataforma"] as const)(
  "guarda el recuerdo de %s sólo en cookie privada, nunca en la respuesta",
  async (alcance) => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "sesion" }), {
        headers: { [MFA_RECORDADO_HEADER]: JSON.stringify({ token, alcance }) },
      }),
    );
    const response = await llamar("auth/mfa/verificar");
    expect(mocks.set).toHaveBeenCalledWith(
      MFA_COOKIES[alcance],
      token,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 2592000,
      }),
    );
    expect(response.headers.has(MFA_RECORDADO_HEADER)).toBe(false);
    expect(await response.json()).toEqual({ accessToken: "sesion" });
  },
);
it("usa sólo la cookie del servidor e ignora encabezados escritos por el cliente", async () => {
  mocks.get.mockImplementation((name) =>
    name === MFA_COOKIES.tenant ? { value: token } : undefined,
  );
  mocks.fetch.mockImplementation(async () => new Response("{}"));
  await llamar("auth/login", "POST", { [MFA_HEADERS.tenant]: "b".repeat(64) });
  const headers: Headers = mocks.fetch.mock.calls[0][1].headers;
  expect(headers.get(MFA_HEADERS.tenant)).toBe(token);
  expect(mocks.set).not.toHaveBeenCalled();
  await llamar("auth/me");
  expect(mocks.fetch.mock.calls[1][1].headers.has(MFA_HEADERS.tenant)).toBe(
    false,
  );
});
it.each(["malformado", "null", JSON.stringify({ token, alcance: "otro" })])(
  "no guarda un recuerdo inválido: %s",
  async (header) => {
    mocks.fetch.mockResolvedValue(
      new Response("{}", { headers: { [MFA_RECORDADO_HEADER]: header } }),
    );
    expect((await llamar("auth/mfa/verificar")).status).toBe(200);
    expect(mocks.set).not.toHaveBeenCalled();
  },
);
it("un MFA fallido no emite confianza y sólo una revocación exitosa borra cookies", async () => {
  mocks.fetch.mockResolvedValueOnce(
    new Response("{}", {
      status: 401,
      headers: {
        [MFA_RECORDADO_HEADER]: JSON.stringify({ token, alcance: "tenant" }),
      },
    }),
  );
  await llamar("auth/mfa/verificar");
  expect(mocks.set).not.toHaveBeenCalled();
  mocks.fetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
  await llamar("auth/perfil/mfa/dispositivos", "DELETE");
  expect(mocks.delete).not.toHaveBeenCalled();
  mocks.fetch.mockResolvedValueOnce(new Response("{}"));
  await llamar("auth/perfil/mfa/dispositivos", "DELETE");
  expect(mocks.delete.mock.calls).toEqual([
    [MFA_COOKIES.tenant],
    [MFA_COOKIES.plataforma],
  ]);
});
