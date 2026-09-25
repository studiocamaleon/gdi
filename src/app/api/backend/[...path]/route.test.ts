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
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
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

it("protege el BFF de staging y sólo envía el secreto interno configurado por el servidor", async () => {
  vi.stubEnv("STAGING_PRIVATE", "true");
  vi.stubEnv("STAGING_ACCESS_USER", "ensayo");
  vi.stubEnv("STAGING_ACCESS_PASSWORD", "clave-ficticia-de-staging-123456");
  vi.stubEnv("STAGING_WEB_API_TOKEN", "secreto-interno-del-servidor-12345678");
  expect((await llamar("auth/login")).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.fetch.mockResolvedValue(new Response("{}"));
  const authorization = `Basic ${Buffer.from("ensayo:clave-ficticia-de-staging-123456").toString("base64")}`;
  const response = await llamar("auth/login", "POST", { authorization, "fly-client-ip":"203.0.113.25", "x-forwarded-for":"8.8.8.8", "x-grafoprint-web-token":"falso", "x-grafoprint-client-ip":"1.1.1.1" });
  expect(response.status).toBe(200);
  const headers: Headers = mocks.fetch.mock.calls[0][1].headers;
  expect(headers.get("x-grafoprint-web-token")).toBe("secreto-interno-del-servidor-12345678");
  expect(headers.get("x-grafoprint-client-ip")).toBe("203.0.113.25");
  expect(headers.has("x-forwarded-for")).toBe(false);
  expect(headers.has("authorization")).toBe(false);
  expect(response.headers.has("x-grafoprint-web-token")).toBe(false);
});
