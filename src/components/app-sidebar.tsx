"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type CurrentUser } from "@/lib/auth";
import { NavLink } from "@/components/navigation/nav-link";
import { hasChildren, NAV, type NavItem } from "@/components/navigation/nav-items";
import { useSidebar } from "@/components/ui/sidebar";

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
  Wallet: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M4 5v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
      <path d="M16 13.5h.5" />
    </svg>
  ),
  Cube: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 21 7.5v9L12 21 3 16.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  ),
  Cog: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1Z" />
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

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="side-brand" title={collapsed ? "grafoprint" : undefined}>
      <div className="mark">
        <LogoNodes size={31} />
      </div>
      <div className="brand-text">
        <div className="wordmark">grafoprint</div>
        <div className="org">gráfica digital inteligente</div>
      </div>
    </div>
  );
}

function matchesRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Resalta en negrita el tramo del texto que coincide con la búsqueda.
function highlightMatch(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ fontWeight: 700, color: "var(--side-ink)" }}>
        {text.slice(idx, idx + q.length)}
      </strong>
      {text.slice(idx + q.length)}
    </>
  );
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

// El backend no manda todavía los días restantes de la suscripción, así que
// acá NO se inventa un contador: se muestra sólo lo que se sabe y el detalle
// real vive en /configuracion/suscripcion. Antes esto mostraba "14 / 30 dias
// restantes" a TODOS los tenants —un número fijo inventado— y una barra de
// progreso acorde. Ver docs/suscripciones-cobro-diseno.md
function formatPlanTier(diasRestantes: number | null | undefined) {
  if (diasRestantes == null) {
    return "Ver plan y facturación";
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
  // Sin dato real no se inventa un nombre de plan (antes caía a "Plan diamante").
  const planNombre = currentUser.tenantActual.suscripcion?.planNombre?.trim() || "Suscripción";
  const diasRestantes = currentUser.tenantActual.suscripcion?.diasRestantes ?? null;
  const suscripcionProgress = getSuscripcionProgress(diasRestantes);
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0;

  // Navegación filtrada en vivo por el buscador del sidebar. Al filtrar, los
  // grupos con hijos que matchean se muestran expandidos.
  const filteredNav = React.useMemo<NavItem[]>(() => {
    if (!filtering) return NAV;
    const match = (label: string) => label.toLowerCase().includes(q);
    const result: NavItem[] = [];
    for (const item of NAV) {
      if (!hasChildren(item)) {
        if (match(item.label)) result.push(item);
        continue;
      }
      const grupoMatch = match(item.label);
      const children = item.children.filter(
        (child) => grupoMatch || match(child.label),
      );
      if (children.length > 0) result.push({ ...item, children });
    }
    return result;
  }, [filtering, q]);

  React.useEffect(() => {
    if (!parentKey) {
      return;
    }

    setOpenKey(parentKey);
  }, [parentKey]);

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  // En modo colapsado no hay lugar para desplegar hijos: al tocar un grupo se
  // expande el sidebar y se abre ese grupo.
  const onGroupClick = (key: string) => {
    if (collapsed) {
      setOpen(true);
      setOpenKey(key);
    } else {
      toggle(key);
    }
  };

  return (
    <aside className={`side${collapsed ? " collapsed" : ""}`} data-collapsed={collapsed}>
      <Brand collapsed={collapsed} />

      {collapsed ? (
        <button
          type="button"
          className="side-search collapsed"
          onClick={() => setOpen(true)}
          title="Buscar"
          aria-label="Buscar"
        >
          <Ico.Search />
        </button>
      ) : (
        <div className="side-search">
          <Ico.Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder="Buscar…"
            aria-label="Buscar en el menú"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--side-ink)",
              font: "inherit",
              fontSize: "13.75px",
            }}
          />
        </div>
      )}

      <nav className="side-nav">
        {filteredNav.map((item) => {
          const IconCmp = Ico[item.icon];
          const itemHasChildren = hasChildren(item);
          // Al filtrar, los grupos se muestran expandidos; sino, acordeón.
          const open = itemHasChildren && (filtering || openKey === item.key);
          const isDirectActive = !itemHasChildren && activeKey === item.key;

          if (!itemHasChildren) {
            return (
              <NavLink
                key={item.key}
                href={item.href}
                title={item.label}
                className={`nav-item ${isDirectActive ? "active" : ""}`}
              >
                <span className="ico"><IconCmp /></span>
                <span className="label">
                  {filtering ? highlightMatch(item.label, q) : item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <React.Fragment key={item.key}>
              <button
                type="button"
                title={item.label}
                className={`nav-item ${open ? "expanded" : ""}`}
                onClick={() => onGroupClick(item.key)}
              >
                <span className="ico"><IconCmp /></span>
                <span className="label">
                  {filtering ? highlightMatch(item.label, q) : item.label}
                </span>
                <Ico.Chev className="chev" />
              </button>

              {open && !collapsed ? (
                <div className="nav-children">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.key}
                      href={child.href}
                      className={`nav-child ${activeKey === child.key ? "active" : ""}`}
                    >
                      <span>
                        {filtering ? highlightMatch(child.label, q) : child.label}
                      </span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}

        {filtering && filteredNav.length === 0 ? (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 12.5,
              color: "var(--side-muted)",
            }}
          >
            Sin resultados para “{query}”.
          </div>
        ) : null}

        {/* Control plane: sólo el staff de Grafo lo ve. La autorización real
            la hace el API — esto es descubribilidad, no seguridad. */}
        {currentUser.rolPlataforma ? (
          <NavLink
            href="/plataforma"
            title="Plataforma"
            className="nav-item"
            style={{
              marginTop: 10,
              borderTop: "1px solid var(--side-hairline, rgba(255,255,255,.08))",
              paddingTop: 12,
            }}
          >
            <span className="ico"><Ico.Grid /></span>
            <span className="label">Plataforma</span>
          </NavLink>
        ) : null}
      </nav>

      <Link href="/configuracion/suscripcion" className="plan-card">
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
      </Link>
    </aside>
  );
}
