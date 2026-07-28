"use client";

/**
 * Reportes (Inteligencia de negocio) — el CUERPO de cada reporte y el kit de
 * gráficos que comparten, portado VERBATIM del diseño del usuario (Grafoprint:
 * panel.jsx/panel-tabs.jsx/panel-charts.jsx) y conectado a los contratos reales
 * de panel-api.ts. Clases .dash/.d-* idénticas al diseño.
 *
 * Acá NO hay navegación ni fetching: cada `Tab*` recibe sus datos ya resueltos
 * por su página en `app/(dashboard)/reportes/`, y el cromo (título, período,
 * tira de reportes) vive en `reportes-shell.tsx`. Antes esto era un solo
 * componente con 9 tabs en `useState` sobre la home.
 * Ver docs/reportes-panel-analisis-diseno.md
 */

import * as React from "react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, abreviarNumero, formatearMoneda } from "@/lib/moneda";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import {
  getPanelMixCategoria,
  type AlertaPanel,
  type CeldaEstacionalidadPanel,
  type ClientesPanel,
  type CobranzaPanel,
  type ComercialPanel,
  type EmbudoPanel,
  type EquipoPanel,
  type MetaPanel,
  type MixCategoriaPanel,
  type ProduccionPanel,
  type ProductoPanel,
  type PuntoMixPanel,
  type RangoPanel,
  type RankingPanel,
  type RentabilidadPanel,
  type ResumenProduccionKpis,
} from "@/lib/panel-api";

/* ─── Formato es-AR ─── */
export const fmtAR = (n: number, d = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmtK(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 100e3 ? 0 : 1).replace(".0", "") + "k";
  return fmtAR(n);
}
export const pct = (n: number | null | undefined, d = 1) =>
  n == null ? "—" : `${fmtAR(n, d).replace(/,0$/, "")}%`;

/* ═══════════ Chart primitives (verbatim del diseño) ═══════════ */

/**
 * Paleta categórica de series (orden FIJO — es el mecanismo de seguridad
 * para daltonismo, no cosmética). Validada con el validador de dataviz
 * sobre superficie blanca: ΔE adyacente mínimo 16.0, contraste ≥3:1.
 * Distinta de los colores de estado (--signal/--ok), que quedan
 * reservados para semáforos.
 */
const PALETA_SERIES = ["#3d6fd6", "#d0662e", "#0e9fae", "#c34d8c", "#b08915", "#7a5fd0"];
const COLOR_OTROS = "#a8a6a0";

/** Ancho real del contenedor (evita el SVG estirado por viewBox fijo). */
function useAncho<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [ancho, setAncho] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entradas) => setAncho(entradas[0].contentRect.width));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

