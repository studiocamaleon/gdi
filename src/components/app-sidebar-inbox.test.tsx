// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";
import { getDisponibilidadInbox } from "@/lib/meta-inbox-api";
import type { CurrentUser } from "@/lib/auth";
const contexto = vi.hoisted(() => ({
  state: "expanded",
  setOpen: vi.fn(),
  setOpenMobile: vi.fn(),
  isMobile: false,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/meta-inbox-api", () => ({
  getDisponibilidadInbox: vi.fn(),
  INBOX_CONEXION_ACTUALIZADA: "grafo:inbox-conexion-actualizada",
}));
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSidebar: () => contexto,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useFuncionesPlan: () => ({ whatsapp_automatico: true }),
}));
vi.mock("@/components/navigation/nav-link", () => ({
  NavLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("@/components/perfil-usuario-modal", () => ({
  PerfilUsuarioModal: () => null,
}));
vi.mock("@/components/usuario-avatar", () => ({
  UsuarioAvatar: () => <span>U</span>,
}));

it("el sidebar real agrega Inbox como enlace en otra pestaña y lo retira al deshabilitarse", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const user: CurrentUser = {
    id: "u",
    email: "prueba@example.invalid",
    tenants: [],
    tenantActual: {
      id: "t",
      nombre: "Gráfica ficticia",
      slug: "ficticia",
      rol: "administrador",
      permisos: ["configuracion.gestionar", "panel.ver"],
    },
  };
  vi.mocked(getDisponibilidadInbox).mockResolvedValue({
    empresaId: "t",
    usuarioId: "u",
    disponible: true,
  });
  try {
    await act(async () => root.render(<AppSidebar currentUser={user} />));
    const enlace =
      container.querySelector<HTMLAnchorElement>('a[href="/inbox"]');
    expect(enlace?.target).toBe("_blank");
    expect(enlace?.rel).toBe("noopener noreferrer");
    expect(enlace?.textContent).toBe("Inbox");
    expect(enlace?.getAttribute("aria-label")).toContain("otra pestaña");
    expect(enlace?.closest("nav")?.getAttribute("aria-label")).toBe(
      "Módulos del sistema",
    );
    vi.mocked(getDisponibilidadInbox).mockResolvedValue({
      empresaId: "t",
      usuarioId: "u",
      disponible: false,
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.querySelector('a[href="/inbox"]')).toBeNull();
    expect(container.textContent).toContain("Panel general");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
