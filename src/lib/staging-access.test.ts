import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { cabecerasBackendStaging, controlAccesoStaging } from "./staging-access";

const password = "clave-ficticia-de-staging-para-pruebas";
const webToken = "token-ficticio-web-api-para-pruebas-12345";
const authorization = `Basic ${Buffer.from(`ensayo:${password}`).toString("base64")}`;
beforeEach(() => {
  vi.stubEnv("STAGING_PRIVATE", "true");
  vi.stubEnv("STAGING_BASIC_AUTH_ENABLED", undefined);
  vi.stubEnv("STAGING_ACCESS_USER", "ensayo");
  vi.stubEnv("STAGING_ACCESS_PASSWORD", password);
  vi.stubEnv("STAGING_WEB_API_TOKEN", webToken);
  vi.stubEnv("STAGING_WEB_ORIGIN", "https://staging.example.invalid");
});

describe("staging sin contraseña de entrada", () => {
  beforeEach(() => vi.stubEnv("STAGING_BASIC_AUTH_ENABLED", "false"));

  it.each(["/login", "/pantalla/produccion", "/api/pantalla/iniciar"])(
    "permite abrir %s sin Basic y conserva las cabeceras de staging", (path) => {
      vi.stubEnv("STAGING_ACCESS_USER", "");
      vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
      const response = proxy(new NextRequest(`https://staging.example.invalid${path}`));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("www-authenticate")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );

  it("mantiene el login de usuario para la gestión de producción", () => {
    const response = proxy(new NextRequest("https://staging.example.invalid/produccion/pantallas"));
    expect(response.headers.get("location")).toBe("https://staging.example.invalid/login");
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("rechaza orígenes ajenos aunque Basic esté deshabilitado", () => {
    const incoming = new Headers({ origin: "https://externo.example.invalid", "fly-client-ip": "192.0.2.1" });
    expect(controlAccesoStaging(incoming)?.status).toBe(403);
    expect(() => cabecerasBackendStaging(incoming, new Headers())).toThrow("Acceso de staging no autorizado.");
    expect(controlAccesoStaging(new Headers({ origin: "https://staging.example.invalid" }))).toBeNull();
  });

  it("conserva la autenticación privada entre web y API sin Basic", () => {
    const incoming = new Headers({ "fly-client-ip": "192.0.2.1" });
    const outgoing = new Headers({ "x-grafoprint-web-token": "falso", "x-grafoprint-client-ip": "8.8.8.8", "x-forwarded-for": "8.8.8.8", "x-real-ip": "8.8.8.8" });
    cabecerasBackendStaging(incoming, outgoing);
    expect(outgoing.get("x-grafoprint-web-token")).toBe(webToken);
    expect(outgoing.get("x-grafoprint-client-ip")).toBe("192.0.2.1");
    expect(outgoing.has("x-forwarded-for")).toBe(false);
    expect(outgoing.has("x-real-ip")).toBe(false);
    expect(() => cabecerasBackendStaging(new Headers(), new Headers())).toThrow("Conexión privada");
    vi.stubEnv("STAGING_WEB_API_TOKEN", "");
    expect(() => cabecerasBackendStaging(incoming, new Headers())).toThrow("Conexión privada");
  });

  it.each([undefined, "true", "", "0", "FALSE"])("sólo false explícito deshabilita Basic: %s", (value) => {
    vi.stubEnv("STAGING_BASIC_AUTH_ENABLED", value);
    expect(controlAccesoStaging(new Headers())?.status).toBe(401);
  });
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

it("rechaza credenciales alteradas de igual o diferente longitud", () => {
  for (const supplied of [authorization.slice(0, -1), authorization + "x", authorization.replace("Basic", "basic"), `Basic ${Buffer.from(`ensayo:${password}x`).toString("base64")}`]) {
    expect(controlAccesoStaging(new Headers({ authorization: supplied }))?.status).toBe(401);
  }
  expect(controlAccesoStaging(new Headers({ authorization }))).toBeNull();
});
