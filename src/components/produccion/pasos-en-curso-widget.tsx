"use client";

/**
 * Widget flotante "En curso": los tramos de trabajo ABIERTOS del usuario,
 * visibles en toda la zona autenticada (registro-tiempos-produccion §7).
 * Polling liviano a mis-tramos; sin tramos no renderiza nada. Incluye el
 * prompt de inactividad (D13): pasado el umbral pregunta si sigue ahí y,
 * sin respuesta en 5 minutos, pausa automáticamente.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon, PauseIcon, TimerIcon } from "lucide-react";

import {
  accionPasoProduccion,
  autoPausarPaso,
  getMisTramosAbiertos,
  TRAMOS_CAMBIARON_EVENT,
  type MisTramosAbiertos,
} from "@/lib/ordenes-trabajo-api";
import { etiquetaDuracion, MOTIVOS_PAUSA } from "@/lib/tablero-produccion";

type Tramo = MisTramosAbiertos["tramos"][number];

const POLL_MS = 30_000;
/** Countdown del prompt de inactividad antes de la auto-pausa (D13). */
const COUNTDOWN_MS = 5 * 60_000;
/** "Sigo trabajando" pospone el próximo prompt este tiempo. */
const SNOOZE_MS = 30 * 60_000;

function elapsedMin(tramo: Tramo, ahora: number): number {
  return Math.max(0, (ahora - new Date(tramo.inicioEl).getTime()) / 60_000);
}

/** Umbral de inactividad (D13): 3× el estimado, mínimo 30'; sin estimado 60'. */
function umbralMin(tramo: Tramo): number {
  return tramo.duracionEstimadaMin != null && tramo.duracionEstimadaMin > 0
    ? Math.max(tramo.duracionEstimadaMin * 3, 30)
    : 60;
}

function labelCrono(tramo: Tramo, ahora: number): string {
  const transcurrido = etiquetaDuracion(Math.max(1, elapsedMin(tramo, ahora))) ?? "1 min";
  const estimado = etiquetaDuracion(tramo.duracionEstimadaMin);
  return estimado ? `${transcurrido} · est. ${estimado}` : transcurrido;
}

