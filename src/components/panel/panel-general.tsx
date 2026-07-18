"use client";

/**
 * Panel general (Inteligencia de negocio) — tabs por rol sobre datos
 * reales del módulo /reportes/panel. Estructura del diseño del usuario
 * (Grafoprint) adaptada a los contratos vivos de panel-api.ts y al sistema
 * de la app. Ver docs/reportes-panel-analisis-diseno.md
 */

import * as React from "react";
import Link from "next/link";
import {
  actualizarPanelUmbrales,
  getPanelComercial,
  getPanelFinanzas,
  getPanelProduccion,
  getPanelProducto,
  getPanelResumen,
  getPanelUmbrales,
  type AlertaPanel,
  type ComercialPanel,
  type CobranzaPanel,
  type MetaPanel,
  type ProduccionPanel,
  type ProductoPanel,
  type RangoPanel,
  type RankingPanel,
  type RentabilidadPanel,
  type UmbralesPanel,
} from "@/lib/panel-api";

/* ─── Formato es-AR ─── */
const fmt = (n: number, d = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtK(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "").replace(".", ",") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 100e3 ? 0 : 1).replace(".0", "").replace(".", ",") + "k";
  return fmt(n);
}
const pesos = (n: number) => `$${fmt(Math.round(n))}`;
const pesosK = (n: number) => `$${fmtK(n)}`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${fmt(n, 1).replace(/,0$/, "")}%`);

/* ─── Chip de delta ─── */
function Delta({ value, unit = "%", invert = false }: { value: number | null | undefined; unit?: string; invert?: boolean }) {
  if (value == null) return <span className="pg-delta none">—</span>;
  const positivo = value >= 0;
  const bueno = invert ? !positivo : positivo;
  const arrow = positivo ? "↑" : "↓";
  return (
    <span className={`pg-delta ${bueno ? "up" : "down"}`}>
      {arrow} {fmt(Math.abs(value), 1).replace(/,0$/, "")}{unit === "pts" ? " pts" : unit}
    </span>
  );
}

/* ─── KPI ─── */
function Kpi({
  label,
  value,
  delta,
  deltaUnit,
  deltaInvert,
  sub,
  tone,
  spark,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaUnit?: string;
  deltaInvert?: boolean;
  sub?: string;
  tone?: "ok" | "signal" | "warn";
  spark?: number[];
}) {
  return (
    <div className={`pg-kpi ${tone ?? ""}`}>
      <div className="pg-kpi-lbl">{label}</div>
      <div className="pg-kpi-val">{value}</div>
      <div className="pg-kpi-foot">
        {delta !== undefined ? <Delta value={delta} unit={deltaUnit} invert={deltaInvert} /> : null}
        {sub ? <span className="pg-kpi-sub">{sub}</span> : null}
        {spark && spark.length > 1 ? <span className="pg-kpi-spark"><Sparkline values={spark} /></span> : null}
      </div>
    </div>
  );
}

/* ─── Barra horizontal ─── */
function HBar({ value, max, tone = "ink" }: { value: number; max: number; tone?: "ink" | "ok" | "signal" | "warn" }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="pg-hbar">
      <span className={`fill ${tone}`} style={{ width: `${w}%` }} />
    </div>
  );
}

/* ─── Ranking ─── */
function Ranking({ rows, max }: { rows: RankingPanel[]; max: number }) {
  return (
    <div className="pg-rank">
      {rows.map((r, i) => (
        <div key={r.id ?? r.nombre} className="pg-rank-row">
          <span className="ix">{String(i + 1).padStart(2, "0")}</span>
          <div className="body">
            <div className="nm">{r.nombre}</div>
            <div className="sub">{r.ordenes} órden{r.ordenes === 1 ? "" : "es"} · ticket {pesosK(r.ordenes > 0 ? r.facturado / r.ordenes : 0)}</div>
            <HBar value={r.facturado} max={max} />
          </div>
          <span className="val mono">{pesosK(r.facturado)}</span>
        </div>
      ))}
      {rows.length === 0 ? <div className="pg-empty-sm">Sin datos en el período.</div> : null}
    </div>
  );
}

/* ─── Card de insight ─── */
function InsightCard({ a }: { a: AlertaPanel }) {
  return (
    <div className={`pg-insight ${a.severidad}`}>
      <span className="pip" />
      <div className="body">
        <div className="nm">{a.titulo}</div>
        <div className="sub">{a.detalle}</div>
      </div>
    </div>
  );
}

/* ─── Donut (gasto por centro) ─── */
const DONUT_COLORS = ["#14141a", "#4b4b55", "#7a7a84", "#a8a6a0", "#c8c6c0", "#8aa896", "#b0578f", "#c07a4a", "#3a9ca0", "#d1495b"];
function Donut({ segments, centro }: { segments: Array<{ label: string; value: number }>; centro: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const size = 132, stroke = 18, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="pg-donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const frac = total > 0 ? s.value / total : 0;
            const dash = frac * c;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="50%" y="46%" textAnchor="middle" className="pg-donut-v">{pesosK(total)}</text>
        <text x="50%" y="58%" textAnchor="middle" className="pg-donut-k">{centro}</text>
      </svg>
    </div>
  );
}

/* ─── Barra de aging apilada ─── */
function AgingBar({ aging, total }: { aging: CobranzaPanel["aging"]; total: number }) {
  const colors: Record<string, string> = { "0-30": "var(--ok)", "31-60": "#c8c6c0", "61-90": "#d97757", "+90": "var(--signal)" };
  return (
    <div className="pg-aging-bar">
      {aging.map((f) =>
        f.monto > 0 ? (
          <span key={f.franja} title={`${f.franja} días: ${pesos(f.monto)}`}
            style={{ width: `${total > 0 ? (f.monto / total) * 100 : 0}%`, background: colors[f.franja] }} />
        ) : null,
      )}
    </div>
  );
}

/* ─── Sparkline (dentro de KPIs) ─── */
function Sparkline({ values, w = 88, h = 30 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `M0 ${h} ${pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${w} ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={area} fill="rgba(20,20,26,.05)" />
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill="var(--ink)" />
    </svg>
  );
}

