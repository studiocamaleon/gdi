"use client";

/**
 * Simulador de impresión — agrupa trabajos listos para imprimir por
 * TECNOLOGÍA → MATERIAL y sugiere el ancho de rollo que minimiza el
 * desperdicio. Medidas internas en cm.
 *
 * v1: datos mock (tecnologías, materiales, cola de trabajos). La conexión a
 * la cola real (items de OT en producción + stock de inventario) viene después.
 */

import * as React from "react";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon } from "lucide-react";

type SimTech = {
  key: string;
  nm: string;
  sub: string;
  color: string;
};

type SimMaterial = {
  key: string;
  tech: string;
  nm: string;
  sub: string;
  /** Anchos de rollo disponibles (cm). */
  rolls: number[];
  /** Metros lineales en stock por ancho. */
  stockMl: Record<number, number>;
};

type SimJob = {
  id: string;
  mat: string;
  cliente: string;
  producto: string;
  w: number;
  h: number;
  copies: number;
  due: string;
  urgent: boolean;
};

/* ─────────── Datos mock (reemplazar por cola real) ─────────── */

const SIM_TECHS: SimTech[] = [
  { key: "uv", nm: "UV", sub: "Gran formato rígido y flexible", color: "#6d4bd8" },
  { key: "latex", nm: "Látex", sub: "Interior / exterior sin olor", color: "#1f9d6b" },
  { key: "eco", nm: "Ecosolvente", sub: "Vinilos y lonas exterior", color: "#2f8fd6" },
  { key: "dtfuv", nm: "DTF UV", sub: "Transfer sobre objetos", color: "#c9599a" },
  { key: "dtftex", nm: "DTF Textil", sub: "Estampado en telas", color: "#d9803a" },
];

const SIM_MATERIALS: SimMaterial[] = [
  { key: "uv-vinilo", tech: "uv", nm: "Vinilo blanco", sub: "Brillante / mate", rolls: [107, 137, 152, 160], stockMl: { 107: 42, 137: 118, 152: 64, 160: 23 } },
  { key: "uv-micro", tech: "uv", nm: "Microperforado", sub: "Vidrieras", rolls: [137, 152], stockMl: { 137: 28, 152: 51 } },
  { key: "uv-torna", tech: "uv", nm: "Tornasolado", sub: "Efecto holográfico", rolls: [137, 152], stockMl: { 137: 19, 152: 34 } },
  { key: "uv-lona", tech: "uv", nm: "Lona frontlight 440g", sub: "Cartelería exterior", rolls: [160, 220, 320], stockMl: { 160: 85, 220: 40, 320: 110 } },
  { key: "lx-vinilo", tech: "latex", nm: "Vinilo mate", sub: "Wall covering", rolls: [137, 152, 160], stockMl: { 137: 60, 152: 44, 160: 30 } },
  { key: "lx-papel", tech: "latex", nm: "Papel fotográfico", sub: "Alta definición", rolls: [137, 152], stockMl: { 137: 25, 152: 38 } },
  { key: "eco-vinilo", tech: "eco", nm: "Vinilo blanco", sub: "Ploteo y ruteado", rolls: [100, 137, 152], stockMl: { 100: 55, 137: 72, 152: 40 } },
  { key: "eco-lona", tech: "eco", nm: "Lona banner 510g", sub: "Pasacalles", rolls: [160, 220], stockMl: { 160: 66, 220: 48 } },
  { key: "dtfuv-film", tech: "dtfuv", nm: "Film DTF UV", sub: "Ancho único", rolls: [60], stockMl: { 60: 120 } },
  { key: "dtftex-film", tech: "dtftex", nm: "Film DTF textil", sub: "Ancho único", rolls: [60], stockMl: { 60: 95 } },
];