export function PasosEnCursoWidget() {
  const [tramos, setTramos] = React.useState<Tramo[]>([]);
  const [expanded, setExpanded] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pausandoId, setPausandoId] = React.useState<string | null>(null);
  const [motivo, setMotivo] = React.useState<string | null>(null);
  const [detalle, setDetalle] = React.useState("");
  /** Prompt de inactividad activo: paso + momento límite de la auto-pausa. */
  const [prompt, setPrompt] = React.useState<{ pasoId: string; deadline: number } | null>(null);
  const [ahora, setAhora] = React.useState(() => Date.now());
  const snoozesRef = React.useRef(new Map<string, number>());
  const disparandoRef = React.useRef(false);

  const refetch = React.useCallback(async () => {
    try {
      const data = await getMisTramosAbiertos();
      setTramos(data.tramos);
    } catch {
      // Silencioso: el widget es informativo, el próximo poll reintenta.
    }
  }, []);

  React.useEffect(() => {
    void refetch();
    const timer = setInterval(() => {
      if (!document.hidden) void refetch();
    }, POLL_MS);
    // Refresco INSTANTÁNEO: cualquier acción propia sobre pasos (tablero,
    // simuladores o el propio widget) avisa por evento; y al volver el
    // foco a la pestaña no se espera el próximo poll.
    const onCambio = () => void refetch();
    const onFoco = () => {
      if (!document.hidden) void refetch();
    };
    window.addEventListener(TRAMOS_CAMBIARON_EVENT, onCambio);
    window.addEventListener("focus", onFoco);
    document.addEventListener("visibilitychange", onFoco);
    return () => {
      clearInterval(timer);
      window.removeEventListener(TRAMOS_CAMBIARON_EVENT, onCambio);
      window.removeEventListener("focus", onFoco);
      document.removeEventListener("visibilitychange", onFoco);
    };
  }, [refetch]);

  // Reloj del cronómetro y del countdown (1 s; barato, sólo con tramos).
  React.useEffect(() => {
    if (tramos.length === 0) return;
    const timer = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [tramos.length]);

  // D13 — armar el prompt cuando un tramo supera su umbral (sin snooze).
  React.useEffect(() => {
    if (prompt && !tramos.some((t) => t.pasoId === prompt.pasoId)) {
      setPrompt(null);
      return;
    }
    if (prompt) return;
    const vencido = tramos.find(
      (t) =>
        elapsedMin(t, ahora) > umbralMin(t) &&
        (snoozesRef.current.get(t.pasoId) ?? 0) < ahora,
    );
    if (vencido) {
      setPrompt({ pasoId: vencido.pasoId, deadline: ahora + COUNTDOWN_MS });
      setExpanded(true);
    }
  }, [tramos, ahora, prompt]);

  // D13 — countdown vencido sin respuesta: auto-pausa.
  React.useEffect(() => {
    if (!prompt || ahora < prompt.deadline || disparandoRef.current) return;
    disparandoRef.current = true;
    const tramo = tramos.find((t) => t.pasoId === prompt.pasoId);
    void autoPausarPaso(prompt.pasoId)
      .then(() => {
        toast.info(
          `"${tramo?.pasoNombre ?? "Paso"}" se pausó solo: no respondiste si seguías trabajando.`,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        disparandoRef.current = false;
        setPrompt(null);
        void refetch();
      });
  }, [prompt, ahora, tramos, refetch]);

  const accion = async (
    tramo: Tramo,
    payload: { accion: "pausar" | "completar"; motivo?: string; motivoDetalle?: string },
  ) => {
    setBusyId(tramo.pasoId);
    try {
      await accionPasoProduccion(tramo.ordenId, tramo.itemId, tramo.pasoId, payload);
      if (payload.accion === "completar") {
        toast.success(`"${tramo.pasoNombre}" completado.`);
      }
      setPausandoId(null);
      setMotivo(null);
      setDetalle("");
      if (prompt?.pasoId === tramo.pasoId) setPrompt(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ejecutar la acción.");
    } finally {
      setBusyId(null);
    }
  };

  const seguirTrabajando = (pasoId: string) => {
    snoozesRef.current.set(pasoId, Date.now() + SNOOZE_MS);
    setPrompt(null);
  };

  if (tramos.length === 0) return null;

  const masViejo = tramos[0];

  if (!expanded) {
    return (
      <div className="pasos-widget">
        <button type="button" className="pw-pill" onClick={() => setExpanded(true)}>
          <span className="pw-pill-dot" />
          <TimerIcon />
          <span>
            {tramos.length === 1
              ? masViejo.pasoNombre
              : `${tramos.length} pasos en curso`}
          </span>
          <span className="pw-pill-time">
            {etiquetaDuracion(Math.max(1, elapsedMin(masViejo, ahora)))}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pasos-widget">
      <div className="pw-panel">
        <div className="pw-head">
          <span className="pw-title">
            <TimerIcon />
            En curso · {tramos.length}
          </span>
          <button type="button" className="pw-min" onClick={() => setExpanded(false)} title="Minimizar">
            <ChevronDownIcon />
          </button>
        </div>

        {tramos.map((tramo) => {
          const busy = busyId === tramo.pasoId;
          const conPrompt = prompt?.pasoId === tramo.pasoId;
          const restanteSeg = conPrompt
            ? Math.max(0, Math.round((prompt.deadline - ahora) / 1000))
            : 0;
          return (
            <div key={tramo.id} className={`pw-item ${conPrompt ? "warn" : ""}`}>
              <div className="pw-item-top">
                <span className="pw-paso">{tramo.pasoNombre}</span>
                <span className="pw-crono">{labelCrono(tramo, ahora)}</span>
              </div>
              <div className="pw-item-sub">
                {tramo.ordenNumero} · {tramo.clienteNombre} · {tramo.itemNombre}
              </div>

              {conPrompt ? (
                <div className="pw-prompt">
                  <div className="pw-prompt-txt">
                    ¿Seguís con este paso? Se pausa solo en{" "}
                    <strong>
                      {Math.floor(restanteSeg / 60)}:{String(restanteSeg % 60).padStart(2, "0")}
                    </strong>
                  </div>
                  <div className="pw-actions">
                    <button
                      type="button"
                      className="pw-btn primary"
                      onClick={() => seguirTrabajando(tramo.pasoId)}
                    >
                      Sigo trabajando
                    </button>
                    <button
                      type="button"
                      className="pw-btn"
                      disabled={busy}
                      onClick={() => setPausandoId(tramo.pasoId)}
                    >
                      <PauseIcon />Pausar
                    </button>
                  </div>
                </div>
              ) : null}

              {pausandoId === tramo.pasoId ? (
                <div className="pw-pausa">
                  <div className="pw-chips">
                    {MOTIVOS_PAUSA.map((entry) => (
                      <button
                        key={entry.codigo}
                        type="button"
                        className={`pw-chip ${motivo === entry.codigo ? "on" : ""}`}
                        onClick={() => setMotivo(entry.codigo)}
                      >
                        {entry.etiqueta}
                      </button>
                    ))}
                  </div>
                  {motivo === "otro" ? (
                    <input
                      autoFocus
                      placeholder="Contanos brevemente el motivo"
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                    />
                  ) : null}
                  <div className="pw-actions">
                    <button
                      type="button"
                      className="pw-btn primary"
                      disabled={busy || !motivo || (motivo === "otro" && detalle.trim().length === 0)}
                      onClick={() =>
                        void accion(tramo, {
                          accion: "pausar",
                          motivo: motivo ?? undefined,
                          motivoDetalle: motivo === "otro" ? detalle.trim() : undefined,
                        })
                      }
                    >
                      <PauseIcon />Pausar
                    </button>
                    <button
                      type="button"
                      className="pw-btn"
                      onClick={() => {
                        setPausandoId(null);
                        setMotivo(null);
                        setDetalle("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : !conPrompt ? (
                <div className="pw-actions">
                  <button
                    type="button"
                    className="pw-btn"
                    disabled={busy}
                    onClick={() => setPausandoId(tramo.pasoId)}
                  >
                    <PauseIcon />Pausar
                  </button>
                  <button
                    type="button"
                    className="pw-btn primary"
                    disabled={busy}
                    onClick={() => void accion(tramo, { accion: "completar" })}
                  >
                    <CheckIcon />Completar
                  </button>
                  <Link
                    className="pw-link"
                    href={`/produccion/tablero?item=${tramo.itemId}`}
                    title="Abrir el detalle de este paso en el tablero"
                  >
                    Ver paso
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