/* ─── AreaChart (grilla + ejes, estética del diseño) ─── */
function AreaChart({ serie, height = 210 }: { serie: Array<{ fecha: string; monto: number }>; height?: number }) {
  if (serie.length < 2) return <div className="pg-empty-sm">El período no tiene serie suficiente para graficar.</div>;
  const W = 800, H = height, padL = 52, padR = 10, padT = 16, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...serie.map((s) => s.monto)) * 1.1 || 1;
  const step = iw / (serie.length - 1);
  const xy = serie.map((s, i) => [padL + i * step, padT + ih - (s.monto / max) * ih] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${padT + ih} L${xy[0][0].toFixed(1)} ${padT + ih} Z`;
  const ticks = 4;
  const every = Math.ceil(serie.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max * i) / ticks;
        const y = padT + ih - (v / max) * ih;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--hairline, #efeeec)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-mono)">${fmtK(v)}</text>
          </g>
        );
      })}
      {serie.map((s, i) =>
        i % every === 0 || i === serie.length - 1 ? (
          <text key={i} x={padL + i * step} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{s.fecha.slice(5)}</text>
        ) : null,
      )}
      <path d={area} fill="rgba(20,20,26,.06)" />
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="3.5" fill="var(--ink)" />
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="7" fill="var(--ink)" opacity=".12" />
    </svg>
  );
}

/* ─── BarChart vertical (grilla + ejes) ─── */
function BarChart({
  data,
  height = 200,
  yFormat = (v: number) => String(Math.round(v)),
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  yFormat?: (v: number) => string;
}) {
  if (data.length === 0) return <div className="pg-empty-sm">Sin datos en el período.</div>;
  const W = 800, H = height, padL = 44, padR = 8, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value)) * 1.12 || 1;
  const groupW = iw / data.length;
  const barW = Math.min(30, groupW * 0.55);
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max * i) / ticks;
        const y = padT + ih - (v / max) * ih;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--hairline, #efeeec)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--muted-text)" fontFamily="var(--font-mono)">{yFormat(v)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = padL + groupW * i + groupW / 2;
        const h = (d.value / max) * ih;
        return (
          <g key={d.label}>
            <rect x={cx - barW / 2} y={padT + ih - h} width={barW} height={h} fill="var(--ink)" rx="2" />
            <text x={cx} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted-text)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Barra de mix ─── */
function MixList({ items, tone }: { items: Array<{ nombre: string; monto: number; pct: number }>; tone?: string }) {
  const max = Math.max(...items.map((i) => i.monto), 1);
  return (
    <div className="pg-mix">
      {items.map((m) => (
        <div key={m.nombre} className="pg-mix-row">
          <span className="nm">{m.nombre}</span>
          <div className="bar"><HBar value={m.monto} max={max} tone={(tone as "ink") ?? "ink"} /></div>
          <span className="pct mono">{pct(m.pct)}</span>
          <span className="val mono">{pesosK(m.monto)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Card contenedora ─── */
function Card({ span, title, sub, action, children }: { span: number; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`pg-card span-${span}`}>
      <div className="pg-card-head">
        <div><div className="ttl">{title}</div>{sub ? <div className="sub">{sub}</div> : null}</div>
        <div className="grow" />
        {action}
      </div>
      <div className="pg-card-body">{children}</div>
    </section>
  );
}

/* ═══════════ TAB · Resumen ═══════════ */
type ResumenData = {
  meta: MetaPanel;
  rentabilidad: RentabilidadPanel;
  produccion: { otdPct: number | null; utilizacionPct: number | null };
  serie: Array<{ fecha: string; monto: number }>;
  topClientes: RankingPanel[];
  topProductos: Array<{ nombre: string; ventas: number; margenPct: number; items: number }>;
  alertas: AlertaPanel[];
};

function TabResumen({ d }: { d: ResumenData }) {
  const r = d.rentabilidad;
  const maxCli = Math.max(...d.topClientes.map((c) => c.facturado), 1);
  const spark = d.serie.map((s) => s.monto);
  const totalSerie = spark.reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="pg-kpi-row">
        <Kpi label="Facturación" value={pesosK(r.ventas)} delta={r.ventasDeltaPct} spark={spark} />
        <Kpi label="Margen bruto" value={pct(r.margenBrutoPct)} delta={r.margenBrutoDeltaPts} deltaUnit="pts" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} delta={r.contribucionDeltaPts} deltaUnit="pts" tone="ok" />
        <Kpi label="Punto de equilibrio" value={r.puntoEquilibrio != null ? pesosK(r.puntoEquilibrio) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : "sin costos fijos"} tone={r.avancePct != null && r.avancePct < 100 ? "warn" : "ok"} />
        <Kpi label="Entregas a tiempo" value={pct(d.produccion.otdPct)} sub="OTD del período" />
        <Kpi label="Utilización taller" value={pct(d.produccion.utilizacionPct)} sub="capacidad usada" />
      </div>

      <div className="pg-grid">
        <Card span={8} title="Facturación del período" sub={`serie ${d.meta.granularidad}`}
          action={<div className="pg-card-total">Total <strong>{pesos(totalSerie)}</strong></div>}>
          <AreaChart serie={d.serie} />
        </Card>

        <Card span={4} title="Punto de equilibrio" sub="cuánto de tu estructura cubriste">
          <PeGauge rentabilidad={r} />
        </Card>

        <Card span={12} title="Alertas activas" sub="lo que requiere atención" action={<span className="pg-more">{d.alertas.length} activa{d.alertas.length === 1 ? "" : "s"}</span>}>
          <div className="pg-insights row">
            {d.alertas.length === 0 ? <div className="pg-empty-sm">Sin alertas activas. Todo en orden.</div> : d.alertas.map((a) => <InsightCard key={a.id} a={a} />)}
          </div>
        </Card>

        <Card span={6} title="Clientes principales" sub="por facturación">
          <Ranking rows={d.topClientes} max={maxCli} />
        </Card>

        <Card span={6} title="Productos con mayor facturación" sub="con su margen">
          <table className="pg-tbl">
            <thead><tr><th>Producto</th><th className="r">Margen</th><th className="r">Facturado</th></tr></thead>
            <tbody>
              {d.topProductos.map((p) => (
                <tr key={p.nombre}>
                  <td>{p.nombre}</td>
                  <td className="r"><span className={`pg-tag ${p.margenPct >= 45 ? "ok" : p.margenPct >= 30 ? "" : "warn"}`}>{pct(p.margenPct)}</span></td>
                  <td className="r mono">{pesosK(p.ventas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function PeGauge({ rentabilidad: r }: { rentabilidad: RentabilidadPanel }) {
  if (r.puntoEquilibrio == null || r.avancePct == null) {
    return <div className="pg-empty-sm">Cargá los costos fijos de tus centros para ver el punto de equilibrio.</div>;
  }
  const avance = Math.min(100, r.avancePct);
  const size = 150, stroke = 16, rad = (size - stroke) / 2, c = 2 * Math.PI * rad;
  return (
    <div className="pg-pe">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={avance < 100 ? "var(--signal)" : "var(--ok)"} strokeWidth={stroke}
            strokeDasharray={`${(avance / 100) * c} ${c}`} strokeLinecap="round" />
        </g>
        <text x="50%" y="46%" textAnchor="middle" className="pg-donut-v">{pct(r.avancePct)}</text>
        <text x="50%" y="58%" textAnchor="middle" className="pg-donut-k">del equilibrio</text>
      </svg>
      <div className="pg-pe-meta">
        <div className="row"><span>Facturado</span><span className="mono">{pesos(r.ventas)}</span></div>
        <div className="row"><span>Costos fijos</span><span className="mono">{pesos(r.costosFijos ?? 0)}</span></div>
        <div className="row strong"><span>Equilibrio</span><span className="mono">{pesos(r.puntoEquilibrio)}</span></div>
      </div>
    </div>
  );
}

/* ═══════════ TAB · Comercial ═══════════ */
function TabComercial({ d }: { d: ComercialPanel }) {
  const k = d.kpis;
  const maxCli = Math.max(...d.rankingClientes.map((c) => c.facturado), 1);
  const maxVen = Math.max(...d.rankingVendedores.map((c) => c.facturado), 1);
  return (
    <>
      <div className="pg-kpi-row">
        <Kpi label="Ventas" value={pesosK(k.ventas)} delta={k.ventasDeltaPct} />
        <Kpi label="Órdenes" value={fmt(k.ordenes)} delta={k.ordenesDeltaPct} />
        <Kpi label="Ticket promedio" value={pesosK(k.ticketPromedio)} />
        <Kpi label="Items por orden" value={fmt(k.itemsPorOrden, 1)} />
        <Kpi label="Clientes nuevos" value={fmt(k.nuevosClientes)} tone="ok" />
        <Kpi label="Clientes dormidos" value={fmt(k.clientesDormidos)} tone={k.clientesDormidos > 0 ? "warn" : undefined} sub="recurrentes sin comprar" />
      </div>
      <div className="pg-grid">
        <Card span={8} title="Ventas del período" sub={`serie ${d.granularidad}`}
          action={<div className="pg-card-total">Ticket <strong>{pesosK(k.ticketPromedio)}</strong></div>}>
          <AreaChart serie={d.serie} />
        </Card>
        <Card span={4} title="Mix por categoría" sub="participación en ventas">
          <MixList items={d.mixCategoria} />
        </Card>
        <Card span={6} title="Clientes principales">
          <Ranking rows={d.rankingClientes} max={maxCli} />
        </Card>
        <Card span={6} title="Ranking de vendedores">
          <Ranking rows={d.rankingVendedores} max={maxVen} />
        </Card>
        <Card span={7} title="Clientes dormidos" sub="recurrentes que dejaron de comprar" >
          {d.dormidos.length === 0 ? <div className="pg-empty-sm">Ninguno: tus clientes recurrentes siguen activos.</div> : (
            <table className="pg-tbl">
              <thead><tr><th>Cliente</th><th className="r">Última compra</th><th className="r">Sin comprar</th><th className="r">Historial</th></tr></thead>
              <tbody>{d.dormidos.map((c) => (
                <tr key={c.clienteId ?? c.cliente}><td>{c.cliente}</td><td className="r mono">{c.ultimaCompra}</td><td className="r mono" style={{ color: "var(--signal)" }}>{c.diasSinComprar} d</td><td className="r mono">{c.historico}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card span={5} title="Mix por tecnología">
          <MixList items={d.mixTecnologia} />
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Finanzas ═══════════ */
type FinanzasData = { meta: MetaPanel; rentabilidad: RentabilidadPanel; cobranza: CobranzaPanel };
function TabFinanzas({ d }: { d: FinanzasData }) {
  const r = d.rentabilidad, co = d.cobranza;
  const maxDeu = Math.max(...co.deudores.map((x) => x.saldo), 1);
  return (
    <>
      <div className="pg-kpi-row">
        <Kpi label="Facturado" value={pesosK(co.facturado)} sub="comprobantes emitidos" />
        <Kpi label="Contribución" value={pct(r.contribucionPct)} tone="ok" />
        <Kpi label="Punto de equilibrio" value={r.puntoEquilibrio != null ? pesosK(r.puntoEquilibrio) : "—"} sub={r.avancePct != null ? `avance ${pct(r.avancePct)}` : undefined} tone="warn" />
        <Kpi label="Deuda por cobrar" value={pesosK(co.agingTotal)} sub={`vencido ${pesosK(co.vencido)}`} tone={co.vencido > 0 ? "signal" : undefined} />
        <Kpi label="DSO" value={co.dso != null ? `${fmt(co.dso)} d` : "—"} sub="días de cobro" />
        <Kpi label="Costo de cobrar" value={pesosK(co.comisionTotal)} sub="comisiones del período" tone={co.comisionTotal > 0 ? "warn" : undefined} />
      </div>
      <div className="pg-grid">
        <Card span={5} title="Gasto por centro de costo" sub="estructura del período">
          <div className="pg-donut-row">
            <Donut segments={(r.gastoPorCentro ?? []).map((c) => ({ label: c.centro, value: c.monto }))} centro="costo fijo" />
            <div className="pg-legend">
              {(r.gastoPorCentro ?? []).map((c, i) => (
                <div key={c.centroId} className="row">
                  <span className="dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="nm">{c.centro}</span><span className="pct mono">{pct(c.pct)}</span><span className="val mono">{pesosK(c.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card span={7} title="Costo de cobrar" sub="comisiones por método de pago">
          <table className="pg-tbl">
            <thead><tr><th>Método</th><th className="r">Cobros</th><th className="r">Bruto</th><th className="r">Comisión</th><th className="r">%</th></tr></thead>
            <tbody>{co.costoCobrar.map((m) => (
              <tr key={m.metodo}><td>{m.metodo}</td><td className="r mono">{m.cantidad}</td><td className="r mono">{pesosK(m.bruto)}</td><td className="r mono" style={{ color: m.comision > 0 ? "var(--signal)" : undefined }}>{pesosK(m.comision)}</td><td className="r mono">{pct(m.pct)}</td></tr>
            ))}</tbody>
          </table>
        </Card>

        <Card span={4} title="Cuentas por cobrar" sub="por antigüedad">
          <div className="pg-aging-total mono">{pesos(co.agingTotal)}</div>
          <AgingBar aging={co.aging} total={co.agingTotal} />
          <div className="pg-aging-rows">
            {co.aging.map((f) => (
              <div key={f.franja} className="row"><span className="nm">{f.franja} días</span><span className="val mono">{pesosK(f.monto)}</span></div>
            ))}
          </div>
        </Card>

        <Card span={8} title="Deudores principales" sub="prioridad de cobranza">
          {co.deudores.length === 0 ? <div className="pg-empty-sm">Sin deuda pendiente.</div> : (
            <table className="pg-tbl">
              <thead><tr><th>Cliente</th><th className="r">Saldo</th><th className="r">Días máx.</th></tr></thead>
              <tbody>{co.deudores.map((x) => (
                <tr key={x.clienteId ?? x.cliente}><td><div className="nm">{x.cliente}</div><HBar value={x.saldo} max={maxDeu} /></td><td className="r mono">{pesos(x.saldo)}</td><td className="r mono" style={{ color: x.diasMax > 60 ? "var(--signal)" : undefined }}>{x.diasMax} d</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>

        <Card span={4} title="Fondos y cheques">
          <div className="pg-fondos">
            {co.fondos.map((f) => (<div key={f.cuenta} className="row"><span className="nm">{f.cuenta}</span><span className="val mono">{pesos(f.saldo)}</span></div>))}
            {co.cheques.length === 0 ? <div className="pg-empty-sm">Sin cheques en cartera.</div> : co.cheques.map((c) => (
              <div key={c.estado} className="row"><span className="nm">Cheques {c.estado} ({c.cantidad})</span><span className="val mono">{pesos(c.importe)}</span></div>
            ))}
          </div>
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
      <div className="pg-kpi-row">
        <Kpi label="Entregas a tiempo" value={pct(k.otdPct)} sub={`${d.otd.aTiempo}/${d.otd.total} órdenes`} />
        <Kpi label="Atraso promedio" value={`${fmt(k.atrasoPromedioDias, 1)} d`} tone={k.atrasoPromedioDias > 0 ? "warn" : undefined} />
        <Kpi label="Lead time" value={k.leadTimeDias != null ? `${fmt(k.leadTimeDias, 1)} d` : "—"} sub="emisión → entrega" />
        <Kpi label="Eficiencia de tiempo" value={pct(k.eficienciaPct)} sub="real vs. cotizado" />
        <Kpi label="Bloqueados" value={fmt(k.bloqueados)} tone={k.bloqueados > 0 ? "signal" : undefined} />
        <Kpi label="Utilización" value={pct(k.utilizacionPct)} sub="capacidad usada" />
      </div>
      <div className="pg-grid">
        <Card span={7} title="Precisión de estimación" sub="tiempo real vs. cotizado por familia">
          <table className="pg-tbl">
            <thead><tr><th>Familia</th><th className="r">Cotizado</th><th className="r">Real</th><th className="r">Razón</th><th className="r">n</th></tr></thead>
            <tbody>{d.eficiencia.porFamilia.map((f) => (
              <tr key={f.familia}><td>{f.familia}</td><td className="r mono">{fmt(f.estimadoMin, 0)}m</td><td className="r mono">{fmt(f.realMin, 1)}m</td><td className="r mono" style={{ color: (f.razon ?? 0) > 1.5 ? "var(--signal)" : undefined }}>{f.razon != null ? `${fmt(f.razon, 2)}×` : "—"}</td><td className="r mono" style={{ opacity: f.muestras < 3 ? 0.5 : 1 }}>{f.muestras}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card span={5} title="Utilización por centro" sub="horas reales vs. capacidad práctica">
          <div className="pg-mix">
            {d.utilizacion.map((c) => (
              <div key={c.centro} className="pg-mix-row">
                <span className="nm">{c.centro}</span>
                <div className="bar"><HBar value={c.pct ?? 0} max={100} tone={(c.pct ?? 0) < 40 ? "warn" : "ink"} /></div>
                <span className="pct mono">{pct(c.pct)}</span>
                <span className="val mono">{fmt(c.horasReales, 0)}/{fmt(c.capacidadPractica, 0)}h</span>
              </div>
            ))}
          </div>
        </Card>
        <Card span={8} title="Órdenes atrasadas" sub="entregadas fuera de fecha">
          {d.otd.atrasadas.length === 0 ? <div className="pg-empty-sm">Ninguna orden se entregó tarde en el período.</div> : (
            <table className="pg-tbl">
              <thead><tr><th>Orden</th><th>Cliente</th><th className="r">Entrega</th><th className="r">Atraso</th></tr></thead>
              <tbody>{d.otd.atrasadas.map((o) => (<tr key={o.numero}><td className="mono">{o.numero}</td><td>{o.cliente}</td><td className="r mono">{o.fechaEntrega}</td><td className="r mono" style={{ color: "var(--signal)" }}>{o.diasAtraso} d</td></tr>))}</tbody>
            </table>
          )}
        </Card>
        <Card span={4} title="Throughput" sub="pasos completados por día">
          <BarChart data={d.throughput.map((t) => ({ label: t.fecha.slice(5), value: t.cantidad }))} height={200} />
        </Card>
      </div>
    </>
  );
}

/* ═══════════ TAB · Ventas & Producto ═══════════ */
function TabProducto({ d }: { d: ProductoPanel }) {
  const fmtMedida = (a: number, alto: number) => `${fmt(a / 10, 0)}×${fmt(alto / 10, 0)} cm`;
  return (
    <>
      <div className="pg-grid">
        <Card span={6} title="Ventas por categoría" sub="con margen">
          <table className="pg-tbl">
            <thead><tr><th>Categoría</th><th className="r">Margen</th><th className="r">Ventas</th></tr></thead>
            <tbody>{d.porCategoria.map((c) => (<tr key={c.nombre}><td>{c.nombre}</td><td className="r"><span className={`pg-tag ${c.margenPct >= 45 ? "ok" : c.margenPct >= 30 ? "" : "warn"}`}>{pct(c.margenPct)}</span></td><td className="r mono">{pesosK(c.ventas)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={6} title="Productos más vendidos" sub="volumen y margen">
          <table className="pg-tbl">
            <thead><tr><th>Producto</th><th className="r">Items</th><th className="r">Margen</th><th className="r">Ventas</th></tr></thead>
            <tbody>{d.porProducto.slice(0, 8).map((p) => (<tr key={p.nombre}><td>{p.nombre}</td><td className="r mono">{p.items}</td><td className="r mono">{pct(p.margenPct)}</td><td className="r mono">{pesosK(p.ventas)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={7} title="Uso de papel y material" sub="consumo teórico del período">
          <table className="pg-tbl">
            <thead><tr><th>Material</th><th className="r">Cantidad</th><th className="r">Trabajos</th><th className="r">Costo</th></tr></thead>
            <tbody>{d.porPapel.map((m) => (<tr key={m.material}><td>{m.material}</td><td className="r mono">{fmt(m.cantidad, 1)} {m.unidad}</td><td className="r mono">{m.items}</td><td className="r mono">{pesosK(m.costo)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={5} title="Medidas más vendidas" sub={`${fmt(d.totalM2, 1)} m² totales`}>
          <table className="pg-tbl">
            <thead><tr><th>Medida</th><th className="r">Unidades</th><th className="r">m²</th></tr></thead>
            <tbody>{d.porMedida.slice(0, 8).map((m) => (<tr key={`${m.anchoMm}x${m.altoMm}`}><td className="mono">{fmtMedida(m.anchoMm, m.altoMm)}</td><td className="r mono">{fmt(m.unidades)}</td><td className="r mono">{fmt(m.m2, 2)}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={6} title="Consumo de tintas" sub="teórico, del snapshot">
          <table className="pg-tbl">
            <thead><tr><th>Tinta</th><th className="r">Cantidad</th></tr></thead>
            <tbody>{d.consumoTintas.map((m) => (<tr key={m.material}><td>{m.material}</td><td className="r mono">{fmt(m.cantidad, 1)} {m.unidad}</td></tr>))}</tbody>
          </table>
        </Card>
        <Card span={6} title="Mix por tecnología">
          <MixList items={d.porTecnologia} />
        </Card>
      </div>
    </>
  );
}

/* ═══════════ Shell ═══════════ */
type TabKey = "resumen" | "comercial" | "finanzas" | "produccion" | "producto";
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "resumen", label: "Resumen ejecutivo" },
  { key: "comercial", label: "Comercial" },
  { key: "produccion", label: "Producción" },
  { key: "finanzas", label: "Finanzas" },
  { key: "producto", label: "Ventas & Producto" },
];
type PeriodoKey = "mes" | "mesPasado" | "trimestre" | "anio";
const PERIODOS: Array<{ key: PeriodoKey; label: string }> = [
  { key: "mes", label: "Este mes" },
  { key: "mesPasado", label: "Mes pasado" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anio", label: "Año" },
];

function iso(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}
function rangoDe(preset: PeriodoKey): RangoPanel {
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth();
  if (preset === "mes") return {};
  if (preset === "mesPasado") return { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) };
  if (preset === "trimestre") { const q = Math.floor(m / 3) * 3; return { desde: iso(new Date(y, q, 1)), hasta: iso(new Date(y, q + 3, 0)) }; }
  return { desde: iso(new Date(y, 0, 1)), hasta: iso(new Date(y, 11, 31)) };
}

const FETCHERS: Record<TabKey, (r: RangoPanel) => Promise<unknown>> = {
  resumen: getPanelResumen,
  comercial: getPanelComercial,
  finanzas: getPanelFinanzas,
  produccion: getPanelProduccion,
  producto: getPanelProducto,
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
    let vivo = true;
    setLoading(true);
    setError(null);
    FETCHERS[tab](rangoDe(periodo))
      .then((res) => { if (vivo) setCache((c) => ({ ...c, [key]: res })); })
      .catch((err) => { if (vivo) setError(err instanceof Error ? err.message : "No se pudo cargar el reporte."); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [key, tab, periodo, data]);

  const meta = (data as { meta?: MetaPanel } | undefined)?.meta;

  return (
    <div className="pg" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 32px 48px" }}>
      <div className="pg-head">
        <div className="title-block">
          <h1>Panel general</h1>
          <div className="sub">Inteligencia de negocio de tu taller, con datos reales.</div>
        </div>
        <div className="pg-period">
          {PERIODOS.map((p) => (
            <button key={p.key} className={periodo === p.key ? "on" : ""} onClick={() => setPeriodo(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="pg-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`pg-tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {error ? <div className="pg-error">{error}</div> : null}
      {loading && !data ? <div className="pg-loading">Calculando el período…</div> : null}

      {data ? (
        <>
          {tab === "resumen" ? <TabResumen d={data as ResumenData} /> : null}
          {tab === "comercial" ? <TabComercial d={(data as { comercial?: never } & ComercialPanel) as ComercialPanel} /> : null}
          {tab === "finanzas" ? <TabFinanzas d={data as FinanzasData} /> : null}
          {tab === "produccion" ? <TabProduccion d={data as ProduccionPanel} /> : null}
          {tab === "producto" ? <TabProducto d={data as ProductoPanel} /> : null}
          {meta && meta.limites.length > 0 ? (
            <div className="pg-meta">
              <strong>Fuente:</strong> {meta.fuente}. {meta.limites.join(" ")}
              {meta.sinComparativa ? " Sin período anterior para comparar." : ""}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
