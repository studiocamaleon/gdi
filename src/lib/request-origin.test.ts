import { afterEach, expect, it, vi } from "vitest";
import { comprobarOrigenDeEscritura } from "./request-origin";
afterEach(() => vi.unstubAllEnvs());
function comprobar(
  origin?: string,
  method = "POST",
  extra: Record<string, string> = {},
) {
  return comprobarOrigenDeEscritura(
    new Request("http://internal:3000/api/session", {
      method,
      headers: { ...(origin === undefined ? {} : { origin }), ...extra },
    }),
  );
}
it.each([
  undefined,
  "null",
  "https://otra.example.invalid",
  "https://app.example.invalid.evil.invalid",
  "https://sub.app.example.invalid",
])("rechaza el origen %s antes de tocar la sesión", (origin) => {
  vi.stubEnv("WEB_ORIGIN", "https://app.example.invalid");
  expect(comprobar(origin)?.status).toBe(403);
});
it.each(["POST", "PUT", "PATCH", "DELETE"])(
  "permite %s sólo desde el origen configurado detrás de Fly",
  (method) => {
    vi.stubEnv("WEB_ORIGIN", "https://app.example.invalid");
    expect(comprobar("https://app.example.invalid", method)).toBeNull();
  },
);
it("no confía en Host ni en X-Forwarded-Host enviados por el cliente", () => {
  vi.stubEnv("WEB_ORIGIN", "https://app.example.invalid");
  expect(
    comprobar("https://otro.example.invalid", "POST", {
      host: "otro.example.invalid",
      "x-forwarded-host": "otro.example.invalid",
    })?.status,
  ).toBe(403);
});
it("rechaza configuración ausente en producción", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEB_ORIGIN", undefined);
  vi.stubEnv("STAGING_WEB_ORIGIN", undefined);
  expect(comprobar("http://internal:3000")?.status).toBe(503);
});
it("conserva el origen explícito de staging", () => {
  vi.stubEnv("WEB_ORIGIN", undefined);
  vi.stubEnv("STAGING_WEB_ORIGIN", "https://staging.example.invalid");
  expect(comprobar("https://staging.example.invalid")).toBeNull();
});
it("local funciona con HTTP y las lecturas no requieren Origin", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("WEB_ORIGIN", undefined);
  vi.stubEnv("STAGING_WEB_ORIGIN", undefined);
  expect(comprobar("http://internal:3000")).toBeNull();
  expect(comprobar(undefined, "GET")).toBeNull();
});
