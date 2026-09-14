"use client";
import { modoTableroGuardado, type ModoTablero } from "@/lib/tablero-modos";
import { useProduccionOperativa } from "./use-produccion-operativa";
import { buildItemView, type ItemView, type StepView } from "@/lib/produccion-item-view";

import { calcularProgreso } from "@/lib/progreso-produccion";
import { ProgresoValor } from "./progreso-produccion";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BanIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDotIcon,
  ClockIcon,
  FactoryIcon,
  FileTextIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PauseIcon,
  PrinterIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
  ShieldCheckIcon,
  TruckIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import {
  bucketKanbanProduccion,
  etiquetaDuracion,
  etiquetaMomento,
  etiquetaPasoKanban,
  esItemEnCursoOperativo,
  resolverEstacionDePaso,
  pasoReabrible,
  textoEntregaRelativa,
  TIEMPO_FUENTE_LABELS,
  type TableroItemData,
  type AlcanceTableroProduccion,
  type TableroPasoAccion,
  type TableroPasoData,
  type TableroPrioridad,
} from "@/lib/tablero-produccion";
import { PasoAccionesProduccion } from "./paso-acciones";
import {
  getOrdenTrabajo,
} from "@/lib/ordenes-trabajo-api";
import type {
  OrdenTrabajoDetalle,
  OrdenTrabajoEvento,
} from "@/lib/ordenes-trabajo";
import {
  type Estacion,
} from "@/lib/estaciones";
import type { DiaNoLaborable, DuracionFamilia } from "@/lib/estaciones-api";
import {
  etiquetaEta,
  simularFlujo,
  type ResultadoSimulacion,
  type SimulacionItem,
} from "@/lib/flujo-produccion";
import { claveFechaEnZona } from "@/lib/zona";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { SimulacionView } from "@/components/produccion/simulacion-view";
import { formatBytes, urlDeArchivo, type Archivo } from "@/lib/archivos";
import { listarArchivos } from "@/lib/archivos-api";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BriefDisenoProduccion } from "@/components/comercial/brief-diseno-resumen";
import { leerBriefDiseno, type BriefDiseno } from "@/lib/brief-diseno";
import { Badge } from "@/components/ui/badge";
import loteStyles from "./tablero-lotes.module.css";
import { EtiquetaLote, ContextoLote } from "./lote-contexto";
import operationStyles from "./tablero-operaciones-incorporacion.module.css";
import planificacionStyles from "./planificacion-page.module.css";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Mode = ModoTablero;
type StatusFilter = "all" | "in-progress" | "blocked" | "delayed" | "due-today";
type PriorityFilter = "all" | TableroPrioridad;
type KanbanBucketKey =
  | "not-started"
  | "blocked"
  | "today"
  | "delayed"
  | "active";

const DEFAULT_BOARD_MODE: Mode = "items";
/** Refresco en vivo del dataset (mismo ritmo que el tracking público). */
const BOARD_MODE_STORAGE_KEY = "grafoprint:produccion:tablero-default-mode:v1";
const BOARD_MODE_LABELS: Record<Mode, string> = {
  items: "Por items",
  kanban: "Kanban",
};

function readStoredBoardMode(): Mode {
  if (typeof window === "undefined") return DEFAULT_BOARD_MODE;
  try {
    const saved = window.localStorage.getItem(BOARD_MODE_STORAGE_KEY);
    // Las preferencias retiradas (estación/simulación) vuelven a Por items.
    return modoTableroGuardado(saved);
  } catch {
    return DEFAULT_BOARD_MODE;
  }
}

function writeStoredBoardMode(mode: Mode) {
  try {
    window.localStorage.setItem(BOARD_MODE_STORAGE_KEY, mode);
  } catch {
    // La preferencia es conveniente, no crítica: si el navegador bloquea storage, la UI sigue funcionando.
  }
}

const TIco: Record<string, IconComponent> = {
  Layout: LayoutDashboardIcon,
  Check: CheckIcon,
  Layers: LayersIcon,
  Printer: PrinterIcon,
  Plot: FactoryIcon,
  Cut: ScissorsIcon,
  Brush: PaintbrushIcon,
  Scissors: ScissorsIcon,
  Stamp: CircleDotIcon,
  Fold: LayersIcon,
  Cnc: FactoryIcon,
  Beam: ZapIcon,
  Book: BookOpenIcon,
  Tool: WrenchIcon,
  Shield: ShieldCheckIcon,
  Package: PackageIcon,
  Truck: TruckIcon,
  Wrench: WrenchIcon,
  Block: BanIcon,
};

function getStepIcon(icon: string) {
  return TIco[icon] ?? LayoutDashboardIcon;
}

