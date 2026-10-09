import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { SESION_RENOVADA_HEADER } from "../../../../../apps/api/src/auth/sesion-renovada";
import { MFA_COOKIES } from "../../../../../apps/api/src/auth/mfa-dispositivo-cookie";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn(), fetch: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => mocks }));
const renovada = "headerFicticio.payloadFicticio.firmaFicticia";
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", mocks.fetch); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function llamar(path = "auth/password", headers: Record<string, string> = {}) {
  return POST(new Request(`http://localhost/api/backend/${path}`, {
    method: "POST", headers: { origin: "http://localhost", ...headers },
  }), { params: Promise.resolve({ path: path.split("/") }) });
}

it("renueva la cookie privada sin entregar la credencial al JavaScript y retira recuerdos MFA", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEB_ORIGIN", "http://localhost");
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 201, headers: { [SESION_RENOVADA_HEADER]: renovada, "cache-control": "private, no-store" },
  }));
  const response = await llamar();
  expect(mocks.set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, renovada, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS,
  });
  expect(mocks.delete.mock.calls).toEqual([[MFA_COOKIES.tenant], [MFA_COOKIES.plataforma]]);
  expect(response.status).toBe(201);
  expect(response.headers.has(SESION_RENOVADA_HEADER)).toBe(false);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ ok: true });
});

it.each([
  { nombre: "ausente", valor: undefined },
  { nombre: "texto inválido", valor: "invalido" },
  { nombre: "nulo", valor: "null" },
  { nombre: "excesivo", valor: "a".repeat(16385) },
])("un contrato de renovación $nombre pide reingreso sin conservar la cookie vieja", async ({ valor }) => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    headers: valor === undefined ? {} : { [SESION_RENOVADA_HEADER]: valor },
  }));
  const response = await llamar();
  expect(response.status).toBe(401);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.delete).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  expect(await response.json()).toMatchObject({ message: expect.stringContaining("contraseña se actualizó") });
});

it.each([400, 401, 500])("un cambio fallido (%s) no modifica la sesión actual", async (status) => {
  mocks.fetch.mockResolvedValue(new Response("{}", { status, headers: { [SESION_RENOVADA_HEADER]: renovada } }));
  const response = await llamar();
  expect(response.status).toBe(status);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.delete).not.toHaveBeenCalled();
  expect(response.headers.has(SESION_RENOVADA_HEADER)).toBe(false);
});

it("otra ruta no puede renovar la sesión y un header del cliente no se reenvía", async () => {
  mocks.fetch.mockResolvedValue(new Response("{}", { headers: { [SESION_RENOVADA_HEADER]: renovada } }));
  await llamar("auth/me", { [SESION_RENOVADA_HEADER]: "inyectado" });
  expect(mocks.set).not.toHaveBeenCalled();
  const [, opciones] = mocks.fetch.mock.calls[0] as [string, { headers: Headers }];
  expect(opciones.headers.has(SESION_RENOVADA_HEADER)).toBe(false);
});

it("bloquea la renovación desde otro origen antes de contactar al API", async () => {
  expect((await llamar("auth/password", { origin: "https://ajeno.example.invalid" })).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("recuperar la contraseña borra las cookies antiguas sin crear sesión", async () => {
  mocks.fetch.mockResolvedValue(new Response('{"ok":true}', {status: 201}));
  expect((await llamar("auth/recuperacion/restablecer")).status).toBe(201);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.delete.mock.calls).toEqual([[SESSION_COOKIE_NAME], [MFA_COOKIES.tenant], [MFA_COOKIES.plataforma]]);
});
it("un enlace rechazado no borra la sesión de quien lo abrió", async () => {
  mocks.fetch.mockResolvedValue(new Response('{}', {status: 400}));
  expect((await llamar("auth/recuperacion/restablecer")).status).toBe(400);
  expect(mocks.delete).not.toHaveBeenCalled();
});