/** Curva monótona (Fritsch–Carlson): suave sin inventar picos que no están en los datos. */
function pathMonotona(pts: Array<readonly [number, number]>): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : "";
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); m.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i])); }
  }
  t.push(m[n - 2]);
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = xs[i] + dx[i] / 3, y1 = ys[i] + (t[i] * dx[i]) / 3;
    const x2 = xs[i + 1] - dx[i] / 3, y2 = ys[i + 1] - (t[i + 1] * dx[i]) / 3;
    d += ` C${x1.toFixed(1)} ${y1.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}, ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

/** Tooltip flotante de los gráficos: título (bucket) + filas con punto de color. */
type FilaTooltip = { color: string; label: string; valor: string };
function TooltipChart({ x, contenedorAncho, titulo, filas }: { x: number; contenedorAncho: number; titulo: string; filas: FilaTooltip[] }) {
  const ANCHO_TT = 190;
  const left = Math.max(4, Math.min(x + 14, contenedorAncho - ANCHO_TT - 4));
  return (
    <div style={{ position: "absolute", left, top: 6, width: ANCHO_TT, pointerEvents: "none", zIndex: 5, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8, boxShadow: "0 6px 20px rgba(20,20,26,.10)", padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-text)", marginBottom: 6 }}>{titulo}</div>
      {filas.map((f) => (
        <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, lineHeight: 1.7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: f.color, flexShrink: 0 }} />
          <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
          <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Multi-línea con curvas monótonas, colores de PALETA_SERIES y crosshair
 * con tooltip (el mix evolutivo y cualquier comparación de series).
 * Ancho medido del contenedor: nada se estira.
 */
function MultiLineChart({ series, labels, height = 240, yFormat = (v: number) => String(v), fmtValor }: {
  series: Array<{ nombre: string; color: string; values: number[] }>;
  labels: string[];
  height?: number;
  yFormat?: (v: number) => string;
  fmtValor?: (v: number) => string;
}) {
  // Sin `fmtValor` el tooltip asume dinero, en la moneda del tenant.
  const { moneda } = useConfigRegional();
  const fmtV = fmtValor ?? ((v: number) => formatearMoneda(v, moneda, { decimales: 0 }));
  const [ref, anchoMedido] = useAncho<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const W = Math.max(320, anchoMedido || 640), H = height;
  const padL = 46, padR = 14, padT = 14, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = picoDeEscala(series.flatMap((s) => s.values), 1.08);
  const step = innerW / Math.max(1, labels.length - 1);
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = Array.from({ length: 5 }, (_, i) => (max * i) / 4);

  const alBucket = (clientX: number, rect: DOMRect) => {
    const idx = Math.round((clientX - rect.left - padL) / step);
    setHover(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  return (
    <div ref={ref} style={{ position: "relative" }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => alBucket(e.clientX, e.currentTarget.getBoundingClientRect())}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 3} fontSize="10" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-mono)">{yFormat(v)}</text>
          </g>
        ))}
        {labels.map((lab, i) =>
          i % Math.ceil(labels.length / Math.max(3, Math.floor(innerW / 70))) === 0 || i === labels.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
          ) : null,
        )}
        {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="var(--muted-text-2)" strokeWidth="1" strokeDasharray="3 3" /> : null}
        {series.map((s) => (
          <path key={s.nombre} d={pathMonotona(s.values.map((v, i) => [x(i), y(v)] as const))} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {series.map((s) => {
          const i = hover ?? s.values.length - 1;
          return <circle key={s.nombre} cx={x(i)} cy={y(s.values[i] ?? 0)} r={hover != null ? 4 : 3} fill={s.color} stroke="var(--surface)" strokeWidth="2" />;
        })}
      </svg>
      {hover != null ? (
        <TooltipChart x={x(hover)} contenedorAncho={W} titulo={labels[hover]}
          filas={[...series].sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0)).map((s) => ({ color: s.color, label: s.nombre, valor: fmtV(s.values[hover] ?? 0) }))} />
      ) : null}
    </div>
  );
}

/**
 * El pico de una serie, listo para usar como denominador de una escala.
 *
 * `Math.max()` sin argumentos devuelve -Infinity, y el `|| 1` de rigor no lo
 * atrapa porque -Infinity es truthy: la escala terminaba en NaN y React
 * escupía "Received NaN for the y attribute" en cada gráfico sin datos. Pasa
 * apenas un tenant nuevo abre un reporte antes de cargar nada.
 */
function picoDeEscala(valores: number[], holgura = 1) {
  const finitos = valores.filter((v) => Number.isFinite(v));
  if (finitos.length === 0) return 1;
  return Math.max(...finitos) * holgura || 1;
}

export function Sparkline({ values, height = 28, width = 84, signal = false }: { values: number[]; height?: number; width?: number; signal?: boolean }) {
  if (!values?.length || values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `M0 ${height} ${pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${width} ${height} Z`;
  const stroke = signal ? "var(--signal)" : "var(--ink)";
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={area} fill={signal ? "var(--signal-bg)" : "rgba(20,20,26,.05)"} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={stroke} />
    </svg>
  );
}

export function AreaChart({ series, labels, height = 220, yFormat = (v: number) => String(v), secondary, nombres = ["Valor"], fmtValor }: { series: number[]; labels: string[]; height?: number; yFormat?: (v: number) => string; secondary?: number[]; nombres?: [string, string?]; fmtValor?: (v: number) => string }) {
  // Sin `fmtValor` el tooltip asume dinero, en la moneda del tenant.
  const { moneda } = useConfigRegional();
  const fmtV = fmtValor ?? ((v: number) => formatearMoneda(v, moneda, { decimales: 0 }));
  const [wrapRef, anchoWrap] = useAncho<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 800, H = height, padL = 44, padR = 8, padT = 18, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const all = secondary ? [...series, ...secondary] : series;
  const max = picoDeEscala(all, 1.08), min = Math.min(0, ...all.filter((v) => Number.isFinite(v))), range = max - min || 1;
  const step = innerW / Math.max(1, series.length - 1);
  const xy = (arr: number[]) => arr.map((v, i) => [padL + i * step, padT + innerH - ((v - min) / range) * innerH] as const);
  const pts = xy(series), pts2 = secondary ? xy(secondary) : null;
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + innerH} L${pts[0][0].toFixed(1)} ${padT + innerH} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  // El SVG se estira al ancho del card: el mouse se mapea en coordenadas del viewBox.
  const alBucket = (clientX: number, rect: DOMRect) => {
    const xView = ((clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((xView - padL) / step))));
  };
  const xPixel = (i: number) => (anchoWrap > 0 ? ((padL + i * step) / W) * anchoWrap : 0);
  return (
    <div ref={wrapRef} style={{ position: "relative" }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => alBucket(e.clientX, e.currentTarget.getBoundingClientRect())}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        {ticks.map((v, i) => {
          const y = padT + innerH - ((v - min) / range) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-mono)">{yFormat(v)}</text>
            </g>
          );
        })}
        {labels.map((lab, i) =>
          i % Math.ceil(labels.length / 12) === 0 || i === labels.length - 1 ? (
            <text key={i} x={padL + i * step} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
          ) : null,
        )}
        {hover != null ? <line x1={pts[hover][0]} x2={pts[hover][0]} y1={padT} y2={padT + innerH} stroke="var(--muted-text-2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
        {pts2 ? <path d={pts2.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--muted-text-2)" strokeWidth="1.4" strokeDasharray="3 3" /> : null}
        <path d={area} fill="rgba(20,20,26,.06)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {hover == null ? (
          <>
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--ink)" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="6" fill="var(--ink)" opacity=".12" />
          </>
        ) : (
          <>
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" />
            {pts2 ? <circle cx={pts2[hover][0]} cy={pts2[hover][1]} r="4" fill="var(--muted-text-2)" stroke="var(--surface)" strokeWidth="2" /> : null}
          </>
        )}
      </svg>
      {hover != null && anchoWrap > 0 ? (
        <TooltipChart x={xPixel(hover)} contenedorAncho={anchoWrap} titulo={labels[hover]}
          filas={[
            { color: "var(--ink)", label: nombres[0], valor: fmtV(series[hover]) },
            ...(secondary && nombres[1] ? [{ color: "var(--muted-text-2)", label: nombres[1], valor: fmtV(secondary[hover]) }] : []),
          ]} />
      ) : null}
    </div>
  );
}

function BarChart({ data, labels, height = 220, yFormat = (v: number) => String(v), mode = "stack", colors, stacks, fmtValor }: { data: number[][]; labels: string[]; height?: number; yFormat?: (v: number) => string; mode?: "stack" | "group"; colors?: string[]; stacks?: string[]; fmtValor?: (v: number) => string }) {
  // Sin `fmtValor` el tooltip asume dinero, en la moneda del tenant.
  const { moneda } = useConfigRegional();
  const fmtV = fmtValor ?? ((v: number) => formatearMoneda(v, moneda, { decimales: 0 }));
  const [wrapRef, anchoWrap] = useAncho<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 800, H = height, padL = 44, padR = 8, padT = 18, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const stackCount = data.length, barCount = data[0]?.length ?? 0;
  const groupW = innerW / Math.max(1, barCount);
  const defaults = ["var(--ink)", "#6e6e76", "#c8c6c0", "var(--signal)"];
  const col = (i: number) => colors?.[i] ?? defaults[i % defaults.length];
  const max = picoDeEscala(
    mode === "stack"
      ? labels.map((_, i) => data.reduce((s, st) => s + (st[i] ?? 0), 0))
      : data.flat(),
    1.12,
  );
  const ticks = Array.from({ length: 5 }, (_, i) => (max * i) / 4);
  const alBucket = (clientX: number, rect: DOMRect) => {
    const xView = ((clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(barCount - 1, Math.floor((xView - padL) / groupW))));
  };
  const filasDe = (bi: number): FilaTooltip[] => {
    const filas = data.map((st, si) => ({ color: col(si), label: stacks?.[si] ?? `Serie ${si + 1}`, valor: fmtV(st[bi] ?? 0) }));
    if (mode === "stack" && stackCount > 1) {
      filas.push({ color: "transparent", label: "Total", valor: fmtV(data.reduce((s, st) => s + (st[bi] ?? 0), 0)) });
    }
    return filas;
  };
  return (
    <div ref={wrapRef} style={{ position: "relative" }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => alBucket(e.clientX, e.currentTarget.getBoundingClientRect())}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        {ticks.map((v, i) => {
          const y = padT + innerH - (v / max) * innerH;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-mono)">{yFormat(v)}</text>
            </g>
          );
        })}
        {labels.map((lab, bi) => {
          const cx = padL + groupW * bi + groupW / 2;
          const atenuada = hover != null && hover !== bi ? 0.45 : 1;
          if (mode === "stack") {
            const barW = Math.min(28, groupW * 0.55);
            let accY = padT + innerH;
            return (
              <g key={bi} opacity={atenuada}>
                {data.map((st, si) => { const h = ((st[bi] ?? 0) / max) * innerH; accY -= h; return <rect key={si} x={cx - barW / 2} y={accY} width={barW} height={h} fill={col(si)} rx="1.5" />; })}
                <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
              </g>
            );
          }
          const barW = Math.min(10, (groupW * 0.7) / stackCount);
          const totalW = barW * stackCount + 2 * (stackCount - 1);
          return (
            <g key={bi} opacity={atenuada}>
              {data.map((st, si) => { const h = ((st[bi] ?? 0) / max) * innerH; return <rect key={si} x={cx - totalW / 2 + si * (barW + 2)} y={padT + innerH - h} width={barW} height={h} fill={col(si)} rx="1.5" />; })}
              <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && anchoWrap > 0 ? (
        <TooltipChart x={((padL + groupW * hover + groupW / 2) / W) * anchoWrap} contenedorAncho={anchoWrap} titulo={labels[hover]} filas={filasDe(hover)} />
      ) : null}
    </div>
  );
}

function DonutRing({ value, max = 100, size = 132, stroke = 16, label, sub, tone = "ink" }: { value: number; max?: number; size?: number; stroke?: number; label: string; sub?: string; tone?: "ink" | "ok" | "signal" }) {
  const p = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, dash = c * p;
  const colors = { ink: "var(--ink)", ok: "var(--ok)", signal: "var(--signal)" };
  return (
    <div className="d-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,20,26,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[tone]} strokeWidth={stroke} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={c / 4} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="d-donut-mid"><div className="d-donut-val">{label}</div>{sub ? <div className="d-donut-sub">{sub}</div> : null}</div>
    </div>
  );
}

const SEG_COLORS = ["var(--ink)", "#4b4b55", "#6e6e76", "#a8a6a0", "#c8c6c0", "#8aa896", "#b0578f", "#c07a4a", "#3a9ca0", "#d1495b"];
function StackedRing({ segments, size = 150, stroke = 20, label, sub }: { segments: number[]; size?: number; stroke?: number; label: string; sub?: string }) {
  const total = segments.reduce((a, s) => a + s, 0) || 1;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="d-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,20,26,.06)" strokeWidth={stroke} />
        {segments.map((s, i) => { const len = (c * s) / total; const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SEG_COLORS[i % SEG_COLORS.length]} strokeWidth={stroke} strokeDasharray={`${len} ${c}`} strokeDashoffset={-off + c / 4} transform={`rotate(-90 ${size / 2} ${size / 2})`} />; off += len; return el; })}
      </svg>
      <div className="d-donut-mid"><div className="d-donut-val">{label}</div>{sub ? <div className="d-donut-sub">{sub}</div> : null}</div>
    </div>
  );
}

export function HBar({ value, max, tone = "ink" }: { value: number; max: number; tone?: "ink" | "ok" | "signal" | "muted" }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const colors = { ink: "var(--ink)", ok: "var(--ok)", signal: "var(--signal)", muted: "var(--muted-text-2)" };
  return <div className="d-hbar"><span style={{ width: `${p * 100}%`, background: colors[tone] }} /></div>;
}

/**
 * Barra divergente desde el centro: izquierda (verde) = más rápido que lo
 * cotizado, derecha (naranja) = más lento. Se satura en ±100% de desvío.
 */
export function BarraDesvio({ desvioPct }: { desvioPct: number | null }) {
  if (desvioPct == null) return null;
  const mag = Math.min(100, Math.abs(desvioPct)) / 100;
  const lento = desvioPct > 0;
  return (
    <div style={{ position: "relative", height: 10, background: "rgba(20,20,26,.05)", borderRadius: 3, overflow: "hidden" }}>
      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--muted-text-2)", opacity: 0.6 }} />
      <span style={{
        position: "absolute", top: 1, bottom: 1, borderRadius: 2,
        left: lento ? "50%" : `${50 - mag * 50}%`,
        width: `${mag * 50}%`,
        background: Math.abs(desvioPct) <= 10 ? "var(--muted-text-2)" : lento ? "var(--signal)" : "var(--ok)",
      }} />
    </div>
  );
}

export function StackedHBar({ segments, height = 18 }: { segments: Array<{ value: number; color: string; label: string }>; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return <div className="d-shbar" style={{ height }}>{segments.map((s, i) => s.value > 0 ? <span key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} /> : null)}</div>;
}

export function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
  return <div className="d-legend-item"><span className="d-legend-dot" style={{ background: color }} /><span className="lbl">{label}</span>{value != null ? <span className="val mono">{value}</span> : null}</div>;
}

/** Pivota puntos {fecha,nombre,monto} a series apiladas (top N + "Otros"). */
function pivotMix(puntos: PuntoMixPanel[], maxSeries = 6): { labels: string[]; nombres: string[]; data: number[][] } {
  const fechas = [...new Set(puntos.map((p) => p.fecha))].sort();
  const totales = new Map<string, number>();
  for (const p of puntos) totales.set(p.nombre, (totales.get(p.nombre) ?? 0) + p.monto);
  const ranking = [...totales.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const top = ranking.slice(0, maxSeries);
  const idx = new Map(fechas.map((f, i) => [f, i] as const));
  const data = top.map(() => fechas.map(() => 0));
  const otros = fechas.map(() => 0);
  for (const p of puntos) {
    const i = idx.get(p.fecha);
    if (i == null) continue;
    const s = top.indexOf(p.nombre);
    if (s >= 0) data[s][i] += p.monto;
    else otros[i] += p.monto;
  }
  const hayOtros = ranking.length > maxSeries;
  return {
    labels: fechas.map((f) => f.slice(5)),
    nombres: hayOtros ? [...top, "Otros"] : top,
    data: hayOtros ? [...data, otros] : data,
  };
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-07" → "jul 26" (sin ambigüedad día/mes). */
function formatoMesCorto(mes: string): string {
  const [y, m] = mes.split("-");
  return `${MESES_CORTOS[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

/** Heatmap categoría × mes: intensidad = venta de la celda vs. el máximo. */
function HeatmapEstacionalidad({ celdas }: { celdas: CeldaEstacionalidadPanel[] }) {
  const { moneda } = useConfigRegional();
  const meses = [...new Set(celdas.map((c) => c.mes))].sort();
  const totales = new Map<string, number>();
  for (const c of celdas) totales.set(c.categoria, (totales.get(c.categoria) ?? 0) + c.monto);
  const categorias = [...totales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  const valor = new Map(celdas.map((c) => [`${c.categoria}|${c.mes}`, c.monto] as const));
  const max = Math.max(...celdas.map((c) => c.monto), 1);
  if (meses.length === 0) return <div className="d-empty" style={{ padding: 30 }}>Sin ventas registradas todavía.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `minmax(90px, 130px) repeat(${meses.length}, minmax(26px, 1fr))`, gap: 3, alignItems: "center" }}>
        {categorias.map((cat) => (
          <React.Fragment key={cat}>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cat}>{cat}</div>
            {meses.map((mes) => {
              const m = valor.get(`${cat}|${mes}`) ?? 0;
              return (
                <div
                  key={mes}
                  title={`${cat} · ${formatoMesCorto(mes)}: ${formatearMoneda(m, moneda, { decimales: 0 })}`}
                  style={{ height: 22, borderRadius: 3, background: m > 0 ? `rgba(20,20,26,${(0.08 + 0.72 * (m / max)).toFixed(3)})` : "rgba(20,20,26,.03)" }}
                />
              );
            })}
          </React.Fragment>
        ))}
        <div />
        {meses.map((mes, i) => (
          <div key={mes} className="mono" style={{ fontSize: 9.5, color: "var(--muted-text)", textAlign: "center" }}>
            {i % 2 === 0 || meses.length <= 6 ? formatoMesCorto(mes) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── KPI (verbatim del diseño) ─── */
export function Kpi({ label, value, currency, sub, delta, deltaUnit = "%", deltaTone = "auto", spark, sparkSignal, hint }: { label: string; value: React.ReactNode; currency?: string; sub?: string; delta?: number | null; deltaUnit?: string; deltaTone?: "auto" | "ok" | "signal" | "muted" | "inverse"; spark?: number[]; sparkSignal?: boolean; hint?: string }) {
  let tone = "muted";
  if (typeof delta === "number") {
    if (deltaTone === "auto") tone = delta >= 0 ? "ok" : "signal";
    else if (deltaTone === "inverse") tone = delta >= 0 ? "signal" : "ok";
    else tone = deltaTone;
  }
  const deltaTxt = typeof delta === "number" ? `${delta >= 0 ? "↑" : "↓"} ${fmtAR(Math.abs(delta), 1).replace(/,0$/, "")}${deltaUnit === "pts" ? " pts" : deltaUnit}` : null;
  return (
    <div className="d-kpi">
      <div className="d-kpi-head"><span className="d-kpi-lbl">{label}</span>{hint ? <span className="d-kpi-hint" title={hint}>?</span> : null}</div>
      <div className="d-kpi-val">{currency ? <span className="cur">{currency}</span> : null}<span className="num">{value}</span></div>
      <div className="d-kpi-foot">
        {deltaTxt ? <span className={`d-delta tone-${tone}`}>{deltaTxt}</span> : null}
        {sub ? <span className="d-kpi-sub">{sub}</span> : null}
        {spark ? <div className="d-kpi-spark"><Sparkline values={spark} signal={sparkSignal} /></div> : null}
      </div>
    </div>
  );
}

/* ─── Card ─── */
export function Card({ span, title, sub, action, flush, foot, children }: { span: number; title: string; sub?: string; action?: React.ReactNode; flush?: boolean; foot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`d-card span-${span}`}>
      <div className="d-card-head">
        <div className="ttl">{title}</div>{sub ? <span className="sub">{sub}</span> : null}
        <div className="grow" />{action}
      </div>
      <div className={`d-card-body ${flush ? "flush" : ""}`}>{children}</div>
      {foot ? <div className="d-card-foot">{foot}</div> : null}
    </div>
  );
}

function InsightsList({ alertas }: { alertas: AlertaPanel[] }) {
  if (alertas.length === 0) return <div className="d-empty" style={{ padding: 30 }}>Sin alertas activas. Todo en orden.</div>;
  const cls: Record<string, string> = { critico: "crit", atencion: "warn", info: "ok" };
  return (
    <div className="d-alerts">
      {alertas.map((a) => (
        <div key={a.id} className={`d-alert ${cls[a.severidad] ?? ""}`}>
          <span className="pip" />
          <div className="body"><div className="nm">{a.titulo}</div><div className="sub">{a.detalle}</div></div>
        </div>
      ))}
    </div>
  );
}

function RankList({ rows, cols = "18px 1fr 90px" }: { rows: RankingPanel[]; cols?: string }) {
  const { moneda } = useConfigRegional();
  const max = Math.max(...rows.map((r) => r.facturado), 1);
  if (rows.length === 0) return <div className="d-empty" style={{ padding: 30 }}>Sin datos en el período.</div>;
  return (
    <div className="d-rank">
      {rows.map((r, i) => (
        <div key={r.id ?? r.nombre} className="d-rank-row" style={{ gridTemplateColumns: cols }}>
          <span className="ix">{String(i + 1).padStart(2, "0")}</span>
          <div className="body">
            <div className="nm">{r.nombre}</div>
            <div className="sub">{r.ordenes} órden{r.ordenes === 1 ? "" : "es"} · ticket {abreviarMoneda(r.ordenes > 0 ? r.facturado / r.ordenes : 0, moneda)}</div>
            <div className="bar-cell"><HBar value={r.facturado} max={max} /></div>
          </div>
          <span className="val">{abreviarMoneda(r.facturado, moneda)}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ TAB · Resumen ═══════════ */
export type ResumenData = {
  meta: MetaPanel;
  rentabilidad: RentabilidadPanel;
  produccion: ResumenProduccionKpis;
  serie: Array<{ fecha: string; monto: number; costo: number }>;
  topClientes: RankingPanel[];
  topProductos: Array<{ nombre: string; ventas: number; margenPct: number; items: number }>;
  alertas: AlertaPanel[];
};

export function TabResumen({ d }: { d: ResumenData }) {
  const { moneda } = useConfigRegional();
  const r = d.rentabilidad;
  const labels = d.serie.map((s) => s.fecha.slice(5));
  const costos = d.serie.map((s) => s.costo);
  const margenes = d.serie.map((s) => Math.max(0, s.monto - s.costo));
  const spark = d.serie.map((s) => s.monto);
  const ytd = d.serie.reduce((a, s) => a + s.monto, 0);
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Ventas" currency={moneda.simbolo} value={abreviarNumero(r.ventas, moneda)} delta={r.ventasDeltaPct} sub="vs período anterior · sin IVA" spark={spark} />
        <Kpi label="Margen bruto" value={pct(r.margenBrutoPct)} delta={r.margenBrutoDeltaPts} deltaUnit="pts" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} delta={r.contribucionDeltaPts} deltaUnit="pts" hint="Ventas menos costos variables (material + tintas)" />
        <Kpi label="Punto de equilibrio" currency={moneda.simbolo} value={r.puntoEquilibrio != null ? abreviarNumero(r.puntoEquilibrio, moneda) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : "sin costos fijos"} />
        <Kpi label="Entregas a tiempo" value={pct(d.produccion.otdPct)} sub="OTD del período" />
      </div>

      <div className="dash-grid">
        <Card span={8} title="Ventas, costo y margen" sub={`serie ${d.meta.granularidad} · pesos, sin IVA`}
          foot={<><span>Total ventas <strong style={{ color: "var(--ink)" }}>{formatearMoneda(ytd, moneda, { decimales: 0 })}</strong></span><span style={{ marginLeft: "auto" }}>Contribución <strong style={{ color: "var(--ok)" }}>{pct(r.contribucionPct)}</strong></span></>}>
          {d.serie.length >= 2 ? (
            <>
              <BarChart labels={labels} data={[costos, margenes]} stacks={["Costo", "Margen"]} mode="stack" colors={["#c8c6c0", "var(--ink)"]} yFormat={(v) => abreviarMoneda(v, moneda)} height={240} />
              <div className="d-legend" style={{ marginTop: 10 }}>
                <LegendDot color="var(--ink)" label="Margen bruto" value={abreviarMoneda(r.margenBruto, moneda)} />
                <LegendDot color="#c8c6c0" label="Costo directo" value={abreviarMoneda(r.costoTotal ?? 0, moneda)} />
              </div>
            </>
          ) : <div className="d-empty" style={{ padding: 40 }}>El período no tiene serie suficiente para graficar.</div>}
        </Card>

        <Card span={4} title="Punto de equilibrio" sub="cuánto de tu estructura cubriste">
          {r.puntoEquilibrio != null && r.avancePct != null ? (
            <div className="d-gauge-row">
              <DonutRing value={Math.min(100, r.avancePct)} label={pct(r.avancePct)} sub="del equilibrio" tone={r.avancePct < 100 ? "signal" : "ok"} />
              <div className="meta">
                <div className="ttl">Necesitás {abreviarMoneda(r.puntoEquilibrio, moneda)}/período</div>
                <div className="sub">para cubrir tu estructura fija</div>
                <div className="breakdown">
                  <div className="row"><span className="d-pip ok" /><span className="nm">Ventas</span><span className="val">{abreviarMoneda(r.ventas, moneda)}</span></div>
                  <div className="row"><span className="d-pip" /><span className="nm">Costos fijos</span><span className="val">{abreviarMoneda(r.costosFijos ?? 0, moneda)}</span></div>
                </div>
              </div>
            </div>
          ) : <div className="d-empty" style={{ padding: 30 }}>Cargá los costos fijos de tus centros para ver el punto de equilibrio.</div>}
        </Card>

        <Card span={6} title="Clientes principales" sub="por ventas · sin IVA" flush><RankList rows={d.topClientes} cols="18px 1fr 90px" /></Card>

        <Card span={6} title="Productos con más ventas" sub="con su margen · sin IVA" flush>
          <table className="d-tbl">
            <thead><tr><th>Producto</th><th className="right">Margen</th><th className="right">Ventas</th></tr></thead>
            <tbody>{d.topProductos.map((p) => (
              <tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td>
                <td className="right"><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><div style={{ width: 60 }}><HBar value={p.margenPct} max={70} tone={p.margenPct >= 50 ? "ok" : p.margenPct >= 40 ? "ink" : "signal"} /></div><span className="mono" style={{ width: 42 }}>{pct(p.margenPct)}</span></div></td>
                <td className="right mono">{abreviarMoneda(p.ventas, moneda)}</td></tr>
            ))}</tbody>
          </table>
        </Card>

        <Card span={12} title="Alertas activas" sub="requieren acción" flush action={<span className="d-kpi-sub">{d.alertas.length} activa{d.alertas.length === 1 ? "" : "s"}</span>}><InsightsList alertas={d.alertas} /></Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Comercial ═══════════ */
export function TabComercial({ d }: { d: ComercialPanel }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const labels = d.serie.map((s) => s.fecha.slice(5));
  const maxCatMix = Math.max(...d.mixCategoria.map((m) => m.monto), 1);
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Ventas" currency={moneda.simbolo} value={abreviarNumero(k.ventas, moneda)} delta={k.ventasDeltaPct} spark={d.serie.map((s) => s.monto)} hint="Totales de venta netos — no incluyen IVA"
          sub={`${k.ventasDeltaAnualPct != null ? `${k.ventasDeltaAnualPct >= 0 ? "+" : ""}${fmtAR(k.ventasDeltaAnualPct, 1)}% vs año pasado` : "vs período anterior"} · sin IVA`} />
        <Kpi label="Órdenes" value={fmtAR(k.ordenes)} delta={k.ordenesDeltaPct} />
        <Kpi label="Ticket promedio" currency={moneda.simbolo} value={abreviarNumero(k.ticketPromedio, moneda)} spark={d.serieTicket.map((t) => t.ticketPromedio)} hint="Promedio por orden, sin IVA" />
        <Kpi label="Clientes nuevos" value={fmtAR(k.nuevosClientes)} delta={k.nuevosClientes} deltaTone="ok" sub="este período" />
        <Kpi label="Clientes dormidos" value={fmtAR(k.clientesDormidos)} deltaTone="signal" delta={k.clientesDormidos > 0 ? k.clientesDormidos : undefined} sub="sin comprar" />
      </div>
      <div className="dash-grid">
        <Card span={8} title="Ventas del período" sub={`serie ${d.granularidad} · sin IVA`} foot={<span>Ticket promedio <strong style={{ color: "var(--ink)" }}>{abreviarMoneda(k.ticketPromedio, moneda)}</strong> · {k.itemsPorOrden} items/orden</span>}>
          {d.serie.length >= 2 ? <AreaChart series={d.serie.map((s) => s.monto)} labels={labels} yFormat={(v) => abreviarMoneda(v, moneda)} height={230} nombres={["Ventas"]} /> : <div className="d-empty" style={{ padding: 40 }}>Serie insuficiente.</div>}
        </Card>
        <Card span={4} title="Mix por categoría" sub="participación">
          {d.mixCategoria.map((m) => (
            <div key={m.nombre} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>{pct(m.pct)}</span></div>
              <HBar value={m.monto} max={maxCatMix} />
            </div>
          ))}
        </Card>
        <Card span={7} title="Evolución del ticket" sub="promedio y mediana por orden"
          foot={d.serieTicket.length >= 2 ? <span>La <strong style={{ color: "var(--ink)" }}>mediana</strong> (punteada) resiste las órdenes grandes: si se separan, pocas órdenes inflan el promedio.</span> : undefined}>
          {d.serieTicket.length >= 2 ? (
            <>
              <AreaChart series={d.serieTicket.map((t) => t.ticketPromedio)} secondary={d.serieTicket.map((t) => t.ticketMediana)} labels={d.serieTicket.map((t) => t.fecha.slice(5))} yFormat={(v) => abreviarMoneda(v, moneda)} height={210} nombres={["Promedio", "Mediana"]} />
              <div className="d-legend" style={{ marginTop: 8 }}>
                <LegendDot color="var(--ink)" label="Promedio" value={abreviarMoneda(k.ticketPromedio, moneda)} />
                <LegendDot color="var(--muted-text-2)" label="Mediana" />
              </div>
            </>
          ) : <div className="d-empty" style={{ padding: 40 }}>Serie insuficiente para graficar el ticket.</div>}
        </Card>
        <Card span={5} title="Estacionalidad por categoría" sub="ventas por mes · últimos 12 meses · sin IVA">
          <HeatmapEstacionalidad celdas={d.estacionalidad} />
          <div style={{ fontSize: 11, color: "var(--muted-text)", marginTop: 10 }}>Más oscuro = más venta. El índice estacional llega con 2+ años de historia.</div>
        </Card>
        <Card span={6} title="Clientes principales" sub="por ventas · sin IVA" flush><RankList rows={d.rankingClientes} /></Card>
        <Card span={6} title="Ranking de vendedores" sub="por ventas · sin IVA" flush><RankList rows={d.rankingVendedores} /></Card>
        <Card span={8} title="Clientes dormidos" sub="recurrentes que dejaron de comprar" flush>
          {d.dormidos.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Tus clientes recurrentes siguen activos.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Última compra</th><th className="right">Sin comprar</th><th className="right">Historial</th></tr></thead>
              <tbody>{d.dormidos.map((c) => (<tr key={c.clienteId ?? c.cliente}><td><div className="nm">{c.cliente}</div></td><td className="right mono">{c.ultimaCompra}</td><td className="right mono" style={{ color: "var(--signal)" }}>{c.diasSinComprar} d</td><td className="right mono">{c.historico}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
        <Card span={4} title="Mix por tecnología">
          {d.mixTecnologia.map((m) => (
            <div key={m.nombre} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{technologyCodeLabel(m.nombre) || m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>{pct(m.pct)}</span></div>
              <HBar value={m.pct} max={100} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Embudo comercial ═══════════ */
/**
 * Salud del pipeline cotización → producción sobre una COHORTE de
 * presupuestos emitidos en el rango. Semántica "alcanzó al menos": cada
 * etapa mide hasta dónde llegó cada presupuesto, no dónde está hoy, así el
 * funnel decrece de forma monótona. Cierra en Entregadas.
 * Ver docs/embudo-comercial-panel-diseno.md
 */
export function TabEmbudo({ d }: { d: EmbudoPanel }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const [modo, setModo] = React.useState<"cant" | "monto">("cant");
  const valDe = (e: { cantidad: number; monto: number }) => (modo === "cant" ? e.cantidad : e.monto);
  const base = d.funnel[0] ? valDe(d.funnel[0]) : 0;
  const maxFuga = Math.max(...d.fugas.map((f) => f.cantidad), 1);
  const toggle = (
    <div className="dash-period">
      {(["cant", "monto"] as const).map((m) => (
        <button key={m} className={modo === m ? "on" : ""} onClick={() => setModo(m)}>
          {m === "cant" ? "Cantidad" : `En ${moneda.simbolo}`}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Tasa de aprobación" value={pct(k.tasaAprobacion)} delta={k.tasaAprobacionDeltaPct} deltaUnit=" pts" sub="aprobadas / emitidas" />
        <Kpi label="Emitida → entregada" value={pct(k.tasaEntrega)} sub="conversión total del ciclo" />
        <Kpi label="Pipeline abierto" currency={moneda.simbolo} value={abreviarNumero(k.pipelineAbiertoMonto, moneda)} sub={`${fmtAR(k.pipelineAbiertoCantidad)} presupuestos vivos hoy · sin IVA`} />
        <Kpi label="Ciclo promedio" value={k.cicloPromedioDias != null ? fmtAR(k.cicloPromedioDias, 1) : "—"} sub="días · emisión → entrega" />
      </div>
      <div className="dash-grid">
        <Card span={12} title="Embudo comercial" sub="cohorte de presupuestos emitidos en el período · montos sin IVA" action={toggle}
          foot={<span>La <strong style={{ color: "var(--ink)" }}>conversión</strong> es paso a paso (etapa sobre la anterior); el <strong style={{ color: "var(--ink)" }}>%</strong> de la barra es sobre lo emitido.</span>}>
          {base === 0 ? <div className="d-empty" style={{ padding: 40 }}>Sin presupuestos emitidos en el período.</div> : (
            <div style={{ marginTop: 6 }}>
              {d.funnel.map((e, i) => {
                const val = valDe(e);
                const prev = i > 0 ? valDe(d.funnel[i - 1]) : 0;
                const share = base > 0 ? (val / base) * 100 : 0;
                const conv = i === 0 ? null : prev > 0 ? (val / prev) * 100 : 0;
                const display = modo === "cant" ? fmtAR(e.cantidad) : abreviarMoneda(e.monto, moneda);
                return (
                  <div key={e.clave} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                      <span style={{ fontSize: 14 }}>{e.label} <strong style={{ marginLeft: 4 }}>{display}</strong></span>
                      {conv != null ? <span style={{ fontSize: 12, color: "var(--muted-text)" }}>↳ conversión {fmtAR(conv, 1)}%</span> : null}
                    </div>
                    <div style={{ position: "relative", height: 28, background: "rgba(20,20,26,.05)", borderRadius: 6, overflow: "hidden" }}>
                      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${share}%`, background: "var(--ink)", borderRadius: 6 }} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--muted-text)" }}>{fmtAR(share, 0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card span={6} title="Dónde se pierde" sub="presupuestos no aprobados · montos sin IVA">
          {d.fugas.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Ningún presupuesto perdido: todo lo emitido sigue vivo o se aprobó.</div> : (
            d.fugas.map((f) => (
              <div key={f.motivo} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span>{f.motivo}</span>
                  <span className="mono" style={{ color: "var(--muted-text)" }}>{fmtAR(f.cantidad)} · {abreviarMoneda(f.monto, moneda)}</span>
                </div>
                <HBar value={f.cantidad} max={maxFuga} tone="muted" />
              </div>
            ))
          )}
        </Card>
        <Card span={6} title="Velocidad del ciclo" sub="días promedio entre etapas">
          {d.velocidad.map((v) => (
            <div key={v.tramo} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
              <span style={{ fontSize: 13, color: "var(--muted-text)" }}>{v.tramo}</span>
              <span style={{ fontSize: 15 }}>{v.diasPromedio != null ? <>{fmtAR(v.diasPromedio, 1)} <span style={{ fontSize: 11, color: "var(--muted-text-2)" }}>d</span></> : "—"}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Producción ═══════════ */
/** Fuente del tiempo asentado por paso (registro-tiempos D3): etiqueta y color. */
const FUENTE_TIEMPO_META: Record<string, { label: string; color: string }> = {
  medido: { label: "Medido", color: "var(--ok)" },
  medido_lote: { label: "Medido en tanda", color: "#3a9ca0" },
  declarado: { label: "Declarado", color: "#5a7fd8" },
  estimado: { label: "Estimado (máquina)", color: "#c8c6c0" },
  invalido: { label: "Sin tiempo", color: "var(--signal)" },
};

/** "95m" / "3,2h" según magnitud (tiempos de operador del panel). */
export function fmtMinutos(min: number): string {
  return min < 90 ? `${fmtAR(min, 0)}m` : `${fmtAR(min / 60, 1)}h`;
}

export function TabProduccion({ d }: { d: ProduccionPanel }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const registro = d.registroTiempos;
  const ahorros = d.ahorros;
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Entregas a tiempo" value={pct(k.otdPct)} sub={`${d.otd.aTiempo}/${d.otd.total} órdenes`} />
        <Kpi label="Trabajos en cola" value={fmtAR(k.trabajosEnCola)} sub={k.diasDeCarga != null ? `${fmtAR(k.diasDeCarga, 1)} días de carga` : "sin capacidad cargada"} />
        <Kpi label="Lead time" value={k.leadTimeDias != null ? `${fmtAR(k.leadTimeDias, 1)}` : "—"} sub="días · emisión→entrega" />
        <Kpi label="Eficiencia de tiempo" value={pct(k.eficienciaPct)} sub="real vs. cotizado" hint="Tiempo real de los pasos sobre el cotizado" />
        <Kpi label="Bloqueados" value={fmtAR(k.bloqueados)} deltaTone="signal" delta={k.bloqueados > 0 ? k.bloqueados : undefined} sub="requieren intervención" />
      </div>
      <div className="dash-grid">
        <Card span={5} title="Throughput diario" sub="pasos completados por día" action={<span className="mono" style={{ color: "var(--ink)", fontSize: 13, fontWeight: 600 }}>{d.throughput.reduce((a, t) => a + t.cantidad, 0)}</span>}>
          {d.throughput.length >= 2 ? <AreaChart series={d.throughput.map((t) => t.cantidad)} labels={d.throughput.map((t) => t.fecha.slice(5))} yFormat={(v) => String(Math.round(v))} height={220} nombres={["Pasos completados"]} fmtValor={(v) => fmtAR(v, 0)} /> : <BarChart labels={d.throughput.map((t) => t.fecha.slice(5))} data={[d.throughput.map((t) => t.cantidad)]} stacks={["Pasos"]} height={200} fmtValor={(v) => fmtAR(v, 0)} />}
        </Card>
        <Card span={7} title="Precisión de estimación" sub="¿tardamos más o menos que lo cotizado?" flush
          foot={<span><span className="d-pip ok" style={{ marginRight: 4 }} />Más rápido que lo cotizado · <span className="d-pip warn" style={{ margin: "0 4px" }} />Más lento (revisar el tiempo del paso)</span>}>
          <table className="d-tbl"><thead><tr><th>Familia</th><th className="right">Cotizado</th><th className="right">Real</th><th style={{ width: 110 }} /><th className="right">vs. cotizado</th></tr></thead>
            <tbody>{d.eficiencia.porFamilia.map((f) => {
              const desvio = f.razon != null ? (f.razon - 1) * 100 : null;
              const enLinea = desvio != null && Math.abs(desvio) <= 10;
              const color = desvio == null || enLinea ? "var(--muted-text)" : desvio > 0 ? "var(--signal)" : "var(--ok)";
              return (
                <tr key={f.familia}>
                  <td><div className="nm">{f.familia}</div><div className="sub" style={{ color: f.muestras < 3 ? "var(--signal)" : undefined }}>{f.muestras} paso{f.muestras === 1 ? "" : "s"} medido{f.muestras === 1 ? "" : "s"}{f.muestras < 3 ? " · poca señal" : ""}</div></td>
                  <td className="right mono">{fmtMinutos(f.estimadoMin)}</td>
                  <td className="right mono">{f.realMin > 0 && f.realMin < 1 ? "<1m" : fmtMinutos(f.realMin)}</td>
                  <td><BarraDesvio desvioPct={desvio} /></td>
                  <td className="right">
                    {desvio == null ? <span className="mono">—</span> : (
                      <>
                        <div className="mono" style={{ fontWeight: 600, color }}>{desvio > 0 ? "+" : ""}{fmtAR(desvio, 0)}%</div>
                        <div style={{ fontSize: 10.5, color: "var(--muted-text)" }}>{enLinea ? "en línea" : desvio > 0 ? "más lento" : "más rápido"}</div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </Card>
        <Card span={7} title="Utilización por centro" sub="horas reales vs. capacidad práctica" flush>
          <table className="d-tbl"><thead><tr><th>Centro</th><th className="right">Reales</th><th className="right">Capacidad</th><th style={{ width: 90 }} /><th className="right">Uso</th></tr></thead>
            <tbody>{d.utilizacion.map((c) => (<tr key={c.centro}><td><div className="nm">{c.centro}</div></td><td className="right mono">{fmtAR(c.horasReales, 0)}h</td><td className="right mono muted">{fmtAR(c.capacidadPractica, 0)}h</td><td><HBar value={c.pct ?? 0} max={100} tone={(c.pct ?? 0) < 40 ? "signal" : "ink"} /></td><td className="right mono">{pct(c.pct)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={5} title="Órdenes atrasadas" sub="entregadas fuera de fecha" flush>
          {d.otd.atrasadas.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Ninguna orden se entregó tarde.</div> : (
            <table className="d-tbl"><thead><tr><th>Orden</th><th>Cliente</th><th className="right">Atraso</th></tr></thead>
              <tbody>{d.otd.atrasadas.map((o) => (<tr key={o.numero}><td className="mono">{o.numero}</td><td>{o.cliente}</td><td className="right mono" style={{ color: "var(--signal)" }}>{o.diasAtraso} d</td></tr>))}</tbody>
            </table>
          )}
        </Card>

        {/* ── Registro de tiempos (docs/registro-tiempos-produccion §9).
             El detalle por operador vive en el tab Equipo. ── */}
        <Card
          span={6}
          title="Calidad del registro"
          sub="fuente del tiempo de cada paso"
          action={<span className="mono" style={{ color: "var(--ink)", fontSize: 13, fontWeight: 600 }}>{registro.confiablePct != null ? `${fmtAR(registro.confiablePct, 0)}% medido` : "—"}</span>}
        >
          {registro.totalPasos === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin pasos completados en el período.</div> : (
            <>
              <StackedHBar segments={registro.fuentes.map((f) => ({ value: f.pasos, color: FUENTE_TIEMPO_META[f.fuente]?.color ?? "var(--muted-text-2)", label: FUENTE_TIEMPO_META[f.fuente]?.label ?? f.fuente }))} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {registro.fuentes.map((f) => (
                  <LegendDot key={f.fuente} color={FUENTE_TIEMPO_META[f.fuente]?.color ?? "var(--muted-text-2)"} label={FUENTE_TIEMPO_META[f.fuente]?.label ?? f.fuente} value={`${f.pasos} · ${fmtAR(f.pct, 0)}%`} />
                ))}
              </div>
            </>
          )}
        </Card>
        <Card span={6} title="Pausas del taller" sub="por qué se corta el trabajo" flush>
          {registro.pausas.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin pausas registradas en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Motivo</th><th style={{ width: 90 }} /><th className="right">Veces</th></tr></thead>
              <tbody>{registro.pausas.map((p) => (<tr key={p.motivo}><td><div className="nm">{p.motivo}</div></td><td><HBar value={p.veces} max={Math.max(...registro.pausas.map((x) => x.veces), 1)} tone={p.motivo === "Pausa automática" || p.motivo === "Fin de jornada" ? "muted" : "ink"} /></td><td className="right mono">{p.veces}</td></tr>))}</tbody>
            </table>
          )}
        </Card>

        {/* ── Ahorro por consolidación: el valor que genera el sistema ── */}
        <Card
          span={5}
          title="Ahorro por consolidación"
          sub="material que NO se compró gracias a consolidar tandas"
        >
          {ahorros.historico.tandas === 0 ? (
            <div className="d-empty" style={{ padding: 30 }}>
              Todavía no hay tandas consolidadas registradas: el ahorro se asienta al marcar impresos en el Simulador gran formato.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-text)" }}>Acumulado histórico</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--ok)" }}>{formatearMoneda(ahorros.historico.ahorroPesos, moneda, { decimales: 0 })}</div>
                <div style={{ fontSize: 12, color: "var(--muted-text)" }}>{fmtAR(ahorros.historico.ahorroMl, 1)} ml de rollo · {ahorros.historico.tandas} tanda{ahorros.historico.tandas === 1 ? "" : "s"} · {ahorros.historico.jobs} trabajo{ahorros.historico.jobs === 1 ? "" : "s"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-text)" }}>En el período</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{formatearMoneda(ahorros.periodo.ahorroPesos, moneda, { decimales: 0 })}</div>
                <div style={{ fontSize: 12, color: "var(--muted-text)" }}>{fmtAR(ahorros.periodo.ahorroMl, 1)} ml · {ahorros.periodo.tandas} tanda{ahorros.periodo.tandas === 1 ? "" : "s"}</div>
              </div>
            </div>
          )}
        </Card>
        <Card span={7} title="Ahorro por material" sub="acumulado histórico por consolidación" flush>
          {ahorros.porMaterial.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin ahorros registrados todavía.</div> : (
            <table className="d-tbl"><thead><tr><th>Material</th><th>Tecnología</th><th className="right">Tandas</th><th className="right">Rollo</th><th className="right">Ahorro</th></tr></thead>
              <tbody>{ahorros.porMaterial.map((m) => (
                <tr key={`${m.material}|${m.tecnologia ?? ""}`}>
                  <td><div className="nm">{m.material}</div></td>
                  <td>{m.tecnologia ? technologyCodeLabel(m.tecnologia) || m.tecnologia : "—"}</td>
                  <td className="right mono">{m.tandas}</td>
                  <td className="right mono">{fmtAR(m.ahorroMl, 1)} ml</td>
                  <td className="right mono" style={{ color: "var(--ok)", fontWeight: 600 }}>{formatearMoneda(m.ahorroPesos, moneda, { decimales: 0 })}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Finanzas ═══════════ */
export type FinanzasData = { meta: MetaPanel; rentabilidad: RentabilidadPanel; cobranza: CobranzaPanel };
const AGING_COLORS: Record<string, string> = { "0-30": "var(--ok)", "31-60": "#c8c6c0", "61-90": "#d97757", "+90": "var(--signal)" };
export function TabFinanzas({ d }: { d: FinanzasData }) {
  const { moneda } = useConfigRegional();
  const r = d.rentabilidad, co = d.cobranza;
  const gasto = r.gastoPorCategoria ?? [];
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Ventas" currency={moneda.simbolo} value={abreviarNumero(r.ventas, moneda)} delta={r.ventasDeltaPct} sub="órdenes emitidas · sin IVA" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} sub="margen de contribución" />
        <Kpi label="Punto de equilibrio" currency={moneda.simbolo} value={r.puntoEquilibrio != null ? abreviarNumero(r.puntoEquilibrio, moneda) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : undefined} />
        <Kpi label="Cuentas por cobrar" currency={moneda.simbolo} value={abreviarNumero(co.agingTotal, moneda)} sub={`DSO ${co.dso != null ? fmtAR(co.dso) : "—"} días`} />
        <Kpi label="Costo de cobrar" currency={moneda.simbolo} value={abreviarNumero(co.comisionTotal, moneda)} deltaTone="signal" sub="comisiones del período" />
      </div>
      <div className="dash-grid">
        <Card span={8} title="Ventas vs costo" sub={`serie ${d.meta.granularidad} · sin IVA`}
          action={<div className="d-legend"><LegendDot color="var(--ink)" label="Ventas" value={abreviarMoneda(r.ventas, moneda)} /><LegendDot color="#c8c6c0" label="Costo" value={abreviarMoneda(r.costoTotal ?? 0, moneda)} /></div>}>
          <FacturacionVsCosto rentabilidad={r} meta={d.meta} />
        </Card>
        <Card span={4} title="Cuentas por cobrar" sub="por antigüedad" foot={<><span className="d-pip warn" />Vencido <strong style={{ color: "var(--signal)" }}>{formatearMoneda(co.vencido, moneda, { decimales: 0 })}</strong></>}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>{formatearMoneda(co.agingTotal, moneda, { decimales: 0 })}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted-text)" }}>total a cobrar</span>
          </div>
          <StackedHBar segments={co.aging.map((a) => ({ value: a.monto, color: AGING_COLORS[a.franja], label: a.franja }))} />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {co.aging.map((a) => (
              <div key={a.franja} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: AGING_COLORS[a.franja] }} />
                <span style={{ color: "var(--ink-2)", flex: 1 }}>{a.franja} días</span>
                <span className="mono" style={{ color: "var(--muted-text)" }}>{co.agingTotal > 0 ? pct((a.monto / co.agingTotal) * 100) : "0%"}</span>
                <span className="mono" style={{ color: "var(--ink)", fontWeight: 500, width: 90, textAlign: "right" }}>{formatearMoneda(a.monto, moneda, { decimales: 0 })}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card span={7} title="Costo de cobrar" sub="comisiones por método de pago" flush>
          <table className="d-tbl"><thead><tr><th>Método</th><th className="right">Cobros</th><th className="right">Bruto</th><th className="right">Comisión</th><th className="right">%</th></tr></thead>
            <tbody>{co.costoCobrar.map((m) => (<tr key={m.metodo}><td><div className="nm">{m.metodo}</div></td><td className="right mono">{m.cantidad}</td><td className="right mono">{abreviarMoneda(m.bruto, moneda)}</td><td className="right mono" style={{ color: m.comision > 0 ? "var(--signal)" : "var(--muted-text)", fontWeight: 600 }}>{abreviarMoneda(m.comision, moneda)}</td><td className="right mono">{pct(m.pct)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={5} title="Gasto fijo por categoría" sub="estructura mensual (gastos fijos)">
          {gasto.length === 0 ? (
            <div className="d-empty" style={{ padding: 30 }}>Sin gastos fijos de estructura cargados. Cargalos en Costos → Gastos fijos para calcular el punto de equilibrio.</div>
          ) : (
            <div className="d-gauge-row">
              <StackedRing segments={gasto.map((g) => g.monto)} label={abreviarMoneda(r.costosFijos ?? 0, moneda)} sub="costo fijo" />
              <div className="meta" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {gasto.slice(0, 8).map((g, i) => (
                  <div key={g.categoria} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG_COLORS[i % SEG_COLORS.length] }} />
                    <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.categoria}</span>
                    <span className="mono" style={{ color: "var(--muted-text)" }}>{pct(g.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card span={12} title="Deudores principales" sub="prioridad de cobranza" flush>
          {co.deudores.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin deuda pendiente.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Saldo</th><th className="right">Días máx.</th><th style={{ width: 200 }}>Distribución</th></tr></thead>
              <tbody>{co.deudores.map((x) => (<tr key={x.clienteId ?? x.cliente}><td><div className="nm">{x.cliente}</div></td><td className="right mono" style={{ fontWeight: 600 }}>{formatearMoneda(x.saldo, moneda, { decimales: 0 })}</td><td className="right mono" style={{ color: x.diasMax > 60 ? "var(--signal)" : "var(--ink)" }}>{x.diasMax} d</td><td style={{ width: 200 }}><StackedHBar height={10} segments={(["0-30", "31-60", "61-90", "+90"] as const).map((f) => ({ value: x.porFranja[f], color: AGING_COLORS[f], label: f }))} /></td></tr>))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function FacturacionVsCosto({ rentabilidad: r, meta }: { rentabilidad: RentabilidadPanel; meta: MetaPanel }) {
  const { moneda } = useConfigRegional();
  // Con un solo período agregado, se muestra el par ventas/costo como
  // barras agrupadas (el período no trae serie de costo mensual aún).
  return (
    <BarChart labels={[meta.rango.desde.slice(5)]} data={[[r.ventas], [r.costoTotal ?? 0]]} stacks={["Ventas", "Costo"]} mode="group" colors={["var(--ink)", "#c8c6c0"]} yFormat={(v) => abreviarMoneda(v, moneda)} height={230} />
  );
}

/* ═══════════ TAB · Ventas & Producto ═══════════ */
/** Mix evolutivo con drill: apilado por categoría; al elegir una, por producto. */
function MixEvolutivoCard({ d, rango }: { d: ProductoPanel; rango: RangoPanel }) {
  const { moneda } = useConfigRegional();
  const [categoria, setCategoria] = React.useState<string | null>(null);
  const [drill, setDrill] = React.useState<MixCategoriaPanel | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!categoria) { setDrill(null); setError(null); return; }
    let vivo = true; setCargando(true); setError(null);
    getPanelMixCategoria(categoria, rango)
      .then((res) => { if (vivo) setDrill(res as MixCategoriaPanel); })
      .catch((err) => { if (vivo) setError(err instanceof Error ? err.message : "No se pudo abrir la categoría."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [categoria, rango]);

  const puntos = categoria && drill ? drill.serie : d.mixEvolutivo;
  const pivot = pivotMix(puntos);
  const categorias = [...new Set(d.mixEvolutivo.map((p) => p.nombre))];
  // El color sigue a la ENTIDAD (orden alfabético estable), no a su ranking:
  // cambiar de período no repinta a las categorías que sobreviven.
  const ordenAlfa = pivot.nombres.filter((n) => n !== "Otros").sort((a, b) => a.localeCompare(b, "es"));
  const colorDe = (n: string) => (n === "Otros" ? COLOR_OTROS : PALETA_SERIES[ordenAlfa.indexOf(n) % PALETA_SERIES.length]);
  const series = pivot.nombres.map((n, i) => ({ nombre: n, color: colorDe(n), values: pivot.data[i] }));
  return (
    <Card span={12} title="Evolución del mix" sub={categoria ? `productos de ${categoria}` : "ventas por categoría en el tiempo"}
      action={
        <select value={categoria ?? ""} onChange={(e) => setCategoria(e.target.value || null)}
          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink)" }}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      }>
      {error ? <div className="d-empty" style={{ padding: 30 }}>{error}</div>
        : cargando && !puntos.length ? <div className="d-empty" style={{ padding: 30 }}>Abriendo la categoría…</div>
        : pivot.labels.length >= 2 ? (
          <>
            <MultiLineChart series={series} labels={pivot.labels} yFormat={(v) => abreviarMoneda(v, moneda)} height={240} />
            <div className="d-legend" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {series.map((s) => <LegendDot key={s.nombre} color={s.color} label={s.nombre} value={abreviarMoneda(s.values.reduce((a, v) => a + v, 0), moneda)} />)}
            </div>
          </>
        ) : <div className="d-empty" style={{ padding: 40 }}>El período no tiene serie suficiente: probá “Trimestre” o “Año”.</div>}
    </Card>
  );
}

/** Unidades canónicas de material → etiqueta humana y decimales sensatos. */
const UNIDAD_MATERIAL: Record<string, { singular: string; plural: string; dec: number }> = {
  unidad: { singular: "unidad", plural: "unidades", dec: 0 },
  hoja: { singular: "hoja", plural: "hojas", dec: 0 },
  m2: { singular: "m²", plural: "m²", dec: 1 },
  metro_lineal: { singular: "m lineal", plural: "m lineales", dec: 1 },
  ml: { singular: "ml", plural: "ml", dec: 0 },
  gramo: { singular: "g", plural: "g", dec: 0 },
};
function fmtCantidadMaterial(m: { cantidad: number; unidad: string; formato: string | null }): string {
  if (m.unidad === "gramo" && m.cantidad >= 1000) return `${fmtAR(m.cantidad / 1000, 2)} kg`;
  const u = UNIDAD_MATERIAL[m.unidad];
  if (!u) return `${fmtAR(m.cantidad, 1)} ${m.unidad}`;
  const etiqueta = m.cantidad === 1 ? u.singular : u.plural;
  const formato = m.unidad === "hoja" && m.formato ? ` ${m.formato}` : "";
  return `${fmtAR(m.cantidad, u.dec)} ${etiqueta}${formato}`;
}

const COLOR_A_MEDIDA = PALETA_SERIES[1];

export function TabProducto({ d, rango }: { d: ProductoPanel; rango: RangoPanel }) {
  const { moneda } = useConfigRegional();
  const maxTec = Math.max(...d.porTecnologia.map((m) => m.monto), 1);
  const ad = d.adicionales;
  const med = d.medidas;
  return (
    <div className="dash-grid">
      <MixEvolutivoCard d={d} rango={rango} />
      <Card span={6} title="Ventas por categoría" sub="margen y contribución · sin IVA" flush>
        <table className="d-tbl"><thead><tr><th>Categoría</th><th className="right">Margen</th><th className="right" title="Margen de contribución = ventas − material y consumibles">MC</th><th className="right">Ventas</th></tr></thead>
          <tbody>{d.porCategoria.map((c) => (<tr key={c.nombre}><td><div className="nm">{c.nombre}</div></td><td className="right"><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><div style={{ width: 44 }}><HBar value={c.margenPct} max={70} tone={c.margenPct >= 50 ? "ok" : c.margenPct >= 40 ? "ink" : "signal"} /></div><span className="mono" style={{ width: 42 }}>{pct(c.margenPct)}</span></div></td><td className="right mono" style={{ color: "var(--ok)" }}>{pct(c.contribucionPct)}</td><td className="right mono">{abreviarMoneda(c.ventas, moneda)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={6} title="Productos más vendidos" sub="volumen, margen y MC · sin IVA" flush>
        <table className="d-tbl"><thead><tr><th>Producto</th><th className="right">Items</th><th className="right">Margen</th><th className="right" title="Margen de contribución = ventas − material y consumibles">MC</th><th className="right">Ventas</th></tr></thead>
          <tbody>{d.porProducto.slice(0, 8).map((p) => (<tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td><td className="right mono">{p.items}</td><td className="right mono">{pct(p.margenPct)}</td><td className="right mono" style={{ color: "var(--ok)" }}>{pct(p.contribucionPct)}</td><td className="right mono">{abreviarMoneda(p.ventas, moneda)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={7} title="Adicionales más pedidos" sub="qué se agrega a los trabajos y cuánto suma al ticket · sin IVA"
        action={<span className="mono" style={{ color: "var(--ink)", fontSize: 13, fontWeight: 600 }}>{pct(ad.pctCon, 0)} con adicionales</span>} flush>
        {ad.porAdicional.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Ningún item del período llevó adicionales.</div> : (
          <>
            <table className="d-tbl"><thead><tr><th>Adicional</th><th style={{ width: 110 }} /><th className="right">Items</th><th className="right">Attach</th><th className="right">Ventas de esos items</th></tr></thead>
              <tbody>{ad.porAdicional.slice(0, 8).map((a) => (
                <tr key={a.etiqueta}><td><div className="nm">{a.etiqueta}</div></td>
                  <td><HBar value={a.pctItems} max={Math.max(...ad.porAdicional.map((x) => x.pctItems), 1)} /></td>
                  <td className="right mono">{a.items}</td>
                  <td className="right mono" style={{ fontWeight: 600 }}>{pct(a.pctItems, 0)}</td>
                  <td className="right mono">{abreviarMoneda(a.ventas, moneda)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ display: "flex", gap: 18, padding: "10px 14px", fontSize: 12, color: "var(--muted-text)", borderTop: "1px solid var(--hairline)" }}>
              <span>Item con adicionales <strong className="mono" style={{ color: "var(--ink)" }}>{abreviarMoneda(ad.ticketItemCon, moneda)}</strong></span>
              <span>sin adicionales <strong className="mono" style={{ color: "var(--ink)" }}>{abreviarMoneda(ad.ticketItemSin, moneda)}</strong></span>
              {ad.ticketItemSin > 0 && ad.itemsCon > 0 ? <span style={{ color: "var(--ok)" }}>{ad.ticketItemCon >= ad.ticketItemSin ? "+" : ""}{fmtAR(((ad.ticketItemCon - ad.ticketItemSin) / ad.ticketItemSin) * 100, 0)}% de ticket</span> : null}
            </div>
          </>
        )}
      </Card>
      <Card span={5} title="Adicionales por producto" sub="% de cada producto que sale con adicionales" flush>
        {ad.porProducto.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin ventas en el período.</div> : (
          <table className="d-tbl"><thead><tr><th>Producto</th><th className="right">Items</th><th style={{ width: 80 }} /><th className="right">Con adic.</th></tr></thead>
            <tbody>{ad.porProducto.slice(0, 8).map((p) => (
              <tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td>
                <td className="right mono">{p.items}</td>
                <td><HBar value={p.pctCon} max={100} tone={p.pctCon >= 50 ? "ok" : "ink"} /></td>
                <td className="right mono" style={{ fontWeight: 600 }}>{pct(p.pctCon, 0)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Card span={7} title="Uso de papel y material" sub="consumo teórico del período" flush>
        <table className="d-tbl"><thead><tr><th>Material</th><th className="right">Cantidad</th><th className="right">Trabajos</th><th className="right">Costo</th></tr></thead>
          <tbody>{d.porPapel.map((m) => (<tr key={`${m.material}|${m.formato ?? ""}`}><td><div className="nm">{m.material}</div></td><td className="right mono">{fmtCantidadMaterial(m)}</td><td className="right mono">{m.items}</td><td className="right mono">{abreviarMoneda(m.costo, moneda)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={5} title="Medida estándar vs. a medida" sub={`cómo se cotizó cada item · ${fmtAR(d.totalM2, 1)} m² vendidos`}>
        {med.items === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin items con dato de medida en el período.</div> : (
          <>
            <StackedHBar segments={[
              { value: med.estandar, color: "var(--ink)", label: "Estándar" },
              { value: med.personalizada, color: COLOR_A_MEDIDA, label: "A medida" },
            ]} />
            <div style={{ display: "flex", gap: 18, marginTop: 10, marginBottom: 12, fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ink)" }} />Estándar <strong className="mono">{med.estandar}</strong><span style={{ color: "var(--muted-text)" }}>({med.pctEstandar != null ? pct(med.pctEstandar, 0) : "—"})</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COLOR_A_MEDIDA }} />A medida <strong className="mono">{med.personalizada}</strong><span style={{ color: "var(--muted-text)" }}>({med.pctEstandar != null ? pct(100 - med.pctEstandar, 0) : "—"})</span></span>
            </div>
            <table className="d-tbl"><thead><tr><th>Producto</th><th className="right">Items</th><th style={{ width: 90 }} /><th className="right">A medida</th></tr></thead>
              <tbody>{med.porProducto.map((p) => (
                <tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td>
                  <td className="right mono">{p.items}</td>
                  <td><StackedHBar height={10} segments={[
                    { value: p.estandar, color: "var(--ink)", label: "Estándar" },
                    { value: p.personalizada, color: COLOR_A_MEDIDA, label: "A medida" },
                  ]} /></td>
                  <td className="right mono" style={{ fontWeight: 600, color: p.personalizada > 0 ? COLOR_A_MEDIDA : "var(--muted-text)" }}>{pct(100 - p.pctEstandar, 0)}</td></tr>
              ))}</tbody>
            </table>
            {med.topEstandar.length > 0 ? (
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted-text)" }}>
                Estándar más usadas: {med.topEstandar.map((t) => `${t.nombre} ×${t.items}`).join(" · ")}
              </div>
            ) : null}
            {med.sinDato > 0 ? <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted-text)" }}>{med.sinDato} item{med.sinDato === 1 ? "" : "s"} sin dato de medida, fuera del porcentaje.</div> : null}
          </>
        )}
      </Card>
      <Card span={6} title="Consumo de tintas" sub="teórico, del snapshot" flush>
        <table className="d-tbl"><thead><tr><th>Tinta</th><th className="right">Cantidad</th></tr></thead>
          <tbody>{d.consumoTintas.map((m) => (<tr key={`${m.material}|${m.formato ?? ""}`}><td><div className="nm">{m.material}</div></td><td className="right mono">{fmtCantidadMaterial(m)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={6} title="Mix por tecnología">
        {d.porTecnologia.map((m) => (
          <div key={m.nombre} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{technologyCodeLabel(m.nombre) || m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>{abreviarMoneda(m.monto, moneda)} · {pct(m.pct)}</span></div>
            <HBar value={m.monto} max={maxTec} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════ TAB · Equipo ═══════════ */
export const FUENTE_DISCIPLINA_COLORS: Array<{ key: "medidos" | "declarados" | "estimados" | "invalidos"; label: string; color: string }> = [
  { key: "medidos", label: "Medido", color: "var(--ok)" },
  { key: "declarados", label: "Declarado", color: "#5a7fd8" },
  { key: "estimados", label: "Estimado", color: "#c8c6c0" },
  { key: "invalidos", label: "Sin tiempo", color: "var(--signal)" },
];

/** Matriz personas × familias con intensidad por minutos trabajados. */
function MatrizPolivalencia({ celdas }: { celdas: EquipoPanel["polivalencia"] }) {
  const personas = [...new Set(celdas.map((c) => c.nombre))].sort((a, b) => a.localeCompare(b, "es")).slice(0, 8);
  const totalesFam = new Map<string, number>();
  for (const c of celdas) totalesFam.set(c.familia, (totalesFam.get(c.familia) ?? 0) + c.minutos);
  const familias = [...totalesFam.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 8);
  const valor = new Map(celdas.map((c) => [`${c.familia}|${c.nombre}`, c] as const));
  const max = Math.max(...celdas.map((c) => c.minutos), 1);
  if (personas.length === 0) return <div className="d-empty" style={{ padding: 30 }}>Sin tramos de trabajo en el período.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `minmax(110px, 150px) repeat(${personas.length}, minmax(34px, 1fr))`, gap: 3, alignItems: "center" }}>
        <div />
        {personas.map((p) => (
          <div key={p} title={p} style={{ fontSize: 10, color: "var(--muted-text)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.split(" ")[0]}</div>
        ))}
        {familias.map((fam) => (
          <React.Fragment key={fam}>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fam}>{fam}</div>
            {personas.map((p) => {
              const c = valor.get(`${fam}|${p}`);
              return (
                <div key={p} title={c ? `${p} · ${fam}: ${fmtMinutos(c.minutos)} en ${c.pasos} paso${c.pasos === 1 ? "" : "s"}` : `${p} · ${fam}: sin trabajo`}
                  style={{ height: 22, borderRadius: 3, background: c ? `rgba(20,20,26,${(0.10 + 0.7 * (c.minutos / max)).toFixed(3)})` : "rgba(20,20,26,.03)" }} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function TabEquipo({ d }: { d: EquipoPanel }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Personas activas" value={fmtAR(k.personasActivas)} sub="trabajaron en el período" />
        <Kpi label="Horas productivas" value={fmtAR(k.minutosProductivos / 60, 1)} sub="cronometradas en pasos" hint="Suma de tramos de trabajo; no es asistencia" />
        <Kpi label="Pasos completados" value={fmtAR(k.pasosCompletados)} />
        <Kpi label="Tiempo medido" value={pct(k.medidoPct, 0)} sub="disciplina de registro" hint="Pasos cuyo tiempo salió del cronómetro; habilita todas las demás métricas" />
        <Kpi label="Vendedores" value={fmtAR(k.vendedoresActivos)} sub="con ventas en el período" />
      </div>
      <div className="dash-grid">
        <Card span={7} title="Trabajo por persona" sub="tiempo cronometrado, no asistencia" flush>
          {d.personas.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin tramos de trabajo en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Persona</th><th className="right">Pasos</th><th className="right">Días</th><th className="right">Familias</th><th className="right">Tiempo</th></tr></thead>
              <tbody>{d.personas.map((p) => (
                <tr key={p.id ?? p.nombre}>
                  <td><div className="nm">{p.nombre}</div>{p.autoPausas > 0 ? <div className="sub">{p.autoPausas} auto-pausa{p.autoPausas === 1 ? "" : "s"} (cronómetro olvidado)</div> : null}</td>
                  <td className="right mono">{p.pasos}</td>
                  <td className="right mono">{p.dias}</td>
                  <td className="right mono">{p.familias}</td>
                  <td className="right mono" style={{ fontWeight: 600 }}>{fmtMinutos(p.minutos)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card span={5} title="Disciplina de registro" sub="calidad del tiempo de los pasos de cada uno">
          {d.disciplina.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin pasos completados en el período.</div> : (
            <>
              {d.disciplina.map((p) => (
                <div key={p.id ?? p.nombre} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>{p.nombre}</span>
                    <span className="mono" style={{ color: p.medidoPct >= 70 ? "var(--ok)" : "var(--muted-text)" }}>{pct(p.medidoPct, 0)} medido · {p.pasos} pasos</span>
                  </div>
                  <StackedHBar height={10} segments={FUENTE_DISCIPLINA_COLORS.map((f) => ({ value: p[f.key], color: f.color, label: f.label }))} />
                </div>
              ))}
              <div className="d-legend" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {FUENTE_DISCIPLINA_COLORS.map((f) => <LegendDot key={f.key} color={f.color} label={f.label} />)}
              </div>
            </>
          )}
        </Card>
        <Card span={7} title="Eficiencia vs. cotizado" sub="tendencia de cada uno contra sí mismo — no es un ranking" flush
          foot={<span>Sólo con {d.muestraMinima}+ pasos medidos en el período: con menos muestra el número es ruido, no desempeño. Orden alfabético.</span>}>
          {d.eficiencia.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin pasos medidos en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Persona</th><th className="right">Pasos medidos</th><th>Tendencia semanal</th><th style={{ width: 100 }} /><th className="right">vs. cotizado</th></tr></thead>
              <tbody>{d.eficiencia.map((p) => {
                const conDato = p.desvioPct != null;
                return (
                  <tr key={p.id ?? p.nombre}>
                    <td><div className="nm">{p.nombre}</div></td>
                    <td className="right mono" style={{ opacity: conDato ? 1 : 0.5 }}>{p.muestras}</td>
                    <td>{conDato && p.serie.length >= 2 ? <Sparkline values={p.serie.map((s) => s.desvioPct)} signal={(p.serie[p.serie.length - 1]?.desvioPct ?? 0) > 10} /> : <span style={{ fontSize: 11, color: "var(--muted-text)" }}>—</span>}</td>
                    <td>{conDato ? <BarraDesvio desvioPct={p.desvioPct} /> : null}</td>
                    <td className="right">
                      {conDato ? (
                        <span className="mono" style={{ fontWeight: 600, color: Math.abs(p.desvioPct!) <= 10 ? "var(--muted-text)" : p.desvioPct! > 0 ? "var(--signal)" : "var(--ok)" }}>{p.desvioPct! > 0 ? "+" : ""}{fmtAR(p.desvioPct!, 0)}%</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted-text)" }}>pocos datos ({p.muestras}/{d.muestraMinima})</span>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </Card>
        <Card span={5} title="Polivalencia observada" sub="quién trabajó en qué familia (minutos)">
          <MatrizPolivalencia celdas={d.polivalencia} />
          {d.familiasSinRespaldo.length > 0 ? (
            <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--signal)" }}>
              Sin respaldo: {d.familiasSinRespaldo.map((f) => `${f.familia} (sólo ${f.persona.split(" ")[0]})`).join(" · ")}
            </div>
          ) : null}
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted-text)" }}>Más oscuro = más tiempo. Una familia con una sola persona es un riesgo de cobertura.</div>
        </Card>
        <Card span={12} title="Vendedores" sub="venta, margen y comisión estimada del período · sin IVA" flush>
          {d.vendedores.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin ventas en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Vendedor</th><th className="right">Órdenes</th><th className="right">Ticket</th><th className="right">Margen</th><th className="right">Ventas</th><th className="right" title="Reglas de comisión configuradas aplicadas a la venta; no es liquidación">Comisión est.</th></tr></thead>
              <tbody>{d.vendedores.map((v) => (
                <tr key={v.empleadoId ?? v.nombre}>
                  <td><div className="nm">{v.nombre}</div>{v.itemsSinCosto > 0 ? <div className="sub">{v.itemsSinCosto} item{v.itemsSinCosto === 1 ? "" : "s"} sin costo (fuera del margen)</div> : null}</td>
                  <td className="right mono">{v.ordenes}</td>
                  <td className="right mono">{abreviarMoneda(v.ticketPromedio, moneda)}</td>
                  <td className="right mono" style={{ color: "var(--ok)" }}>{v.margenPct != null ? pct(v.margenPct) : "—"}</td>
                  <td className="right mono" style={{ fontWeight: 600 }}>{abreviarMoneda(v.facturado, moneda)}</td>
                  <td className="right mono">{v.comisionEstimada != null ? abreviarMoneda(v.comisionEstimada, moneda) : <span style={{ color: "var(--muted-text)" }}>sin regla</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Clientes ═══════════ */
/** Regla de cada segmento, con los umbrales reales (diasActivo configurable). */
function segmentoRfmMeta(diasActivo: number): Record<string, { label: string; regla: string }> {
  const lejos = diasActivo * 3;
  return {
    campeones: { label: "Campeones", regla: `4+ compras · la última hace ≤${diasActivo} días` },
    leales: { label: "Leales", regla: `2-3 compras · la última hace ≤${diasActivo} días` },
    nuevos: { label: "Nuevos", regla: `primera compra hace ≤${diasActivo} días` },
    en_riesgo: { label: "En riesgo", regla: `2+ compras · sin comprar hace ${diasActivo + 1}-${lejos} días` },
    perdidos: { label: "Perdidos", regla: `2+ compras · sin comprar hace más de ${lejos} días` },
    ocasionales: { label: "Ocasionales", regla: `una sola compra · hace más de ${diasActivo} días` },
  };
}
const SEGMENTO_RFM_COLOR: Record<string, string> = {
  campeones: "var(--ok)", leales: "var(--ink)", nuevos: "#3a9ca0",
  en_riesgo: "#d97757", perdidos: "var(--signal)", ocasionales: "#c8c6c0",
};

export function TabClientes({ d }: { d: ClientesPanel }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const serieNR = d.serieNuevosRecurrentes;
  const maxSeg = Math.max(...d.rfm.segmentos.map((s) => s.clientes), 1);
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Clientes activos" value={fmtAR(k.activos)} sub="compraron en el período" />
        <Kpi label="Retención" value={pct(k.retencionPct, 0)} sub="del período anterior que volvieron" hint="Clientes del período anterior equivalente que también compraron en éste" />
        <Kpi label="Recompra" value={k.frecuenciaMedianaDias != null ? `${fmtAR(k.frecuenciaMedianaDias, 0)} d` : "—"} sub="mediana entre compras" />
        <Kpi label="Clientes nuevos" value={fmtAR(k.nuevos)} sub={`${fmtAR(k.recurrentes)} recurrentes`} />
        <Kpi label="Concentración top 3" value={pct(k.concentracionTop3Pct, 0)} deltaTone="signal" sub="de la venta del período" hint="Cuánto de tus ventas (sin IVA) dependen de sólo 3 clientes" />
      </div>
      <div className="dash-grid">
        <Card span={7} title="Nuevos vs. recurrentes" sub="de dónde viene la venta de cada período"
          foot={<span>La barra clara es venta de clientes captados en ese período; la oscura, de los que ya tenías.</span>}>
          {serieNR.length >= 2 ? (
            <>
              <BarChart labels={serieNR.map((s) => s.fecha.slice(5))} data={[serieNR.map((s) => s.recurrentes), serieNR.map((s) => s.nuevos)]} mode="stack" stacks={["Recurrentes", "Nuevos"]} colors={["var(--ink)", "#8aa896"]} yFormat={(v) => abreviarMoneda(v, moneda)} height={220} />
              <div className="d-legend" style={{ marginTop: 10 }}>
                <LegendDot color="var(--ink)" label="Recurrentes" />
                <LegendDot color="#8aa896" label="Nuevos" />
              </div>
            </>
          ) : <div className="d-empty" style={{ padding: 40 }}>Serie insuficiente: probá “Trimestre” o “Año”.</div>}
        </Card>
        <Card span={5} title="Segmentos de cartera" sub="según cuándo y cuánto compró cada cliente">
          {d.rfm.segmentos.map((s) => {
            const meta = segmentoRfmMeta(d.rfm.diasActivo)[s.segmento];
            return (
              <div key={s.segmento} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, marginBottom: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: SEGMENTO_RFM_COLOR[s.segmento] ?? "var(--ink)" }} />
                    {meta?.label ?? s.segmento}
                  </span>
                  <span className="mono" style={{ color: "var(--muted-text)" }}>{s.clientes} · {abreviarMoneda(s.facturado, moneda)} hist.</span>
                </div>
                {meta ? <div style={{ fontSize: 10.5, color: "var(--muted-text)", marginLeft: 14, marginBottom: 4 }}>{meta.regla}</div> : null}
                <HBar value={s.clientes} max={maxSeg} tone={s.segmento === "en_riesgo" || s.segmento === "perdidos" ? "signal" : s.segmento === "campeones" ? "ok" : "ink"} />
              </div>
            );
          })}
        </Card>
        <Card span={7} title="Concentración de cartera" sub="quiénes explican tus ventas del período · sin IVA" flush>
          {d.pareto.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin ventas con cliente en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Órdenes</th><th className="right">Ventas</th><th className="right">%</th><th className="right">% acum.</th></tr></thead>
              <tbody>{d.pareto.map((c) => (
                <tr key={c.clienteId}><td><div className="nm">{c.cliente}</div></td>
                  <td className="right mono">{c.ordenes}</td>
                  <td className="right mono">{abreviarMoneda(c.facturado, moneda)}</td>
                  <td className="right mono">{pct(c.pct, 0)}</td>
                  <td className="right mono" style={{ color: c.pctAcumulado >= 80 ? "var(--muted-text)" : "var(--ink)", fontWeight: 600 }}>{pct(c.pctAcumulado, 0)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card span={5} title="Clientes en riesgo" sub="recurrentes que están dejando de comprar" flush>
          {d.rfm.enRiesgo.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Ningún recurrente en zona de riesgo.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Sin comprar</th><th className="right">Histórico</th></tr></thead>
              <tbody>{d.rfm.enRiesgo.map((c) => (
                <tr key={c.clienteId}><td><div className="nm">{c.cliente}</div><div className="sub">{c.ordenes} órdenes · última {c.ultimaCompra}</div></td>
                  <td className="right mono" style={{ color: "var(--signal)" }}>{c.diasSinComprar} d</td>
                  <td className="right mono">{abreviarMoneda(c.facturadoHistorico, moneda)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card span={12} title="Margen por cliente" sub="quién vende mucho y margina poco · sin IVA" flush>
          {d.margenClientes.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin ventas en el período.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Órdenes</th><th className="right">Ventas</th><th className="right">Margen</th><th className="right">Margen %</th></tr></thead>
              <tbody>{d.margenClientes.map((c) => (
                <tr key={c.clienteId ?? c.cliente}>
                  <td><div className="nm">{c.cliente}</div>{c.itemsSinCosto > 0 ? <div className="sub">{c.itemsSinCosto} item{c.itemsSinCosto === 1 ? "" : "s"} sin costo snapshoteado (fuera del margen)</div> : null}</td>
                  <td className="right mono">{c.ordenes}</td>
                  <td className="right mono">{abreviarMoneda(c.ventas, moneda)}</td>
                  <td className="right mono">{abreviarMoneda(c.margen, moneda)}</td>
                  <td className="right">{c.margenPct != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <div style={{ width: 60 }}><HBar value={c.margenPct} max={70} tone={c.margenPct >= 50 ? "ok" : c.margenPct >= 40 ? "ink" : "signal"} /></div>
                      <span className="mono" style={{ width: 42 }}>{pct(c.margenPct)}</span>
                    </div>
                  ) : <span className="mono">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ Pie de fuente ═══════════ */
/**
 * La letra chica de cada reporte: de dónde salen los números y qué NO
 * incluyen. La regla de la casa es que un reporte declare su fuente y sus
 * límites antes que quede lindo — un dato sin contexto se lee como verdad.
 */
export function MetaPie({ meta }: { meta: MetaPanel | undefined }) {
  if (!meta || meta.limites.length === 0) return null;
  return (
    <div style={{ fontSize: 11, color: "var(--muted-text)", lineHeight: 1.5, marginTop: 4 }}>
      <strong>Fuente:</strong> {meta.fuente}. {meta.limites.join(" ")}
      {meta.sinComparativa ? " Sin período anterior para comparar." : ""}
    </div>
  );
}

/* ═══════════ REPORTE · Costo laboral ═══════════ */
