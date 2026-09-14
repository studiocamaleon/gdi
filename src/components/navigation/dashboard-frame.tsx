"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Input, Modal } from "@heroui/react";
import { ArrowRight, Moon, Search, Sun } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ActionButton } from "@/components/design-system/action-button";
import {
  DesignSystemProvider,
  useDesignScope,
} from "@/components/design-system/appearance";
import { PerfilUsuarioModal } from "@/components/perfil-usuario-modal";
import { LogoutButton } from "@/components/logout-button";
import { NotificacionesBell } from "@/components/notificaciones/notificaciones-bell";
import { type CurrentUser } from "@/lib/auth";
import { permisosDe } from "@/lib/permisos";
import { navPara, hasChildren } from "./nav-items";
import { NavLink } from "./nav-link";
import theme from "@/components/design-system/theme.module.css";
import s from "./dashboard-frame.module.css";

export function esVistaOrden(pathname: string) {
  return (
    pathname === "/comercial/crear-propuesta" ||
    /^\/produccion\/ordenes\/[^/]+\/?$/.test(pathname)
  );
}
export function esVistaPanelAdministrador(
  pathname: string,
  administrador: boolean,
  vista: string | null,
) {
  return pathname === "/" && administrador && (!vista || vista === "actual");
}
const AppearanceContext = createContext({ dark: false, toggle: () => {} });

/** El marco visual abarca OT y el panel propio del administrador. */
export function DashboardFrame({
  children,
  esAdministrador = false,
}: {
  children: ReactNode;
  esAdministrador?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const isOrder =
    esVistaOrden(pathname) ||
    esVistaPanelAdministrador(pathname, esAdministrador, params.get("vista"));
  const [dark, setDark] = useState(false);
  return (
    <AppearanceContext
      value={{ dark, toggle: () => setDark((value) => !value) }}
    >
      <DesignSystemProvider appearance={isOrder && dark ? "dark" : undefined}>
        <SidebarProvider
          defaultOpen
          className={isOrder && dark ? "dark" : undefined}
          style={
            {
              height: "100dvh",
              overflow: "hidden",
              "--sidebar-width": "262px",
              "--sidebar-width-icon": "66px",
            } as React.CSSProperties
          }
        >
          {children}
        </SidebarProvider>
      </DesignSystemProvider>
    </AppearanceContext>
  );
}

export function DashboardTopbar({ currentUser }: { currentUser: CurrentUser }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const isOrder =
    esVistaOrden(pathname) ||
    esVistaPanelAdministrador(
      pathname,
      currentUser.tenantActual.rol === "administrador",
      params.get("vista"),
    );
  const appearance = useContext(AppearanceContext);
  const scope = useDesignScope();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const entries = useMemo(
    () =>
      navPara(
        permisosDe(currentUser),
        currentUser.tenantActual.regional?.paisCodigo ?? "AR",
      ).flatMap((item) =>
        hasChildren(item)
          ? item.children.map((child) => ({ ...child, group: item.label }))
          : [
              {
                key: item.key,
                label: item.label,
                href: item.href,
                group: "General",
              },
            ],
      ),
    [currentUser],
  );
  const results = entries.filter((entry) =>
    `${entry.label} ${entry.group}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(
        query
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ),
  );
  useEffect(() => {
    if (!isOrder) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOrder]);
  if (!isOrder)
    return (
      <header className="topbar">
        <SidebarTrigger className="icon-btn" />
        <div className="ml-auto flex items-center gap-1">
          <NotificacionesBell />
          <LogoutButton />
        </div>
      </header>
    );
  const nombre = currentUser.nombreCompleto || currentUser.email;
  const parts = nombre.trim().split(/\s+/);
  const initials = `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`;
  return (
    <>
      <header {...scope} className={`${theme.theme} ${s.topbar}`}>
        <SidebarTrigger className={s.menu} />
        <ActionButton
          variant="ghost"
          className={s.search}
          onPress={() => {
            setQuery("");
            setSearchOpen(true);
          }}
          aria-label="Buscar en el sistema"
        >
          <Search />
          <span>Buscar clientes, órdenes, productos…</span>
          <kbd>⌘ K</kbd>
        </ActionButton>
        <div className={s.actions}>
          <ActionButton
            variant="ghost"
            isIconOnly
            aria-label={
              appearance.dark ? "Usar tema claro" : "Usar tema oscuro"
            }
            onPress={appearance.toggle}
          >
            {appearance.dark ? <Moon /> : <Sun />}
          </ActionButton>
          <NotificacionesBell />
          <ActionButton
            variant="ghost"
            isIconOnly
            className={s.avatar}
            onPress={() => setProfileOpen(true)}
            aria-label="Abrir mi perfil"
          >
            {initials}
          </ActionButton>
        </div>
      </header>
      <Modal.Backdrop
        {...scope}
        className={theme.theme}
        isOpen={searchOpen}
        onOpenChange={setSearchOpen}
      >
        <Modal.Container size="md" placement="top">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Cerrar búsqueda" />
            <Modal.Header>
              <Modal.Heading>Buscar en el sistema</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className={s.help}>
                Ir a clientes, órdenes, productos y otras secciones.
              </p>
              <Input
                autoFocus
                aria-label="Buscar sección"
                placeholder="¿A dónde querés ir?"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full"
              />
              <nav className={s.results} aria-label="Resultados de navegación">
                {results.map((entry) => (
                  <NavLink
                    key={entry.key}
                    href={entry.href}
                    onClick={() => setSearchOpen(false)}
                  >
                    <span>
                      <strong>{entry.label}</strong>
                      <small>{entry.group}</small>
                    </span>
                    <ArrowRight />
                  </NavLink>
                ))}
                {results.length === 0 && (
                  <p role="status">No encontramos secciones con ese nombre.</p>
                )}
              </nav>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {profileOpen && (
        <PerfilUsuarioModal
          currentUser={currentUser}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </>
  );
}
