import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getContextoPlataforma } from "@/lib/plataforma-api";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { proxy } from "@/proxy";
import { GET as salir } from "@/app/salir/route";
import PlataformaPage from "./page";
import { PlataformaSinAcceso } from "@/components/plataforma/consola-view";

vi.mock("@/lib/plataforma-api", () => ({ getContextoPlataforma: vi.fn() }));
vi.mock("@/components/plataforma/consola-view", () => ({
  ConsolaPlataformaView: () => null,
  PlataformaSinAcceso: () => null,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

beforeEach(() => vi.clearAllMocks());

it("recupera el login de empresa tras una sesión de Plataforma revocada", async () => {
  const origin = "https://staging.example.invalid";
  const payload = Buffer.from(JSON.stringify({
    plat: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const headers = { cookie: `${SESSION_COOKIE_NAME}=prueba.${payload}.prueba` };

  // El proxy todavía ve un JWT vigente, pero la API ya revocó su sesión.
  expect(proxy(new NextRequest(`${origin}/login`, { headers })).headers.get("location"))
    .toBe(`${origin}/plataforma`);
  vi.mocked(getContextoPlataforma).mockRejectedValue(new ApiError("Revocada", 401));
  await expect(PlataformaPage()).rejects.toThrow("redirect:/salir?acceso=plataforma");

  const salida = new NextRequest(`${origin}/salir?acceso=plataforma`, { headers });
  expect(proxy(salida).headers.get("x-middleware-next")).toBe("1");
  const response = await salir(salida);
  expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
  expect(response.headers.get("location")).toBe("/backoffice");
  expect(proxy(new NextRequest(`${origin}/login`)).headers.get("x-middleware-next")).toBe("1");
});

it("conserva el rechazo por permisos sin confundirlo con una sesión revocada", async () => {
  vi.mocked(getContextoPlataforma).mockRejectedValue(new ApiError("Sin permiso", 403));
  expect((await PlataformaPage()).type).toBe(PlataformaSinAcceso);
  expect(redirect).not.toHaveBeenCalled();
});

it("no cierra la sesión ante una interrupción de la API", async () => {
  const error = new ApiError("No disponible", 503);
  vi.mocked(getContextoPlataforma).mockRejectedValue(error);
  await expect(PlataformaPage()).rejects.toBe(error);
  expect(redirect).not.toHaveBeenCalled();
});
