"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { type CurrentUser } from "@/lib/auth";
import { NavLink } from "@/components/navigation/nav-link";

type AppSidebarProps = {
  currentUser: CurrentUser;
};

type IconProps = React.SVGProps<SVGSVGElement>;
type IconComponent = (props: IconProps) => React.ReactElement;

const Ico = {
  Grid: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Briefcase: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Users: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Coin: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5h-3.75a1.75 1.75 0 0 0 0 3.5h2.5a1.75 1.75 0 0 1 0 3.5H9" />
      <path d="M12 7v1.5M12 15.5V17" />
    </svg>
  ),
  Factory: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 20V10l5 3V10l5 3V10l5 3v7Z" />
      <path d="M3 20h18" />
      <path d="M7 16h2M11 16h2M15 16h2" />
    </svg>
  ),
  Cube: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 21 7.5v9L12 21 3 16.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
  Chev: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Search: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  ),
} satisfies Record<string, IconComponent>;

const LogoNodes = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M5.5 6.5 L18 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5.5 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M18 6.5 L12 17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M18 6.5 L18 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
    <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
    <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
    <circle cx="18" cy="14.5" r="1.4" fill="currentColor" opacity="0.55" />
  </svg>
);

function Brand() {
  return (
    <div className="side-brand">
      <div className="mark">
        <LogoNodes size={31} />
      </div>
      <div>
        <div className="wordmark">grafoprint</div>
        <div className="org">gráfica digital inteligente</div>
      </div>
    </div>
  );
}

type NavChild = {
  key: string;
  label: string;
  href: string;
};

type NavItem =
  | {
      key: string;
      label: string;
      icon: keyof typeof Ico;
      href: string;
      children?: never;
    }
  | {
      key: string;
      label: string;
      icon: keyof typeof Ico;
      children: NavChild[];
      href?: never;
    };

const NAV: NavItem[] = [
  { key: "panel", label: "Panel general", icon: "Grid", href: "/" },
  {
    key: "comercial",
    label: "Comercial",
    icon: "Briefcase",
    children: [
      { key: "crear-propuesta", label: "Crear propuesta", href: "/comercial/crear-propuesta" },
    ],
  },
  {
    key: "registros",
    label: "Registros",
    icon: "Users",
    children: [
      { key: "clientes", label: "Clientes", href: "/clientes" },
      { key: "proveedores", label: "Proveedores", href: "/proveedores" },
      { key: "empleados", label: "Empleados", href: "/empleados" },
    ],
  },
  {
    key: "costos",
    label: "Costos",
    icon: "Coin",
    children: [
      { key: "centros", label: "Centros de costo", href: "/costos/centros-de-costo" },
      { key: "maquinaria", label: "Maquinaria", href: "/costos/maquinaria" },
      { key: "rutas", label: "Rutas de producción", href: "/productos-servicios/rutas" },
      { key: "catalogo", label: "Catálogo de productos", href: "/productos-servicios" },
      { key: "cargos", label: "Cargos directos", href: "/productos-servicios/cargos-directos" },
      { key: "impuestos", label: "Impuestos", href: "/productos-servicios/impuestos-catalogo" },
      { key: "comisiones", label: "Comisiones", href: "/productos-servicios/comisiones-catalogo" },
    ],
  },
  {
    key: "produccion",
    label: "Producción",
    icon: "Factory",
    children: [
      { key: "tablero-produccion", label: "Tablero", href: "/produccion/tablero" },
      { key: "simulador", label: "Simulador de impresión", href: "/produccion/simulador" },
      { key: "estaciones", label: "Estaciones", href: "/produccion/estaciones" },
    ],
  },
  {
    key: "inventario",
    label: "Inventario",
    icon: "Cube",
    children: [
      { key: "materiales", label: "Materiales", href: "/inventario/materias-primas" },
      { key: "movimientos", label: "Movimientos", href: "/inventario/movimientos" },
    ],
  },
];

function matchesRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasChildren(item: NavItem): item is Extract<NavItem, { children: NavChild[] }> {
  return Array.isArray(item.children);
}

function getActiveKey(pathname: string) {
  const entries = NAV.flatMap((item) => {
    if (hasChildren(item)) {
      return item.children.map((child) => ({
        key: child.key,
        href: child.href,
      }));
    }

    return [{ key: item.key, href: item.href }];
  });

  return entries
    .sort((a, b) => b.href.length - a.href.length)
    .find((entry) => matchesRoute(pathname, entry.href))?.key;
}

function getParentKey(activeKey: string | undefined) {
  if (!activeKey) {
    return undefined;
  }

  return NAV.find((item) => hasChildren(item) && item.children.some((child) => child.key === activeKey))?.key;
}

function formatPlanTier(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return "Sin vencimiento";
  }

  if (diasRestantes <= 0) {
    return "Vencida";
  }

  return `${diasRestantes} / 30 dias restantes`;
}

function getSuscripcionProgress(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return 100;
  }

  if (diasRestantes <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(8, Math.round((diasRestantes / 30) * 100)));
}

export function AppSidebar({ currentUser }: AppSidebarProps) {
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname);
  const parentKey = getParentKey(activeKey);
  // Acordeón: un solo grupo abierto a la vez. Se abre el del módulo actual;
  // al abrir otro, el anterior se colapsa.
  const [openKey, setOpenKey] = React.useState<string | null>(() => parentKey ?? null);
  const planNombre = currentUser.tenantActual.suscripcion?.planNombre?.trim() || "Plan diamante";
  const diasRestantes = currentUser.tenantActual.suscripcion?.diasRestantes ?? 14;
  const suscripcionProgress = getSuscripcionProgress(diasRestantes);

  React.useEffect(() => {
    if (!parentKey) {
      return;
    }

    setOpenKey(parentKey);
  }, [parentKey]);

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <aside className="side">
      <Brand />

      <button
        type="button"
        className="side-search"
        onClick={() => toast.info("Búsqueda global disponible próximamente.")}
      >
        <Ico.Search />
        <span>Buscar…</span>
        <span className="kbd">⌘K</span>
      </button>

      <nav className="side-nav">
        {NAV.map((item) => {
          const IconCmp = Ico[item.icon];
          const itemHasChildren = hasChildren(item);
          const open = itemHasChildren && openKey === item.key;
          const isDirectActive = !itemHasChildren && activeKey === item.key;

          if (!itemHasChildren) {
            return (
              <NavLink
                key={item.key}
                href={item.href}
                className={`nav-item ${isDirectActive ? "active" : ""}`}
              >
                <span className="ico"><IconCmp /></span>
                <span className="label">{item.label}</span>
              </NavLink>
            );
          }

          return (
            <React.Fragment key={item.key}>
              <button
                type="button"
                className={`nav-item ${open ? "expanded" : ""}`}
                onClick={() => toggle(item.key)}
              >
                <span className="ico"><IconCmp /></span>
                <span className="label">{item.label}</span>
                <Ico.Chev className="chev" />
              </button>

              {open ? (
                <div className="nav-children">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.key}
                      href={child.href}
                      className={`nav-child ${activeKey === child.key ? "active" : ""}`}
                    >
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </nav>

      <button
        type="button"
        className="plan-card"
        onClick={() => toast.info("Administración de suscripción disponible próximamente.")}
      >
        <div className="plan-row">
          <div className="plan-title">
            <span className="dot" />
            <div>
              <div className="name">{planNombre}</div>
              <div className="tier">{formatPlanTier(diasRestantes)}</div>
            </div>
          </div>
        </div>
        <div className="plan-meter"><span style={{ width: `${suscripcionProgress}%` }} /></div>
        <div className="plan-admin">Administrar suscripción</div>
      </button>
    </aside>
  );
}
