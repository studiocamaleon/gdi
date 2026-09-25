import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { cabecerasBackendStaging, controlAccesoStaging } from "./staging-access";

const password = "clave-ficticia-de-staging-para-pruebas";
const webToken = "token-ficticio-web-api-para-pruebas-12345";
const authorization = `Basic ${Buffer.from(`ensayo:${password}`).toString("base64")}`;
beforeEach(() => {
  vi.stubEnv("STAGING_PRIVATE", "true");
  vi.stubEnv("STAGING_ACCESS_USER", "ensayo");
  vi.stubEnv("STAGING_ACCESS_PASSWORD", password);
  vi.stubEnv("STAGING_WEB_API_TOKEN", webToken);
  vi.stubEnv("STAGING_WEB_ORIGIN", "https://staging.example.invalid");
});
afterEach(() => vi.unstubAllEnvs());

describe("entrada de staging", () => {
  it("permite leer sólo el ícono exacto sin Basic, sin abrir rutas privadas", () => {
    for (const method of ["GET", "HEAD"]) {
      const response = proxy(new NextRequest("https://staging.example.invalid/icon.svg?v=prueba", {method}));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    }
    for (const path of ["/icon.svg/privado", "/icon.svg-admin", "/backoffice"]) {
      expect(proxy(new NextRequest(`https://staging.example.invalid${path}`)).status).toBe(401);
    }
    expect(proxy(new NextRequest("https://staging.example.invalid/icon.svg", {method:"POST"})).status).toBe(401);
  });
  it.each(["/login", "/backoffice", "/api/backend/auth/login", "/api/session", "/p/token", "/_next/static/app.js", "/brand/logo.png", "/api/health/extra"])(
    "protege %s incluso sin sesión de usuario", (path) => {
      const response = proxy(new NextRequest(`https://staging.example.invalid${path}`));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain("Basic");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );
  it("deja salud GET y robots accesibles, pero no POST a salud", async () => {
    expect(proxy(new NextRequest("https://staging.example.invalid/api/health")).status).toBe(200);
    expect(proxy(new NextRequest("https://staging.example.invalid/api/health", {method:"POST"})).status).toBe(401);
    const robots = proxy(new NextRequest("https://staging.example.invalid/robots.txt"));
    expect(await robots.text()).toContain("Disallow: /");
  });
  it("la clave de staging no reemplaza el login del sistema", () => {
    const request = new NextRequest("https://staging.example.invalid/", {headers:{authorization}});
    expect(proxy(request).headers.get("location")).toBe("https://staging.example.invalid/login");
    expect(proxy(new NextRequest("https://staging.example.invalid/api/session",{headers:{authorization}})).headers.get("location")).toBeNull();
  });
  it("rechaza configuración incompleta y origen externo aunque tenga la clave", () => {
    expect(controlAccesoStaging(new Headers({authorization,origin:"https://externo.example.invalid"}))?.status).toBe(403);
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
    expect(controlAccesoStaging(new Headers({authorization}))?.status).toBe(503);
  });
});

it("conserva la IP de Fly y reemplaza las cabeceras internas falsificadas", () => {
  const incoming = new Headers({authorization,"fly-client-ip":"2001:db8::7","x-forwarded-for":"1.1.1.1","x-grafoprint-web-token":"falso","x-grafoprint-client-ip":"8.8.8.8"});
  const outgoing = new Headers({"x-forwarded-for":"1.1.1.1"});
  cabecerasBackendStaging(incoming,outgoing);
  expect(outgoing.get("x-grafoprint-web-token")).toBe(webToken);
  expect(outgoing.get("x-grafoprint-client-ip")).toBe("2001:db8::7");
  expect(outgoing.has("x-forwarded-for")).toBe(false);
  expect(outgoing.has("authorization")).toBe(false);
});

it.each(["", "1.2.3.4, 5.6.7.8", "10.0.0.1:123", "desconocida"])("no inventa una IP si Fly entrega %s", (ip) => {
  expect(() => cabecerasBackendStaging(new Headers({authorization,"fly-client-ip":ip}),new Headers())).toThrow();
});
