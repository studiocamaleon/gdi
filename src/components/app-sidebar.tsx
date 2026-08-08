"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type CurrentUser, type TenantSummary } from "@/lib/auth";
import { NavLink } from "@/components/navigation/nav-link";
import {
  hasChildren,
  navPara,
  type NavItem,
} from "@/components/navigation/nav-items";
import { permisosDe, puede } from "@/lib/permisos";
import {
  PALABRAS_CONFIG,
  seccionesConfigVisibles,
} from "@/components/configuracion/configuracion-secciones";
import { useSidebar } from "@/components/ui/sidebar";
import { ConstelacionCanvas } from "@/components/constelacion-canvas";
import { PerfilUsuarioModal } from "@/components/perfil-usuario-modal";
import s from "@/components/app-sidebar.module.css";

type AppSidebarProps = {
  currentUser: CurrentUser;
};

type IconProps = React.SVGProps<SVGSVGElement>;
type IconComponent = (props: IconProps) => React.ReactElement;

const Ico = {
  Chart: (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 3v16a2 2 0 0 0 2 2h15" />
      <rect x="7" y="12" width="3.5" height="5" rx="1" />
      <rect x="13" y="8" width="3.5" height="9" rx="1" />
      <path d="m7.5 8 3-3 3 2.5 4.5-5" />
    </svg>
  ),
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
    <div className={s.brand} title={collapsed ? "grafoprint" : undefined}>
      <span className={s.mk}>
        <LogoNodes size={30} />
      </span>
      <span className={s.nm}>
        <div className={s.wordmark}>grafoprint</div>
        <div className={s.org}>gráfica digital inteligente</div>
      </span>
    </div>
  );
}

/** Iniciales para el avatar del pie (2 letras). */
function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
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
      <strong style={{ fontWeight: 700, color: "#c2410c" }}>
        {text.slice(idx, idx + q.length)}
      </strong>
      {text.slice(idx + q.length)}
    </>
  );
}

