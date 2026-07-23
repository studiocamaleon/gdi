"use client";

import * as React from "react";

import type { TenantConsola } from "@/lib/plataforma-api";

/**
 * Kit de la consola del control plane, portado de "Grafo Control Plane"
 * (claude.ai/design, backoffice/bo-kit.jsx): íconos, formateadores y piezas
 * chicas. Clases con prefijo cpl- (hoja global) — el diseño original usa
 * .kpi/.panel/.tbl y acá serían colisiones seguras.
 */

type IconProps = React.SVGProps<SVGSVGElement>;
const icon = (path: React.ReactNode, strokeWidth = 1.7) =>
  function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {path}
      </svg>
    );
  };

export const BIco = {
  node: icon(
    <>
      <circle cx="5" cy="6" r="2.4" />
      <circle cx="5" cy="18" r="2.4" />
      <circle cx="19" cy="12" r="2.4" />
      <path d="M7.2 7.2 16.8 11M7.2 16.8 16.8 13" />
    </>,
  ),
  gauge: icon(
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18 16 11" />
      <circle cx="12" cy="18" r="1.3" fill="currentColor" />
    </>,
  ),
  building: icon(
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2M10 21v-3h4v3" />
    </>,
    1.6,
  ),
  card: icon(
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
    </>,
  ),
  mask: icon(
    <>
      <path d="M3 6c0-1 1-2 2.5-2 2 0 3 1.5 6.5 1.5S16.5 4 18.5 4C20 4 21 5 21 6v5c0 5-4 8-9 9-5-1-9-4-9-9Z" />
      <path d="M8.5 10h.01M15.5 10h.01M9 14c1 1 5 1 6 0" />
    </>,
    1.6,
  ),
  search: icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </>,
    1.8,
  ),
  x: icon(<path d="M6 6l12 12M18 6 6 18" />, 1.9),
  alert: icon(
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>,
  ),
  eye: icon(
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  clock: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  users: icon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </>,
    1.6,
  ),
  arrow: icon(<path d="M5 12h14M13 6l6 6-6 6" />, 1.9),
  logout: icon(
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h10" />,
    1.8,
  ),
};

// ── formateadores ──────────────────────────────────────────────────────

export const fmtN = (n: number) => n.toLocaleString("es-AR");

export function fmtBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

export function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * El riesgo derivado de lo que SÍ medimos hoy (nada inventado): suspensión,
 * integraciones en error, WhatsApp fallidos, inactividad. Con la etapa B se
 * suman los de billing (pago vencido, uso al límite del plan).
 */
export function riesgoDe(t: TenantConsola): string | null {
  if (!t.activo) return "Tenant suspendido";
  const enError = t.integraciones.find((i) => i.estado === "ERROR");
  if (enError) {
    return `${enError.proveedor}: ${enError.ultimoErrorTexto ?? "integración en error"}`;
  }
  if (t.whatsappFallidas > 0) {
    return `${t.whatsappFallidas} WhatsApp fallido${t.whatsappFallidas === 1 ? "" : "s"}`;
  }
  if (t.sinActividad14d) return "Sin actividad hace 14+ días";
  return null;
}

// ── piezas chicas ──────────────────────────────────────────────────────

const PALETA = [
  "#8b7cff",
  "#5aa2f5",
  "#37d39b",
  "#f5b544",
  "#e07a5f",
  "#b07cff",
  "#4db6ac",
  "#7986cb",
  "#ff8a65",
  "#9ccc65",
];

/** Color determinístico por slug: no lo guardamos, no hace falta. */
export function colorDe(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 997;
  return PALETA[h % PALETA.length];
}

export function TLogo({
  nombre,
  slug,
  size = 30,
}: {
  nombre: string;
  slug: string;
  size?: number;
}) {
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="cpl-tlogo"
      style={{
        background: colorDe(slug),
        width: size,
        height: size,
        fontSize: size * 0.37,
      }}
    >
      {iniciales}
    </span>
  );
}

export function EstadoPill({ t }: { t: TenantConsola }) {
  if (!t.activo) {
    return (
      <span className="cpl-pill dng">
        <span className="d" />
        Suspendido
      </span>
    );
  }
  if (riesgoDe(t)) {
    return (
      <span className="cpl-pill warn">
        <span className="d" />
        En riesgo
      </span>
    );
  }
  return (
    <span className="cpl-pill ok">
      <span className="d" />
      Activo
    </span>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  alerta,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  alerta?: boolean;
}) {
  return (
    <div className="cpl-kpi">
      <div className="kl">{label}</div>
      <div className="kv cpl-mono" style={alerta ? { color: "var(--warn)" } : undefined}>
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {sub ? (
        <div className="kf">
          <span className="ksub">{sub}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  sub,
  right,
  flush,
  children,
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="cpl-panel">
      {title || right ? (
        <div className="cpl-panel-h">
          {title ? <h3>{title}</h3> : null}
          {sub ? <span className="ph-sub">{sub}</span> : null}
          <span className="grow" />
          {right}
        </div>
      ) : null}
      <div className={`cpl-panel-b ${flush ? "flush" : ""}`}>{children}</div>
    </section>
  );
}