const SIM_JOBS: SimJob[] = [
  { id: "ITEM-2512-A", mat: "uv-vinilo", cliente: "Clínica Mayo", producto: "Señalética interna", w: 30, h: 42, copies: 12, due: "Hoy 17:00", urgent: true },
  { id: "ITEM-2515-B", mat: "uv-vinilo", cliente: "Bodega Trapiche", producto: "Gráfica PDV", w: 120, h: 80, copies: 2, due: "Mañana", urgent: false },
  { id: "ITEM-2508-A", mat: "uv-vinilo", cliente: "Municipalidad Rosario", producto: "Cartelería vía pública", w: 60, h: 90, copies: 6, due: "Vie 10", urgent: false },
  { id: "ITEM-2519-A", mat: "uv-vinilo", cliente: "Estudio Méndez", producto: "Banner recepción", w: 140, h: 300, copies: 1, due: "Hoy 18:00", urgent: true },
  { id: "ITEM-2520-B", mat: "uv-vinilo", cliente: "Bar 9 de Julio", producto: "Ploteo de barra", w: 45, h: 65, copies: 4, due: "Sáb 11", urgent: false },
  { id: "ITEM-2511-D", mat: "uv-micro", cliente: "Farmacia Central", producto: "Vidriera local", w: 110, h: 180, copies: 2, due: "Vie 10", urgent: false },
  { id: "ITEM-2523-A", mat: "uv-micro", cliente: "Óptica Visión", producto: "Vidriera promo", w: 90, h: 130, copies: 2, due: "Lun 13", urgent: false },
  { id: "ITEM-2524-C", mat: "uv-torna", cliente: "Disco Neón", producto: "Gráfica evento", w: 50, h: 70, copies: 8, due: "Vie 10", urgent: true },
  { id: "ITEM-2510-A", mat: "uv-lona", cliente: "Distribuidora Sur", producto: "Lona frente depósito", w: 300, h: 150, copies: 1, due: "Mié 8", urgent: false },
  { id: "ITEM-2516-A", mat: "uv-lona", cliente: "Club Provincial", producto: "Pasacalle evento", w: 200, h: 90, copies: 3, due: "Hoy 19:00", urgent: true },
  { id: "ITEM-2530-A", mat: "lx-vinilo", cliente: "Hotel Savoy", producto: "Wall covering hall", w: 150, h: 260, copies: 2, due: "Mar 14", urgent: false },
  { id: "ITEM-2531-B", mat: "lx-vinilo", cliente: "Coworking Nodo", producto: "Mural sala", w: 100, h: 200, copies: 3, due: "Mié 15", urgent: false },
  { id: "ITEM-2532-A", mat: "lx-papel", cliente: "Galería Arte Sur", producto: "Reproducción obra", w: 60, h: 90, copies: 5, due: "Jue 16", urgent: false },
  { id: "ITEM-2540-A", mat: "eco-vinilo", cliente: "Flota Rápido", producto: "Ploteo vehicular", w: 80, h: 120, copies: 4, due: "Vie 10", urgent: true },
  { id: "ITEM-2541-B", mat: "eco-vinilo", cliente: "Kiosco 24hs", producto: "Cartel frente", w: 90, h: 60, copies: 2, due: "Sáb 11", urgent: false },
  { id: "ITEM-2542-A", mat: "eco-lona", cliente: "Feria del Libro", producto: "Pasacalle acceso", w: 250, h: 100, copies: 2, due: "Lun 13", urgent: false },
  { id: "ITEM-2550-A", mat: "dtfuv-film", cliente: "Merch & Co", producto: "Transfer botellas", w: 12, h: 18, copies: 40, due: "Mié 8", urgent: false },
  { id: "ITEM-2551-B", mat: "dtfuv-film", cliente: "Eventos Prime", producto: "Transfer termos", w: 20, h: 22, copies: 24, due: "Jue 9", urgent: true },
  { id: "ITEM-2560-A", mat: "dtftex-film", cliente: "Indumentaria Base", producto: "Estampa remeras", w: 28, h: 34, copies: 30, due: "Vie 10", urgent: false },
  { id: "ITEM-2561-B", mat: "dtftex-film", cliente: "Club Deportivo", producto: "Números camisetas", w: 22, h: 28, copies: 18, due: "Sáb 11", urgent: true },
];

const SIM_COLORS = [
  "#2f6fdb", "#e08a2b", "#7a52d8", "#1f9d6b", "#d1495b",
  "#c99a2b", "#3a9ca0", "#b0578f", "#5a7fd8", "#c07a4a",
];

/* ─────────── Motor de nesting (shelf-packing FFDH con rotación) ─────────── */

type SimPlaced = { x: number; y: number; w: number; h: number; id: string };

