"use client";

/**
 * Simulador GRAN FORMATO — cola REAL de pasos `impresion_por_area` en
 * frontera, agrupada por TECNOLOGÍA → MATERIA PRIMA, re-nesteada de forma
 * consolidada con sugerencia del ancho de rollo que minimiza desperdicio
 * (y su $), y completar en LOTE: el impresor marca impreso todo el batch
 * sin ir card por card en el tablero.
 *
 * Medidas internas en cm; el contrato viaja en mm. El nesting de acá es
 * herramienta de DECISIÓN (FFDH shelf con rotación): el costeo real sigue
 * siendo el del motor. Ver docs/simulador-impresion-diseno.md
 */

import * as React from "react";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon } from "lucide-react";

import {
  getSimuladorImpresion,
  type SimuladorData,
  type SimuladorJob,
} from "@/lib/simulador-impresion-api";
import {
  completarPasosLote,
  type AhorroConsolidacionPayload,
} from "@/lib/ordenes-trabajo-api";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import { diasHastaEntrega, etiquetaEntrega } from "@/lib/tablero-produccion";

const POLL_SIMULADOR_MS = 15000;

/* ─────────── View-model (cm) ─────────── */

type VPieza = { w: number; h: number; copies: number };

type VJob = {
  /** pasoId: la clave de todo (selección, lote, colores). */
  id: string;
  code: string;
  cliente: string;
  producto: string;
  piezas: VPieza[];
  copies: number;
  urgent: boolean;
  due: string;
  /** Consumo al cotizar por separado (ml) y su precio por ml, para el ahorro. */
  consumoCotizadoMl: number | null;
  precioMlCotizado: number | null;
  sinMedidas: boolean;
  /** Estimado del paso (min): placeholder de "¿cuánto duró la tanda?" (D11). */
  duracionEstimadaMin: number | null;
};

type VMaterial = {
  /** `${techKey}|${materiaPrimaId}` — un material puede imprimir en 2 tecnologías. */
  key: string;
  tech: string;
  nm: string;
  sub: string;
  /** Anchos de rollo disponibles (cm), con stock y precio por ml. */
  rolls: number[];
  stockMl: Record<number, number | null>;
  precioMl: Record<number, number | null>;
};

type VTech = { key: string; nm: string; sub: string; color: string };

const SIN_TECNOLOGIA = "sin_tecnologia";
const SIN_MATERIAL = "sin_material";

const r2 = (n: number) => Math.round(n * 100) / 100;

const TECH_COLORS = ["#6d4bd8", "#1f9d6b", "#2f8fd6", "#c9599a", "#d9803a", "#3a9ca0", "#b0578f"];

const SIM_COLORS = [
  "#2f6fdb", "#e08a2b", "#7a52d8", "#1f9d6b", "#d1495b",
  "#c99a2b", "#3a9ca0", "#b0578f", "#5a7fd8", "#c07a4a",
];

function techKeyDe(job: SimuladorJob) {
  return job.tecnologia ?? SIN_TECNOLOGIA;
}

function materialKeyDe(job: SimuladorJob) {
  return `${techKeyDe(job)}|${job.materiaPrimaId ?? SIN_MATERIAL}`;
}

