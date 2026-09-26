import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { getCurrentUserCached } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import InboxPage from "./page";
import type { CurrentUser } from "@/lib/auth";
vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ getCurrentUserCached: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
const user = {
  id: "usuario",
  email: "prueba@example.invalid",
  tenantActual: {
    id: "empresa",
    nombre: "Gráfica ficticia",
    rol: "administrador",
    permisos: ["configuracion.gestionar"],
  },
} as CurrentUser;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionToken).mockResolvedValue("token-sintetico");
  vi.mocked(getCurrentUserCached).mockResolvedValue({
    currentUser: user,
    sessionId: "sesion",
    accessToken: null,
  });
});
it("sin sesión redirige al login antes de consultar datos", async () => {
  vi.mocked(getSessionToken).mockResolvedValue(null);
  await expect(InboxPage()).rejects.toThrow("redirect:/login");
  expect(getCurrentUserCached).not.toHaveBeenCalled();
});
it("una sesión revocada va a la salida que limpia la cookie", async () => {
  vi.mocked(getCurrentUserCached).mockRejectedValue(
    new ApiError("revocada", 401),
  );
  await expect(InboxPage()).rejects.toThrow("redirect:/salir?motivo=sesion");
});
it("la ruta independiente mantiene el cambio de clave obligatorio", async () => {
  vi.mocked(getCurrentUserCached).mockResolvedValue({
    currentUser: { ...user, debeCambiarPassword: true },
    sessionId: "s",
    accessToken: null,
  });
  await expect(InboxPage()).rejects.toThrow("redirect:/cambiar-clave");
});
it.each([
  { impersonacion: { actorNombre: "Soporte", expiraEl: "2030-01-01" } },
  { tenantActual: { ...user.tenantActual, rol: "operador" as const } },
  { tenantActual: { ...user.tenantActual, permisos: [] } },
])("no monta el inbox sin autorización: %j", async (patch) => {
  vi.mocked(getCurrentUserCached).mockResolvedValue({
    currentUser: { ...user, ...patch },
    sessionId: "s",
    accessToken: null,
  });
  const result = await InboxPage();
  expect(result.props).toEqual({ modulo: "Conversaciones" });
});
it("monta sólo la vista independiente para la identidad autorizada", async () => {
  const result = await InboxPage();
  expect(result.props.children.props.identidad).toEqual({
    empresaId: "empresa",
    usuarioId: "usuario",
    empresa: "Gráfica ficticia",
    operador: "prueba@example.invalid",
  });
  expect(redirect).not.toHaveBeenCalled();
});
