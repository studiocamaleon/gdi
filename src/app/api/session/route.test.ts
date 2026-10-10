import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST, DELETE } from "./route";
const cookies = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookies }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WEB_ORIGIN", "https://app.example.invalid");
});
afterEach(() => vi.unstubAllEnvs());
it("rechaza un cuerpo excesivo antes de crear una cookie", async () => {
  const response = await POST(
    new Request("http://internal/api/session", {
      method: "POST",
      headers: {
        origin: "https://app.example.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: "x".repeat(16 * 1024) }),
    }),
  );
  expect(response.status).toBe(413);
  expect(cookies.set).not.toHaveBeenCalled();
});
it.each([undefined, "null", "https://intruso.example.invalid"])(
  "no fija una sesión desde %s aunque el cuerpo parezca JSON",
  async (origin) => {
    const response = await POST(
      new Request("http://internal/api/session", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify({ token: "token-ficticio" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(cookies.set).not.toHaveBeenCalled();
  },
);
it("no permite cerrar una sesión desde otro sitio", async () => {
  expect(
    (
      await DELETE(
        new Request("http://internal/api/session", {
          method: "DELETE",
          headers: { origin: "https://intruso.example.invalid" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(cookies.delete).not.toHaveBeenCalled();
});
it("mantiene las cookies privadas para un pedido propio", async () => {
  const response = await POST(
    new Request("http://internal/api/session", {
      method: "POST",
      headers: {
        origin: "https://app.example.invalid",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: "token-ficticio" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(cookies.set).toHaveBeenCalledWith(
    "gdi_access_token",
    "token-ficticio",
    expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
  );
});