function buildViewModel(data: SimuladorData) {
  const jobs = new Map<string, VJob[]>(); // materialKey → jobs
  const techs: VTech[] = [];
  const materials: VMaterial[] = [];
  const catalogo = new Map(data.materiales.map((mat) => [mat.materiaPrimaId, mat]));

  for (const job of data.jobs) {
    const dias = diasHastaEntrega(job.fechaEntrega);
    const vjob: VJob = {
      id: job.pasoId,
      code: job.codigo.replace("OT-2026-", "").replace("OT-", ""),
      cliente: job.cliente,
      producto: job.producto,
      piezas: job.piezas.map((pieza) => ({
        w: pieza.anchoMm / 10,
        h: pieza.altoMm / 10,
        copies: pieza.cantidad,
      })),
      copies: job.piezas.reduce((acc, pieza) => acc + pieza.cantidad, 0),
      urgent: dias !== null && dias <= 1,
      due: etiquetaEntrega(job.fechaEntrega),
      consumoCotizadoMl: job.consumoCotizadoMm !== null ? job.consumoCotizadoMm / 1000 : null,
      precioMlCotizado: job.varianteCotizada?.precioMl ?? null,
      sinMedidas: job.piezas.length === 0,
      duracionEstimadaMin: job.duracionEstimadaMin,
    };
    const matKey = materialKeyDe(job);
    const lista = jobs.get(matKey) ?? [];
    lista.push(vjob);
    jobs.set(matKey, lista);

    const techKey = techKeyDe(job);
    if (!techs.some((tech) => tech.key === techKey)) {
      techs.push({
        key: techKey,
        nm: job.tecnologia ? technologyCodeLabel(job.tecnologia) : "Sin tecnología",
        sub: "",
        color: TECH_COLORS[techs.length % TECH_COLORS.length],
      });
    }
    if (!materials.some((material) => material.key === matKey)) {
      const cat = job.materiaPrimaId ? catalogo.get(job.materiaPrimaId) : undefined;
      const stockMl: Record<number, number | null> = {};
      const precioMl: Record<number, number | null> = {};
      // El simulador nestea por ANCHO: varias variantes del catálogo pueden
      // compartir ancho (mismo cm, distinto color/gramaje). Se deduplica por
      // ancho para no repetir rollos (evita keys duplicadas): se acumula el
      // stock y se conserva el precio más bajo del ancho.
      const rolls: number[] = [];
      for (const ancho of cat?.anchos ?? []) {
        const rollCm = ancho.anchoMm / 10;
        if (!rolls.includes(rollCm)) {
          rolls.push(rollCm);
          stockMl[rollCm] = ancho.stockMl;
          precioMl[rollCm] = ancho.precioMl;
        } else {
          if (ancho.stockMl != null) stockMl[rollCm] = (stockMl[rollCm] ?? 0) + ancho.stockMl;
          if (ancho.precioMl != null && (precioMl[rollCm] == null || ancho.precioMl < precioMl[rollCm]!)) {
            precioMl[rollCm] = ancho.precioMl;
          }
        }
      }
      materials.push({
        key: matKey,
        tech: techKey,
        nm: cat?.nombre ?? job.materiaPrimaNombre ?? "Sin material identificado",
        sub: cat ? `${cat.anchos.length} ancho${cat.anchos.length === 1 ? "" : "s"} en catálogo` : "OT manual o sin sustrato",
        rolls,
        stockMl,
        precioMl,
      });
    }
  }
  // Urgentes primero dentro de cada material.
  for (const lista of jobs.values()) {
    lista.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.code.localeCompare(b.code));
  }
  return { jobs, techs, materials };
}

/* ─────────── Motor de nesting (shelf-packing FFDH con rotación) ─────────── */

type SimPlaced = { x: number; y: number; w: number; h: number; id: string };

type SimPackResult = {
  placed: SimPlaced[];
  totalLen: number;
  utilization: number;
  pieceArea: number;
  wasteArea: number;
  /** Jobs con alguna pieza que no entra en el ancho (todo o nada por job). */
  incompatible: string[];
  pieces: number;
};

