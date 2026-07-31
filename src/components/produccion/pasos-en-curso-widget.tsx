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

/**
 * ¿Completar dejaría el tiempo inválido (D8)? Mismo criterio del backend:
 * tramos cerrados + el vivo, contra 1 min o 10% del estimado.
 */
function completarSeriaInvalido(tramo: Tramo, ahora: number): boolean {
  const suma = tramo.acumuladoPrevioMin + elapsedMin(tramo, ahora);
  const umbral = Math.max(
    1,
    tramo.duracionEstimadaMin != null ? tramo.duracionEstimadaMin * 0.1 : 0,
  );
  return suma < umbral;
}

/** Chips del micro-prompt: mitad, estimado y doble del estimado del paso. */
function chipsDeclarar(estimado: number | null): number[] {
  if (estimado == null || estimado <= 0) return [];
  const redondo = (n: number) => Math.max(1, Math.round(n));
  return [...new Set([redondo(estimado / 2), redondo(estimado), redondo(estimado * 2)])];
}

const POS_STORAGE_KEY = "pasos-widget-pos";
/** Píxeles a mover antes de considerarlo arrastre (así el click sigue vivo). */
const DRAG_THRESHOLD = 4;
const BORDE = 8;

/**
 * Hace el widget arrastrable por su handle (la píldora o el encabezado). El
 * usuario lo lleva a donde quiera y la posición se recuerda (localStorage). Con
 * umbral: mover < 4px sigue contando como click, así no se rompe expandir/pausar.
 */
function useWidgetArrastrable() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const drag = React.useRef<{
    sx: number; sy: number; ox: number; oy: number; moved: boolean; id: number;
  } | null>(null);
  /** True mientras se arrastra: suprime el click que dispara el pointerup. */
  const arrastrando = React.useRef(false);

  const clamp = React.useCallback((x: number, y: number) => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 0;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(BORDE, window.innerWidth - w - BORDE);
    const maxY = Math.max(BORDE, window.innerHeight - h - BORDE);
    return { x: Math.min(Math.max(BORDE, x), maxX), y: Math.min(Math.max(BORDE, y), maxY) };
  }, []);

  // Posición guardada; se re-encajota por si la ventana cambió de tamaño.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p?.x === "number" && typeof p?.y === "number") setPos(clamp(p.x, p.y));
    } catch {
      /* posición corrupta: se ignora, vuelve al ancla por defecto */
    }
  }, [clamp]);

  // Al achicar la ventana, mantenerlo dentro.
  React.useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  // Persistir en cada cambio de posición (no en el pointerup): así no depende
  // de que ese evento llegue, y sobrevive a recargas y cambios de página.
  React.useEffect(() => {
    if (!pos) return;
    try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos)); } catch { /* sin persistencia */ }
  }, [pos]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    drag.current = {
      sx: e.clientX, sy: e.clientY,
      ox: e.clientX - rect.left, oy: e.clientY - rect.top,
      moved: false, id: e.pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = drag.current;
    if (!st || e.pointerId !== st.id) return;
    if (!st.moved && Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < DRAG_THRESHOLD) return;
    st.moved = true;
    arrastrando.current = true;
    setPos(clamp(e.clientX - st.ox, e.clientY - st.oy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = drag.current;
    if (!st || e.pointerId !== st.id) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (st.moved) {
      // La persistencia la hace el efecto sobre `pos`. Acá sólo se suprime el
      // click sintético que llega justo después del pointerup.
      setTimeout(() => { arrastrando.current = false; }, 0);
    }
    drag.current = null;
  };

  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { cursor: "grab", touchAction: "none" as const },
  };
  const rootStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};
  return { rootRef, handleProps, rootStyle, arrastrando };
}

