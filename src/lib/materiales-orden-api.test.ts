import { afterEach, expect, it, vi } from "vitest";
import {
  getPoliticaReservas,
  savePoliticaReservas,
} from "./materiales-orden-api";
vi.mock("@/lib/session", () => ({ getSessionToken: async () => null }));
afterEach(() => vi.unstubAllGlobals());

it("permite editar una política persistida sin reenviar los metadatos internos del GET", async () => {
  // La respuesta real de una política guardada incluye estos metadatos de Prisma.
  const guardada = {
    tenantId: "empresa-test",
    updatedAt: "2026-09-19T19:00:00.000Z",
    habilitada: true,
    incluirConsumibles: false,
    modo: "MANUAL",
    version: 4,
  };
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method !== "PUT") return Response.json(guardada);
    const body = JSON.parse(String(init.body));
    const permitidas = ["habilitada", "incluirConsumibles", "modo", "version"];
    const sobrantes = Object.keys(body).filter(
      (key) => !permitidas.includes(key),
    );
    // Contrato de ValidationPipe con forbidNonWhitelisted, sin relajar el API.
    if (sobrantes.length)
      return Response.json(
        { message: sobrantes.map((key) => `property ${key} should not exist`) },
        { status: 400 },
      );
    return Response.json({ ...guardada, ...body, version: body.version + 1 });
  });
  vi.stubGlobal("fetch", fetch);

  const politica = await getPoliticaReservas();
  await expect(
    savePoliticaReservas({ ...politica, modo: "AL_EMITIR" }),
  ).resolves.toMatchObject({ modo: "AL_EMITIR", version: 5 });
  expect(JSON.parse(String(fetch.mock.calls[1][1].body))).toEqual({
    habilitada: true,
    incluirConsumibles: false,
    modo: "AL_EMITIR",
    version: 4,
  });
});
