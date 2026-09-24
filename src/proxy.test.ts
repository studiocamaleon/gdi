import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// Sólo prueba el ruteo del proxy; los guards del API verifican la firma real.
function request(path: string, tipo?: "empresa" | "plataforma" | "vencida") {
  const payload = {
    plat: tipo === "plataforma",
    exp: tipo === "vencida" ? 1 : Math.floor(Date.now() / 1000) + 3600,
  };
  const cookie = tipo
    ? `${SESSION_COOKIE_NAME}=prueba.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.prueba`
    : "";
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie },
  });
}

describe("enlaces de invitación", () => {
  it.each([undefined, "empresa", "plataforma", "vencida"] as const)(
    "permite validar el enlace con sesión %s",
    (tipo) => {
      const response = proxy(request("/aceptar-invitacion?token=prueba", tipo));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );
  it("conserva el acceso privado y no abre rutas con prefijos parecidos", () => {
    expect(
      proxy(request("/aceptar-invitacion-admin")).headers.get("location"),
    ).toBe("http://localhost:3000/login");
    expect(proxy(request("/", "plataforma")).headers.get("location")).toBe(
      "http://localhost:3000/plataforma",
    );
  });
});

describe("documentos legales públicos", () => {
  it.each([undefined, "empresa", "plataforma", "vencida"] as const)(
    "permite acceder a los documentos con sesión %s",
    (tipo) => {
      for (const path of [
        "/terminos",
        "/privacidad",
        "/eliminacion-de-datos",
      ]) {
        const response = proxy(request(path, tipo));
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("x-middleware-next")).toBe("1");
      }
    },
  );

  it("mantiene privadas las rutas con prefijos parecidos", () => {
    for (const path of [
      "/terminos-admin",
      "/privacidad-interna",
      "/eliminacion-de-datos-admin",
    ]) {
      expect(proxy(request(path)).headers.get("location")).toBe(
        "http://localhost:3000/login",
      );
    }
    expect(
      proxy(request("/registro/verificar?token=prueba")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
  });
});