function simPack(jobs: VJob[], rollCm: number, opts: { margin?: number; gap?: number } = {}): SimPackResult {
  const margin = opts.margin ?? 3;
  const gap = opts.gap ?? 1.5;
  const usable = rollCm - margin * 2;

  const rects: Array<{ w: number; h: number; id: string }> = [];
  const incompatible: string[] = [];
  for (const job of jobs) {
    if (job.sinMedidas) continue;
    // Todo o nada: si una pieza del job no entra, el job no se imprime acá.
    if (job.piezas.some((pieza) => Math.min(pieza.w, pieza.h) > usable)) {
      incompatible.push(job.id);
      continue;
    }
    for (const pieza of job.piezas) {
      for (let c = 0; c < pieza.copies; c++) rects.push({ w: pieza.w, h: pieza.h, id: job.id });
    }
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

type SimRollResult = SimPackResult & {
  rollCm: number;
  stockMl: number | null;
  stockOk: boolean;
  precioMl: number | null;
  /** Costo del largo consumido en ESTE ancho ($, null sin precio). */
  costo: number | null;
};

function simCompareRolls(jobs: VJob[], material: VMaterial) {
  const results: SimRollResult[] = material.rolls.map((rollCm) => {
    const r = simPack(jobs, rollCm);
    const stockMl = material.stockMl[rollCm] ?? null;
    const precioMl = material.precioMl[rollCm] ?? null;
    return {
      rollCm,
      ...r,
      stockMl,
      // Sin dato de stock no se bloquea la sugerencia (se muestra "—").
      stockOk: stockMl === null || stockMl >= r.totalLen / 100,
      precioMl,
      costo: precioMl !== null ? (r.totalLen / 100) * precioMl : null,
    };
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

const fmtPesos = (n: number) =>
  `$${Math.round(n).toLocaleString("es-AR")}`;

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
                {colorLabel(p.id, colorMap)}
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

/** Etiqueta corta dentro de la pieza: el índice de color del job. */
const labelPorJob = new WeakMap<Record<string, string>, Map<string, string>>();
function colorLabel(id: string, colorMap: Record<string, string>) {
  let mapa = labelPorJob.get(colorMap);
  if (!mapa) {
    mapa = new Map(Object.keys(colorMap).map((jobId, i) => [jobId, `#${i + 1}`]));
    labelPorJob.set(colorMap, mapa);
  }
  return mapa.get(id) ?? "";
}

/* ─────────── Card por material ─────────── */

function SimMaterialCard({
  material,
  jobs,
  excluded,
  onToggle,
  onCompletar,
  completando,
}: {
  material: VMaterial;
  jobs: VJob[];
  excluded: Set<string>;
  onToggle: (id: string) => void;
  onCompletar: (
    pasoIds: string[],
    duracionTandaMin?: number,
    ahorro?: AhorroConsolidacionPayload,
  ) => void;
  completando: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [rollOverride, setRollOverride] = React.useState<number | null>(null);
  // Duración REAL de la tanda (opcional, registro-tiempos D11): se prorratea
  // entre los trabajos del lote. Vacío = cada paso asienta su estimado; NO
  // se prellena para no fabricar "mediciones" que nadie midió.
  const [tanda, setTanda] = React.useState("");
  const tandaMin = Number(tanda);
  const tandaValida = Number.isFinite(tandaMin) && tandaMin >= 1;

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
  const totalM2 = activeJobs.reduce(
    (a, j) => a + j.piezas.reduce((s, p) => s + (p.w * p.h * p.copies) / 10000, 0),
    0,
  );

  // Ahorro vs. COTIZADO por separado (D6): baseline real del motor, no una
  // re-simulación. Si algún job del batch no tiene dato, el $ es parcial.
  const conBaseline = activeJobs.filter(
    (j) => j.consumoCotizadoMl !== null && !j.sinMedidas,
  );
  const separadoMl = conBaseline.reduce((a, j) => a + (j.consumoCotizadoMl ?? 0), 0);
  const separadoPesos = conBaseline.reduce(
    (a, j) =>
      j.precioMlCotizado !== null ? a + (j.consumoCotizadoMl ?? 0) * j.precioMlCotizado : a,
    0,
  );
  const consolidadoMl = shownPack ? shownPack.totalLen / 100 : null;
  const ahorroMl =
    consolidadoMl !== null && conBaseline.length > 0 ? separadoMl - consolidadoMl : null;
  const ahorroPesos =
    shownPack?.costo != null && separadoPesos > 0 ? separadoPesos - shownPack.costo : null;
  const baselineParcial = conBaseline.length < activeJobs.filter((j) => !j.sinMedidas).length;

  const singleRoll = material.rolls.length === 1;
  const completables = activeJobs.map((j) => j.id);
  const estimadoTanda = activeJobs.reduce(
    (acc, j) => acc + (j.duracionEstimadaMin ?? 0),
    0,
  );

  // Ahorro CONCRETADO de la tanda: se persiste al marcar impresos para el
  // acumulado del Panel general. Sin baseline cotizado no hay qué asentar.
  const materiaPrimaId = material.key.split("|")[1];
  const ahorroPayload: AhorroConsolidacionPayload | undefined =
    ahorroMl !== null && consolidadoMl !== null
      ? {
          materiaPrimaId: materiaPrimaId !== SIN_MATERIAL ? materiaPrimaId : undefined,
          materiaPrimaNombre: material.nm,
          tecnologia: material.tech !== SIN_TECNOLOGIA ? material.tech : undefined,
          jobs: activeJobs.length,
          consumoSeparadoMl: r2(separadoMl),
          consumoConsolidadoMl: r2(consolidadoMl),
          ahorroMl: r2(ahorroMl),
          costoSeparado: separadoPesos > 0 ? r2(separadoPesos) : undefined,
          costoConsolidado: shownPack?.costo != null ? r2(shownPack.costo) : undefined,
          ahorroPesos: ahorroPesos !== null ? r2(ahorroPesos) : undefined,
          baselineParcial,
        }
      : undefined;

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
                const pieza0 = j.piezas[0];
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
                        <span className="code mono">{j.code}</span>
                        {j.urgent ? <span className="urg">HOY</span> : null}
                      </div>
                      <div className="j2">{j.cliente} · {j.producto}</div>
                      <div className="j3 mono">
                        {j.sinMedidas
                          ? "sin medidas"
                          : `${simFmt(pieza0.w, 0)}×${simFmt(pieza0.h, 0)} · ${j.copies}u${j.piezas.length > 1 ? ` · ${j.piezas.length} tamaños` : ""}`}
                        {" · "}{j.due}
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
                  rollCm={shownRoll || material.rolls[0] || 100}
                  colorMap={colorMap}
                />
              </div>

              {!singleRoll && material.rolls.length > 0 ? (
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
                          <span className="wa">{r.costo !== null ? fmtPesos(r.costo) : `−${simFmt(r.wasteArea / 10000, 1)}m²`}</span>
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
                    {consolidadoMl !== null ? simFmt(consolidadoMl, 2) : "—"} ml
                    {shownPack?.costo != null ? ` · ${fmtPesos(shownPack.costo)}` : ""}
                  </span>
                </div>
                <div className={`sv ${(ahorroMl ?? 0) >= 0 ? "ok" : ""}`}>
                  <span className="k">Ahorro vs. cotizado{baselineParcial ? " (parcial)" : ""}</span>
                  <span className="v mono">
                    {ahorroMl !== null ? `${simFmt(ahorroMl, 1)} ml` : "—"}
                    {ahorroPesos !== null ? ` · ${fmtPesos(ahorroPesos)}` : ""}
                  </span>
                </div>
                <div
                  className="sim-tanda"
                  title="Si medís cuánto duró la tanda completa, ese tiempo real se reparte entre los trabajos y sirve para calibrar la máquina. Vacío = queda el estimado."
                >
                  <label>Duró</label>
                  <input
                    type="number"
                    min={1}
                    placeholder={estimadoTanda > 0 ? `~${Math.round(estimadoTanda)}` : "min"}
                    value={tanda}
                    onChange={(event) => setTanda(event.target.value)}
                  />
                  <span className="u">min</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary sim-send"
                  disabled={completables.length === 0 || completando}
                  onClick={() =>
                    onCompletar(
                      completables,
                      tandaValida ? tandaMin : undefined,
                      ahorroPayload,
                    )
                  }
                >
                  <ArrowRightIcon />
                  {completando ? "Marcando…" : `Marcar impresos (${completables.length})`}
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

export function SimuladorImpresion({ initialData }: { initialData: SimuladorData }) {
  const [data, setData] = React.useState(initialData);
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());
  const [completando, setCompletando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const completandoRef = React.useRef(false);

  const { jobs: jobsByMat, techs, materials } = React.useMemo(
    () => buildViewModel(data),
    [data],
  );
  const [techKey, setTechKey] = React.useState<string | null>(null);
  const tech = techs.find((t) => t.key === techKey) ?? techs[0] ?? null;

  // Cola EN VIVO (mismo patrón del tablero): pausa oculta + refresh al foco;
  // no se pisa un lote en vuelo. La selección vive por pasoId: lo que otro
  // completa desaparece solo.
  React.useEffect(() => {
    let vivo = true;
    const refrescar = async () => {
      if (document.hidden || completandoRef.current) return;
      try {
        const fresh = await getSimuladorImpresion();
        if (vivo && !completandoRef.current) setData(fresh);
      } catch {
        // Se conserva el último estado.
      }
    };
    const id = window.setInterval(() => void refrescar(), POLL_SIMULADOR_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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

  const completar = async (
    pasoIds: string[],
    duracionTandaMin?: number,
    ahorro?: AhorroConsolidacionPayload,
  ) => {
    setCompletando(true);
    completandoRef.current = true;
    setResultado(null);
    try {
      const res = await completarPasosLote(pasoIds, duracionTandaMin, ahorro);
      const fresh = await getSimuladorImpresion();
      setData(fresh);
      setResultado(
        res.errores.length === 0
          ? `${res.completados} paso${res.completados === 1 ? "" : "s"} de impresión marcados como hechos.`
          : `${res.completados} marcados · ${res.errores.length} con error: ${res.errores.map((e) => e.motivo).join(" / ")}`,
      );
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "No se pudo completar el lote.");
    } finally {
      setCompletando(false);
      completandoRef.current = false;
    }
  };

  const currentTechKey = tech?.key ?? null;
  const techMaterials = materials.filter((m) => m.tech === currentTechKey);
  const techJobs = techMaterials
    .flatMap((m) => jobsByMat.get(m.key) ?? [])
    .filter((j) => !excluded.has(j.id));
  const techM2 = techJobs.reduce(
    (a, j) => a + j.piezas.reduce((s, p) => s + (p.w * p.h * p.copies) / 10000, 0),
    0,
  );
  const techPieces = techJobs.reduce((a, j) => a + j.copies, 0);

  // Ahorro de la tecnología: Σ por material del delta vs. cotizado (D6).
  let techAhorroMl = 0;
  let techAhorroPesos = 0;
  for (const m of techMaterials) {
    const mj = (jobsByMat.get(m.key) ?? []).filter((j) => !excluded.has(j.id));
    if (!mj.length) continue;
    const { results, bestRoll } = simCompareRolls(mj, m);
    const best = results.find((r) => r.rollCm === bestRoll);
    if (!best) continue;
    const conBaseline = mj.filter((j) => j.consumoCotizadoMl !== null && !j.sinMedidas);
    const sepMl = conBaseline.reduce((a, j) => a + (j.consumoCotizadoMl ?? 0), 0);
    const sepPesos = conBaseline.reduce(
      (a, j) => (j.precioMlCotizado !== null ? a + (j.consumoCotizadoMl ?? 0) * j.precioMlCotizado : a),
      0,
    );
    if (conBaseline.length) techAhorroMl += sepMl - best.totalLen / 100;
    if (sepPesos > 0 && best.costo !== null) techAhorroPesos += sepPesos - best.costo;
  }

  const techCount = (tk: string) =>
    materials.filter((m) => m.tech === tk).reduce((acc, m) => acc + (jobsByMat.get(m.key)?.length ?? 0), 0);

  return (
    <div className="sim-scroll">
    <div className="sim-page">
      <div className="sim-head">
        <div className="left">
          <h1>Simulador gran formato</h1>
          <div className="sub">
            Todo lo listo para imprimir por área, consolidado por material, con el
            ancho de rollo óptimo y su costo. Marcá el batch impreso de una.
          </div>
        </div>
        <span className="sim-live">
          <span className="d" />
          Cola en vivo
        </span>
      </div>

      {resultado ? <div className="sim-resultado" role="status">{resultado}</div> : null}

      {techs.length === 0 ? (
        <div className="sim-empty">
          No hay pasos de impresión por área listos para imprimir. Cuando una orden
          emitida llegue a su paso de impresión, aparece acá.
        </div>
      ) : (
        <>
          <div className="sim-techs">
            {techs.map((t) => (
              <button
                type="button"
                key={t.key}
                className={`sim-tech ${currentTechKey === t.key ? "on" : ""}`}
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
              <div className="v mono">{techMaterials.length}</div>
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
            <div className={`sim-kpi ${techAhorroMl >= 0 ? "ok" : ""}`}>
              <div className="k">Ahorro vs. cotizado</div>
              <div className="v mono">
                {simFmt(techAhorroMl, 1)} ml
                {techAhorroPesos !== 0 ? ` · ${fmtPesos(techAhorroPesos)}` : ""}
              </div>
            </div>
          </div>

          <div className="sim-mats">
            <div className="sim-mats-head">
              <span className="ttl">
                Materiales · <span style={{ color: tech?.color }}>{tech?.nm}</span>
              </span>
              <span className="hint">
                Tocá un material para ver el acomodo · tocá un trabajo para excluirlo del batch
              </span>
            </div>
            {techMaterials.map((m) => {
              const mj = jobsByMat.get(m.key) ?? [];
              if (!mj.length) return null;
              return (
                <SimMaterialCard
                  key={m.key}
                  material={m}
                  jobs={mj}
                  excluded={excluded}
                  onToggle={toggle}
                  onCompletar={(pasoIds, tanda, ahorro) => void completar(pasoIds, tanda, ahorro)}
                  completando={completando}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
    </div>
  );
}