type SimPackResult = {
  placed: SimPlaced[];
  totalLen: number;
  utilization: number;
  pieceArea: number;
  wasteArea: number;
  incompatible: string[];
  pieces: number;
};

function simPack(jobs: SimJob[], rollCm: number, opts: { margin?: number; gap?: number } = {}): SimPackResult {
  const margin = opts.margin ?? 3;
  const gap = opts.gap ?? 1.5;
  const usable = rollCm - margin * 2;

  const rects: Array<{ w: number; h: number; id: string }> = [];
  const incompatible: string[] = [];
  for (const j of jobs) {
    const minSide = Math.min(j.w, j.h);
    if (minSide > usable) {
      incompatible.push(j.id);
      continue;
    }
    for (let c = 0; c < j.copies; c++) rects.push({ w: j.w, h: j.h, id: j.id });
  }

  for (const r of rects) {
    const long = Math.max(r.w, r.h);
    const short = Math.min(r.w, r.h);
    if (long <= usable) {
      r.w = long;
      r.h = short;
    } else {
      r.w = short;
      r.h = long;
    }
  }
  rects.sort((a, b) => b.h - a.h || b.w - a.w);

  const shelves: Array<{ y: number; h: number; x: number }> = [];
  const placed: SimPlaced[] = [];
  let cursorY = 0;
  for (const r of rects) {
    let shelf: { y: number; h: number; x: number } | null = null;
    for (const s of shelves) {
      if (s.x + r.w <= usable && r.h <= s.h) {
        shelf = s;
        break;
      }
      if (s.x + r.h <= usable && r.w <= s.h && Math.max(r.w, r.h) <= usable) {
        const t = r.w;
        r.w = r.h;
        r.h = t;
        shelf = s;
        break;
      }
    }
    if (!shelf) {
      shelf = { y: cursorY, h: r.h, x: 0 };
      shelves.push(shelf);
      cursorY += r.h + gap;
    }
    placed.push({ x: margin + shelf.x, y: shelf.y, w: r.w, h: r.h, id: r.id });
    shelf.x += r.w + gap;
  }

  const last = shelves[shelves.length - 1];
  const totalLen = last ? last.y + last.h : 0;
  const pieceArea = placed.reduce((a, p) => a + p.w * p.h, 0);
  const rollArea = rollCm * totalLen;
  return {
    placed,
    totalLen,
    utilization: rollArea ? pieceArea / rollArea : 0,
    pieceArea,
    wasteArea: Math.max(0, rollArea - pieceArea),
    incompatible,
    pieces: placed.length,
  };
}

type SimRollResult = SimPackResult & { rollCm: number; stockMl: number; stockOk: boolean };

function simCompareRolls(jobs: SimJob[], material: SimMaterial) {
  const results: SimRollResult[] = material.rolls.map((rollCm) => {
    const r = simPack(jobs, rollCm);
    const stockOk = (material.stockMl[rollCm] ?? 0) >= r.totalLen / 100;
    return { rollCm, ...r, stockMl: material.stockMl[rollCm] ?? 0, stockOk };
  });
  const eligible = results.filter(
    (r) => r.incompatible.length === 0 && r.stockOk && r.pieces > 0,
  );
  const pool = eligible.length ? eligible : results.filter((r) => r.pieces > 0);
  let best: SimRollResult | null = null;
  for (const r of pool) {
    if (!best || r.wasteArea < best.wasteArea) best = r;
  }
  return { results, bestRoll: best ? best.rollCm : null };
}

const simFmt = (n: number, d = 1) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtRollM = (rollCm: number) => (rollCm / 100).toFixed(2).replace(".", ",");

/* ─────────── Layout SVG (rollo horizontal) ─────────── */

