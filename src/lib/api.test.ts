import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionToken: async () => null }));
import { apiRequest, ApiError } from "./api";
import { logout } from "./auth";

afterEach(() => vi.unstubAllGlobals());

it.each([200, 201, 204, 205])(
  "cerrar sesión acepta una respuesta %s sin cuerpo",
  async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);

    await expect(logout()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    );
  },
);

it("acepta un cuerpo con sólo espacios como respuesta vacía", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(" \n ")));
  await expect(apiRequest<void>("/accion")).resolves.toBeUndefined();
});

it("conserva null como un valor JSON explícito", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("null")));
  await expect(apiRequest<null>("/dato")).resolves.toBeNull();
});

it("no oculta un JSON truncado como si fuera una respuesta vacía", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"dato":')));
  await expect(apiRequest("/dato")).rejects.toBeInstanceOf(SyntaxError);
});

it("una respuesta de error vacía sigue rechazando la operación", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  const resultado = apiRequest("/auth/logout", { method: "POST" });
  await expect(resultado).rejects.toBeInstanceOf(ApiError);
  await expect(resultado).rejects.toMatchObject({ status: 401 });
});
