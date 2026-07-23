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
  arrowLeft: icon(<path d="M19 12H5M11 6l-6 6 6 6" />, 1.9),
  check: icon(<path d="M5 12l4 4 10-10" />, 2.4),
  logout: icon(
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h10" />,
    1.8,
  ),
};

// ── formateadores ──────────────────────────────────────────────────────

export const fmtN = (n: number) => n.toLocaleString("es-AR");

/** "$5,04M" / "$189k" — el formato compacto de plata del diseño. */
export function mk(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6)
    return (
      "$" + (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/[.,]?0+$/, "") + "M"
    );
  if (a >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + fmtN(n);
}

export const PLAN_COLORS: Record<string, string> = {
  trial: "#63636d",
  taller: "#37d39b",
  estudio: "#5aa2f5",
  diamante: "#8b7cff",
};

export function PlanBadge({
  codigo,
  nombre,
}: {
  codigo: string;
  nombre: string;
}) {
  const c = PLAN_COLORS[codigo] ?? "#63636d";
  return (
    <span className="cpl-plan" style={{ color: c, background: c + "1f" }}>
      <span className="g" style={{ background: c }} />
      {nombre}
    </span>
  );
}

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
  if (t.plan?.codigo === "trial") {
    return (
      <span className="cpl-pill trial">
        <span className="d" />
        Trial
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
  spark,
  sparkColor,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  alerta?: boolean;
  /** Serie chica de fondo (como el diseño); sólo si es un dato real. */
  spark?: number[];
  sparkColor?: string;
  /** Delta % contra el período anterior equivalente. */
  delta?: { actual: number; previo: number };
}) {
  return (
    <div className="cpl-kpi">
      <div className="kl">{label}</div>
      <div className="kv cpl-mono" style={alerta ? { color: "var(--warn)" } : undefined}>
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {sub || delta ? (
        <div className="kf">
          {delta ? <Delta actual={delta.actual} previo={delta.previo} /> : null}
          {sub ? <span className="ksub">{sub}</span> : null}
        </div>
      ) : null}
      {spark && spark.length > 1 ? (
        <Spark data={spark} color={sparkColor} />
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

// ── gráficos (port de bo-kit.jsx, mismos trazos) ───────────────────────

export function Delta({ actual, previo }: { actual: number; previo: number }) {
  if (previo <= 0) {
    return <span className="cpl-delta flat">—</span>;
  }
  const v = Math.round(((actual - previo) / previo) * 100);
  if (v === 0) return <span className="cpl-delta flat">0%</span>;
  return (
    <span className={`cpl-delta ${v > 0 ? "up" : "down"}`}>
      {v > 0 ? "↑" : "↓"}
      {Math.abs(v)}%
    </span>
  );
}

export function Spark({
  data,
  color = "var(--acc)",
}: {
  data: number[];
  color?: string;
}) {
  const w = 88;
  const h = 34;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const rng = mx - mn || 1;
  const pts = data.map(
    (v, i) =>
      [
        (i / (data.length - 1 || 1)) * w,
        h - 3 - ((v - mn) / rng) * (h - 6),
      ] as const,
  );
  const line = pts
    .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  // useId: estable entre SSR e hidratación. Un contador de módulo acá
  // producía ids distintos en server y cliente → hydration mismatch.
  const gid = `cpl-sp${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AreaChart({
  data,
  series,
  height = 200,
}: {
  data: Array<Record<string, number | string>>;
  series: Array<{ key: string; color: string }>;
  height?: number;
}) {
  const w = 640;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 22;
  const iw = w - padL - padR;
  const ih = height - padT - padB;
  const n = data.length;
  const xAt = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const uid = `cpl-ac${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const todos = series.flatMap((s) => data.map((d) => Number(d[s.key])));
  const mx = Math.max(...todos, 1) * 1.08;
  const yAt = (v: number) => padT + ih - (v / mx) * ih;
  return (
    <svg
      className="cpl-chart"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={padL}
          x2={w - padR}
          y1={padT + ih * g}
          y2={padT + ih * g}
          stroke="var(--hair)"
          strokeWidth="1"
        />
      ))}
      {series.map((s, si) => {
        const pts = data.map(
          (d, i) => [xAt(i), yAt(Number(d[s.key]))] as const,
        );
        const line = pts
          .map(
            (p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1),
          )
          .join(" ");
        return (
          <g key={s.key}>
            {si === 0 ? (
              <>
                <defs>
                  <linearGradient id={uid + si} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={s.color} stopOpacity=".2" />
                    <stop offset="1" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${line} L ${xAt(n - 1)} ${padT + ih} L ${xAt(0)} ${padT + ih} Z`}
                  fill={`url(#${uid + si})`}
                />
              </>
            ) : null}
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r="2.4"
                fill="var(--bg)"
                stroke={s.color}
                strokeWidth="1.8"
              />
            ))}
          </g>
        );
      })}
      {data.map((d, i) => (
        <text
          key={i}
          x={xAt(i)}
          y={height - 6}
          textAnchor="middle"
          className="cpl-chart-x"
        >
          {String(d.x)}
        </text>
      ))}
    </svg>
  );
}

