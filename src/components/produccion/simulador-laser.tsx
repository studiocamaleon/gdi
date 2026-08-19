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
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  FileStackIcon,
  PrinterIcon,
  RefreshCwIcon,
} from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePuede } from "@/components/navigation/permisos-provider";

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
  return (
    modoColor.toUpperCase().includes("CMYK") ||
    modoColor.toUpperCase().includes("COLOR")
  );
}

/* ─────────── Batches "enviables juntos" (D2) ─────────── */

export type LaserBatch = {
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
  puedeCompletar: boolean;
  faltantesCompatibilidad: string[];
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
  // Una ausencia no prueba igualdad: cada trabajo incompleto queda aislado.
  return job.compatibilidadKey ?? `incompleto:${job.pasoId}`;
}

export function buildLaserBatches(jobs: LaserJob[]): LaserBatch[] {
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
        puedeCompletar: job.compatibilidadKey !== null,
        faltantesCompatibilidad: [...job.faltantesCompatibilidad],
      };
      porKey.set(key, batch);
    }
    batch.jobs.push(job);
    batch.hojas += job.hojas ?? 0;
    batch.clics += job.clics ?? 0;
    batch.minutos += job.duracionEstimadaMin ?? 0;
    batch.puedeCompletar =
      batch.puedeCompletar && job.compatibilidadKey !== null;
    batch.faltantesCompatibilidad = [
      ...new Set([
        ...batch.faltantesCompatibilidad,
        ...job.faltantesCompatibilidad,
      ]),
    ];
    const dias = diasHastaEntrega(job.fechaEntrega);
    if (dias !== null) {
      batch.minDias =
        batch.minDias === null ? dias : Math.min(batch.minDias, dias);
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

function LaserJobRow({ job, ahoraMs }: { job: LaserJob; ahoraMs: number }) {
  const dias = diasHastaEntrega(job.fechaEntrega);
  const urgente = dias !== null && dias <= 1;
  // "Imprimiendo" honesto (D7): transcurrido vs. estimado, sin inventar RIP.
  const enCurso = job.estado === "en_curso";
  const progreso =
    enCurso && job.iniciadoEl && job.duracionEstimadaMin && ahoraMs > 0
      ? Math.min(
          99,
          Math.round(
            ((ahoraMs - new Date(job.iniciadoEl).getTime()) /
              60000 /
              job.duracionEstimadaMin) *
              100,
          ),
        )
      : null;

  return (
    <div
      className={`laz-job ${urgente ? "urgent" : ""} ${enCurso ? "current" : ""}`}
    >
      <div className="laz-job-l">
        <div className="laz-job-1">
          <span className="code mono">
            {job.codigo.replace("OT-2026-", "")}
          </span>
          {urgente ? (
            <span className="laz-urg">
              {dias !== null && dias < 0
                ? "ATRASADA"
                : dias === 0
                  ? "HOY"
                  : "MAÑANA"}
            </span>
          ) : null}
          {enCurso ? (
            <span className="laz-print mono">
              {progreso !== null ? `${progreso}% · imprimiendo` : "imprimiendo"}
            </span>
          ) : null}
        </div>
        <div className="laz-job-2">
          {job.cliente ? `${job.cliente} · ` : ""}
          {job.producto}
        </div>
        <div className="laz-job-3 mono">
          {job.hojas !== null ? `${lazNum(job.hojas)} hojas` : "hojas s/d"}
          {job.clics !== null ? ` · ${lazNum(job.clics)} clics` : ""}
          {job.duracionEstimadaMin !== null
            ? ` · ${lazFmtTime(job.duracionEstimadaMin)}`
            : ""}
          {" · "}
          {etiquetaEntrega(job.fechaEntrega)}
        </div>
      </div>
      <div className="laz-job-r">
        {job.acabados.map((acabado) => (
          <span key={acabado} className="laz-fin">
            {acabado}
          </span>
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
  puedeGestionar,
  ahoraMs,
}: {
  batch: LaserBatch;
  onCompletar: (pasoIds: string[], duracionTandaMin?: number) => Promise<void>;
  completando: boolean;
  puedeGestionar: boolean;
  ahoraMs: number;
}) {
  const color = esColor(batch.modoColor);
  // Duración REAL de la tanda (opcional, registro-tiempos D11): un solo
  // número medido que el backend prorratea entre los trabajos del lote.
  // Vacío = cada paso asienta su estimado; NO se prellena para no fabricar
  // "mediciones" que nadie midió.
  const [tanda, setTanda] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const inputId = React.useId();
  const tandaMin = Number(tanda);
  const tandaValida = Number.isFinite(tandaMin) && tandaMin >= 1;
  return (
    <div className={`laz-batch ${batch.urgentes > 0 ? "urgent" : ""}`}>
      <div className="laz-batch-head">
        <span className={`laz-batch-ic ${color === false ? "bn" : "col"}`}>
          <FileStackIcon />
        </span>
        <div className="laz-batch-id">
          <div className="nm">
            {batch.papelNombre}
            {batch.gramaje !== null ? ` · ${batch.gramaje}g` : ""}
            {batch.pliego ? ` · pliego ${batch.pliego}` : ""}
          </div>
          <div className="laz-batch-chips">
            {batch.modoColor ? (
              <span className={`laz-chip ${color === false ? "bn" : "col"}`}>
                {batch.modoColor}
              </span>
            ) : (
              <span className="laz-chip">Color s/d</span>
            )}
            <span className="laz-chip">
              {batch.caras === 2
                ? "Doble faz"
                : batch.caras === 1
                  ? "Simple faz"
                  : "Faz s/d"}
            </span>
            <span className="laz-chip mono">
              {batch.jobs.length} trabajo{batch.jobs.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="laz-batch-stats mono">
          <span title="Hojas físicas a cargar en bandeja">
            <FileStackIcon />
            {lazNum(batch.hojas)} hojas
          </span>
          <span title="Tiempo estimado del batch">
            <ClockIcon />
            {batch.minutos > 0 ? `~${lazFmtTime(batch.minutos)}` : "—"}
          </span>
        </div>
        <div className="laz-batch-actions">
          <Field
            orientation="horizontal"
            className="sim-tanda"
            title="Si medís cuánto duró la tanda completa, ese tiempo real se reparte entre los trabajos y sirve para calibrar la máquina. Vacío = queda el estimado."
          >
            <FieldLabel htmlFor={inputId}>Duró</FieldLabel>
            <Input
              id={inputId}
              type="number"
              min={1}
              placeholder={
                batch.minutos > 0 ? `~${Math.round(batch.minutos)}` : "min"
              }
              value={tanda}
              onChange={(event) => setTanda(event.target.value)}
              disabled={!batch.puedeCompletar || !puedeGestionar}
            />
            <span className="u">min</span>
          </Field>
          {batch.puedeCompletar && puedeGestionar ? (
            <Button
              type="button"
              className="laz-lote"
              loading={completando}
              loadingText="Marcando…"
              disabled={batch.jobs.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckIcon data-icon="inline-start" />
              Marcar impresos ({batch.jobs.length})
            </Button>
          ) : batch.puedeCompletar ? (
            <span className="laz-readonly">Sólo lectura</span>
          ) : (
            <span className="laz-incomplete" role="status">
              Faltan {batch.faltantesCompatibilidad.join(", ")}
            </span>
          )}
        </div>
      </div>
      <div className="laz-batch-body">
        {batch.jobs.map((job) => (
          <LaserJobRow key={job.pasoId} job={job} ahoraMs={ahoraMs} />
        ))}
      </div>
      <ConfirmacionDestructiva
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        titulo={`Confirmar tanda de ${batch.papelNombre}`}
        descripcion="Esta acción marcará los pasos como impresos y avanzará sus órdenes de trabajo."
        impacto={[
          `${batch.jobs.length} trabajo${batch.jobs.length === 1 ? "" : "s"} avanzará${batch.jobs.length === 1 ? "" : "n"} de etapa.`,
          `Se confirmará la tanda ${batch.modoColor ?? "sin color"}, ${batch.caras === 2 ? "doble faz" : "simple faz"}.`,
          tandaValida
            ? `Se distribuirán ${Math.round(tandaMin)} minutos reales.`
            : "Se conservarán los tiempos estimados.",
        ]}
        requiereTipear={false}
        accionLabel="Confirmar impresión"
        onConfirmar={async () => {
          await onCompletar(
            batch.jobs.map((job) => job.pasoId),
            tandaValida ? tandaMin : undefined,
          );
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}

/* ─────────── Vista principal ─────────── */

export function SimuladorLaser({
  initialData,
  initialError = null,
}: {
  initialData: SimuladorLaserData;
  initialError?: string | null;
}) {
  const puedeGestionar = usePuede("produccion.gestionar");
  const [data, setData] = React.useState(initialData);
  const [completando, setCompletando] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(
    initialError,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [ahoraMs, setAhoraMs] = React.useState(0);
  const completandoRef = React.useRef(false);

  const refrescar = React.useCallback(async () => {
    if (document.hidden || completandoRef.current) return;
    setRefreshing(true);
    try {
      const fresh = await getSimuladorLaser();
      if (!completandoRef.current) setData(fresh);
      setRefreshError(null);
      setAhoraMs(Date.now());
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la cola.",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    setAhoraMs(Date.now());
    const id = window.setInterval(() => void refrescar(), POLL_LASER_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refrescar]);

  const completar = async (pasoIds: string[], duracionTandaMin?: number) => {
    setCompletando(true);
    completandoRef.current = true;
    setResultado(null);
    try {
      const res = await completarPasosLote(
        pasoIds,
        duracionTandaMin,
        undefined,
        true,
      );
      const fresh = await getSimuladorLaser();
      setData(fresh);
      setRefreshError(null);
      setAhoraMs(Date.now());
      setResultado(
        res.errores.length === 0
          ? `${res.completados} paso${res.completados === 1 ? "" : "s"} de impresión marcados como hechos.`
          : `${res.completados} marcados · ${res.errores.length} con error: ${res.errores.map((e) => e.motivo).join(" / ")}`,
      );
    } catch (err) {
      setResultado(
        err instanceof Error ? err.message : "No se pudo completar el lote.",
      );
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
      nombre:
        jobs[0]?.maquinaNombre ??
        jobs[0]?.centroCostoNombre ??
        "Sin máquina asignada",
      sub: jobs[0]?.maquinaNombre
        ? (jobs[0]?.centroCostoNombre ?? "")
        : "Sin máquina asignada · agrupado por centro",
      batches: buildLaserBatches(jobs),
      minutos: jobs.reduce(
        (acc, job) => acc + (job.duracionEstimadaMin ?? 0),
        0,
      ),
      hojas: jobs.reduce((acc, job) => acc + (job.hojas ?? 0), 0),
      enCurso: jobs.some((job) => job.estado === "en_curso"),
      jobs,
    }));
  }, [data]);

  const totalHojas = data.jobs.reduce((acc, job) => acc + (job.hojas ?? 0), 0);
  const clicsColor = data.jobs
    .filter((j) => esColor(j.modoColor) !== false)
    .reduce((acc, j) => acc + (j.clics ?? 0), 0);
  const clicsBn = data.jobs
    .filter((j) => esColor(j.modoColor) === false)
    .reduce((acc, j) => acc + (j.clics ?? 0), 0);

  return (
    <div className="sim-scroll">
      <div className="sim-page laz-page">
        <div className="sim-head">
          <div className="left">
            <h1>Simulador de impresión láser</h1>
            <div className="sub">
              La cola por hoja consolidada para el operador: cada batch es una
              carga de bandeja (mismo papel, pliego, color y faz) que se manda y
              se marca junta.
            </div>
          </div>
          <span className={`sim-live ${refreshError ? "stale" : ""}`}>
            <span className="d" />
            {refreshError ? "Datos sin actualizar" : "Cola en vivo"}
          </span>
        </div>

        {resultado ? (
          <div className="sim-resultado" role="status">
            {resultado}
          </div>
        ) : null}

        {refreshError ? (
          <Alert variant="destructive" className="sim-alert">
            <AlertTriangleIcon />
            <AlertTitle>No pudimos actualizar la cola</AlertTitle>
            <AlertDescription>
              Conservamos los últimos datos disponibles. {refreshError}
            </AlertDescription>
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                onClick={() => void refrescar()}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Reintentar
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {data.jobs.length === 0 ? (
          refreshError ? null : (
            <div className="sim-empty">
              No hay pasos de impresión por hoja listos para imprimir. Cuando
              una orden emitida llegue a su paso de impresión digital, aparece
              acá.
            </div>
          )
        ) : (
          <>
            <div className="sim-kpis">
              <div className="sim-kpi">
                <div className="k">Trabajos en cola</div>
                <div className="v mono">{data.jobs.length}</div>
              </div>
              <div className="sim-kpi">
                <div className="k">Hojas totales</div>
                <div className="v mono">{lazNum(totalHojas)}</div>
              </div>
              <div className="sim-kpi">
                <div className="k">Clics color</div>
                <div className="v mono">{lazNum(clicsColor)}</div>
              </div>
              <div className="sim-kpi">
                <div className="k">Clics B&N</div>
                <div className="v mono">{lazNum(clicsBn)}</div>
              </div>
            </div>

            <div className="laz-board">
              {lanes.map((lane) => (
                <div key={lane.laneId} className="laz-lane">
                  <div className="laz-lane-head">
                    <span className="laz-lane-ic">
                      <PrinterIcon />
                    </span>
                    <div className="laz-lane-id">
                      <div className="nm">{lane.nombre}</div>
                      <div className="sub">{lane.sub}</div>
                    </div>
                    <div className="laz-lane-stats mono">
                      <span>
                        <b>{lane.jobs.length}</b> en cola
                      </span>
                      <span>
                        <b>{lazNum(lane.hojas)}</b> hojas
                      </span>
                      <span>
                        {lane.enCurso ? "se libera en" : "carga"}{" "}
                        <b>~{lazFmtTime(lane.minutos)}</b>
                      </span>
                    </div>
                  </div>
                  {lane.batches.map((batch) => (
                    <LaserBatchCard
                      key={batch.key}
                      batch={batch}
                      onCompletar={completar}
                      completando={completando}
                      puedeGestionar={puedeGestionar}
                      ahoraMs={ahoraMs}
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