function priorityLabel(priority: TableroPrioridad) {
  return priority === "urgent"
    ? "Urgente"
    : priority === "high"
      ? "Alta"
      : "Normal";
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Ventana progresiva (performance con listas grandes) ──────────────────
// Las columnas y listas renderizan una VENTANA del dataset — que ya viene
// ordenado por urgencia: sobre la card nº 800 nadie opera — y un sentinel
// con IntersectionObserver monta más al acercarse al fondo. El DOM queda
// acotado sin importar cuántos items haya; los datos completos siguen en
// memoria, así stats y contadores son exactos. Si el día de mañana el
// PAYLOAD del poll pesa (>~500 items), la etapa siguiente es ETag/304 en
// GET /tablero; la virtualización con librería recién con miles reales.

const VENTANA_INICIAL = 30;
const VENTANA_PASO = 30;

function useVentanaProgresiva(total: number) {
  const [limite, setLimite] = React.useState(VENTANA_INICIAL);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const expandir = React.useCallback(
    () => setLimite((actual) => actual + VENTANA_PASO),
    [],
  );

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    // Se re-observa tras cada expansión: si el sentinel sigue en viewport,
    // encadena la siguiente hasta que sale de la ventana visible.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) expandir();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [limite, total, expandir]);

  return { limite, sentinelRef, expandir, hayMas: total > limite };
}

function VentanaSentinel({
  mostrando,
  total,
  expandir,
  sentinelRef,
}: {
  mostrando: number;
  total: number;
  expandir: () => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={sentinelRef} className="ventana-sentinel">
      <span>
        Mostrando {mostrando} de {total}
      </span>
      <button type="button" onClick={expandir}>
        Mostrar más
      </button>
    </div>
  );
}

// ── View-model: derivados de presentación por item ───────────────────────

/**
 * Cronómetro vivo de un tramo abierto: minutos transcurridos desde
 * `desdeIso`, refrescado cada 30 s (suficiente para un taller).
 */
function ElapsedMin({ desdeIso }: { desdeIso: string }) {
  const [ahora, setAhora] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const min = Math.max(1, (ahora - new Date(desdeIso).getTime()) / 60_000);
  return <>{etiquetaDuracion(min)}</>;
}

// ── Ruta compacta (strip de pasos) ───────────────────────────────────────

function routeStatusIcon(step: StepView, fallback?: React.ReactNode) {
  const IconCmp = getStepIcon(step.iconKey);
  if (step.status === "done") return <CheckIcon />;
  if (step.status === "blocked") return <BanIcon />;
  if (step.status === "paused") return <PauseIcon />;
  if (step.status === "pending" && fallback) return fallback;
  return <IconCmp />;
}

function RouteStrip({
  steps,
  compact = false,
}: {
  steps: StepView[];
  compact?: boolean;
}) {
  if (steps.length === 0) {
    return (
      <div className={`route-strip ${compact ? "compact" : ""}`}>
        <div className="route-step pending" title="Item sin ruta de producción">
          <span className="ri-dot">
            <BanIcon />
          </span>
          <span className="ri-label">Sin ruta</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`route-strip ${compact ? "compact" : ""}`}>
      {steps.map((step, index) => {
        // Visual: la frontera pendiente luce como "current" (anillo), aunque
        // semánticamente siga pendiente (el sheet la muestra como estimada).
        const visual =
          step.esActivo && step.status === "pending" ? "current" : step.status;
        const cls =
          `route-step ${visual}` +
          (step.status === "done" ||
          (index > 0 && steps[index - 1]?.status === "done")
            ? " link-done"
            : "");
        return (
          <div
            key={step.paso.id}
            className={cls}
            title={`${step.paso.nombre} · ${step.tec}`}
          >
            <span className="ri-dot">{routeStatusIcon(step)}</span>
            <span className="ri-label">{step.paso.nombre}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista Por items ──────────────────────────────────────────────────────

/**
 * "fin ≈ mar 22" bajo la entrega (Fase 2b): la simulación de flujo contra
 * las colas reales. ROJO + "no llega" si la ETA supera la fecha de entrega
 * — la señal del vendedor ANTES de que el retraso exista. "~" = corrió con
 * supuestos (estación sin calendario o bloqueo asumido como destrabado).
 */
function EtaLine({
  item,
  eta,
}: {
  item: ItemView;
  eta: SimulacionItem | undefined;
}) {
  const { zonaHoraria } = useConfigRegional();
  if (!eta || item.finished) return null;
  if (eta.sinEstimar)
    return <span className="eta-line none">fin sin estimar</span>;
  if (!eta.finEstimado) return null;
  const fin = eta.finEstimado;
  const finClave = claveFechaEnZona(fin, zonaHoraria);
  const late = item.data.fechaEntrega
    ? finClave > item.data.fechaEntrega.slice(0, 10)
    : false;
  const aprox = eta.parcial || eta.asumeDesbloqueo;
  const motivo = [
    eta.parcial ? "estación sin calendario en la ruta" : null,
    eta.asumeDesbloqueo ? "asume desbloqueo inmediato" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      className={`eta-line ${late ? "late" : ""}`}
      title={motivo || undefined}
    >
      fin {aprox ? "~" : "≈"} {etiquetaEta(fin, new Date(), zonaHoraria)}
      {late ? " · no llega" : ""}
    </span>
  );
}

// Memo: misma razón que KanbanCard — ver el comentario de la ventana.
const ItemRow = React.memo(function ItemRow({
  item,
  eta,
  onOpen,
}: {
  item: ItemView;
  eta: SimulacionItem | undefined;
  onOpen: (id: string) => void;
}) {
  const cssRow =
    `tab-row priority-${item.priority}` +
    (item.blocked ? " blocked" : "") +
    (item.delayed && !item.blocked ? " delayed" : "");

  return (
    <button type="button" className={cssRow} onClick={() => onOpen(item.id)}>
      <div className="tab-row-left">
        <div className="tab-row-codes">
          <span className="item-code">{item.code}</span>
          <span className="ot-badge" title="Orden de trabajo origen">
            {item.otCode}
          </span>
          {item.data.loteEntrega ? <EtiquetaLote item={item.data} /> : item.data.componenteDe ? (
            <span
              className="ot-badge"
              title={`${item.data.loteEntregaId ? "Producción por lote" : "Componente fabricado"} de ${item.data.componenteDe.nombre}`}
            >
              Componente
            </span>
          ) : null}
          {item.priority !== "normal" ? (
            <span className={`prio-pill prio-${item.priority}`}>
              {priorityLabel(item.priority)}
            </span>
          ) : null}
        </div>
        <div className="tab-row-product">{item.product}</div>
        <ContextoLote item={item.data} />
        {/* Sólo el cliente: el detalle del producto vive en el sheet. */}
        <div className="tab-row-spec">
          <span className="cust">{item.customer}</span>
        </div>
      </div>

      <div className="tab-row-route">
        <RouteStrip steps={item.steps} />
        <div
          className={`tab-status-line ${item.blocked ? "blocked" : item.delayed ? "delayed" : ""}`}
        >
          <span
            className={`dot ${item.blocked ? "dot-block" : item.delayed ? "dot-warn" : "dot-ok"}`}
          />
          <span>{item.statusLine}</span>
        </div>
      </div>

      <div className="tab-row-right">
        <div
          className={`tab-due ${item.delayed && !item.blocked ? "delayed" : ""}`}
        >
          <span className="due-label">{item.dueLabel}</span>
          <span className="due-in">
            {textoEntregaRelativa(item.dueDays, item.dueIn)}
          </span>
          <EtaLine item={item} eta={eta} />
        </div>
        <div
          className="tab-assigned"
          title={`Estación actual: ${item.station}`}
        >
          <span className="av">
            {item.stationIcon ? (
              React.createElement(getStepIcon(item.stationIcon))
            ) : (
              <FactoryIcon />
            )}
          </span>
          <div>
            <div className="role">Estación actual</div>
            <div className="nm">{item.station}</div>
          </div>
        </div>
      </div>

      <div className="tab-row-cta">
        <ChevronRightIcon />
      </div>
    </button>
  );
});

function FiltersBar({
  filters,
  setFilters,
  counts,
}: {
  filters: { status: StatusFilter; priority: PriorityFilter; query: string };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      status: StatusFilter;
      priority: PriorityFilter;
      query: string;
    }>
  >;
  counts: {
    all: number;
    shown: number;
    inProgress: number;
    blocked: number;
    delayed: number;
    today: number;
  };
}) {
  return (
    <div className="tab-filters">
      <div className="search">
        <SearchIcon />
        <input
          placeholder="Buscar por item, OT, cliente, producto..."
          value={filters.query}
          onChange={(event) =>
            setFilters((current) => ({ ...current, query: event.target.value }))
          }
        />
        <span className="kbd">/</span>
      </div>

      <div className="seg-filter">
        {[
          { k: "all", l: "Todos", c: counts.all },
          { k: "in-progress", l: "En curso", c: counts.inProgress },
          { k: "blocked", l: "Bloqueados", c: counts.blocked },
          { k: "delayed", l: "Con retraso", c: counts.delayed },
          { k: "due-today", l: "Vencen hoy", c: counts.today },
        ].map((status) => (
          <button
            key={status.k}
            type="button"
            className={filters.status === status.k ? "on" : ""}
            aria-pressed={filters.status === status.k}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                status: status.k as StatusFilter,
              }))
            }
          >
            {status.l}
            <span className="ct">{status.c}</span>
          </button>
        ))}
      </div>

      <div className="seg-prio">
        <span className="lbl">Prioridad</span>
        {[
          { k: "all", l: "Todas" },
          { k: "urgent", l: "Urgente" },
          { k: "high", l: "Alta" },
          { k: "normal", l: "Normal" },
        ].map((priority) => (
          <button
            key={priority.k}
            type="button"
            className={filters.priority === priority.k ? "on" : ""}
            aria-pressed={filters.priority === priority.k}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                priority: priority.k as PriorityFilter,
              }))
            }
          >
            {priority.l}
          </button>
        ))}
      </div>

      <div className="tab-filter-summary">
        <strong>{counts.shown}</strong> de <strong>{counts.all}</strong> items
      </div>
    </div>
  );
}

// ── Sheet de detalle: ruta + materiales + actividad reales ───────────────