export function Bars({
  data,
  color = "var(--ok)",
  height = 168,
}: {
  data: Array<{ x: string; v: number }>;
  color?: string;
  height?: number;
}) {
  const w = 640;
  const padT = 12;
  const padB = 22;
  const padX = 8;
  const ih = height - padT - padB;
  const n = data.length || 1;
  const mx = Math.max(...data.map((d) => d.v), 1) * 1.15;
  const slot = (w - padX * 2) / n;
  const bw = Math.min(26, slot * 0.4);
  return (
    <svg
      className="cpl-chart"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      {[0, 0.5, 1].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={w - padX}
          y1={padT + ih * g}
          y2={padT + ih * g}
          stroke="var(--hair)"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const cx = padX + slot * i + slot / 2;
        const hv = (d.v / mx) * ih;
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={padT + ih - hv}
              width={bw}
              height={hv}
              rx="2.5"
              fill={color}
            />
            {d.v > 0 ? (
              <text
                x={cx}
                y={padT + ih - hv - 5}
                textAnchor="middle"
                className="cpl-chart-x"
                style={{ fill: "var(--muted)" }}
              >
                {d.v}
              </text>
            ) : null}
            <text
              x={cx}
              y={height - 6}
              textAnchor="middle"
              className="cpl-chart-x"
            >
              {d.x}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  segs,
  centerV,
  centerL,
}: {
  segs: Array<{ label: string; value: number; color: string }>;
  centerV: string;
  centerL: string;
}) {
  const size = 130;
  const thick = 18;
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thick) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  // Offsets precalculados: nada de mutar acumuladores dentro del render.
  const offsets = segs.reduce<number[]>(
    (arr, seg) => [...arr, (arr[arr.length - 1] ?? 0) + seg.value / total],
    [],
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ flex: "none" }}
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thick}
        />
        {segs.map((s, i) => {
          const frac = s.value / total;
          const len = frac * c;
          const off = (i === 0 ? 0 : offsets[i - 1]) * c;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thick}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          );
        })}
        <g>
          <text
            x={cx}
            y={cx - 1}
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="21"
            fontWeight="600"
            fontFamily="var(--font-mono)"
          >
            {centerV}
          </text>
          <text
            x={cx}
            y={cx + 15}
            textAnchor="middle"
            fill="var(--muted-2)"
            fontSize="10"
          >
            {centerL}
          </text>
        </g>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
        {segs.map((s, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12 }}
          >
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: s.color,
                flex: "none",
              }}
            />
            <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-mono)",
                color: "var(--muted)",
              }}
            >
              {s.value}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--muted-2)",
                width: 34,
                textAlign: "right",
              }}
            >
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
