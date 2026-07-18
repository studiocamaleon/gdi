"use client";

/**
 * Panel general (Inteligencia de negocio) — portado VERBATIM del diseño
 * del usuario (Grafoprint: panel.jsx/panel-tabs.jsx/panel-charts.jsx),
 * conectado a los contratos reales de panel-api.ts. Clases .dash/.d-* y
 * primitivos de gráfico idénticos al diseño. Ver docs/reportes-panel-analisis-diseno.md
 */

import * as React from "react";
import {
  LayoutGridIcon,
  BriefcaseIcon,
  FactoryIcon,
  CircleDollarSignIcon,
  PackageIcon,
} from "lucide-react";
import {
  getPanelComercial,
  getPanelFinanzas,
  getPanelProduccion,
  getPanelProducto,
  getPanelResumen,
  type AlertaPanel,
  type CobranzaPanel,
  type ComercialPanel,
  type MetaPanel,
  type ProduccionPanel,
  type ProductoPanel,
  type RangoPanel,
  type RankingPanel,
  type RentabilidadPanel,
  type ResumenProduccionKpis,
} from "@/lib/panel-api";

/* ─── Formato es-AR ─── */
const fmtAR = (n: number, d = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtK(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 100e3 ? 0 : 1).replace(".0", "") + "k";
  return fmtAR(n);
}
const pct = (n: number | null | undefined, d = 1) =>
  n == null ? "—" : `${fmtAR(n, d).replace(/,0$/, "")}%`;

/* ═══════════ Chart primitives (verbatim del diseño) ═══════════ */

function Sparkline({ values, height = 28, width = 84, signal = false }: { values: number[]; height?: number; width?: number; signal?: boolean }) {
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

function AreaChart({ series, labels, height = 220, yFormat = (v: number) => String(v), secondary }: { series: number[]; labels: string[]; height?: number; yFormat?: (v: number) => string; secondary?: number[] }) {
  const W = 800, H = height, padL = 44, padR = 8, padT = 18, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const all = secondary ? [...series, ...secondary] : series;
  const max = Math.max(...all) * 1.08, min = Math.min(0, Math.min(...all)), range = max - min || 1;
  const step = innerW / Math.max(1, series.length - 1);
  const xy = (arr: number[]) => arr.map((v, i) => [padL + i * step, padT + innerH - ((v - min) / range) * innerH] as const);
  const pts = xy(series), pts2 = secondary ? xy(secondary) : null;
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${padT + innerH} L${pts[0][0].toFixed(1)} ${padT + innerH} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  return (
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
      {pts2 ? <path d={pts2.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--muted-text-2)" strokeWidth="1.4" strokeDasharray="3 3" /> : null}
      <path d={area} fill="rgba(20,20,26,.06)" />
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--ink)" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="6" fill="var(--ink)" opacity=".12" />
    </svg>
  );
}

function BarChart({ data, labels, height = 220, yFormat = (v: number) => String(v), mode = "stack", colors }: { data: number[][]; labels: string[]; height?: number; yFormat?: (v: number) => string; mode?: "stack" | "group"; colors?: string[]; stacks?: string[] }) {
  const W = 800, H = height, padL = 44, padR = 8, padT = 18, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const stackCount = data.length, barCount = data[0]?.length ?? 0;
  const groupW = innerW / Math.max(1, barCount);
  const defaults = ["var(--ink)", "#6e6e76", "#c8c6c0", "var(--signal)"];
  const col = (i: number) => colors?.[i] ?? defaults[i % defaults.length];
  const max = (mode === "stack"
    ? Math.max(...labels.map((_, i) => data.reduce((s, st) => s + (st[i] ?? 0), 0)))
    : Math.max(...data.flat())) * 1.12 || 1;
  const ticks = Array.from({ length: 5 }, (_, i) => (max * i) / 4);
  return (
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
        if (mode === "stack") {
          const barW = Math.min(28, groupW * 0.55);
          let accY = padT + innerH;
          return (
            <g key={bi}>
              {data.map((st, si) => { const h = ((st[bi] ?? 0) / max) * innerH; accY -= h; return <rect key={si} x={cx - barW / 2} y={accY} width={barW} height={h} fill={col(si)} rx="1.5" />; })}
              <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
            </g>
          );
        }
        const barW = Math.min(10, (groupW * 0.7) / stackCount);
        const totalW = barW * stackCount + 2 * (stackCount - 1);
        return (
          <g key={bi}>
            {data.map((st, si) => { const h = ((st[bi] ?? 0) / max) * innerH; return <rect key={si} x={cx - totalW / 2 + si * (barW + 2)} y={padT + innerH - h} width={barW} height={h} fill={col(si)} rx="1.5" />; })}
            <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{lab}</text>
          </g>
        );
      })}
    </svg>
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

