import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ get: vi.fn(), fetch: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("STAGING_PRIVATE", "false");
  vi.stubEnv("API_URL", "http://api.example.invalid/api");
  mocks.fetch.mockImplementation(async () =>
    Response.json({ estado: "pendiente", codigo: "ABCD2345" }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function llamar(accion: string, method = "GET", headers = {}) {
  return (method === "GET" ? GET : POST)(
    new Request(`http://localhost/api/pantalla/${accion}`, {
      method,
      headers: { origin: "http://localhost", ...headers },
    }),
    { params: Promise.resolve({ accion }) },
  );
}
it("crea la credencial sólo en cookie privada y nunca en el cuerpo/URL", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEB_ORIGIN", "http://localhost");
  const response = await llamar("iniciar", "POST");
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toMatch(/grafo_pantalla=grafo_tv_[a-f0-9]{64}/);
  for (const atributo of [
    "HttpOnly",
    "Secure",
    "SameSite=strict",
    "Path=/api/pantalla",
  ])
    expect(cookie).toContain(atributo);
  expect(JSON.stringify(await response.json())).not.toContain("grafo_tv_");
  expect(mocks.fetch.mock.calls[0][0]).toBe(
    "http://api.example.invalid/api/pantalla-produccion/iniciar",
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("usa sólo la cookie TV, ignora la sesión y la autorización del navegador", async () => {
  const token = `grafo_tv_${"a".repeat(64)}`;
  mocks.get.mockImplementation((name) => ({
    value: name === "grafo_pantalla" ? token : "sesion-personal",
  }));
  await llamar("datos", "GET", {
    authorization: "Bearer atacante",
    "x-grafoprint-web-token": "atacante",
  });
  const headers: Headers = mocks.fetch.mock.calls[0][1].headers;
  expect(headers.get("authorization")).toBe(`Bearer ${token}`);
  expect(headers.has("x-grafoprint-web-token")).toBe(false);
  expect(mocks.fetch.mock.calls[0][1].redirect).toBe("error");
});
it("conserva la vinculación al recargar y no genera otra credencial", async () => {
  mocks.get.mockReturnValue({ value: `grafo_tv_${"a".repeat(64)}` });
  const response = await llamar("iniciar", "POST");
  expect(mocks.fetch.mock.calls[0][0]).toMatch(/\/estado$/);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("rechaza CSRF, acciones arbitrarias y lecturas sin credencial", async () => {
  expect(
    (
      await llamar("reiniciar", "POST", {
        origin: "https://otro.example.invalid",
      })
    ).status,
  ).toBe(403);
  expect((await llamar("usuarios", "POST")).status).toBe(404);
  expect((await llamar("reiniciar")).status).toBe(404);
  expect((await llamar("datos")).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("conserva la protección privada de staging", async () => {
  vi.stubEnv("STAGING_PRIVATE", "true");
  vi.stubEnv("STAGING_ACCESS_USER", "prueba");
  vi.stubEnv("STAGING_ACCESS_PASSWORD", "clave-ficticia-de-prueba-12345");
  expect((await llamar("iniciar", "POST")).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