function getActiveKey(nav: NavItem[], pathname: string) {
  const entries = nav.flatMap((item) => {
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

function getParentKey(nav: NavItem[], activeKey: string | undefined) {
  if (!activeKey) {
    return undefined;
  }

  return nav.find((item) => hasChildren(item) && item.children.some((child) => child.key === activeKey))?.key;
}

// La card muestra plan y días SÓLO con datos reales del backend. Antes esto
// mostraba "14 / 30 dias restantes" a TODOS los tenants —un número fijo
// inventado— y una barra acorde; por eso las funciones de abajo devuelven un
// texto neutro cuando el dato no está, en vez de rellenar con un supuesto.
// Ver docs/suscripciones-cobro-diseno.md
function formatPlanTier(susc: TenantSummary["suscripcion"]) {
  const dias = susc?.diasRestantes;
  if (dias == null) {
    return "Ver plan y facturación";
  }
  if (dias <= 0) {
    return susc?.enPrueba ? "Prueba vencida" : "Vencida";
  }
  const unidad = dias === 1 ? "día" : "días";
  // Sin el largo del período no se arma la fracción: un plan anual con "/ 30"
  // sería falso. Se dice lo que se sabe.
  const total = susc?.diasTotales;
  const cuenta = total ? `${dias} / ${total} ${unidad}` : `${dias} ${unidad}`;
  return susc?.enPrueba ? `Prueba · ${cuenta}` : `Renueva en ${cuenta}`;
}

function getSuscripcionProgress(susc: TenantSummary["suscripcion"]) {
  const dias = susc?.diasRestantes;
  const total = susc?.diasTotales;
  if (dias == null || !total) {
    return 100;
  }

  if (dias <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(8, Math.round((dias / total) * 100)));
}

// Secciones del menú (sólo reordenan; las rutas y permisos siguen en
// nav-items.ts). Un módulo que el permiso oculta desaparece de su sección, y
// una sección sin módulos visibles no muestra encabezado. "Sistema" (control
// plane) se arma aparte porque es staff-only.
const SECCIONES: ReadonlyArray<{ label: string; keys: string[] }> = [
  { label: "Operación", keys: ["panel", "comercial", "produccion", "inventario"] },
  { label: "Gestión", keys: ["registros", "costos", "administracion", "reportes"] },
];

export function AppSidebar({ currentUser }: AppSidebarProps) {
  const pathname = usePathname();
  // Lo que este usuario puede ver. Se calcula una vez y de acá sale todo el
  // resto: qué grupos hay, cuál está activo y qué encuentra el buscador.
  const nav = React.useMemo(
    () =>
      navPara(
        permisosDe(currentUser),
        currentUser.tenantActual?.regional?.paisCodigo ?? "AR",
      ),
    [currentUser],
  );
  // El ancla del pie. Se muestra si le queda alguna sección: el Administrativo
  // entra por Datos fiscales y Métodos de pago sin tener `configuracion.ver`.
  const hayConfig = React.useMemo(() => {
    const permisos = permisosDe(currentUser);
    return (
      seccionesConfigVisibles(
        (p) => permisos === null || permisos.has(p),
        currentUser.tenantActual?.regional?.paisCodigo ?? "AR",
      ).length > 0
    );
  }, [currentUser]);
  const activeKey = getActiveKey(nav, pathname);
  const parentKey = getParentKey(nav, activeKey);
  // Acordeón: un solo grupo abierto a la vez. Se abre el del módulo actual;
  // al abrir otro, el anterior se colapsa.
  const [openKey, setOpenKey] = React.useState<string | null>(() => parentKey ?? null);
  // Sin dato real no se inventa un nombre de plan (antes caía a "Plan diamante").
  const suscripcion = currentUser.tenantActual.suscripcion;
  const planNombre = suscripcion?.planNombre?.trim() || "Suscripción";
  const suscripcionProgress = getSuscripcionProgress(suscripcion);
  const { state, setOpen, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const usuarioNombre =
    currentUser.nombreCompleto?.trim() || currentUser.email;
  const tenantNombre = currentUser.tenantActual.nombre;
  const rolNombre =
    currentUser.tenantActual.rolNombre?.trim() ||
    currentUser.tenantActual.rol;
  const [query, setQuery] = React.useState("");
  const [perfilAbierto, setPerfilAbierto] = React.useState(false);
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0;
  const configActiva = matchesRoute(pathname, "/configuracion");
  // Sus secciones ya no son hijos del menú, así que el buscador las tiene que
  // encontrar por acá: escribir "usuarios" o "integraciones" llega igual.
  const configMatch =
    filtering &&
    ("configuración".includes(q) ||
      "configuracion".includes(q) ||
      PALABRAS_CONFIG.some((p) => p.toLowerCase().includes(q)));

  // Navegación filtrada en vivo por el buscador del sidebar. Al filtrar, los
  // grupos con hijos que matchean se muestran expandidos.
  const filteredNav = React.useMemo<NavItem[]>(() => {
    if (!filtering) return nav;
    const match = (label: string) => label.toLowerCase().includes(q);
    const result: NavItem[] = [];
    for (const item of nav) {
      if (!hasChildren(item)) {
        // `buscar`: las pantallas que el módulo tiene adentro pero no muestra
        // como hijos (los reportes). Buscar "embudo" tiene que llegar igual.
        if (match(item.label) || item.buscar?.some(match)) result.push(item);
        continue;
      }
      const grupoMatch = match(item.label);
      const children = item.children.filter(
        (child) => grupoMatch || match(child.label),
      );
      if (children.length > 0) result.push({ ...item, children });
    }
    return result;
  }, [filtering, q, nav]);

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

  // Render de un módulo (hoja o grupo con hijos). Se llama por sección.
  const renderItem = (item: NavItem) => {
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
          className={`${s.it} ${isDirectActive ? s.on : ""}`}
        >
          <span className={s.ic}>
            <IconCmp />
          </span>
          <span className={s.tx}>
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
          className={s.it}
          aria-expanded={open}
          onClick={() => onGroupClick(item.key)}
        >
          <span className={s.ic}>
            <IconCmp />
          </span>
          <span className={s.tx}>
            {filtering ? highlightMatch(item.label, q) : item.label}
          </span>
          <svg
            className={s.cv}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && !collapsed ? (
          <div className={s.sub}>
            {item.children.map((child) => (
              <NavLink
                key={child.key}
                href={child.href}
                className={`${s.si} ${activeKey === child.key ? s.on : ""}`}
              >
                <span className={s.dot} />
                <span className={s.tx}>
                  {filtering ? highlightMatch(child.label, q) : child.label}
                </span>
              </NavLink>
            ))}
          </div>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <aside
      className={`${s.sb} ${collapsed ? s.mini : ""}`}
      data-collapsed={collapsed}
    >
      {/* Malla 3D velada hacia abajo; se oculta al colapsar (regla del módulo). */}
      <ConstelacionCanvas
        className={s.canvas}
        nodes={34}
        pulses={3}
        cx={0.5}
        cy={0.14}
        radius={0.62}
      />
      <span className={s.veil} aria-hidden="true" />

      <button
        type="button"
        className={s.tgl}
        onClick={toggleSidebar}
        title={collapsed ? "Expandir menú" : "Contraer menú"}
        aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>

      <Brand collapsed={collapsed} />

      {collapsed ? (
        <button
          type="button"
          className={s.search}
          onClick={() => setOpen(true)}
          title="Buscar"
          aria-label="Buscar"
        >
          <Ico.Search />
        </button>
      ) : (
        <label className={s.search}>
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
          />
        </label>
      )}

      <nav className={s.nav}>
        {SECCIONES.map((sec) => {
          const items = sec.keys
            .map((key) => filteredNav.find((it) => it.key === key))
            .filter((it): it is NavItem => Boolean(it));
          if (items.length === 0) return null;
          return (
            <React.Fragment key={sec.label}>
              <div className={s.grp}>
                <span className={s.lbl}>{sec.label}</span>
                <span className={s.rule} />
              </div>
              {items.map(renderItem)}
            </React.Fragment>
          );
        })}

        {/* Módulos fuera de las secciones definidas (futuros): sin encabezado,
            para que un módulo nuevo nunca desaparezca por no estar mapeado. */}
        {(() => {
          const enSeccion = new Set(SECCIONES.flatMap((x) => x.keys));
          return filteredNav
            .filter((it) => !enSeccion.has(it.key))
            .map(renderItem);
        })()}

        {filtering && filteredNav.length === 0 && !configMatch ? (
          <div className={s.sinResultados}>Sin resultados para “{query}”.</div>
        ) : null}

        {/* Sistema: control plane, sólo el staff de Grafo lo ve. La
            autorización real la hace el API — esto es descubribilidad. */}
        {currentUser.rolPlataforma &&
        (!filtering || "plataforma".includes(q)) ? (
          <React.Fragment>
            <div className={s.grp}>
              <span className={s.lbl}>Sistema</span>
              <span className={s.rule} />
            </div>
            <NavLink href="/plataforma" title="Plataforma" className={s.it}>
              <span className={s.ic}>
                <Ico.Grid />
              </span>
              <span className={s.tx}>
                {filtering ? highlightMatch("Plataforma", q) : "Plataforma"}
              </span>
            </NavLink>
          </React.Fragment>
        ) : null}
      </nav>

      {/* El plan y la facturación son configuración: el operario no tiene por
          qué ver cuánto paga la imprenta ni entrar a cambiarlo. */}
      {puede(currentUser, "configuracion.ver") ? (
        <Link href="/suscripcion" className={s.plan} title={planNombre}>
          <div className={s.planT}>
            <i />
            <span>{planNombre}</span>
          </div>
          <div className={s.planD}>{formatPlanTier(suscripcion)}</div>
          <div className={s.bar}>
            <i style={{ width: `${suscripcionProgress}%` }} />
          </div>
          <span className={s.lnk}>Administrar suscripción</span>
        </Link>
      ) : null}

      <div className={s.foot}>
        {hayConfig && (!filtering || configMatch) ? (
          <NavLink
            href="/configuracion"
            title="Configuración"
            className={`${s.it} ${configActiva ? s.on : ""}`}
          >
            <span className={s.ic}>
              <Ico.Cog />
            </span>
            <span className={s.tx}>
              {filtering ? highlightMatch("Configuración", q) : "Configuración"}
            </span>
          </NavLink>
        ) : null}

        <button
          type="button"
          className={s.user}
          onClick={() => setPerfilAbierto(true)}
          title={`${usuarioNombre} · ${tenantNombre}`}
          aria-label="Abrir perfil de usuario"
        >
          <span className={s.av}>{inicialesDe(usuarioNombre)}</span>
          <span className={s.userNm}>
            <span className={s.userA}>{usuarioNombre}</span>
            <span className={s.userB}>
              {tenantNombre} · {rolNombre}
            </span>
          </span>
          <svg
            className={s.userChev}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" />
          </svg>
        </button>
      </div>

      {perfilAbierto ? (
        <PerfilUsuarioModal
          currentUser={currentUser}
          onClose={() => setPerfilAbierto(false)}
        />
      ) : null}
    </aside>
  );
}