function HBar({ value, max, tone = "ink" }: { value: number; max: number; tone?: "ink" | "ok" | "signal" | "muted" }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const colors = { ink: "var(--ink)", ok: "var(--ok)", signal: "var(--signal)", muted: "var(--muted-text-2)" };
  return <div className="d-hbar"><span style={{ width: `${p * 100}%`, background: colors[tone] }} /></div>;
}

function StackedHBar({ segments, height = 18 }: { segments: Array<{ value: number; color: string; label: string }>; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return <div className="d-shbar" style={{ height }}>{segments.map((s, i) => s.value > 0 ? <span key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} /> : null)}</div>;
}

function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
  return <div className="d-legend-item"><span className="d-legend-dot" style={{ background: color }} /><span className="lbl">{label}</span>{value != null ? <span className="val mono">{value}</span> : null}</div>;
}

/* ─── KPI (verbatim del diseño) ─── */
function Kpi({ label, value, currency, sub, delta, deltaUnit = "%", deltaTone = "auto", spark, sparkSignal, hint }: { label: string; value: React.ReactNode; currency?: string; sub?: string; delta?: number | null; deltaUnit?: string; deltaTone?: "auto" | "ok" | "signal" | "muted" | "inverse"; spark?: number[]; sparkSignal?: boolean; hint?: string }) {
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
function Card({ span, title, sub, action, flush, foot, children }: { span: number; title: string; sub?: string; action?: React.ReactNode; flush?: boolean; foot?: React.ReactNode; children: React.ReactNode }) {
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
  const max = Math.max(...rows.map((r) => r.facturado), 1);
  if (rows.length === 0) return <div className="d-empty" style={{ padding: 30 }}>Sin datos en el período.</div>;
  return (
    <div className="d-rank">
      {rows.map((r, i) => (
        <div key={r.id ?? r.nombre} className="d-rank-row" style={{ gridTemplateColumns: cols }}>
          <span className="ix">{String(i + 1).padStart(2, "0")}</span>
          <div className="body">
            <div className="nm">{r.nombre}</div>
            <div className="sub">{r.ordenes} órden{r.ordenes === 1 ? "" : "es"} · ticket ${fmtK(r.ordenes > 0 ? r.facturado / r.ordenes : 0)}</div>
            <div className="bar-cell"><HBar value={r.facturado} max={max} /></div>
          </div>
          <span className="val">${fmtK(r.facturado)}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ TAB · Resumen ═══════════ */
type ResumenData = {
  meta: MetaPanel;
  rentabilidad: RentabilidadPanel;
  produccion: ResumenProduccionKpis;
  serie: Array<{ fecha: string; monto: number; costo: number }>;
  topClientes: RankingPanel[];
  topProductos: Array<{ nombre: string; ventas: number; margenPct: number; items: number }>;
  alertas: AlertaPanel[];
};

function TabResumen({ d }: { d: ResumenData }) {
  const r = d.rentabilidad;
  const labels = d.serie.map((s) => s.fecha.slice(5));
  const costos = d.serie.map((s) => s.costo);
  const margenes = d.serie.map((s) => Math.max(0, s.monto - s.costo));
  const spark = d.serie.map((s) => s.monto);
  const ytd = d.serie.reduce((a, s) => a + s.monto, 0);
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Facturación" currency="$" value={fmtK(r.ventas)} delta={r.ventasDeltaPct} sub="vs período anterior" spark={spark} />
        <Kpi label="Margen bruto" value={pct(r.margenBrutoPct)} delta={r.margenBrutoDeltaPts} deltaUnit="pts" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} delta={r.contribucionDeltaPts} deltaUnit="pts" hint="Ventas menos costos variables (material + tintas)" />
        <Kpi label="Punto de equilibrio" currency="$" value={r.puntoEquilibrio != null ? fmtK(r.puntoEquilibrio) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : "sin costos fijos"} />
        <Kpi label="Entregas a tiempo" value={pct(d.produccion.otdPct)} sub="OTD del período" />
      </div>

      <div className="dash-grid">
        <Card span={8} title="Facturación, costo y margen" sub={`serie ${d.meta.granularidad} · pesos`}
          foot={<><span>Total facturado <strong style={{ color: "var(--ink)" }}>${fmtAR(ytd)}</strong></span><span style={{ marginLeft: "auto" }}>Contribución <strong style={{ color: "var(--ok)" }}>{pct(r.contribucionPct)}</strong></span></>}>
          {d.serie.length >= 2 ? (
            <>
              <BarChart labels={labels} data={[costos, margenes]} stacks={["Costo", "Margen"]} mode="stack" colors={["#c8c6c0", "var(--ink)"]} yFormat={(v) => `$${fmtK(v)}`} height={240} />
              <div className="d-legend" style={{ marginTop: 10 }}>
                <LegendDot color="var(--ink)" label="Margen bruto" value={`$${fmtK(r.margenBruto)}`} />
                <LegendDot color="#c8c6c0" label="Costo directo" value={`$${fmtK(r.costoTotal ?? 0)}`} />
              </div>
            </>
          ) : <div className="d-empty" style={{ padding: 40 }}>El período no tiene serie suficiente para graficar.</div>}
        </Card>

        <Card span={4} title="Punto de equilibrio" sub="cuánto de tu estructura cubriste">
          {r.puntoEquilibrio != null && r.avancePct != null ? (
            <div className="d-gauge-row">
              <DonutRing value={Math.min(100, r.avancePct)} label={pct(r.avancePct)} sub="del equilibrio" tone={r.avancePct < 100 ? "signal" : "ok"} />
              <div className="meta">
                <div className="ttl">Necesitás ${fmtK(r.puntoEquilibrio)}/período</div>
                <div className="sub">para cubrir tu estructura fija</div>
                <div className="breakdown">
                  <div className="row"><span className="d-pip ok" /><span className="nm">Facturado</span><span className="val">${fmtK(r.ventas)}</span></div>
                  <div className="row"><span className="d-pip" /><span className="nm">Costos fijos</span><span className="val">${fmtK(r.costosFijos ?? 0)}</span></div>
                </div>
              </div>
            </div>
          ) : <div className="d-empty" style={{ padding: 30 }}>Cargá los costos fijos de tus centros para ver el punto de equilibrio.</div>}
        </Card>

        <Card span={6} title="Clientes principales" sub="por facturación" flush><RankList rows={d.topClientes} cols="18px 1fr 90px" /></Card>

        <Card span={6} title="Productos con mayor facturación" sub="con su margen" flush>
          <table className="d-tbl">
            <thead><tr><th>Producto</th><th className="right">Margen</th><th className="right">Facturado</th></tr></thead>
            <tbody>{d.topProductos.map((p) => (
              <tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td>
                <td className="right"><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><div style={{ width: 60 }}><HBar value={p.margenPct} max={70} tone={p.margenPct >= 50 ? "ok" : p.margenPct >= 40 ? "ink" : "signal"} /></div><span className="mono" style={{ width: 42 }}>{pct(p.margenPct)}</span></div></td>
                <td className="right mono">${fmtK(p.ventas)}</td></tr>
            ))}</tbody>
          </table>
        </Card>

        <Card span={12} title="Alertas activas" sub="requieren acción" flush action={<span className="d-kpi-sub">{d.alertas.length} activa{d.alertas.length === 1 ? "" : "s"}</span>}><InsightsList alertas={d.alertas} /></Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Comercial ═══════════ */
function TabComercial({ d }: { d: ComercialPanel }) {
  const k = d.kpis;
  const labels = d.serie.map((s) => s.fecha.slice(5));
  const maxCatMix = Math.max(...d.mixCategoria.map((m) => m.monto), 1);
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Ventas" currency="$" value={fmtK(k.ventas)} delta={k.ventasDeltaPct} spark={d.serie.map((s) => s.monto)} />
        <Kpi label="Órdenes" value={fmtAR(k.ordenes)} delta={k.ordenesDeltaPct} />
        <Kpi label="Ticket promedio" currency="$" value={fmtK(k.ticketPromedio)} />
        <Kpi label="Clientes nuevos" value={fmtAR(k.nuevosClientes)} delta={k.nuevosClientes} deltaTone="ok" sub="este período" />
        <Kpi label="Clientes dormidos" value={fmtAR(k.clientesDormidos)} deltaTone="signal" delta={k.clientesDormidos > 0 ? k.clientesDormidos : undefined} sub="sin comprar" />
      </div>
      <div className="dash-grid">
        <Card span={8} title="Ventas del período" sub={`serie ${d.granularidad}`} foot={<span>Ticket promedio <strong style={{ color: "var(--ink)" }}>${fmtK(k.ticketPromedio)}</strong> · {k.itemsPorOrden} items/orden</span>}>
          {d.serie.length >= 2 ? <AreaChart series={d.serie.map((s) => s.monto)} labels={labels} yFormat={(v) => `$${fmtK(v)}`} height={230} /> : <div className="d-empty" style={{ padding: 40 }}>Serie insuficiente.</div>}
        </Card>
        <Card span={4} title="Mix por categoría" sub="participación">
          {d.mixCategoria.map((m) => (
            <div key={m.nombre} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>{pct(m.pct)}</span></div>
              <HBar value={m.monto} max={maxCatMix} />
            </div>
          ))}
        </Card>
        <Card span={6} title="Clientes principales" flush><RankList rows={d.rankingClientes} /></Card>
        <Card span={6} title="Ranking de vendedores" flush><RankList rows={d.rankingVendedores} /></Card>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>{pct(m.pct)}</span></div>
              <HBar value={m.pct} max={100} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Producción ═══════════ */
function TabProduccion({ d }: { d: ProduccionPanel }) {
  const k = d.kpis;
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
          {d.throughput.length >= 2 ? <AreaChart series={d.throughput.map((t) => t.cantidad)} labels={d.throughput.map((t) => t.fecha.slice(5))} yFormat={(v) => String(Math.round(v))} height={220} /> : <BarChart labels={d.throughput.map((t) => t.fecha.slice(5))} data={[d.throughput.map((t) => t.cantidad)]} stacks={["Pasos"]} height={200} />}
        </Card>
        <Card span={7} title="Precisión de estimación" sub="tiempo real vs. cotizado por familia" flush>
          <table className="d-tbl"><thead><tr><th>Familia</th><th className="right">Cotizado</th><th className="right">Real</th><th className="right">Razón</th><th className="right">n</th></tr></thead>
            <tbody>{d.eficiencia.porFamilia.map((f) => (<tr key={f.familia}><td><div className="nm">{f.familia}</div></td><td className="right mono">{fmtAR(f.estimadoMin, 0)}m</td><td className="right mono">{fmtAR(f.realMin, 1)}m</td><td className="right mono" style={{ color: (f.razon ?? 0) > 1.5 ? "var(--signal)" : "var(--ink)", fontWeight: 600 }}>{f.razon != null ? `${fmtAR(f.razon, 2)}×` : "—"}</td><td className="right mono" style={{ opacity: f.muestras < 3 ? 0.45 : 1 }}>{f.muestras}</td></tr>))}</tbody>
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
      </div>
    </>
  );
}

/* ═══════════ TAB · Finanzas ═══════════ */
type FinanzasData = { meta: MetaPanel; rentabilidad: RentabilidadPanel; cobranza: CobranzaPanel };
const AGING_COLORS: Record<string, string> = { "0-30": "var(--ok)", "31-60": "#c8c6c0", "61-90": "#d97757", "+90": "var(--signal)" };
function TabFinanzas({ d }: { d: FinanzasData }) {
  const r = d.rentabilidad, co = d.cobranza;
  const gasto = r.gastoPorCentro ?? [];
  return (
    <>
      <div className="d-kpi-row">
        <Kpi label="Facturado" currency="$" value={fmtK(co.facturado)} sub="comprobantes emitidos" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} sub="margen de contribución" />
        <Kpi label="Punto de equilibrio" currency="$" value={r.puntoEquilibrio != null ? fmtK(r.puntoEquilibrio) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : undefined} />
        <Kpi label="Cuentas por cobrar" currency="$" value={fmtK(co.agingTotal)} sub={`DSO ${co.dso != null ? fmtAR(co.dso) : "—"} días`} />
        <Kpi label="Costo de cobrar" currency="$" value={fmtK(co.comisionTotal)} deltaTone="signal" sub="comisiones del período" />
      </div>
      <div className="dash-grid">
        <Card span={8} title="Facturación vs costo" sub={`serie ${d.meta.granularidad}`}
          action={<div className="d-legend"><LegendDot color="var(--ink)" label="Facturación" value={`$${fmtK(r.ventas)}`} /><LegendDot color="#c8c6c0" label="Costo" value={`$${fmtK(r.costoTotal ?? 0)}`} /></div>}>
          <FacturacionVsCosto rentabilidad={r} meta={d.meta} />
        </Card>
        <Card span={4} title="Cuentas por cobrar" sub="por antigüedad" foot={<><span className="d-pip warn" />Vencido <strong style={{ color: "var(--signal)" }}>${fmtAR(co.vencido)}</strong></>}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>${fmtAR(co.agingTotal)}</span>
            <span style={{ fontSize: 11.5, color: "var(--muted-text)" }}>total a cobrar</span>
          </div>
          <StackedHBar segments={co.aging.map((a) => ({ value: a.monto, color: AGING_COLORS[a.franja], label: a.franja }))} />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {co.aging.map((a) => (
              <div key={a.franja} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: AGING_COLORS[a.franja] }} />
                <span style={{ color: "var(--ink-2)", flex: 1 }}>{a.franja} días</span>
                <span className="mono" style={{ color: "var(--muted-text)" }}>{co.agingTotal > 0 ? pct((a.monto / co.agingTotal) * 100) : "0%"}</span>
                <span className="mono" style={{ color: "var(--ink)", fontWeight: 500, width: 90, textAlign: "right" }}>${fmtAR(a.monto)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card span={7} title="Costo de cobrar" sub="comisiones por método de pago" flush>
          <table className="d-tbl"><thead><tr><th>Método</th><th className="right">Cobros</th><th className="right">Bruto</th><th className="right">Comisión</th><th className="right">%</th></tr></thead>
            <tbody>{co.costoCobrar.map((m) => (<tr key={m.metodo}><td><div className="nm">{m.metodo}</div></td><td className="right mono">{m.cantidad}</td><td className="right mono">${fmtK(m.bruto)}</td><td className="right mono" style={{ color: m.comision > 0 ? "var(--signal)" : "var(--muted-text)", fontWeight: 600 }}>${fmtK(m.comision)}</td><td className="right mono">{pct(m.pct)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={5} title="Gasto por centro de costo" sub="estructura del período">
          <div className="d-gauge-row">
            <StackedRing segments={gasto.map((g) => g.monto)} label={`$${fmtK(r.costosFijos ?? 0)}`} sub="costo fijo" />
            <div className="meta" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {gasto.slice(0, 6).map((g, i) => (
                <div key={g.centroId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG_COLORS[i % SEG_COLORS.length] }} />
                  <span style={{ color: "var(--ink-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.centro}</span>
                  <span className="mono" style={{ color: "var(--muted-text)" }}>{pct(g.pct)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card span={12} title="Deudores principales" sub="prioridad de cobranza" flush>
          {co.deudores.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin deuda pendiente.</div> : (
            <table className="d-tbl"><thead><tr><th>Cliente</th><th className="right">Saldo</th><th className="right">Días máx.</th><th style={{ width: 200 }}>Distribución</th></tr></thead>
              <tbody>{co.deudores.map((x) => (<tr key={x.clienteId ?? x.cliente}><td><div className="nm">{x.cliente}</div></td><td className="right mono" style={{ fontWeight: 600 }}>${fmtAR(x.saldo)}</td><td className="right mono" style={{ color: x.diasMax > 60 ? "var(--signal)" : "var(--ink)" }}>{x.diasMax} d</td><td style={{ width: 200 }}><StackedHBar height={10} segments={(["0-30", "31-60", "61-90", "+90"] as const).map((f) => ({ value: x.porFranja[f], color: AGING_COLORS[f], label: f }))} /></td></tr>))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function FacturacionVsCosto({ rentabilidad: r, meta }: { rentabilidad: RentabilidadPanel; meta: MetaPanel }) {
  // Con un solo período agregado, se muestra el par facturación/costo como
  // barras agrupadas (el período no trae serie de costo mensual aún).
  return (
    <BarChart labels={[meta.rango.desde.slice(5)]} data={[[r.ventas], [r.costoTotal ?? 0]]} stacks={["Facturación", "Costo"]} mode="group" colors={["var(--ink)", "#c8c6c0"]} yFormat={(v) => `$${fmtK(v)}`} height={230} />
  );
}

/* ═══════════ TAB · Ventas & Producto ═══════════ */
function TabProducto({ d }: { d: ProductoPanel }) {
  const fmtMed = (a: number, alto: number) => `${fmtAR(a / 10, 0)}×${fmtAR(alto / 10, 0)} cm`;
  const maxTec = Math.max(...d.porTecnologia.map((m) => m.monto), 1);
  return (
    <div className="dash-grid">
      <Card span={6} title="Ventas por categoría" sub="con margen" flush>
        <table className="d-tbl"><thead><tr><th>Categoría</th><th className="right">Margen</th><th className="right">Ventas</th></tr></thead>
          <tbody>{d.porCategoria.map((c) => (<tr key={c.nombre}><td><div className="nm">{c.nombre}</div></td><td className="right"><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><div style={{ width: 50 }}><HBar value={c.margenPct} max={70} tone={c.margenPct >= 50 ? "ok" : c.margenPct >= 40 ? "ink" : "signal"} /></div><span className="mono" style={{ width: 42 }}>{pct(c.margenPct)}</span></div></td><td className="right mono">${fmtK(c.ventas)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={6} title="Productos más vendidos" sub="volumen y margen" flush>
        <table className="d-tbl"><thead><tr><th>Producto</th><th className="right">Items</th><th className="right">Margen</th><th className="right">Ventas</th></tr></thead>
          <tbody>{d.porProducto.slice(0, 8).map((p) => (<tr key={p.nombre}><td><div className="nm">{p.nombre}</div></td><td className="right mono">{p.items}</td><td className="right mono">{pct(p.margenPct)}</td><td className="right mono">${fmtK(p.ventas)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={7} title="Uso de papel y material" sub="consumo teórico del período" flush>
        <table className="d-tbl"><thead><tr><th>Material</th><th className="right">Cantidad</th><th className="right">Trabajos</th><th className="right">Costo</th></tr></thead>
          <tbody>{d.porPapel.map((m) => (<tr key={m.material}><td><div className="nm">{m.material}</div></td><td className="right mono">{fmtAR(m.cantidad, 1)} {m.unidad}</td><td className="right mono">{m.items}</td><td className="right mono">${fmtK(m.costo)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={5} title="Medidas más vendidas" sub={`${fmtAR(d.totalM2, 1)} m² totales`} flush>
        <table className="d-tbl"><thead><tr><th>Medida</th><th className="right">Unidades</th><th className="right">m²</th></tr></thead>
          <tbody>{d.porMedida.slice(0, 8).map((m) => (<tr key={`${m.anchoMm}x${m.altoMm}`}><td className="mono">{fmtMed(m.anchoMm, m.altoMm)}</td><td className="right mono">{fmtAR(m.unidades)}</td><td className="right mono">{fmtAR(m.m2, 2)}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={6} title="Consumo de tintas" sub="teórico, del snapshot" flush>
        <table className="d-tbl"><thead><tr><th>Tinta</th><th className="right">Cantidad</th></tr></thead>
          <tbody>{d.consumoTintas.map((m) => (<tr key={m.material}><td><div className="nm">{m.material}</div></td><td className="right mono">{fmtAR(m.cantidad, 1)} {m.unidad}</td></tr>))}</tbody>
        </table>
      </Card>
      <Card span={6} title="Mix por tecnología">
        {d.porTecnologia.map((m) => (
          <div key={m.nombre} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{m.nombre}</span><span className="mono" style={{ color: "var(--muted-text)" }}>${fmtK(m.monto)} · {pct(m.pct)}</span></div>
            <HBar value={m.monto} max={maxTec} />
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════ Shell ═══════════ */
type TabKey = "resumen" | "comercial" | "produccion" | "finanzas" | "producto";
const TABS: Array<{ key: TabKey; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = [
  { key: "resumen", label: "Resumen ejecutivo", Icon: LayoutGridIcon },
  { key: "comercial", label: "Comercial", Icon: BriefcaseIcon },
  { key: "produccion", label: "Producción", Icon: FactoryIcon },
  { key: "finanzas", label: "Finanzas", Icon: CircleDollarSignIcon },
  { key: "producto", label: "Ventas & Producto", Icon: PackageIcon },
];
type PeriodoKey = "mes" | "mesPasado" | "trimestre" | "anio";
const PERIODOS: Array<{ key: PeriodoKey; label: string }> = [
  { key: "mes", label: "Este mes" },
  { key: "mesPasado", label: "Mes pasado" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anio", label: "Año" },
];
function iso(f: Date) { return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`; }
function rangoDe(p: PeriodoKey): RangoPanel {
  const hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth();
  if (p === "mes") return {};
  if (p === "mesPasado") return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
  if (p === "trimestre") { const q = Math.floor(m / 3) * 3; return { desde: iso(new Date(y, q, 1)), hasta: iso(new Date(y, q + 3, 0)) }; }
  return { desde: iso(new Date(y, 0, 1)), hasta: iso(new Date(y, 11, 31)) };
}
const FETCHERS: Record<TabKey, (r: RangoPanel) => Promise<unknown>> = {
  resumen: getPanelResumen, comercial: getPanelComercial, produccion: getPanelProduccion, finanzas: getPanelFinanzas, producto: getPanelProducto,
};

export function PanelGeneral({ initialResumen }: { initialResumen: ResumenData }) {
  const [tab, setTab] = React.useState<TabKey>("resumen");
  const [periodo, setPeriodo] = React.useState<PeriodoKey>("mes");
  const [cache, setCache] = React.useState<Record<string, unknown>>({ "resumen|mes": initialResumen });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = `${tab}|${periodo}`;
  const data = cache[key];

  React.useEffect(() => {
    if (data) return;
    let vivo = true; setLoading(true); setError(null);
    FETCHERS[tab](rangoDe(periodo))
      .then((res) => { if (vivo) setCache((c) => ({ ...c, [key]: res })); })
      .catch((err) => { if (vivo) setError(err instanceof Error ? err.message : "No se pudo cargar el reporte."); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [key, tab, periodo, data]);

  const meta = (data as { meta?: MetaPanel } | undefined)?.meta;

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className="dash-head">
          <div className="title-block">
            <h1>Panel general</h1>
            <div className="sub">Inteligencia de negocio de tu taller, con datos reales.</div>
          </div>
          <div className="actions">
            <div className="dash-period">
              {PERIODOS.map((p) => <button key={p.key} className={periodo === p.key ? "on" : ""} onClick={() => setPeriodo(p.key)}>{p.label}</button>)}
            </div>
          </div>
        </div>

        <div className="dash-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`dash-tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
              <span className="ico"><t.Icon width={15} height={15} /></span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {error ? <div className="d-empty">{error}</div> : null}
        {loading && !data ? <div className="d-empty">Calculando el período…</div> : null}

        {data ? (
          <>
            {tab === "resumen" ? <TabResumen d={data as ResumenData} /> : null}
            {tab === "comercial" ? <TabComercial d={data as ComercialPanel} /> : null}
            {tab === "produccion" ? <TabProduccion d={data as ProduccionPanel} /> : null}
            {tab === "finanzas" ? <TabFinanzas d={data as FinanzasData} /> : null}
            {tab === "producto" ? <TabProducto d={data as ProductoPanel} /> : null}
            {meta && meta.limites.length > 0 ? (
              <div style={{ fontSize: 11, color: "var(--muted-text)", lineHeight: 1.5, marginTop: 4 }}>
                <strong>Fuente:</strong> {meta.fuente}. {meta.limites.join(" ")}{meta.sinComparativa ? " Sin período anterior para comparar." : ""}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