function SimRollLayout({
  pack,
  rollCm,
  colorMap,
  height = 190,
}: {
  pack: SimRollResult | undefined;
  rollCm: number;
  colorMap: Record<string, string>;
  height?: number;
}) {
  if (!pack || pack.pieces === 0) {
    return <div className="sim-layout-empty">Sin piezas para acomodar</div>;
  }
  const lenCm = Math.max(pack.totalLen, 40);
  const W = 720;
  const H = height;
  const padL = 46;
  const padT = 16;
  const padB = 26;
  const padR = 14;
  const innerH = H - padT - padB;
  const innerW = W - padL - padR;
  const scale = Math.min(innerH / rollCm, innerW / lenCm);
  const rollH = rollCm * scale;
  const rollW = lenCm * scale;
  const oy = padT + (innerH - rollH) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect x={padL} y={oy} width={rollW} height={rollH} fill="#faf9f7" stroke="#d4d2cd" strokeWidth="1.5" rx="2" />
      <line x1={padL} x2={padL + rollW} y1={oy + 3 * scale} y2={oy + 3 * scale} stroke="#e7e5e2" strokeWidth="1" strokeDasharray="5 4" />
      <line x1={padL} x2={padL + rollW} y1={oy + rollH - 3 * scale} y2={oy + rollH - 3 * scale} stroke="#e7e5e2" strokeWidth="1" strokeDasharray="5 4" />
      {pack.placed.map((p, i) => {
        const x = padL + p.y * scale;
        const y = oy + p.x * scale;
        const w = p.h * scale;
        const h = p.w * scale;
        const c = colorMap[p.id] || "#888";
        const showLabel = w > 44 && h > 22;
        return (
          <g key={i} className="sim-piece" style={{ animationDelay: `${Math.min(i * 0.015, 0.4)}s` }}>
            <rect x={x} y={y} width={w} height={h} fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.3" rx="2" />
            {showLabel ? (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill={c} fontSize="10" fontFamily="var(--font-mono)" fontWeight="600">
                {p.id.replace("ITEM-", "")}
              </text>
            ) : null}
          </g>
        );
      })}
      <text
        x={padL - 12}
        y={oy + rollH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(-90 ${padL - 12} ${oy + rollH / 2})`}
        fill="#6e6e76"
        fontSize="11"
        fontFamily="var(--font-mono)"
        fontWeight="600"
      >
        {fmtRollM(rollCm)} m
      </text>
      <text x={padL + rollW / 2} y={oy + rollH + 18} textAnchor="middle" fill="#6e6e76" fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">
        {simFmt(pack.totalLen / 100, 2)} m lineales
      </text>
    </svg>
  );
}

/* ─────────── Card por material ─────────── */

function SimMaterialCard({
  material,
  jobs,
  excluded,
  onToggle,
}: {
  material: SimMaterial;
  jobs: SimJob[];
  excluded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [rollOverride, setRollOverride] = React.useState<number | null>(null);

  const activeJobs = React.useMemo(
    () => jobs.filter((j) => !excluded.has(j.id)),
    [jobs, excluded],
  );
  const { results, bestRoll } = React.useMemo(
    () => simCompareRolls(activeJobs, material),
    [activeJobs, material],
  );
  const shownRoll =
    rollOverride && material.rolls.includes(rollOverride) ? rollOverride : bestRoll;
  const shownPack = results.find((r) => r.rollCm === shownRoll);

  const colorMap: Record<string, string> = {};
  jobs.forEach((j, i) => {
    colorMap[j.id] = SIM_COLORS[i % SIM_COLORS.length];
  });

  const totalPieces = activeJobs.reduce((a, j) => a + j.copies, 0);
  const totalM2 = activeJobs.reduce((a, j) => a + (j.w * j.h * j.copies) / 10000, 0);
  const separateLen = activeJobs.reduce(
    (a, j) => a + simPack([j], shownRoll || material.rolls[0]).totalLen,
    0,
  );
  const savedMl = shownPack ? Math.max(0, (separateLen - shownPack.totalLen) / 100) : 0;
  const singleRoll = material.rolls.length === 1;

  return (
    <div className={`sim-mat ${open ? "open" : ""}`}>
      <button type="button" className="sim-mat-head" onClick={() => setOpen((o) => !o)}>
        <span className="chev">
          <ChevronRightIcon
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}
          />
        </span>
        <div className="sim-mat-id">
          <div className="nm">{material.nm}</div>
          <div className="sub">{material.sub}</div>
        </div>
        <div className="sim-mat-stats">
          <div className="s">
            <span className="k">Trabajos</span>
            <span className="v mono">{activeJobs.length}</span>
          </div>
          <div className="s">
            <span className="k">Piezas</span>
            <span className="v mono">{totalPieces}</span>
          </div>
          <div className="s">
            <span className="k">Área</span>
            <span className="v mono">{simFmt(totalM2, 1)} m²</span>
          </div>
        </div>
        <div className="sim-mat-roll">
          {shownRoll ? (
            <>
              <span className="roll-badge mono">{fmtRollM(shownRoll)} m</span>
              {!singleRoll &&
                (shownRoll === bestRoll ? (
                  <span className="opt">ÓPTIMO</span>
                ) : (
                  <span className="man">MANUAL</span>
                ))}
            </>
          ) : (
            <span className="dash">—</span>
          )}
        </div>
        <div className="sim-mat-util">
          <div className="util-track">
            <span
              style={{
                width: `${shownPack ? Math.round(shownPack.utilization * 100) : 0}%`,
                background:
                  shownPack && shownPack.utilization > 0.7 ? "var(--ok)" : "var(--info)",
              }}
            />
          </div>
          <span className="util-v mono">
            {shownPack ? Math.round(shownPack.utilization * 100) : 0}%
          </span>
        </div>
      </button>

      {open ? (
        <div className="sim-mat-body">
          <div className="sim-mat-cols">
            <div className="sim-jobs">
              <div className="sim-sub-h">Trabajos en el batch</div>
              {jobs.map((j) => {
                const off = excluded.has(j.id);
                const incompat = shownPack?.incompatible.includes(j.id);
                return (
                  <button
                    type="button"
                    key={j.id}
                    className={`sim-job ${off ? "off" : ""} ${j.urgent ? "urgent" : ""}`}
                    onClick={() => onToggle(j.id)}
                  >
                    <span className="jc" style={{ background: colorMap[j.id], opacity: off ? 0.25 : 1 }} />
                    <div className="jb">
                      <div className="j1">
                        <span className="code mono">{j.id.replace("ITEM-", "")}</span>
                        {j.urgent ? <span className="urg">HOY</span> : null}
                      </div>
                      <div className="j2">{j.cliente}</div>
                      <div className="j3 mono">
                        {j.w}×{j.h} · {j.copies}u
                        {incompat && !off ? <span className="warn"> · no entra</span> : null}
                      </div>
                    </div>
                    <span className={`cbx ${!off ? "on" : ""}`}>
                      {!off ? <CheckIcon strokeWidth={3.2} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sim-viz">
              <div className="sim-sub-h">Acomodo sugerido</div>
              <div className="sim-canvas">
                <SimRollLayout
                  pack={shownPack}
                  rollCm={shownRoll || material.rolls[0]}
                  colorMap={colorMap}
                />
              </div>

              {!singleRoll ? (
                <div className="sim-rolls">
                  {results.map((r) => {
                    const isBest = r.rollCm === bestRoll;
                    const isShown = r.rollCm === shownRoll;
                    const blocked = r.incompatible.length > 0;
                    return (
                      <button
                        type="button"
                        key={r.rollCm}
                        className={`sim-roll ${isShown ? "shown" : ""} ${isBest ? "best" : ""} ${blocked ? "blocked" : ""}`}
                        onClick={() => setRollOverride(r.rollCm === bestRoll ? null : r.rollCm)}
                      >
                        <div className="rr1">
                          <span className="w mono">{fmtRollM(r.rollCm)} m</span>
                          {isBest ? <span className="tg">SUG.</span> : null}
                        </div>
                        <div className="rbar">
                          <span
                            style={{
                              width: `${Math.round(r.utilization * 100)}%`,
                              background: isBest ? "var(--ok)" : "#9aa3b2",
                            }}
                          />
                        </div>
                        <div className="rr2 mono">
                          <span className="u">{Math.round(r.utilization * 100)}%</span>
                          <span className="wa">−{simFmt(r.wasteArea / 10000, 1)}m²</span>
                        </div>
                        {blocked ? (
                          <div className="rblock mono">{r.incompatible.length} no entra</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="sim-save">
                <div className="sv">
                  <span className="k">Consumo</span>
                  <span className="v mono">
                    {shownPack ? simFmt(shownPack.totalLen / 100, 2) : "—"} ml
                  </span>
                </div>
                <div className="sv ok">
                  <span className="k">Ahorro vs. separado</span>
                  <span className="v mono">{simFmt(savedMl, 1)} ml</span>
                </div>
                <button type="button" className="btn btn-primary sim-send" disabled title="Disponible al conectar con la cola real de producción.">
                  <ArrowRightIcon />
                  Enviar a impresión
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────── Vista principal ─────────── */

export function SimuladorImpresion() {
  const [techKey, setTechKey] = React.useState("uv");
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  const tech = SIM_TECHS.find((t) => t.key === techKey) ?? SIM_TECHS[0];
  const materials = SIM_MATERIALS.filter((m) => m.tech === techKey);
  const jobsByMat: Record<string, SimJob[]> = {};
  for (const j of SIM_JOBS) {
    (jobsByMat[j.mat] = jobsByMat[j.mat] || []).push(j);
  }

  const techJobs = SIM_JOBS.filter(
    (j) => materials.some((m) => m.key === j.mat) && !excluded.has(j.id),
  );
  const techM2 = techJobs.reduce((a, j) => a + (j.w * j.h * j.copies) / 10000, 0);
  const techPieces = techJobs.reduce((a, j) => a + j.copies, 0);

  const techSaved = materials.reduce((acc, m) => {
    const mj = (jobsByMat[m.key] || []).filter((j) => !excluded.has(j.id));
    if (!mj.length) return acc;
    const { bestRoll } = simCompareRolls(mj, m);
    if (!bestRoll) return acc;
    const batch = simPack(mj, bestRoll).totalLen;
    const sep = mj.reduce((a, j) => a + simPack([j], bestRoll).totalLen, 0);
    return acc + Math.max(0, (sep - batch) / 100);
  }, 0);

  const techCount = (tk: string) =>
    SIM_JOBS.filter((j) => SIM_MATERIALS.some((m) => m.tech === tk && m.key === j.mat)).length;

  return (
    <div className="sim-page">
      <div className="sim-head">
        <div className="left">
          <h1>Simulador de impresión</h1>
          <div className="sub">
            Unificá trabajos listos para imprimir por material y encontrá el ancho de
            rollo óptimo.
          </div>
        </div>
        <span className="sim-live">
          <span className="d" />
          Cola de ejemplo
        </span>
      </div>

      <div className="sim-techs">
        {SIM_TECHS.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`sim-tech ${techKey === t.key ? "on" : ""}`}
            onClick={() => setTechKey(t.key)}
          >
            <span className="dot" style={{ background: t.color }} />
            <span className="tt">
              <span className="n">{t.nm}</span>
              <span className="s">{t.sub}</span>
            </span>
            <span className="ct mono">{techCount(t.key)}</span>
          </button>
        ))}
      </div>

      <div className="sim-kpis">
        <div className="sim-kpi">
          <div className="k">Materiales</div>
          <div className="v mono">{materials.length}</div>
        </div>
        <div className="sim-kpi">
          <div className="k">Trabajos en cola</div>
          <div className="v mono">{techJobs.length}</div>
        </div>
        <div className="sim-kpi">
          <div className="k">Piezas totales</div>
          <div className="v mono">{techPieces}</div>
        </div>
        <div className="sim-kpi">
          <div className="k">Área a imprimir</div>
          <div className="v mono">{simFmt(techM2, 1)} m²</div>
        </div>
        <div className="sim-kpi ok">
          <div className="k">Ahorro estimado</div>
          <div className="v mono">{simFmt(techSaved, 1)} ml</div>
        </div>
      </div>

      <div className="sim-mats">
        <div className="sim-mats-head">
          <span className="ttl">
            Materiales · <span style={{ color: tech.color }}>{tech.nm}</span>
          </span>
          <span className="hint">
            Tocá un material para ver el acomodo · tocá un trabajo para excluirlo
          </span>
        </div>
        {materials.map((m) => {
          const mj = jobsByMat[m.key] || [];
          if (!mj.length) return null;
          return (
            <SimMaterialCard
              key={m.key}
              material={m}
              jobs={mj}
              excluded={excluded}
              onToggle={toggle}
            />
          );
        })}
        {materials.every((m) => !(jobsByMat[m.key] || []).length) ? (
          <div className="sim-empty">No hay trabajos en cola para esta tecnología.</div>
        ) : null}
      </div>
    </div>
  );
}
