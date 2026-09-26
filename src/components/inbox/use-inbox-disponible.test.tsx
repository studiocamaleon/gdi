// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import {
  getDisponibilidadInbox,
  INBOX_CONEXION_ACTUALIZADA,
  type DisponibilidadInbox,
} from "@/lib/meta-inbox-api";
import { useInboxDisponible } from "./use-inbox-disponible";
import { navPara } from "@/components/navigation/nav-items";
vi.mock("@/lib/meta-inbox-api", () => ({
  getDisponibilidadInbox: vi.fn(),
  INBOX_CONEXION_ACTUALIZADA: "grafo:inbox-conexion-actualizada",
}));
const user: CurrentUser = {
  id: "user-1",
  email: "prueba@example.invalid",
  tenants: [],
  tenantActual: {
    id: "empresa-1",
    nombre: "Gráfica ficticia",
    slug: "ficticia",
    rol: "administrador",
    permisos: ["configuracion.gestionar"],
  },
};
const conectado = {
  empresaId: "empresa-1",
  usuarioId: "user-1",
  disponible: true,
};
function Muestra({
  usuario = user,
  plan = true,
  path = "/",
}: {
  usuario?: CurrentUser;
  plan?: boolean;
  path?: string;
}) {
  const disponible = useInboxDisponible(usuario, plan, path);
  const nav = navPara(
    new Set(usuario.tenantActual.permisos),
    "AR",
    { whatsapp_automatico: plan },
    { inboxDisponible: disponible },
  );
  return (
    <span>
      {nav.some((item) => item.key === "inbox")
        ? "Inbox visible"
        : "Inbox oculto"}
    </span>
  );
}
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(getDisponibilidadInbox).mockResolvedValue(conectado);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = (props = {}) =>
  act(async () => root.render(<Muestra {...props} />));
it("queda oculto mientras se comprueba y aparece sólo al confirmar recepción", async () => {
  let resolver!: (value: DisponibilidadInbox) => void;
  vi.mocked(getDisponibilidadInbox).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await render();
  expect(container.textContent).toBe("Inbox oculto");
  await act(async () => resolver(conectado));
  expect(container.textContent).toBe("Inbox visible");
});
it.each([
  { plan: false },
  {
    usuario: {
      ...user,
      impersonacion: { actorNombre: "Soporte", expiraEl: "2030-01-01" },
    },
  },
  { usuario: { ...user, debeCambiarPassword: true } },
  {
    usuario: {
      ...user,
      tenantActual: { ...user.tenantActual, rol: "operador" },
    },
  },
  {
    usuario: {
      ...user,
      tenantActual: { ...user.tenantActual, permisos: undefined },
    },
  },
])("no ofrece ni consulta disponibilidad sin acceso: %j", async (props) => {
  await render(props);
  expect(container.textContent).toBe("Inbox oculto");
  expect(getDisponibilidadInbox).not.toHaveBeenCalled();
});
it("piloto sin comprobar o apagado no ofrece el acceso", async () => {
  vi.mocked(getDisponibilidadInbox).mockResolvedValue({
    ...conectado,
    disponible: false,
  });
  await render();
  expect(container.textContent).toBe("Inbox oculto");
});
it.each(["empresaId", "usuarioId"] as const)(
  "una respuesta de otra identidad (%s) no habilita el menú",
  async (field) => {
    vi.mocked(getDisponibilidadInbox).mockResolvedValue({
      ...conectado,
      [field]: "otra",
    });
    await render();
    expect(container.textContent).toBe("Inbox oculto");
  },
);
it("oculta ante fallo y revalida al comprobar recepción en Configuración", async () => {
  await render();
  expect(container.textContent).toBe("Inbox visible");
  vi.mocked(getDisponibilidadInbox).mockRejectedValueOnce(new Error("403"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toBe("Inbox oculto");
  await act(async () =>
    window.dispatchEvent(new Event(INBOX_CONEXION_ACTUALIZADA)),
  );
  expect(container.textContent).toBe("Inbox visible");
});
it("revalida al navegar y una respuesta vieja no vuelve a habilitarlo", async () => {
  let resolver!: (value: DisponibilidadInbox) => void;
  vi.mocked(getDisponibilidadInbox).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await render();
  vi.mocked(getDisponibilidadInbox).mockResolvedValue({
    ...conectado,
    disponible: false,
  });
  await render({ path: "/configuracion/integraciones" });
  expect(getDisponibilidadInbox).toHaveBeenCalledTimes(2);
  expect(vi.mocked(getDisponibilidadInbox).mock.calls[0][0]?.aborted).toBe(
    true,
  );
  await act(async () => resolver(conectado));
  expect(container.textContent).toBe("Inbox oculto");
});
it("al cambiar de empresa nunca conserva la disponibilidad de la anterior", async () => {
  await render();
  expect(container.textContent).toBe("Inbox visible");
  await render({
    usuario: {
      ...user,
      tenantActual: { ...user.tenantActual, id: "empresa-2" },
    },
  });
  expect(container.textContent).toBe("Inbox oculto");
});