type AccionHandler = (
  item: ItemView,
  paso: TableroPasoData,
  accion: TableroPasoAccion,
  opts?: {
    motivo?: string;
    motivoDetalle?: string;
    tiempoDeclaradoMin?: number;
    sinTiempoConfirmado?: boolean;
  },
) => Promise<void>;

type GateHandler = (
  paso: TableroPasoData,
  tipo: "MATERIAL" | "CALIDAD",
  estado: "CUMPLIDO" | "PENDIENTE",
) => Promise<void>;

export function GatesOperativos({
  paso,
  busy,
  canSupervise,
  onGate,
}: {
  paso: TableroPasoData;
  busy: boolean;
  canSupervise: boolean;
  onGate: GateHandler;
}) {
  const gates = paso.gatesOperativos ?? [];
  if (!gates.length) return null;
  return (
    <div className="ds-terc">
      {gates.map((gate) => {
        const cumplido = gate.estado === "CUMPLIDO";
        const etiqueta = gate.tipo === "MATERIAL" ? "Material" : "Calidad";
        return (
          <React.Fragment key={gate.id}>
            <span
              className={`dst-badge ${cumplido ? "recibido" : "pendiente"}`}
            >
              {cumplido ? "✓ " : ""}
              {etiqueta}
            </span>
            <span className="dst-info">
              {cumplido
                ? `Confirmado${gate.resueltoPorNombre ? ` por ${gate.resueltoPorNombre}` : ""}`
                : "Pendiente: bloquea la ejecución"}
            </span>
            {canSupervise ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onGate(
                    paso,
                    gate.tipo,
                    cumplido ? "PENDIENTE" : "CUMPLIDO",
                  )
                }
              >
                {cumplido ? "Revocar" : "Confirmar"}
              </Button>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Estado de la compra de un paso tercerizado, en lenguaje del taller. */
const COMPRA_LABELS: Record<string, string> = {
  pendiente: "Compra pendiente",
  pedido: "Pedido al proveedor",
  recibido: "Recibido",
  entregado: "Entregado",
};

function PasoAcciones({
  item,
  step,
  busy,
  canManage,
  canSupervise,
  onAccion,
}: {
  item: ItemView;
  step: StepView;
  busy: boolean;
  canManage: boolean;
  canSupervise: boolean;
  onAccion: AccionHandler;
}) {
  const paso = step.paso;
  if (paso.tipoEjecucion === "tercerizado") return canManage ? (
    <div className="ds-terc"><span className="dst-badge">Tercerizado</span><span className="dst-info">{paso.proveedorNombre ? `${paso.proveedorNombre} · ` : ""}{COMPRA_LABELS[paso.estadoCompra ?? "pendiente"] ?? paso.estadoCompra}{paso.plazoProveedorDias != null ? ` · plazo ${paso.plazoProveedorDias} d` : ""}</span><span className="dst-hint">Se gestiona desde la orden</span></div>
  ) : null;
  return <PasoAccionesProduccion enLinea paso={paso} esActual={step.esActivo} canManage={canManage} canSupervise={canSupervise} reabrible={pasoReabrible(item.data, paso)} busy={busy} onAccion={(accion, opts) => onAccion(item, paso, accion, opts)} />;
}

function DetailRuta({
  item,
  briefDiseno,
  carasBrief,
  busy,
  canManage,
  canSupervise,
  estaciones,
  estacionIdsEjecutables,
  onAccion,
  onGate,
}: {
  item: ItemView;
  briefDiseno: BriefDiseno;
  carasBrief: 1 | 2;
  busy: boolean;
  canManage: boolean;
  canSupervise: boolean;
  estaciones: Estacion[];
  estacionIdsEjecutables: string[] | null;
  onAccion: AccionHandler;
  onGate: GateHandler;
}) {
  if (item.sinRuta) {
    return (
      <div className="detail-route-empty">
        Este item no tiene ruta de producción: es una orden manual o histórica
        sin snapshot del cotizador. Los pasos se materializan al emitir órdenes
        creadas desde el cotizador.
      </div>
    );
  }
  return (
    <div className="detail-route">
      {item.steps.map((step, index) => {
        const paso = step.paso;
        const estacion = resolverEstacionDePaso(estaciones, paso);
        const puedeEjecutarPaso =
          canSupervise ||
          (canManage &&
            estacion != null &&
            estacionIdsEjecutables != null &&
            estacionIdsEjecutables.includes(estacion.id));
        const dur = etiquetaDuracion(paso.duracionEstimadaMin);
        // El paso ACTIVO (la frontera de la secuencia) se resalta con borde
        // para ubicar de un vistazo dónde está parado el trabajo.
        const esActivo = step.esActivo;
        return (
          <div
            key={paso.id}
            className={`detail-step ${step.status}${esActivo ? " is-active" : ""}`}
          >
            <div className="ds-line">
              <span className="ds-dot">
                {routeStatusIcon(step, <span className="ix">{index + 1}</span>)}
              </span>
            </div>
            <div className="ds-body">
              <div className="ds-head">
                {/* El protagonista es el PASO; el centro de costo vive en la
                    vista Estaciones y en el banner del paso actual. */}
                <div>
                  <div className="ds-tec">{paso.nombre}</div>
                </div>
                {step.status === "done" && paso.completadoEl ? (
                  <span className="ds-time done">
                    <CheckIcon />
                    {etiquetaMomento(paso.completadoEl)}
                  </span>
                ) : null}
                {step.status === "current" ? (
                  <span className="ds-time current">
                    <span className="dot" />
                    En curso
                    {paso.tramoAbierto ? (
                      <>
                        {" "}
                        · <ElapsedMin desdeIso={paso.tramoAbierto.inicioEl} />
                      </>
                    ) : paso.iniciadoEl ? (
                      ` · desde ${etiquetaMomento(paso.iniciadoEl)}`
                    ) : (
                      ""
                    )}
                  </span>
                ) : null}
                {step.status === "paused" ? (
                  <span className="ds-time paused">
                    <PauseIcon />
                    Pausado
                  </span>
                ) : null}
                {step.status === "pending" && dur ? (
                  <span className="ds-time">estimado {dur}</span>
                ) : null}
                {step.status === "blocked" ? (
                  <span className="ds-time blocked">
                    <BanIcon />
                    Bloqueado
                  </span>
                ) : null}
              </div>

              {paso.operacionesIncorporacionSnapshotJson?.length ? (
                <div className={operationStyles.compoundStep}>
                  <div className={operationStyles.compoundHeader}>
                    <LayersIcon />
                    <strong>Operaciones de ensamblaje</strong>
                    <span>
                      {paso.operacionesIncorporacionSnapshotJson.length}
                    </span>
                  </div>
                  <div className={operationStyles.compoundRows}>
                    {paso.operacionesIncorporacionSnapshotJson.map(
                      (operacion) => (
                        <div key={operacion.codigo}>
                          <span />
                          <div>
                            <strong>{operacion.nombre}</strong>
                            <small>
                              {operacion.componentesNombres?.join(" + ") ??
                                operacion.componenteNombre ??
                                "Operación del paso"}
                              {operacion.modoTiempo === "POR_UNIDAD"
                                ? ` · ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(operacion.cantidadResuelta)} ${operacion.unidadCantidad ?? "unidades"}`
                                : " · tiempo fijo"}
                            </small>
                          </div>
                          <b>{etiquetaDuracion(operacion.duracionMin)}</b>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {step.status === "blocked" && paso.motivoBloqueo ? (
                <div className="ds-blocked-detail">{paso.motivoBloqueo}</div>
              ) : null}
              {step.status === "paused" && paso.motivoPausa ? (
                <div className="ds-paused-detail">{paso.motivoPausa}</div>
              ) : null}
              {step.status === "current" &&
              paso.tramoAbierto &&
              !paso.tramoAbierto.esMio ? (
                <div className="ds-operador">
                  Lo está trabajando {paso.tramoAbierto.usuarioNombre}
                </div>
              ) : null}
              {step.status === "done" ? (
                <div className="ds-operador">
                  {paso.tiempoRealMin != null &&
                  paso.tiempoFuente !== "invalido"
                    ? `${etiquetaDuracion(paso.tiempoRealMin) ?? `${paso.tiempoRealMin} min`} (${paso.tiempoFuente ? TIEMPO_FUENTE_LABELS[paso.tiempoFuente] : "—"})`
                    : "Sin tiempo registrado"}
                  {paso.completadoPorNombre
                    ? ` · por ${paso.completadoPorNombre}`
                    : ""}
                </div>
              ) : null}
              {paso.familiaCodigo === "diseno_grafico" ||
              paso.plantillaCodigo === "diseno_grafico" ? (
                <BriefDisenoProduccion
                  brief={briefDiseno}
                  caras={carasBrief}
                  detalleInline
                />
              ) : null}
              <GatesOperativos
                paso={paso}
                busy={busy}
                canSupervise={canSupervise}
                onGate={onGate}
              />
              <PasoAcciones
                item={item}
                step={step}
                busy={busy}
                canManage={puedeEjecutarPaso}
                canSupervise={canSupervise}
                onAccion={onAccion}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MaterialRow = { nombre: string; cantidad: number; unidad: string };

/** Nota de producción del item (jobContext.notasProduccion del snapshot). */
function notaProduccionDeDetalle(
  detalle: OrdenTrabajoDetalle,
  itemId: string,
): string | null {
  const producto = detalle.productos.find((entry) => entry.id === itemId);
  const jobContext = producto?.snapshot?.jobContext as
    { notasProduccion?: unknown } | null | undefined;
  const nota =
    typeof jobContext?.notasProduccion === "string"
      ? jobContext.notasProduccion.trim()
      : "";
  return nota || null;
}

/** Materiales estimados del item, desde la trazabilidad del snapshot. */
function materialesDeDetalle(
  detalle: OrdenTrabajoDetalle,
  itemId: string,
): MaterialRow[] {
  const producto = detalle.productos.find((entry) => entry.id === itemId);
  const trazabilidad = producto?.snapshot?.trazabilidad as
    | {
        pasos?: Array<{
          activado?: boolean;
          materiales?: Array<Record<string, unknown>>;
        }>;
      }
    | null
    | undefined;
  if (!trazabilidad?.pasos) return [];
  const rows: MaterialRow[] = [];
  for (const paso of trazabilidad.pasos) {
    if (!paso?.activado || !Array.isArray(paso.materiales)) continue;
    for (const material of paso.materiales) {
      rows.push({
        nombre:
          (material.materialDisplayName as string) ||
          (material.materialNombre as string) ||
          "Material",
        cantidad: Number(material.cantidad ?? 0),
        unidad: (material.unidad as string) || "",
      });
    }
  }
  return rows;
}

/**
 * El arte del item, al alcance de la mano en la mesa. Se carga recién al
 * abrir el tab: el tablero ya trae bastante payload y el operario abre los
 * archivos de un item por vez, no de los cuarenta.
 *
 * Es de sólo lectura a propósito — desde el tablero se consume el arte, no se
 * administra. Subir y borrar viven en la ficha de la orden.
 */
function DetailArchivos({ itemId }: { itemId: string }) {
  const [archivos, setArchivos] = React.useState<Archivo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    setArchivos(null);
    setError(null);
    listarArchivos("ORDEN_ITEM", itemId)
      .then((r) => {
        if (vivo) setArchivos(r);
      })
      .catch((e: unknown) => {
        if (vivo) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar.");
        }
      });
    return () => {
      vivo = false;
    };
  }, [itemId]);

  if (error) return <div className="detail-route-empty">{error}</div>;
  if (!archivos)
    return <div className="detail-route-empty">Cargando archivos…</div>;
  if (archivos.length === 0) {
    return (
      <div className="detail-route-empty">
        Este item no tiene arte cargado. Se sube desde la ficha de la orden.
      </div>
    );
  }
  return (
    <div className="arch-lista" style={{ marginTop: 0 }}>
      {archivos.map((a) => (
        <a
          key={a.id}
          className="arch-row"
          href={urlDeArchivo(a.id)}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <span className="arch-ico">
            {a.esImagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlDeArchivo(a.id)} alt="" />
            ) : (
              <FileTextIcon />
            )}
          </span>
          <div className="arch-nom">
            <b>{a.nombre}</b>
            <span>
              {formatBytes(a.bytes)}
              {a.subidoPor ? ` · ${a.subidoPor}` : ""}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function DetailMateriales({
  materiales,
  cargando,
}: {
  materiales: MaterialRow[];
  cargando: boolean;
}) {
  if (cargando)
    return <div className="detail-route-empty">Cargando materiales…</div>;
  if (materiales.length === 0) {
    return (
      <div className="detail-route-empty">
        Este item no tiene materiales estimados en su ruta.
      </div>
    );
  }
  return (
    <table className="detail-tbl">
      <thead>
        <tr>
          <th>Material</th>
          <th className="right">Estimado</th>
        </tr>
      </thead>
      <tbody>
        {materiales.map((mat, index) => (
          <tr key={`${mat.nombre}-${index}`}>
            <td>
              <div className="nm">{mat.nombre}</div>
            </td>
            <td className="right mono">
              {mat.cantidad.toLocaleString("es-AR", {
                maximumFractionDigits: 2,
              })}{" "}
              {mat.unidad}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailActividad({
  eventos,
  cargando,
}: {
  eventos: OrdenTrabajoEvento[];
  cargando: boolean;
}) {
  if (cargando)
    return <div className="detail-route-empty">Cargando actividad…</div>;
  if (eventos.length === 0) {
    return (
      <div className="detail-route-empty">
        Sin actividad registrada todavía.
      </div>
    );
  }
  return (
    <div className="detail-activity">
      <div className="act-scope">Actividad de toda la orden</div>
      {eventos.map((evento, index) => (
        <div
          key={`${evento.fecha}-${index}`}
          className={`act-row ${evento.tipo === "paso" ? "step" : evento.tipo === "estado" || evento.tipo === "emision" ? "progress" : "comment"}`}
        >
          <span className="t">{etiquetaMomento(evento.fecha)}</span>
          <div className="body">
            <div className="what">{evento.descripcion}</div>
            <div className="who">por {evento.usuarioNombre}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ItemDetailSheet({
  item,
  busy,
  canManage,
  canSupervise,
  estaciones,
  estacionIdsEjecutables,
  alcance,
  onAccion,
  onGate,
  onClose,
}: {
  item: ItemView | undefined;
  busy: boolean;
  canManage: boolean;
  canSupervise: boolean;
  estaciones: Estacion[];
  estacionIdsEjecutables: string[] | null;
  alcance: AlcanceTableroProduccion;
  onAccion: AccionHandler;
  onGate: GateHandler;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState("ruta");
  const [detalle, setDetalle] = React.useState<OrdenTrabajoDetalle | null>(
    null,
  );
  const [cargandoDetalle, setCargandoDetalle] = React.useState(false);
  const ordenId = item?.data.ordenId;

  // Materiales y actividad viven en el detalle de la orden: se trae una vez
  // al abrir el sheet (y se refresca si cambió la orden seleccionada).
  React.useEffect(() => {
    if (!ordenId) return;
    if (alcance === "operario") {
      setDetalle(null);
      setCargandoDetalle(false);
      return;
    }
    let vigente = true;
    setCargandoDetalle(true);
    getOrdenTrabajo(ordenId)
      .then((data) => {
        if (vigente) setDetalle(data);
      })
      .catch(() => {
        if (vigente) setDetalle(null);
      })
      .finally(() => {
        if (vigente) setCargandoDetalle(false);
      });
    return () => {
      vigente = false;
    };
  }, [alcance, ordenId]);

  // Esc cierra el sheet (sólo mientras hay un item abierto).
  const abierto = Boolean(item);
  React.useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onClose]);

  if (!item) return null;

  const totalSteps = item.steps.length;
  const doneSteps = item.steps.filter((step) => step.status === "done").length;
  const currentStep = item.currentStep;
  const materiales = detalle ? materialesDeDetalle(detalle, item.id) : [];
  const notaProduccion = detalle
    ? notaProduccionDeDetalle(detalle, item.id)
    : null;
  const eventos = detalle?.eventos ?? [];
  const estimadoTotal = etiquetaDuracion(
    item.data.pasos.reduce(
      (acc, paso) => acc + (paso.duracionEstimadaMin ?? 0),
      0,
    ),
  );
  const briefDiseno = leerBriefDiseno(item.data.briefDiseno);
  const carasBrief = item.data.caras === 2 ? 2 : 1;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar detalle"
        className="sheet-backdrop"
        onClick={onClose}
      />
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle ${item.code}${item.data.loteEntrega ? ` · ${item.data.loteEntrega.nombre}` : ""}`}
      >
        <div className="sheet-head item-sheet-head">
          <div className="sheet-title-row">
            <div className="sheet-title-copy">
              <div className="sheet-codes">
                <span className="item-code">{item.code}</span>
                <span className="ot-badge">{item.otCode}</span>
                {item.data.loteEntrega ? <EtiquetaLote item={item.data} /> : item.data.componenteDe ? (
                  <span
                    className="ot-badge"
                    title={`Se incorpora en ${item.data.componenteDe.nombre}`}
                  >
                    {item.data.loteEntregaId ? "Producción de" : "Componente de"} {item.data.componenteDe.nombre}
                  </span>
                ) : null}
                {item.priority !== "normal" ? (
                  <span className={`prio-pill prio-${item.priority}`}>
                    {item.priority === "urgent" ? "Urgente" : "Alta prioridad"}
                  </span>
                ) : null}
                {item.blocked ? (
                  <span className="prio-pill prio-blocked">
                    <BanIcon />
                    Bloqueado
                  </span>
                ) : null}
              </div>
              <h2>{item.product}</h2>
              <ContextoLote item={item.data} />
              <div className="sub">
                {item.customer}{item.spec ? ` · ${item.spec}` : ""}
              </div>
              {item.corteLabel ? (
                <div className="sub corte-medida">
                  <strong>Cortar {item.corteLabel}</strong> — lleva bolsillo o
                  refuerzo, es más grande que la medida pedida
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div
            className={`item-status-banner ${item.blocked ? "blocked" : item.delayed ? "delayed" : "ok"}`}
          >
            <span className="dot" />
            <div className="body">
              <div className="ttl">{item.dependencias.length && item.statusLine === item.blockedReason ? "En espera de otros trabajos" : item.statusLine}</div>
              {item.blocked && item.blockedReason && item.statusLine !== item.blockedReason ? (
                <div className="sub">{item.blockedReason}</div>
              ) : null}
              {!item.blocked && currentStep ? (
                <div className="sub">
                  {item.currentSteps.length > 1
                    ? `${item.currentSteps.length} ramas disponibles · `
                    : "Paso actual · "}
                  <strong>
                    {item.currentSteps
                      .map((step) => step.paso.nombre)
                      .join(" + ")}
                  </strong>
                  {currentStep.paso.centroCostoNombre ? (
                    <>
                      {" "}
                      · en <strong>{currentStep.paso.centroCostoNombre}</strong>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="due">
              <div className="lbl">Entrega</div>
              <div className="val">{item.dueLabel}</div>
              <div className="sub">
                {textoEntregaRelativa(item.dueDays, item.dueIn)}
              </div>
            </div>
          </div>

          {item.dependencias.length > 0 ? (
            <section className={loteStyles.dependencias} aria-label="Dependencias pendientes">
              <strong>Para continuar, espera a</strong>
              <ul>{item.dependencias.map((d) => (
                <li key={d.pasoId}>
                  {d.loteNombre ? <Badge variant="outline">{d.loteNombre}</Badge> : null}
                  <span><strong>{d.pasoNombre}</strong><span>{d.itemNombre}</span></span>
                </li>
              ))}</ul>
            </section>
          ) : null}

          {notaProduccion ? (
            <div className="item-nota-produccion">
              <div className="lbl">Nota de producción</div>
              <div className="txt">{notaProduccion}</div>
            </div>
          ) : null}

          <div className="item-meta-strip">
            <div className="m">
              <div className="k">Avance</div>
              <div className="v">
                <ProgresoValor progreso={calcularProgreso(item.data.pasos)} />
                <span className="sub">
                  · {doneSteps}/{totalSteps} pasos
                </span>
              </div>
            </div>
            <div className="m">
              <div className="k">Cantidad</div>
              <div className="v">{item.qtyLabel}</div>
            </div>
            {alcance !== "operario" ? (
              <div className="m">
                <div className="k">Vendedor</div>
                <div className="v">
                  <span className="mini-av">{iniciales(item.vendedor)}</span>
                  {item.vendedor.split(" ")[0]}
                </div>
              </div>
            ) : null}
            <div className="m">
              <div className="k">Estación actual</div>
              <div className="v">{item.station}</div>
            </div>
            <div className="m">
              <div className="k">Tiempo estimado</div>
              <div className="v mono">{estimadoTotal ?? "—"}</div>
            </div>
          </div>

          <div
            className="sheet-tabs"
            role="tablist"
            aria-label="Detalle del item"
          >
            {(alcance === "operario"
              ? [{ k: "ruta", l: "Ruta de producción", n: totalSteps }]
              : [
                  { k: "ruta", l: "Ruta de producción", n: totalSteps },
                  { k: "materiales", l: "Materiales", n: materiales.length },
                  { k: "archivos", l: "Archivos", n: item.data.archivosCount },
                  { k: "actividad", l: "Actividad", n: eventos.length },
                ]
            ).map((entry) => (
              <button
                key={entry.k}
                type="button"
                role="tab"
                id={`item-tab-${entry.k}`}
                aria-controls="item-tab-panel"
                aria-selected={tab === entry.k}
                tabIndex={tab === entry.k ? 0 : -1}
                className={tab === entry.k ? "on" : ""}
                onClick={() => setTab(entry.k)}
              >
                {entry.l}
                <span className="ct">{entry.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="sheet-body"
          id="item-tab-panel"
          role="tabpanel"
          aria-labelledby={`item-tab-${tab}`}
        >
          {tab === "ruta" ? (
            <DetailRuta
              item={item}
              briefDiseno={briefDiseno}
              carasBrief={carasBrief}
              busy={busy}
              canManage={canManage}
              canSupervise={canSupervise}
              estaciones={estaciones}
              estacionIdsEjecutables={estacionIdsEjecutables}
              onAccion={onAccion}
              onGate={onGate}
            />
          ) : null}
          {tab === "materiales" ? (
            <DetailMateriales
              materiales={materiales}
              cargando={cargandoDetalle}
            />
          ) : null}
          {tab === "archivos" ? <DetailArchivos itemId={item.id} /> : null}
          {tab === "actividad" ? (
            <DetailActividad eventos={eventos} cargando={cargandoDetalle} />
          ) : null}
        </div>

        <div className="sheet-foot">
          <div className="sheet-foot-hint">
            {item.finished
              ? "Todos los pasos completados. La orden se finaliza desde Órdenes de trabajo."
              : currentStep
                ? `Paso actual: ${currentStep.paso.nombre}`
                : item.statusLine}
          </div>
          <div className="spacer" />
          {alcance !== "operario" ? (
            <Link
              className="btn"
              href={`/produccion/ordenes/${item.data.ordenId}`}
            >
              Ver orden {item.otCode}
            </Link>
          ) : null}
        </div>
      </aside>
    </>
  );
}

// ── Kanban ───────────────────────────────────────────────────────────────

function getKanbanBucket(item: ItemView): KanbanBucketKey | null {
  if (item.blocked) return "blocked";
  return bucketKanbanProduccion({
    iniciado: item.started,
    terminado: item.finished,
    atrasado: item.delayed,
    diasEntrega: item.dueDays,
  });
}

function kanbanStepIcon(item: ItemView, step: StepView | undefined) {
  if (item.blocked) return <BanIcon />;
  if (step?.paso.estado === "pausado") return <PauseIcon />;
  const IconCmp = step ? getStepIcon(step.iconKey) : LayoutDashboardIcon;
  return <IconCmp />;
}

// Memo: con listas grandes, tipear en el buscador o abrir un sheet no
// re-renderiza las cards cuyos props no cambiaron (los ItemView son
// estables entre renders de UI: se rearman sólo cuando cambian los datos).
const KanbanCard = React.memo(function KanbanCard({
  item,
  onOpen,
}: {
  item: ItemView;
  onOpen: (id: string) => void;
}) {
  // Si el DAG espera una dependencia externa no hay una frontera ejecutable,
  // pero la card igualmente debe nombrar el próximo paso, no decir solamente
  // "En espera" ni repetir una explicación de estado.
  const step =
    item.currentStep ??
    item.steps.find((candidate) => candidate.paso.estado !== "hecho");
  const pasoPausado = step?.paso.estado === "pausado";

  return (
    <button
      type="button"
      className={`kan-card priority-${item.priority} ${item.blocked ? "blocked" : item.delayed ? "delayed" : ""}`}
      onClick={() => onOpen(item.id)}
    >
      <div className={`kan-card-top ${loteStyles.cabecera}`}>
        <span className="item-code">{item.code}</span>
        {item.data.loteEntrega ? <EtiquetaLote item={item.data} /> : item.data.componenteDe ? (
          <span
            className="ot-badge"
            title={`${item.data.loteEntregaId ? "Producción por lote" : "Componente fabricado"} de ${item.data.componenteDe.nombre}`}
          >
            Componente
          </span>
        ) : null}
        {item.priority !== "normal" ? (
          <span className={`prio-pill prio-${item.priority}`}>
            {priorityLabel(item.priority)}
          </span>
        ) : null}
        <span className="kan-pct"><ProgresoValor progreso={calcularProgreso(item.data.pasos)} /></span>
      </div>
      <div className="kan-customer">{item.customer}</div>
      <div className="kan-title" title={item.product}>{item.product}</div>
      <ContextoLote item={item.data} />
      <div className="kan-step">
        <span
          className={`kan-step-ico ${
            item.blocked ? "is-blocked" : pasoPausado ? "is-paused" : ""
          }`}
          title={pasoPausado ? "Paso pausado" : undefined}
        >
          {kanbanStepIcon(item, step)}
        </span>
        <div>
          <div className="kan-step-label">
            {etiquetaPasoKanban(step?.paso.estado)}
          </div>
          <div className="tec">
            {step?.paso.nombre ??
              (item.sinRuta
                ? "Sin ruta"
                : item.finished
                  ? "Completado"
                    : item.blocked
                      ? "Bloqueado"
                      : "En espera")}
          </div>
          {item.blocked && item.blockedReason ? (
            <div className="kan-blocked-reason">{item.blockedReason}</div>
          ) : null}
        </div>
      </div>
      <div className="kan-progress" aria-label={calcularProgreso(item.data.pasos).explicacion}>
        <span style={{ width: `${item.progressPct}%` }} />
      </div>
      <div className="kan-foot">
        <span
          className={`due ${item.delayed || item.dueDays === 0 ? "warn" : ""}`}
        >
          <ClockIcon />
          {item.dueLabel} · {textoEntregaRelativa(item.dueDays, item.dueIn)}
        </span>
        <span className="op">
          <span className="mini-av">{iniciales(item.vendedor)}</span>
          {item.vendedor.split(" ")[0]}
        </span>
      </div>
    </button>
  );
});

/** Columna del Kanban con ventana progresiva propia (DOM acotado). */
function KanbanColumn({
  column,
  onOpen,
}: {
  column: {
    key: KanbanBucketKey;
    title: string;
    description: string;
    items: ItemView[];
  };
  onOpen: (id: string) => void;
}) {
  const { limite, sentinelRef, expandir, hayMas } = useVentanaProgresiva(
    column.items.length,
  );
  return (
    <section className={`kan-col kan-${column.key}`}>
      <div className="kan-col-head">
        <div>
          <h2>{column.title}</h2>
          <p>{column.description}</p>
        </div>
        <span>{column.items.length}</span>
      </div>
      <div className="kan-col-body">
        {column.items.length === 0 ? (
          <div className="kan-empty">No hay items en esta columna.</div>
        ) : null}
        {column.items.slice(0, limite).map((item) => (
          <KanbanCard key={item.id} item={item} onOpen={onOpen} />
        ))}
        {hayMas ? (
          <VentanaSentinel
            mostrando={limite}
            total={column.items.length}
            expandir={expandir}
            sentinelRef={sentinelRef}
          />
        ) : null}
      </div>
    </section>
  );
}

function KanbanView({
  items,
  onOpen,
}: {
  items: ItemView[];
  onOpen: (id: string) => void;
}) {
  const columns: Array<{
    key: KanbanBucketKey;
    title: string;
    description: string;
  }> = [
    {
      key: "not-started",
      title: "No iniciados",
      description: "Sin pasos ejecutados",
    },
    {
      key: "blocked",
      title: "Bloqueados",
      description: "Esperan dependencias o intervención",
    },
    { key: "today", title: "Vencen hoy", description: "Prioridad de despacho" },
    { key: "delayed", title: "Con retraso", description: "Entrega vencida" },
    { key: "active", title: "En curso", description: "Avanzando sin retraso" },
  ];
  // Dentro de cada columna, de la entrega más próxima a la más lejana (los
  // vencidos van primero por ser lo más urgente); sin fecha, al final. Mismo
  // criterio que la vista "Por items".
  const porEntrega = (a: ItemView, b: ItemView) => {
    if (a.dueDays === null && b.dueDays === null) return 0;
    if (a.dueDays === null) return 1;
    if (b.dueDays === null) return -1;
    return a.dueDays - b.dueDays;
  };
  const grouped = columns.map((column) => ({
    ...column,
    items: items
      .filter((item) => getKanbanBucket(item) === column.key)
      .sort(porEntrega),
  }));

  return (
    <div className="kanban-board" aria-label="Kanban de producción">
      {grouped.map((column) => (
        <KanbanColumn key={column.key} column={column} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Lista "Por items" con ventana progresiva (DOM acotado con miles). */
function ItemsList({
  items,
  sim,
  onOpen,
}: {
  items: ItemView[];
  sim: ResultadoSimulacion;
  onOpen: (id: string) => void;
}) {
  const { limite, sentinelRef, expandir, hayMas } = useVentanaProgresiva(
    items.length,
  );
  return (
    <div className="tab-board">
      {items.slice(0, limite).map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          eta={sim.porItem.get(item.id)}
          onOpen={onOpen}
        />
      ))}
      {items.length === 0 ? (
        <div className="empty-results">
          No hay items que coincidan con los filtros.
        </div>
      ) : null}
      {hayMas ? (
        <VentanaSentinel
          mostrando={limite}
          total={items.length}
          expandir={expandir}
          sentinelRef={sentinelRef}
        />
      ) : null}
    </div>
  );
}

// ── Vista principal ──────────────────────────────────────────────────────

export function TableroProduccion({
  initialItems,
  initialMeta,
  initialLoadError = null,
  initialPartialWarning = null,
  estaciones,
  duracionesFamilias,
  diasNoLaborables,
  tiempoEntrePasosMin = 0,
  modoPlanificacion = false,
}: {
  initialItems: TableroItemData[];
  initialMeta: {
    alcance: AlcanceTableroProduccion;
    puedeGestionar: boolean;
    estacionIdsEjecutables: string[] | null;
    vendedorSinVinculo: boolean;
  };
  initialLoadError?: string | null;
  initialPartialWarning?: string | null;
  estaciones: Estacion[];
  duracionesFamilias: DuracionFamilia[];
  diasNoLaborables: DiaNoLaborable[];
  /** Default del tenant para el traslado entre pasos. */
  tiempoEntrePasosMin?: number;
  /** Acceso dedicado al Gantt; conserva los mismos datos, permisos y refresco. */
  modoPlanificacion?: boolean;
}) {
  const { zonaHoraria } = useConfigRegional();
  const { items, meta, busy, error, loadError, syncError, refreshing, actualizadoEl, permisoSupervisar, canManage, refrescar, handleAccion, handleGate } = useProduccionOperativa({ initialItems, initialMeta, initialLoadError });
  const [mode, setMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [defaultMode, setDefaultMode] =
    React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [tabMenu, setTabMenu] = React.useState<{
    mode: Mode;
    x: number;
    y: number;
  } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<{
    status: StatusFilter;
    priority: PriorityFilter;
    query: string;
  }>({ status: "all", priority: "all", query: "" });
  const searchParams = useSearchParams();
  React.useEffect(() => {
    if (modoPlanificacion) return;
    const savedMode = readStoredBoardMode();
    setDefaultMode(savedMode);
    setMode(savedMode);
  }, [modoPlanificacion]);

  // Deep-link del widget "En curso": /produccion/tablero?item=<id> abre el
  // sheet de ese item directo (searchParams cambia de instancia en cada
  // navegación, así que re-clickear el link vuelve a abrirlo).
  React.useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam) setSelectedId(itemParam);
  }, [searchParams]);

  React.useEffect(() => {
    const estado = searchParams.get("estado");
    if (estado === "blocked" && !modoPlanificacion) {
      // El acceso desde el panel abre Ítems filtrados por bloqueo
      // sin modificar la vista predeterminada del usuario.
      setMode("items");
      setFilters((actual) => ({ ...actual, status: "blocked" }));
    }
  }, [searchParams, modoPlanificacion]);

  React.useEffect(() => {
    if (!tabMenu) return undefined;

    const closeMenu = () => setTabMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [tabMenu]);

  const views = React.useMemo(
    () => items.map((item) => buildItemView(item, estaciones, zonaHoraria)),
    [items, estaciones, zonaHoraria],
  );

  /** familiaCodigo → mediana histórica en minutos (fallback de la cola). */
  const medianas = React.useMemo(
    () =>
      new Map(
        duracionesFamilias.map((entry) => [
          entry.familiaCodigo,
          entry.medianaMin,
        ]),
      ),
    [duracionesFamilias],
  );

  /** Fechas no laborables del taller (la proyección y la simulación las saltan). */
  const noLaborables = React.useMemo(
    () => new Set(diasNoLaborables.map((dia) => dia.fecha)),
    [diasNoLaborables],
  );

  /** Simulación de flujo (fase 2b): ETA por item + llegadas por estación. */
  const sim = React.useMemo<ResultadoSimulacion>(
    () =>
      simularFlujo({
        items,
        estaciones,
        medianas,
        noLaborables,
        tiempoEntrePasosMin,
        zona: zonaHoraria,
      }),
    [
      items,
      estaciones,
      medianas,
      noLaborables,
      tiempoEntrePasosMin,
      zonaHoraria,
    ],
  );

  const tabEntries: Array<{ mode: Mode; label: string; count?: number }> = [
    { mode: "items", label: BOARD_MODE_LABELS.items, count: views.length },
    { mode: "kanban", label: BOARD_MODE_LABELS.kanban },
  ];

  const tabMenuStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!tabMenu || typeof window === "undefined") return undefined;
    return {
      left: Math.max(
        12,
        Math.min(tabMenu.x, Math.max(12, window.innerWidth - 244)),
      ),
      top: Math.max(
        12,
        Math.min(tabMenu.y, Math.max(12, window.innerHeight - 72)),
      ),
    };
  }, [tabMenu]);

  const setDefaultBoardMode = (nextMode: Mode) => {
    writeStoredBoardMode(nextMode);
    setDefaultMode(nextMode);
    setMode(nextMode);
    setTabMenu(null);
  };

  const filtered = React.useMemo(() => {
    return views.filter((item) => {
      if (
        filters.status === "in-progress" &&
        !esItemEnCursoOperativo({
          iniciado: item.started,
          terminado: item.finished,
          bloqueado: item.blocked,
          atrasado: item.delayed,
        })
      )
        return false;
      if (filters.status === "blocked" && !item.blocked) return false;
      if (filters.status === "delayed" && (!item.delayed || item.blocked))
        return false;
      if (filters.status === "due-today" && item.dueDays !== 0) return false;
      if (filters.priority !== "all" && item.priority !== filters.priority)
        return false;
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const haystack =
          `${item.code} ${item.otCode} ${item.customer} ${item.product} ${item.spec} ${item.data.loteEntrega?.nombre ?? ""} ${item.data.loteEntrega?.productoNombre ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [views, filters]);

  const counts = {
    all: views.length,
    shown: filtered.length,
    inProgress: views.filter((item) =>
      esItemEnCursoOperativo({
        iniciado: item.started,
        terminado: item.finished,
        bloqueado: item.blocked,
        atrasado: item.delayed,
      }),
    ).length,
    blocked: views.filter((item) => item.blocked).length,
    delayed: views.filter((item) => item.delayed && !item.blocked).length,
    today: views.filter((item) => item.dueDays === 0).length,
  };
  const selectedItem = selectedId
    ? views.find((item) => item.id === selectedId)
    : undefined;

  return (
    <div className={`tablero-produccion${modoPlanificacion ? ` ${planificacionStyles.root}` : ""}`}>
      <div className={`tab-page${modoPlanificacion ? ` ${planificacionStyles.page}` : ""}`}>
        <div className="page-head">
          <div className="title-block">
            <h1>{modoPlanificacion ? "Planificación" : "Tablero de producción en tiempo real"}</h1>
            <div className="sub">
              {modoPlanificacion
                ? "Calendario de producción, carga de estaciones y dependencias por lote."
                : "Items de las órdenes emitidas, con cliente y ruta real de pasos."}
              {actualizadoEl
                ? ` Actualizado a las ${actualizadoEl.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                : " Todavía no se pudo actualizar."}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            loading={refreshing}
            loadingText="Actualizando"
            onClick={() => void refrescar(true)}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
        </div>

        {initialPartialWarning ? (
          <Alert>
            <AlertTitle>Configuración parcialmente disponible</AlertTitle>
            <AlertDescription>{initialPartialWarning}</AlertDescription>
          </Alert>
        ) : null}
        {syncError ? (
          <Alert variant="destructive">
            <AlertTitle>El tablero no se está actualizando</AlertTitle>
            <AlertDescription>
              Se conservan los últimos datos válidos. {syncError}
            </AlertDescription>
            <AlertAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refrescar(true)}
              >
                Reintentar
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {!modoPlanificacion ? <div className="d-kpi-row">
          <div className="d-kpi">
            <div className="d-kpi-head">
              <span className="d-kpi-lbl">Items en producción</span>
            </div>
            <div className="d-kpi-val">
              <span className="num">{views.length}</span>
            </div>
            <div className="d-kpi-foot">
              <span className="d-kpi-sub">de órdenes emitidas</span>
            </div>
          </div>
          <div className="d-kpi">
            <div className="d-kpi-head">
              <span className="d-kpi-lbl">En curso · OK</span>
            </div>
            <div className="d-kpi-val">
              <span className="num ok">{counts.inProgress}</span>
            </div>
            <div className="d-kpi-foot">
              <span className="d-kpi-sub">avanzando sin retraso</span>
            </div>
          </div>
          <div className="d-kpi">
            <div className="d-kpi-head">
              <span className="d-kpi-lbl">Con retraso</span>
            </div>
            <div className="d-kpi-val">
              <span className="num signal">{counts.delayed}</span>
            </div>
            <div className="d-kpi-foot">
              <span className="d-delta tone-signal">entrega vencida</span>
            </div>
          </div>
          <div className="d-kpi">
            <div className="d-kpi-head">
              <span className="d-kpi-lbl">Bloqueados</span>
            </div>
            <div className="d-kpi-val">
              <span className="num">{counts.blocked}</span>
            </div>
            <div className="d-kpi-foot">
              <span className="d-kpi-sub">requieren intervención</span>
            </div>
          </div>
          <div className="d-kpi">
            <div className="d-kpi-head">
              <span className="d-kpi-lbl">Vencen hoy</span>
            </div>
            <div className="d-kpi-val">
              <span className="num">{counts.today}</span>
            </div>
            <div className="d-kpi-foot">
              <span className="d-kpi-sub">prioridad de despacho</span>
            </div>
          </div>
        </div> : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!modoPlanificacion ? <div
          className="dash-tabs"
          role="tablist"
          aria-label="Vistas del tablero de producción"
        >
          {tabEntries.map((entry) => (
            <button
              key={entry.mode}
              type="button"
              role="tab"
              id={`tablero-tab-${entry.mode}`}
              aria-controls="tablero-panel-vista"
              tabIndex={mode === entry.mode ? 0 : -1}
              className={`dash-tab ${mode === entry.mode ? "on" : ""}`}
              aria-selected={mode === entry.mode}
              onClick={() => setMode(entry.mode)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                  return;
                event.preventDefault();
                const actual = tabEntries.findIndex(
                  (tab) => tab.mode === entry.mode,
                );
                const delta = event.key === "ArrowRight" ? 1 : -1;
                const siguiente =
                  tabEntries[
                    (actual + delta + tabEntries.length) % tabEntries.length
                  ];
                if (!siguiente) return;
                setMode(siguiente.mode);
                document
                  .getElementById(`tablero-tab-${siguiente.mode}`)
                  ?.focus();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setTabMenu({
                  mode: entry.mode,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            >
              <span>{entry.label}</span>
              {typeof entry.count === "number" ? (
                <span className="count">{entry.count}</span>
              ) : null}
              {defaultMode === entry.mode ? (
                <span className="default-mark">Pred.</span>
              ) : null}
            </button>
          ))}
        </div> : null}
        {!modoPlanificacion && tabMenu ? (
          <div
            className="dash-tab-menu"
            role="menu"
            style={tabMenuStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => setDefaultBoardMode(tabMenu.mode)}
            >
              {defaultMode === tabMenu.mode ? (
                <CheckIcon />
              ) : (
                <LayoutDashboardIcon />
              )}
              <span>
                {defaultMode === tabMenu.mode
                  ? "Vista predeterminada"
                  : "Elegir como predeterminada"}
              </span>
            </button>
          </div>
        ) : null}

        <div
          id="tablero-panel-vista"
          className={modoPlanificacion ? planificacionStyles.panel : undefined}
          role={modoPlanificacion ? "region" : "tabpanel"}
          aria-label={modoPlanificacion ? "Calendario de producción" : undefined}
          aria-labelledby={modoPlanificacion ? undefined : `tablero-tab-${mode}`}
        >
          {loadError && views.length === 0 ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar el tablero</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refrescar(true)}
                >
                  Reintentar
                </Button>
              </AlertAction>
            </Alert>
          ) : meta.vendedorSinVinculo ? (
            <div className="empty-results">
              Tu usuario vendedor no está vinculado a un empleado. Vinculalo
              desde Configuración para ver solamente tus órdenes.
            </div>
          ) : views.length === 0 ? (
            <div className="empty-results">
              {meta.alcance === "operario" ? (
                "No tenés tareas reclamadas en tu mesa de trabajo."
              ) : (
                <>
                  No hay órdenes en producción. Cuando emitas una orden de
                  trabajo al taller, sus items aparecen acá con su ruta de
                  pasos.{" "}
                  <Link href="/produccion/ordenes">
                    Ir a Órdenes de trabajo
                  </Link>
                </>
              )}
            </div>
          ) : modoPlanificacion ? (
            <SimulacionView
              items={items}
              estaciones={estaciones}
              sim={sim}
              noLaborables={noLaborables}
              onOpen={setSelectedId}
            />
          ) : (
            <>
              {mode === "items" ? (
                <>
                  <FiltersBar
                    filters={filters}
                    setFilters={setFilters}
                    counts={counts}
                  />
                  <ItemsList
                    items={filtered}
                    sim={sim}
                    onOpen={setSelectedId}
                  />
                </>
              ) : null}
              {mode === "kanban" ? (
                <>
                  <FiltersBar
                    filters={filters}
                    setFilters={setFilters}
                    counts={counts}
                  />
                  <KanbanView items={filtered} onOpen={setSelectedId} />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ItemDetailSheet
        item={selectedItem}
        busy={busy}
        canManage={canManage}
        canSupervise={permisoSupervisar}
        estaciones={estaciones}
        estacionIdsEjecutables={meta.estacionIdsEjecutables}
        alcance={meta.alcance}
        onAccion={handleAccion}
        onGate={handleGate}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
