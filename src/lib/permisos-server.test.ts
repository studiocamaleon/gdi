import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth-server", () => ({ getCurrentUserCached: vi.fn() }));
import { getCurrentUserCached } from "./auth-server";
import { tienePermiso } from "./permisos-server";
const sesion = (permisos: string[] | undefined) =>
  ({ currentUser: { tenantActual: { permisos } } }) as Awaited<
    ReturnType<typeof getCurrentUserCached>
  >;
beforeEach(() => vi.resetAllMocks());
it.each([undefined, [], ["acceso.por_vista", "produccion.tablero.ver"]])(
  "sin permiso comercial confirmado no abre la ficha: %j",
  async (permisos) => {
    vi.mocked(getCurrentUserCached).mockResolvedValue(sesion(permisos));
    expect(
      await tienePermiso("comercial.ordenes.ver", { exigirConfirmacion: true }),
    ).toBe(false);
  },
);
it("un fallo de sesión no concede acceso", async () => {
  vi.mocked(getCurrentUserCached).mockRejectedValue(
    new Error("Sesión no disponible"),
  );
  expect(
    await tienePermiso("comercial.ordenes.ver", { exigirConfirmacion: true }),
  ).toBe(false);
});
it("gestionar órdenes conserva el acceso a su detalle", async () => {
  vi.mocked(getCurrentUserCached).mockResolvedValue(
    sesion(["acceso.por_vista", "comercial.ordenes.gestionar"]),
  );
  expect(
    await tienePermiso("comercial.ordenes.ver", { exigirConfirmacion: true }),
  ).toBe(true);
});