export function PasosEnCursoWidget() {
  const [tramos, setTramos] = React.useState<Tramo[]>([]);
  const [expanded, setExpanded] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pausandoId, setPausandoId] = React.useState<string | null>(null);
  const [motivo, setMotivo] = React.useState<string | null>(null);
  const [detalle, setDetalle] = React.useState("");
  const [declarandoId, setDeclarandoId] = React.useState<string | null>(null);
  const [tiempoOtro, setTiempoOtro] = React.useState("");
  /** Prompt de inactividad activo: paso + momento límite de la auto-pausa. */
  const [prompt, setPrompt] = React.useState<{ pasoId: string; deadline: number } | null>(null);
  const [ahora, setAhora] = React.useState(() => Date.now());
  const snoozesRef = React.useRef(new Map<string, number>());
  const disparandoRef = React.useRef(false);
  const { rootRef, handleProps, rootStyle, arrastrando } = useWidgetArrastrable();

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
    payload: {
      accion: "pausar" | "completar";
      motivo?: string;
      motivoDetalle?: string;
      tiempoDeclaradoMin?: number;
    },
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
      setDeclarandoId(null);
      setTiempoOtro("");
      if (prompt?.pasoId === tramo.pasoId) setPrompt(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ejecutar la acción.");
    } finally {
      setBusyId(null);
    }
  };

  // D8: completar con menos del umbral trabajado ofrece declarar primero.
  const completarConPrompt = (tramo: Tramo) => {
    if (completarSeriaInvalido(tramo, Date.now())) setDeclarandoId(tramo.pasoId);
    else void accion(tramo, { accion: "completar" });
  };

  const seguirTrabajando = (pasoId: string) => {
    snoozesRef.current.set(pasoId, Date.now() + SNOOZE_MS);
    setPrompt(null);
  };

  if (tramos.length === 0) return null;

  const masViejo = tramos[0];

  if (!expanded) {
    return (
      <div className="pasos-widget" ref={rootRef} style={rootStyle}>
        <button
          type="button"
          className="pw-pill"
          {...handleProps}
          title="Arrastrá para mover · clic para abrir"
          onClick={() => {
            if (arrastrando.current) return; // fue un arrastre, no un clic
            setExpanded(true);
          }}
        >
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
    <div className="pasos-widget" ref={rootRef} style={rootStyle}>
      <div className="pw-panel">
        <div className="pw-head">
          <span className="pw-title" {...handleProps} title="Arrastrá para mover">
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

              {declarandoId === tramo.pasoId ? (
                <div className="pw-pausa">
                  <div className="pw-prompt-txt">
                    Casi no hay tiempo registrado. ¿Cuánto llevó aprox?
                  </div>
                  <div className="pw-chips">
                    {chipsDeclarar(tramo.duracionEstimadaMin).map((min) => (
                      <button
                        key={min}
                        type="button"
                        className="pw-chip"
                        disabled={busy}
                        onClick={() =>
                          void accion(tramo, { accion: "completar", tiempoDeclaradoMin: min })
                        }
                      >
                        {etiquetaDuracion(min)}
                      </button>
                    ))}
                    <input
                      style={{ width: 64, flex: "0 0 auto" }}
                      type="number"
                      min={1}
                      placeholder="min"
                      value={tiempoOtro}
                      onChange={(event) => setTiempoOtro(event.target.value)}
                    />
                    {Number.isFinite(Number(tiempoOtro)) && Number(tiempoOtro) >= 1 ? (
                      <button
                        type="button"
                        className="pw-chip on"
                        disabled={busy}
                        onClick={() =>
                          void accion(tramo, {
                            accion: "completar",
                            tiempoDeclaradoMin: Number(tiempoOtro),
                          })
                        }
                      >
                        Usar {etiquetaDuracion(Number(tiempoOtro))}
                      </button>
                    ) : null}
                  </div>
                  <div className="pw-actions">
                    <button
                      type="button"
                      className="pw-btn"
                      disabled={busy}
                      onClick={() => void accion(tramo, { accion: "completar" })}
                    >
                      Completar sin tiempo
                    </button>
                    <button
                      type="button"
                      className="pw-btn"
                      onClick={() => {
                        setDeclarandoId(null);
                        setTiempoOtro("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : pausandoId === tramo.pasoId ? (
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
                    onClick={() => completarConPrompt(tramo)}
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
