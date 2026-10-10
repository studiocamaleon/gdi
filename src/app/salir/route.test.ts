import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/session";
import { GET } from "./route";

describe("salida de una sesión revocada", () => {
  it.each([
    "https://0.0.0.0:3000",
    "https://staging.example.invalid",
    "http://localhost:3000",
  ])("vuelve al login del navegador aunque Next reciba %s", async (origin) => {
    const response = await GET(
      new NextRequest(`${origin}/salir?motivo=sesion`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=sesion-ficticia` },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login?motivo=sesion");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toMatchObject({
      value: "",
      path: "/",
      expires: new Date(0),
    });
    expect(response.headers.has("www-authenticate")).toBe(false);
  });

  it("no toma el destino de cabeceras del solicitante", async () => {
    const response = await GET(
      new NextRequest("http://0.0.0.0:3000/salir", {
        headers: {
          host: "ajeno.example.invalid",
          "x-forwarded-host": "ajeno.example.invalid",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.headers.get("location")).toBe("/login");
  });

  it("limpia la sesión rechazada antes de volver al acceso de Plataforma", async () => {
    const response = await GET(
      new NextRequest("https://staging.example.invalid/salir?acceso=plataforma", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=sesion-revocada` },
      }),
    );
    expect(response.headers.get("location")).toBe("/backoffice");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toMatchObject({
      value: "",
      path: "/",
      expires: new Date(0),
    });
  });

  it.each(["https://ajeno.example.invalid", "//ajeno.example.invalid", "/plataforma", "plataforma/otro"])(
    "no acepta un destino arbitrario: %s",
    async (acceso) => {
      const response = await GET(
        new NextRequest(`https://staging.example.invalid/salir?acceso=${encodeURIComponent(acceso)}`),
      );
      expect(response.headers.get("location")).toBe("/login");
    },
  );

  it("conserva el motivo como texto sin convertirlo en otro destino", async () => {
    const motivo = "//ajeno.example.invalid/?x=1&y=2";
    const response = await GET(
      new NextRequest(
        `http://0.0.0.0:3000/salir?motivo=${encodeURIComponent(motivo)}`,
      ),
    );
    const location = response.headers.get("location")!;
    const destino = new URL(location, "https://staging.example.invalid");

    expect(location.startsWith("/login?")).toBe(true);
    expect(destino.origin).toBe("https://staging.example.invalid");
    expect(destino.pathname).toBe("/login");
    expect([...destino.searchParams]).toEqual([["motivo", motivo]]);
  });
});
