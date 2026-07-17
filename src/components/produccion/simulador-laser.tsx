"use client";

/**
 * Simulador de impresión LÁSER — cola real de pasos `impresion_por_hoja`
 * en frontera, por CENTRO láser, agrupada en BATCHES "enviables juntos":
 * mismo papel (tipo + gramaje + pliego) + modo de color + caras = una
 * carga de bandeja y un "Marcar impresos". Sin nesting: acá lo que manda
 * es el pliego, el gramaje y las hojas físicas, no la pieza final.
 * Orden por entrega. Ver docs/simulador-laser-diseno.md
 */

import * as React from "react";
import { CheckIcon, ClockIcon, FileStackIcon, PrinterIcon } from "lucide-react";

import {
  getSimuladorLaser,
  type LaserJob,
  type SimuladorLaserData,
} from "@/lib/simulador-laser-api";
import { completarPasosLote } from "@/lib/ordenes-trabajo-api";
import { diasHastaEntrega, etiquetaEntrega } from "@/lib/tablero-produccion";

const POLL_LASER_MS = 15000;

const lazNum = (n: number) => n.toLocaleString("es-AR");

function lazFmtTime(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m.toString().padStart(2, "0")}`;
}

/** Color vs B&N: identificación VISUAL nada más (D5). */
function esColor(modoColor: string | null) {
  if (!modoColor) return null;
  return modoColor.toUpperCase().includes("CMYK") || modoColor.toUpperCase().includes("COLOR");
}

/* ─────────── Batches "enviables juntos" (D2) ─────────── */

type LaserBatch = {
  key: string;
  papelNombre: string;
  gramaje: number | null;
  pliego: string | null;
  modoColor: string | null;
  caras: 1 | 2 | null;
  jobs: LaserJob[];
  hojas: number;
  clics: number;
  minutos: number;
  minDias: number | null;
  urgentes: number;
};

/** "A4 (210×297)" — el pliego de IMPRESIÓN, no el formato de compra. */
function etiquetaPliego(pliego: LaserJob["pliego"]): string | null {
  if (!pliego) return null;
  const dims =
    pliego.anchoMm !== null && pliego.altoMm !== null
      ? `${pliego.anchoMm}×${pliego.altoMm}`
      : null;
  if (pliego.preset && dims) return `${pliego.preset} (${dims})`;
  return pliego.preset ?? dims;
}

function batchKeyDe(job: LaserJob) {
  const papel = job.papel ? `${job.papel.nombre}|${job.papel.gramaje ?? "?"}` : "sin-papel";
  return `${papel}|${etiquetaPliego(job.pliego) ?? "?"}|${job.modoColor ?? "sin-color"}|${job.caras ?? "?"}`;
}

function buildBatches(jobs: LaserJob[]): LaserBatch[] {
  const porKey = new Map<string, LaserBatch>();
  for (const job of jobs) {
    const key = batchKeyDe(job);
    let batch = porKey.get(key);
    if (!batch) {
      batch = {
        key,
        papelNombre: job.papel?.nombre ?? "Sin papel identificado",
        gramaje: job.papel?.gramaje ?? null,
        pliego: etiquetaPliego(job.pliego),
        modoColor: job.modoColor,
        caras: job.caras,
        jobs: [],
        hojas: 0,
        clics: 0,
        minutos: 0,
        minDias: null,
        urgentes: 0,
      };
      porKey.set(key, batch);
    }
    batch.jobs.push(job);
    batch.hojas += job.hojas ?? 0;
    batch.clics += job.clics ?? 0;
    batch.minutos += job.duracionEstimadaMin ?? 0;
    const dias = diasHastaEntrega(job.fechaEntrega);
    if (dias !== null) {
      batch.minDias = batch.minDias === null ? dias : Math.min(batch.minDias, dias);
      if (dias <= 1) batch.urgentes += 1;
    }
  }
  // Orden por ENTREGA (D4): el batch más urgente primero, y adentro igual.
  for (const batch of porKey.values()) {
    batch.jobs.sort((a, b) => {
      const da = diasHastaEntrega(a.fechaEntrega);
      const db = diasHastaEntrega(b.fechaEntrega);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }
  return [...porKey.values()].sort((a, b) => {
    if (a.minDias === null && b.minDias === null) return 0;
    if (a.minDias === null) return 1;
    if (b.minDias === null) return -1;
    return a.minDias - b.minDias;
  });
}

/* ─────────── Job (fila dentro del batch) ─────────── */

function LaserJobRow({ job }: { job: LaserJob }) {
  const dias = diasHastaEntrega(job.fechaEntrega);
  const urgente = dias !== null && dias <= 1;
  // "Imprimiendo" honesto (D7): transcurrido vs. estimado, sin inventar RIP.
  const enCurso = job.estado === "en_curso";
  const progreso =
    enCurso && job.iniciadoEl && job.duracionEstimadaMin
      ? Math.min(
          99,
          Math.round(
            ((Date.now() - new Date(job.iniciadoEl).getTime()) / 60000 / job.duracionEstimadaMin) * 100,
          ),
        )
      : null;

  return (
    <div className={`laz-job ${urgente ? "urgent" : ""} ${enCurso ? "current" : ""}`}>
      <div className="laz-job-l">
        <div className="laz-job-1">
          <span className="code mono">{job.codigo.replace("OT-2026-", "")}</span>
          {urgente ? <span className="laz-urg">{dias !== null && dias <= 0 ? "HOY" : "MAÑANA"}</span> : null}
          {enCurso ? <span className="laz-print mono">{progreso !== null ? `${progreso}% · imprimiendo` : "imprimiendo"}</span> : null}
        </div>
        <div className="laz-job-2">{job.cliente} · {job.producto}</div>
        <div className="laz-job-3 mono">
          {job.hojas !== null ? `${lazNum(job.hojas)} hojas` : "hojas s/d"}
          {job.clics !== null ? ` · ${lazNum(job.clics)} clics` : ""}
          {job.duracionEstimadaMin !== null ? ` · ${lazFmtTime(job.duracionEstimadaMin)}` : ""}
          {" · "}{etiquetaEntrega(job.fechaEntrega)}
        </div>
      </div>
      <div className="laz-job-r">
        {job.acabados.map((acabado) => (
          <span key={acabado} className="laz-fin">{acabado}</span>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Batch card ─────────── */

function LaserBatchCard({
  batch,
  onCompletar,
  completando,
}: {
  batch: LaserBatch;
  onCompletar: (pasoIds: string[]) => void;
  completando: boolean;
}) {
  const color = esColor(batch.modoColor);
  return (
    <div className={`laz-batch ${batch.urgentes > 0 ? "urgent" : ""}`}>
      <div className="laz-batch-head">
        <span className={`laz-batch-ic ${color === false ? "bn" : "col"}`}><FileStackIcon /></span>
        <div className="laz-batch-id">
          <div className="nm">
            {batch.papelNombre}
            {batch.gramaje !== null ? ` · ${batch.gramaje}g` : ""}
            {batch.pliego ? ` · pliego ${batch.pliego}` : ""}
          </div>
          <div className="laz-batch-chips">
            {batch.modoColor ? (
              <span className={`laz-chip ${color === false ? "bn" : "col"}`}>{batch.modoColor}</span>
            ) : (
              <span className="laz-chip">Color s/d</span>
            )}
            <span className="laz-chip">{batch.caras === 2 ? "Doble faz" : batch.caras === 1 ? "Simple faz" : "Faz s/d"}</span>
            <span className="laz-chip mono">{batch.jobs.length} trabajo{batch.jobs.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="laz-batch-stats mono">
          <span title="Hojas físicas a cargar en bandeja"><FileStackIcon />{lazNum(batch.hojas)} hojas</span>
          <span title="Tiempo estimado del batch"><ClockIcon />{batch.minutos > 0 ? `~${lazFmtTime(batch.minutos)}` : "—"}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary laz-lote"
          disabled={completando || batch.jobs.length === 0}
          onClick={() => onCompletar(batch.jobs.map((job) => job.pasoId))}
        >
          <CheckIcon />
          {completando ? "Marcando…" : `Marcar impresos (${batch.jobs.length})`}
        </button>
      </div>
      <div className="laz-batch-body">
        {batch.jobs.map((job) => <LaserJobRow key={job.pasoId} job={job} />)}
      </div>
    </div>
  );
}

/* ─────────── Vista principal ─────────── */

export function SimuladorLaser({ initialData }: { initialData: SimuladorLaserData }) {
  const [data, setData] = React.useState(initialData);
  const [completando, setCompletando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const completandoRef = React.useRef(false);

  React.useEffect(() => {
    let vivo = true;
    const refrescar = async () => {
      if (document.hidden || completandoRef.current) return;
      try {
        const fresh = await getSimuladorLaser();
        if (vivo && !completandoRef.current) setData(fresh);
      } catch {
        // Se conserva el último estado.
      }
    };
    const id = window.setInterval(() => void refrescar(), POLL_LASER_MS);
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

  const completar = async (pasoIds: string[]) => {
    setCompletando(true);
    completandoRef.current = true;
    setResultado(null);
    try {
      const res = await completarPasosLote(pasoIds);
      const fresh = await getSimuladorLaser();
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

  // Lanes por MÁQUINA asignada (la del cotizador, o la default de la
  // config del paso); sin máquina resuelta, el centro como fallback.
  const lanes = React.useMemo(() => {
    const porMaquina = new Map<string, LaserJob[]>();
    for (const job of data.jobs) {
      const key = job.maquinaId ?? job.centroCostoId ?? "sin-maquina";
      const lista = porMaquina.get(key) ?? [];
      lista.push(job);
      porMaquina.set(key, lista);
    }
    return [...porMaquina.entries()].map(([laneId, jobs]) => ({
      laneId,
      nombre: jobs[0]?.maquinaNombre ?? jobs[0]?.centroCostoNombre ?? "Sin máquina asignada",
      sub: jobs[0]?.maquinaNombre
        ? (jobs[0]?.centroCostoNombre ?? "")
        : "Sin máquina asignada · agrupado por centro",
      batches: buildBatches(jobs),
      minutos: jobs.reduce((acc, job) => acc + (job.duracionEstimadaMin ?? 0), 0),
      hojas: jobs.reduce((acc, job) => acc + (job.hojas ?? 0), 0),
      enCurso: jobs.some((job) => job.estado === "en_curso"),
      jobs,
    }));
  }, [data]);

  const totalHojas = data.jobs.reduce((acc, job) => acc + (job.hojas ?? 0), 0);
  const clicsColor = data.jobs.filter((j) => esColor(j.modoColor) !== false).reduce((acc, j) => acc + (j.clics ?? 0), 0);
  const clicsBn = data.jobs.filter((j) => esColor(j.modoColor) === false).reduce((acc, j) => acc + (j.clics ?? 0), 0);
  const urgentes = data.jobs.filter((j) => {
    const dias = diasHastaEntrega(j.fechaEntrega);
    return dias !== null && dias <= 1;
  }).length;
  const imprimiendo = data.jobs.filter((j) => j.estado === "en_curso").length;

  // Cuello de botella: sólo tiene sentido con más de una lane (comparar).
  const cuello = lanes.length > 1
    ? [...lanes].sort((a, b) => b.minutos - a.minutos)[0]
    : null;

  return (
    <div className="sim-scroll">
    <div className="sim-page laz-page">
      <div className="sim-head">
        <div className="left">
          <h1>Simulador de impresión láser</h1>
          <div className="sub">
            La cola por hoja consolidada para el operador: cada batch es una carga de
            bandeja (mismo papel, pliego, color y faz) que se manda y se marca junta.
          </div>
        </div>
        <span className="sim-live"><span className="d" />Cola en vivo</span>
      </div>

      {resultado ? <div className="sim-resultado" role="status">{resultado}</div> : null}

      {data.jobs.length === 0 ? (
        <div className="sim-empty">
          No hay pasos de impresión por hoja listos para imprimir. Cuando una orden
          emitida llegue a su paso de impresión digital, aparece acá.
        </div>
      ) : (
        <>
          <div className="sim-kpis">
            <div className="sim-kpi"><div className="k">Trabajos en cola</div><div className="v mono">{data.jobs.length}</div></div>
            <div className="sim-kpi"><div className="k">Hojas totales</div><div className="v mono">{lazNum(totalHojas)}</div></div>
            <div className="sim-kpi"><div className="k">Clics color</div><div className="v mono">{lazNum(clicsColor)}</div></div>
            <div className="sim-kpi"><div className="k">Clics B&N</div><div className="v mono">{lazNum(clicsBn)}</div></div>
            <div className={`sim-kpi ${imprimiendo > 0 ? "ok" : ""}`}><div className="k">Imprimiendo</div><div className="v mono">{imprimiendo}</div></div>
            <div className={`sim-kpi ${urgentes > 0 ? "warn" : ""}`}><div className="k">Urgentes</div><div className="v mono">{urgentes}</div></div>
          </div>

          {cuello && cuello.minutos > 0 ? (
            <div className="laz-hint">
              <PrinterIcon />
              <span>
                <b>{cuello.nombre}</b> es el cuello de botella: se libera en{" "}
                <b>~{lazFmtTime(cuello.minutos)}</b>.
              </span>
            </div>
          ) : null}

          <div className="laz-board">
            {lanes.map((lane) => (
              <div key={lane.laneId} className="laz-lane">
                <div className="laz-lane-head">
                  <span className="laz-lane-ic"><PrinterIcon /></span>
                  <div className="laz-lane-id">
                    <div className="nm">{lane.nombre}</div>
                    <div className="sub">{lane.sub}</div>
                  </div>
                  <div className="laz-lane-stats mono">
                    <span><b>{lane.jobs.length}</b> en cola</span>
                    <span><b>{lazNum(lane.hojas)}</b> hojas</span>
                    <span>{lane.enCurso ? "se libera en" : "carga"} <b>~{lazFmtTime(lane.minutos)}</b></span>
                  </div>
                </div>
                {lane.batches.map((batch) => (
                  <LaserBatchCard
                    key={batch.key}
                    batch={batch}
                    onCompletar={(pasoIds) => void completar(pasoIds)}
                    completando={completando}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    </div>
  );
}
