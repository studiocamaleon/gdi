"use client";

import * as React from "react";
import { useCambiosSistema } from "@/components/notificaciones/notificaciones-provider";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  BookOpenIcon,
  BoxIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDotIcon,
  ClockIcon,
  CogIcon,
  FactoryIcon,
  FileTextIcon,
  GripVerticalIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PauseIcon,
  PlayIcon,
  PrinterIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
  SquareDashedIcon,
  ShieldCheckIcon,
  TruckIcon,
  UnlockIcon,
  UserIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import {
  codigoVisibleItem,
  bucketKanbanProduccion,
  debeRefrescarTablero,
  etiquetaDuracion,
  etiquetaEntrega,
  etiquetaMomento,
  etiquetaRestante,
  diasHastaEntrega,
  familiaIcono,
  itemBloqueado,
  itemConRetraso,
  itemIniciado,
  itemTerminado,
  esItemEnCursoOperativo,
  lineaEstado,
  MOTIVOS_PAUSA,
  resolverEstacionDePaso,
  pasoActivo,
  pasosActivos,
  pasoReabrible,
  prioridadDerivada,
  progresoItem,
  textoEntregaRelativa,
  SIN_ESTACION_KEY,
  TERCERIZADOS_KEY,
  TIEMPO_FUENTE_LABELS,
  type TableroItemData,
  type AlcanceTableroProduccion,
  type TableroPasoAccion,
  type TableroPasoData,
  type TableroPrioridad,
} from "@/lib/tablero-produccion";
import {
  accionPasoProduccion,
  getOrdenTrabajo,
  getTableroProduccion,
  mesaPasoProduccion,
  resolverGatePasoProduccion,
} from "@/lib/ordenes-trabajo-api";
import type {
  OrdenTrabajoDetalle,
  OrdenTrabajoEvento,
} from "@/lib/ordenes-trabajo";
import {
  capacidadDiariaMaxMin,
  ETAPAS_ESTACION,
  etapaDeEstacion,
  etiquetaCalendario,
  etiquetaDias,
  proyectarColaDias,
  type CalendarioEstacion,
  type Estacion,
} from "@/lib/estaciones";
import type { DiaNoLaborable, DuracionFamilia } from "@/lib/estaciones-api";
import {
  etiquetaEta,
  simularFlujo,
  type ResultadoSimulacion,
  type SimulacionItem,
} from "@/lib/flujo-produccion";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { SimulacionView } from "@/components/produccion/simulacion-view";
import { formatBytes, urlDeArchivo, type Archivo } from "@/lib/archivos";
import { listarArchivos } from "@/lib/archivos-api";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BriefDisenoProduccion } from "@/components/comercial/brief-diseno-resumen";
import { leerBriefDiseno, type BriefDiseno } from "@/lib/brief-diseno";
import operationStyles from "./tablero-operaciones-incorporacion.module.css";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Mode = "items" | "estacion" | "kanban" | "simulacion";
type StatusFilter = "all" | "in-progress" | "blocked" | "delayed" | "due-today";
type PriorityFilter = "all" | TableroPrioridad;
type KanbanBucketKey = "not-started" | "today" | "delayed" | "active";

const DEFAULT_BOARD_MODE: Mode = "items";
/** Refresco en vivo del dataset (mismo ritmo que el tracking público). */
const POLL_TABLERO_MS = 15000;
const BOARD_MODE_STORAGE_KEY = "grafoprint:produccion:tablero-default-mode:v1";
const BOARD_MODE_LABELS: Record<Mode, string> = {
  items: "Por items",
  estacion: "Por estación",
  kanban: "Kanban",
  simulacion: "Simulación",
};

function isBoardMode(value: string | null): value is Mode {
  return (
    value === "items" ||
    value === "estacion" ||
    value === "kanban" ||
    value === "simulacion"
  );
}

function readStoredBoardMode(): Mode {
  if (typeof window === "undefined") return DEFAULT_BOARD_MODE;
  try {
    const saved = window.localStorage.getItem(BOARD_MODE_STORAGE_KEY);
    return isBoardMode(saved) ? saved : DEFAULT_BOARD_MODE;
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

type StepStatus = "done" | "current" | "paused" | "pending" | "blocked";

type StepView = {
  paso: TableroPasoData;
  status: StepStatus;
  /** Paso ACTIVO (frontera de la secuencia): el diseño lo destaca con anillo. */
  esActivo: boolean;
  iconKey: string;
  /** Subtítulo técnico: la estación (centro de costo) del paso. */
  tec: string;
};

type ItemView = {
  data: TableroItemData;
  id: string;
  code: string;
  otCode: string;
  customer: string;
  vendedor: string;
  product: string;
  spec: string;
  /**
   * Medida que hay que CORTAR cuando un paso de modificación (bolsillo,
   * refuerzo) agrandó la pieza. Va aparte y etiquetada: en el resumen suelto
   * quedarían dos medidas sin rótulo y el operario no sabría cuál cortar.
   */
  corteLabel: string | null;
  qtyLabel: string;
  priority: TableroPrioridad;
  dueLabel: string;
  dueIn: string;
  dueDays: number | null;
  delayed: boolean;
  blocked: boolean;
  blockedReason: string | null;
  started: boolean;
  finished: boolean;
  sinRuta: boolean;
  progressPct: number;
  statusLine: string;
  /** Estación REAL del paso activo (resuelta por familia+máquina), o "—". */
  station: string;
  /** Icono de esa estación (clave del set del tablero). */
  stationIcon: string | null;
  currentStep: StepView | undefined;
  currentSteps: StepView[];
  steps: StepView[];
};

function stepStatus(paso: TableroPasoData): StepStatus {
  switch (paso.estado) {
    case "hecho":
      return "done";
    case "en_curso":
      return "current";
    case "pausado":
      return "paused";
    case "bloqueado":
      return "blocked";
    default:
      return "pending";
  }
}

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

function buildItemView(
  item: TableroItemData,
  estaciones: Estacion[],
): ItemView {
  const activos = pasosActivos(item);
  const actual = activos[0];
  const estacionActual = actual
    ? resolverEstacionDePaso(estaciones, actual)
    : null;
  const steps = item.pasos.map<StepView>((paso) => ({
    paso,
    status: stepStatus(paso),
    esActivo: activos.some((activo) => activo.id === paso.id),
    iconKey: familiaIcono(paso.familiaCodigo, paso.plantillaCodigo),
    tec: paso.centroCostoNombre ?? "Paso manual",
  }));
  const currentStep = actual
    ? steps.find((s) => s.paso.id === actual.id)
    : undefined;
  const currentSteps = steps.filter((step) => step.esActivo);
  const blocked = itemBloqueado(item);
  const bloqueadoPaso = item.pasos.find((paso) => paso.estado === "bloqueado");
  // El resumen une valores SIN etiqueta, así que la medida de corte no puede
  // entrar acá: quedarían dos medidas sueltas y ninguna diría cuál cortar.
  const esSpecCorte = (etiqueta: string) =>
    etiqueta.trim().toLowerCase() === "medida de corte";
  const spec = item.specs
    .filter((entry) => !esSpecCorte(entry.etiqueta))
    .slice(0, 3)
    .map((entry) => entry.valor)
    .filter(Boolean)
    .join(" · ");
  const corteLabel =
    item.specs.find((entry) => esSpecCorte(entry.etiqueta))?.valor ?? null;

  return {
    data: item,
    id: item.id,
    code: codigoVisibleItem(item.ordenNumero, item.itemIndice),
    otCode: item.ordenNumero,
    customer: item.clienteNombre,
    vendedor: item.vendedorNombre,
    product: item.nombre,
    spec: spec || item.codigo,
    corteLabel,
    qtyLabel: `${item.cantidad.toLocaleString("es-AR")} ${item.cantidadUnidad}`,
    priority: prioridadDerivada(item.fechaEntrega),
    dueLabel: etiquetaEntrega(item.fechaEntrega),
    dueIn: etiquetaRestante(item.fechaEntrega),
    dueDays: diasHastaEntrega(item.fechaEntrega),
    delayed: itemConRetraso(item),
    blocked,
    blockedReason: bloqueadoPaso?.motivoBloqueo ?? null,
    started: itemIniciado(item),
    finished: itemTerminado(item),
    sinRuta: item.sinRuta,
    progressPct: progresoItem(item),
    statusLine: lineaEstado(item),
    station: actual ? (estacionActual?.nombre ?? "Sin estación") : "—",
    stationIcon: estacionActual?.icono ?? null,
    currentStep,
    currentSteps,
    steps,
  };
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
  if (!eta || item.finished) return null;
  if (eta.sinEstimar)
    return <span className="eta-line none">fin sin estimar</span>;
  if (!eta.finEstimado) return null;
  const fin = eta.finEstimado;
  const finClave = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
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
      fin {aprox ? "~" : "≈"} {etiquetaEta(fin)}
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
          {item.data.componenteDe ? (
            <span
              className="ot-badge"
              title={`Componente fabricado de ${item.data.componenteDe.nombre}`}
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
              <button
                type="button"
                className="sta-btn ghost"
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
              </button>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * ¿Completar este paso dejaría el tiempo INVÁLIDO (D8, el "inicio y
 * completo en 1 seg")? Espejo del criterio del backend: suma de tramos
 * cerrados (`tiempoAcumuladoMin`) + el abierto si corre, contra el umbral
 * de 1 min o 10% del estimado. Cubre pendiente, en curso y pausado.
 */
function completarSeriaInstantaneo(paso: TableroPasoData): boolean {
  if (paso.modoRegistro !== "cronometro") return false;
  if (
    paso.estado !== "pendiente" &&
    paso.estado !== "en_curso" &&
    paso.estado !== "pausado"
  )
    return false;
  const abiertoMin = paso.tramoAbierto
    ? (Date.now() - new Date(paso.tramoAbierto.inicioEl).getTime()) / 60_000
    : 0;
  const suma = paso.tiempoAcumuladoMin + abiertoMin;
  const umbral = Math.max(1, (paso.duracionEstimadaMin ?? 0) * 0.1);
  return suma < umbral;
}

/** Chips del micro-prompt de tiempo declarado (D8): estimado, mitad, doble. */
function chipsDeclarar(estimado: number | null): number[] {
  if (estimado == null || estimado <= 0) return [];
  const redondo = (n: number) => Math.max(1, Math.round(n));
  return [
    ...new Set([
      redondo(estimado / 2),
      redondo(estimado),
      redondo(estimado * 2),
    ]),
  ];
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
  const [bloqueando, setBloqueando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [pausando, setPausando] = React.useState(false);
  const [motivoPausa, setMotivoPausa] = React.useState<string | null>(null);
  const [detallePausa, setDetallePausa] = React.useState("");
  const [declarando, setDeclarando] = React.useState(false);
  const [tiempoOtro, setTiempoOtro] = React.useState("");
  const paso = step.paso;
  const esActual = step.esActivo;
  const esCronometro = paso.modoRegistro === "cronometro";
  const gatePendiente = (paso.gatesOperativos ?? []).some(
    (gate) => gate.estado !== "CUMPLIDO",
  );

  if (!canManage) return null;
  if (gatePendiente && paso.estado === "pendiente") return null;

  // Un paso TERCERIZADO es una compra al proveedor, no trabajo del taller: no se
  // ejecuta desde el tablero (se avanza en "Compras / Tercerizados" de la OT).
  // Igual se muestra —y sigue contando para la secuencia— porque bloquea al paso
  // interno siguiente hasta que la compra esté recibida.
  // docs/productos-tercerizados-diseno.md §6.
  if (paso.tipoEjecucion === "tercerizado") {
    const estadoCompra = paso.estadoCompra ?? "pendiente";
    return (
      <div className="ds-terc">
        <span className={`dst-badge ${estadoCompra}`}>Tercerizado</span>
        <span className="dst-info">
          {paso.proveedorNombre ? `${paso.proveedorNombre} · ` : ""}
          {COMPRA_LABELS[estadoCompra] ?? estadoCompra}
          {paso.plazoProveedorDias != null
            ? ` · plazo ${paso.plazoProveedorDias} d`
            : ""}
        </span>
        <span className="dst-hint">Se gestiona desde la orden</span>
      </div>
    );
  }

  if (paso.estado === "hecho") {
    // Reabrir sólo el último hecho: deshacer en el medio rompe la secuencia.
    if (!canSupervise || !pasoReabrible(item.data, paso)) return null;
    return (
      <div className="ds-acciones">
        <button
          type="button"
          className="sta-btn ghost"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "reabrir")}
        >
          Reabrir
        </button>
      </div>
    );
  }
  if (paso.estado === "bloqueado") {
    if (!canSupervise) return null;
    return (
      <div className="ds-acciones">
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "desbloquear")}
        >
          <UnlockIcon />
          Desbloquear
        </button>
      </div>
    );
  }
  if (!esActual && paso.estado === "pendiente") return null;

  if (bloqueando) {
    return (
      <div className="ds-acciones ds-bloqueo-form">
        <input
          autoFocus
          placeholder="¿Qué está frenando este paso?"
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
        />
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy || motivo.trim().length === 0}
          onClick={() => {
            void onAccion(item, paso, "bloquear", { motivo: motivo.trim() });
            setBloqueando(false);
            setMotivo("");
          }}
        >
          Bloquear
        </button>
        <button
          type="button"
          className="sta-btn ghost"
          onClick={() => setBloqueando(false)}
        >
          Cancelar
        </button>
      </div>
    );
  }

  // Pausar con motivo del catálogo (D7); "Otro" pide un detalle corto.
  if (pausando) {
    const necesitaDetalle = motivoPausa === "otro";
    return (
      <div className="ds-acciones ds-pausa-form">
        <div className="ds-form-title">¿Por qué se pausa?</div>
        <div className="ds-chips">
          {MOTIVOS_PAUSA.map((entry) => (
            <button
              key={entry.codigo}
              type="button"
              className={`ds-chip ${motivoPausa === entry.codigo ? "on" : ""}`}
              onClick={() => setMotivoPausa(entry.codigo)}
            >
              {entry.etiqueta}
            </button>
          ))}
        </div>
        {necesitaDetalle ? (
          <input
            autoFocus
            placeholder="Contanos brevemente el motivo"
            value={detallePausa}
            onChange={(event) => setDetallePausa(event.target.value)}
          />
        ) : null}
        <div className="ds-form-actions">
          <button
            type="button"
            className="sta-btn primary"
            disabled={
              busy ||
              !motivoPausa ||
              (necesitaDetalle && detallePausa.trim().length === 0)
            }
            onClick={() => {
              void onAccion(item, paso, "pausar", {
                motivo: motivoPausa ?? undefined,
                motivoDetalle: necesitaDetalle
                  ? detallePausa.trim()
                  : undefined,
              });
              setPausando(false);
              setMotivoPausa(null);
              setDetallePausa("");
            }}
          >
            <PauseIcon />
            Pausar
          </button>
          <button
            type="button"
            className="sta-btn ghost"
            onClick={() => setPausando(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Micro-prompt D8: el paso se completa sin tiempo medido — se ofrece
  // declarar cuánto llevó (opcional, un toque) o completar sin tiempo.
  if (declarando) {
    const otroMin = Number(tiempoOtro);
    const completar = (tiempoDeclaradoMin?: number) => {
      void onAccion(item, paso, "completar", { tiempoDeclaradoMin });
      setDeclarando(false);
      setTiempoOtro("");
    };
    return (
      <div className="ds-acciones ds-declarar-form">
        <div className="ds-form-title">
          Sin tiempo registrado. ¿Cuánto llevó aprox?
        </div>
        <div className="ds-chips">
          {chipsDeclarar(paso.duracionEstimadaMin).map((min) => (
            <button
              key={min}
              type="button"
              className="ds-chip"
              disabled={busy}
              onClick={() => completar(min)}
            >
              {etiquetaDuracion(min)}
            </button>
          ))}
          <input
            className="ds-chip-input"
            type="number"
            min={1}
            placeholder="min"
            value={tiempoOtro}
            onChange={(event) => setTiempoOtro(event.target.value)}
          />
          {Number.isFinite(otroMin) && otroMin >= 1 ? (
            <button
              type="button"
              className="ds-chip on"
              disabled={busy}
              onClick={() => completar(otroMin)}
            >
              Usar {etiquetaDuracion(otroMin)}
            </button>
          ) : null}
        </div>
        <div className="ds-form-actions">
          <button
            type="button"
            className="sta-btn ghost"
            disabled={busy}
            onClick={() => completar(undefined)}
          >
            Completar sin tiempo
          </button>
          <button
            type="button"
            className="sta-btn ghost"
            onClick={() => setDeclarando(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-acciones">
      {/* Cronómetro: Iniciar/Pausar/Continuar. Un paso de máquina
          (solo_completar) se completa de un click, sin cronómetro. */}
      {esCronometro && paso.estado === "pendiente" ? (
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "iniciar")}
        >
          <PlayIcon />
          Iniciar
        </button>
      ) : null}
      {esCronometro && paso.estado === "en_curso" ? (
        <button
          type="button"
          className="sta-btn ghost"
          disabled={busy}
          onClick={() => setPausando(true)}
        >
          <PauseIcon />
          Pausar
        </button>
      ) : null}
      {esCronometro && paso.estado === "pausado" ? (
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "continuar")}
        >
          <PlayIcon />
          Continuar
        </button>
      ) : null}
      <button
        type="button"
        className={`sta-btn ${paso.estado === "en_curso" || !esCronometro ? "primary" : "ghost"}`}
        disabled={busy}
        onClick={() => {
          if (completarSeriaInstantaneo(paso)) setDeclarando(true);
          else void onAccion(item, paso, "completar");
        }}
      >
        <CheckIcon />
        Completar
      </button>
      <button
        type="button"
        className="sta-btn ghost"
        disabled={busy}
        onClick={() => setBloqueando(true)}
      >
        <BanIcon />
        Bloquear
      </button>
    </div>
  );
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
                    vista Por estación y en el banner del paso actual. */}
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

function ItemDetailSheet({
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
        aria-label={`Detalle ${item.code}`}
      >
        <div className="sheet-head item-sheet-head">
          <div className="sheet-title-row">
            <div className="sheet-title-copy">
              <div className="sheet-codes">
                <span className="item-code">{item.code}</span>
                <span className="ot-badge">{item.otCode}</span>
                {item.data.componenteDe ? (
                  <span
                    className="ot-badge"
                    title={`Se incorpora en ${item.data.componenteDe.nombre}`}
                  >
                    Componente de {item.data.componenteDe.nombre}
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
              <div className="sub">
                {item.customer} · {item.spec}
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
              <div className="ttl">{item.statusLine}</div>
              {item.blocked && item.blockedReason ? (
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
                {item.progressPct}%
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
                : null}
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

// ── Vista Por estación (estaciones reales: familia → estación) ───────────

type StationInfo = {
  key: string;
  nm: string;
  icono: string | null;
  /** Puestos de trabajo configurados; null para el bucket "Sin estación". */
  capacidad: number | null;
  /** Calendario semanal (proyecta la cola en días); null = sin horario. */
  calendario: CalendarioEstacion | null;
  /** Label derivado del calendario ("L–V 8:00–18:00"); null = sin horario. */
  horario: string | null;
  /** Etapa productiva fija elegida en la estación (null = sin estación). */
  etapa: string | null;
  sinEstacion: boolean;
  /** Bucket sintético de tercerizados (compras a proveedor, no trabajo de piso). */
  tercerizada: boolean;
};

type StationTask = {
  item: ItemView;
  step: StepView;
  isCurrent: boolean;
  isBlocked: boolean;
  isPending: boolean;
  overdue: boolean;
  urgent: boolean;
};

/**
 * Paso FUTURO de un item vivo: pendiente, no activo todavía. Va a caer en
 * su estación cuando avance la secuencia — es la "carga en camino" (D10).
 */
type IncomingTask = {
  item: ItemView;
  step: StepView;
};

function ordenarTareas(tasks: StationTask[]): StationTask[] {
  return tasks.sort((a, b) => {
    const aw =
      (a.isBlocked ? 0 : 1) + (a.overdue ? 0 : 2) + (a.isCurrent ? 1 : 4);
    const bw =
      (b.isBlocked ? 0 : 1) + (b.overdue ? 0 : 2) + (b.isCurrent ? 1 : 4);
    return aw - bw;
  });
}

/**
 * Modelo de la vista: las estaciones ACTIVAS configuradas + el bucket "Sin
 * estación", con sus tareas activas (la COLA: el paso listo de cada item)
 * y sus pasos EN CAMINO (futuros pendientes de items vivos, que caerán acá
 * cuando avance la secuencia — D10, se muestran aparte, nunca sumados a la
 * cola). El paso interno llega a su estación por las REGLAS de captura (ver
 * resolverEstacionDePaso); los TERCERIZADOS van a un bucket sintético propio
 * ("Proveedor tercerizado"), no a la estación que les tocaría por familia.
 */
function buildStationsModel(items: ItemView[], estaciones: Estacion[]) {
  const tareas = new Map<string, StationTask[]>();
  const entrantes = new Map<string, IncomingTask[]>();

  // Un paso tercerizado es una compra al proveedor, no trabajo de piso: se
  // agrupa en el bucket sintético "Proveedor tercerizado", no en la estación
  // que le tocaría por familia. Los internos sí ruteando por reglas.
  const estacionDe = (step: StepView) =>
    step.paso.tipoEjecucion === "tercerizado"
      ? TERCERIZADOS_KEY
      : (resolverEstacionDePaso(estaciones, step.paso)?.id ?? SIN_ESTACION_KEY);

  for (const item of items) {
    for (const step of item.steps) {
      if (pasoActivo(item.data, step.paso)) {
        const key = estacionDe(step);
        const lista = tareas.get(key) ?? [];
        lista.push({
          item,
          step,
          isCurrent: step.status === "current",
          isBlocked: step.status === "blocked",
          isPending: step.status === "pending",
          overdue: item.delayed && step.status !== "blocked",
          urgent:
            item.priority === "urgent" ||
            (item.delayed && step.status !== "blocked") ||
            step.status === "blocked",
        });
        tareas.set(key, lista);
        continue;
      }
      // Futuro = pendiente no activo (los hechos ya no son carga).
      if (step.paso.estado !== "pendiente") continue;
      const key = estacionDe(step);
      const lista = entrantes.get(key) ?? [];
      lista.push({ item, step });
      entrantes.set(key, lista);
    }
  }
  for (const lista of tareas.values()) ordenarTareas(lista);

  const stations: StationInfo[] = estaciones
    .filter((estacion) => estacion.activo)
    .map((estacion) => ({
      key: estacion.id,
      nm: estacion.nombre,
      icono: estacion.icono,
      capacidad: estacion.capacidadConcurrente,
      calendario: estacion.calendario,
      horario: etiquetaCalendario(estacion.calendario),
      etapa: estacion.etapa,
      sinEstacion: false,
      tercerizada: false,
    }));
  if (tareas.has(TERCERIZADOS_KEY) || entrantes.has(TERCERIZADOS_KEY)) {
    stations.push({
      key: TERCERIZADOS_KEY,
      nm: "Proveedor tercerizado",
      icono: null,
      capacidad: null,
      calendario: null,
      horario: null,
      etapa: null,
      sinEstacion: false,
      tercerizada: true,
    });
  }
  if (tareas.has(SIN_ESTACION_KEY) || entrantes.has(SIN_ESTACION_KEY)) {
    stations.push({
      key: SIN_ESTACION_KEY,
      nm: "Sin estación",
      icono: null,
      capacidad: null,
      calendario: null,
      horario: null,
      etapa: null,
      sinEstacion: true,
      tercerizada: false,
    });
  }

  return { stations, tareas, entrantes };
}

function taskId(task: StationTask) {
  return task.step.paso.id;
}

/**
 * Duración estimada del paso para la cola: la propia del snapshot, o la
 * mediana histórica de su familia (D6 del doc de capacidad). null = sin
 * estimar (suma 0 a la cola y se señala aparte, sin inventar defaults).
 * Un 0 explícito SÍ es duración conocida — ver duracionDePaso en
 * flujo-produccion.ts, misma regla.
 */
function duracionDeTask(
  task: { step: StepView },
  medianas: Map<string, number>,
): number | null {
  const propia = task.step.paso.duracionEstimadaMin;
  if (propia != null) return propia;
  return medianas.get(task.step.paso.familiaCodigo) ?? null;
}

function computeStationStats(
  tasks: StationTask[],
  incoming: IncomingTask[],
  medianas: Map<string, number>,
) {
  const blocked = tasks.filter((task) => task.isBlocked).length;
  const urgent = tasks.filter((task) => task.urgent && !task.isBlocked).length;
  const pending = tasks.length - blocked - urgent;
  const enCurso = tasks.filter((task) => task.isCurrent).length;
  const minDias = tasks.reduce<number | null>((min, task) => {
    const dias = task.item.dueDays;
    if (dias === null) return min;
    return min === null ? dias : Math.min(min, dias);
  }, null);

  // Cola en MINUTOS (incluye bloqueados: el trabajo no desaparece), con los
  // segmentos de la LoadBar ponderados por horas, no por conteo (doc §6).
  let colaMin = 0;
  let sinEstimar = 0;
  let pendingMin = 0;
  let urgentMin = 0;
  let blockedMin = 0;
  for (const task of tasks) {
    const duracion = duracionDeTask(task, medianas);
    if (duracion == null) {
      sinEstimar += 1;
      continue;
    }
    colaMin += duracion;
    if (task.isBlocked) blockedMin += duracion;
    else if (task.urgent) urgentMin += duracion;
    else pendingMin += duracion;
  }

  // Carga EN CAMINO (D10): pasos futuros de items vivos que caerán acá.
  // Se informa aparte de la cola, nunca sumada como si llegara ya (D11).
  let entranteMin = 0;
  for (const task of incoming) {
    const duracion = duracionDeTask(task, medianas);
    if (duracion == null) sinEstimar += 1;
    else entranteMin += duracion;
  }

  return {
    tasks,
    total: tasks.length,
    pending,
    urgent,
    blocked,
    enCurso,
    colaMin,
    sinEstimar,
    pendingMin,
    urgentMin,
    blockedMin,
    entranteMin,
    entranteCount: incoming.length,
    minDias,
    oldestBlocked: tasks.find((task) => task.isBlocked),
  };
}

function fmtDiasEntrega(dias: number) {
  if (dias < 0) return `vencida ${Math.abs(dias)}d`;
  if (dias === 0) return "hoy";
  return `${dias}d`;
}

function LoadBar({
  pending,
  urgent,
  blocked,
  incoming = 0,
  max,
}: {
  pending: number;
  urgent: number;
  blocked: number;
  incoming?: number;
  max: number;
}) {
  const total = pending + urgent + blocked + incoming;
  if (max === 0 || total === 0)
    return (
      <div className="load-bar">
        <div className="track" />
      </div>
    );
  const width = (value: number) => `${Math.min(100, (value / max) * 100)}%`;
  return (
    <div className="load-bar">
      <div className="track">
        {pending > 0 ? (
          <span className="seg pending" style={{ width: width(pending) }} />
        ) : null}
        {urgent > 0 ? (
          <span className="seg urgent" style={{ width: width(urgent) }} />
        ) : null}
        {blocked > 0 ? (
          <span className="seg blocked" style={{ width: width(blocked) }} />
        ) : null}
        {incoming > 0 ? (
          <span className="seg incoming" style={{ width: width(incoming) }} />
        ) : null}
      </div>
    </div>
  );
}

function stationIcon(station: StationInfo) {
  if (station.tercerizada) return <TruckIcon />;
  if (station.sinEstacion) return <BanIcon />;
  const IconCmp = station.icono ? getStepIcon(station.icono) : FactoryIcon;
  return <IconCmp />;
}

function StationCard({
  station,
  stats,
  noLaborables,
  hoyMin = 0,
  onSelect,
}: {
  station: StationInfo;
  stats: ReturnType<typeof computeStationStats>;
  noLaborables: Set<string>;
  /** De lo en camino, minutos que la simulación estima que llegan HOY. */
  hoyMin?: number;
  onSelect: (stationKey: string) => void;
}) {
  const etapa = station.etapa ? etapaDeEstacion(station.etapa) : null;
  const tone = stats.blocked > 0 ? "block" : stats.urgent > 0 ? "urgent" : "ok";
  // Carga en TIEMPO (doc §6): ocupación instantánea (en curso/puestos) +
  // cola en horas + jornadas caminando el calendario. El % por conteo murió.
  const colaLabel = stats.colaMin > 0 ? etiquetaDuracion(stats.colaMin) : null;
  const dias =
    station.capacidad != null && stats.colaMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  const entranteLabel =
    stats.entranteMin > 0 ? etiquetaDuracion(stats.entranteMin) : null;
  const cargaPartes = [
    station.capacidad != null
      ? `${stats.enCurso}/${station.capacidad} puestos`
      : null,
    colaLabel ? `cola ${colaLabel}` : null,
    // "≈ 0 d" para colas de minutos es ruido: sólo desde 0,1 jornadas.
    dias != null && dias >= 0.05 ? `≈ ${etiquetaDias(dias)}` : null,
    entranteLabel
      ? `+${entranteLabel} en camino${hoyMin > 0 ? ` (${etiquetaDuracion(hoyMin)} hoy)` : ""}`
      : null,
  ].filter(Boolean);
  // La barra escala contra UN DÍA lleno de la estación; sin calendario, la
  // carga presente la llena (no hay vara de tiempo contra la cual medir).
  const barMax =
    capacidadDiariaMaxMin(station.calendario, station.capacidad ?? 1) ??
    Math.max(stats.colaMin + stats.entranteMin, 1);

  return (
    <button
      type="button"
      className={`sta-card tone-${tone}`}
      onClick={() => onSelect(station.key)}
    >
      <div className="sta-card-head">
        <span className="sta-card-ico">{stationIcon(station)}</span>
        <div className="sta-card-titles">
          <div className="nm">{station.nm}</div>
          <div className="desc">
            {station.tercerizada
              ? "Compras a proveedores"
              : station.sinEstacion
                ? "Familias sin estación asignada"
                : (etapa?.nm ?? "Estación del taller")}
          </div>
        </div>
      </div>
      <div className="sta-card-load">
        <div className="lh">
          <span className="num">{stats.total}</span>
          <span className="lbl">pasos activos</span>
          {cargaPartes.length > 0 ? (
            <span className="pct">{cargaPartes.join(" · ")}</span>
          ) : null}
        </div>
        <LoadBar
          pending={stats.pendingMin}
          urgent={stats.urgentMin}
          blocked={stats.blockedMin}
          incoming={stats.entranteMin}
          max={barMax}
        />
        <div className="sta-card-segs">
          {stats.pending > 0 ? (
            <span className="seg-lbl">
              <span className="dot pending" />
              {stats.pending} pendientes
            </span>
          ) : null}
          {stats.urgent > 0 ? (
            <span className="seg-lbl">
              <span className="dot urgent" />
              {stats.urgent} urgente{stats.urgent > 1 ? "s" : ""}
            </span>
          ) : null}
          {stats.blocked > 0 ? (
            <span className="seg-lbl">
              <span className="dot blocked" />
              {stats.blocked} bloqueado{stats.blocked > 1 ? "s" : ""}
            </span>
          ) : null}
          {stats.entranteCount > 0 ? (
            <span className="seg-lbl">
              <span className="dot incoming" />
              {stats.entranteCount} en camino
            </span>
          ) : null}
          {stats.sinEstimar > 0 ? (
            <span className="seg-lbl">
              <span className="dot none" />
              {stats.sinEstimar} sin estimar
            </span>
          ) : null}
        </div>
      </div>
      <div className="sta-card-signals">
        {stats.oldestBlocked ? (
          <div className="sig sig-block">
            <BanIcon />
            <span>
              <strong>
                {stats.oldestBlocked.step.paso.motivoBloqueo || "Sin detalle"}
              </strong>
            </span>
          </div>
        ) : null}
        {stats.minDias != null ? (
          <div className={`sig ${stats.minDias <= 0 ? "sig-warn" : ""}`}>
            <ClockIcon />
            <span>
              Próxima entrega · <strong>{fmtDiasEntrega(stats.minDias)}</strong>
            </span>
          </div>
        ) : null}
      </div>
      <div className="sta-card-foot">
        <span>Ver detalles</span>
        <ArrowRightIcon />
      </div>
    </button>
  );
}

function StationGrid({
  items,
  estaciones,
  medianas,
  noLaborables,
  llegadasHoyMin,
  onSelect,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  noLaborables: Set<string>;
  llegadasHoyMin: Map<string, number>;
  onSelect: (stationKey: string) => void;
}) {
  const { stations, tareas, entrantes } = buildStationsModel(items, estaciones);
  const allStats = stations.map((station) => ({
    station,
    stats: computeStationStats(
      tareas.get(station.key) ?? [],
      entrantes.get(station.key) ?? [],
      medianas,
    ),
  }));
  const totalActive = allStats.reduce(
    (acc, entry) => acc + entry.stats.total,
    0,
  );
  const totalEntrante = allStats.reduce(
    (acc, entry) => acc + entry.stats.entranteCount,
    0,
  );
  const blockedTotal = allStats.reduce(
    (acc, entry) => acc + entry.stats.blocked,
    0,
  );
  const urgentTotal = allStats.reduce(
    (acc, entry) => acc + entry.stats.urgent,
    0,
  );
  // Una estación sin cola pero CON carga en camino muestra card igual (D12):
  // es exactamente la que el vendedor necesita ver antes de prometer.
  const active = allStats.filter(
    (entry) =>
      (entry.stats.total > 0 || entry.stats.entranteCount > 0) &&
      !entry.station.sinEstacion &&
      !entry.station.tercerizada,
  );
  const idle = allStats.filter(
    (entry) =>
      entry.stats.total === 0 &&
      entry.stats.entranteCount === 0 &&
      !entry.station.tercerizada,
  );
  const sinEstacion = allStats.find((entry) => entry.station.sinEstacion);
  const tercerizados = allStats.find((entry) => entry.station.tercerizada);
  const byEtapa = ETAPAS_ESTACION.map((etapa) => ({
    ...etapa,
    items: active
      .filter(({ station }) => station.etapa === etapa.key)
      .sort(
        (a, b) =>
          b.stats.blocked - a.stats.blocked ||
          b.stats.urgent - a.stats.urgent ||
          b.stats.total - a.stats.total,
      ),
  })).filter((etapa) => etapa.items.length > 0);

  return (
    <div className="sta-grid-wrap">
      <div className="sta-toolbar">
        <div className="sta-toolbar-stats">
          <span className="stat">
            <strong>{totalActive}</strong>pasos activos
          </span>
          {totalEntrante > 0 ? (
            <>
              <span className="sep">·</span>
              <span className="stat">
                <strong>{totalEntrante}</strong>en camino
              </span>
            </>
          ) : null}
          <span className="sep">·</span>
          <span className="stat">
            <strong>{active.length}</strong>de{" "}
            {stations.filter((s) => !s.sinEstacion && !s.tercerizada).length}{" "}
            estaciones con trabajo
          </span>
          {blockedTotal > 0 ? (
            <>
              <span className="sep">·</span>
              <span className="stat warn">
                <strong>{blockedTotal}</strong>bloqueado
                {blockedTotal > 1 ? "s" : ""}
              </span>
            </>
          ) : null}
          {urgentTotal > 0 ? (
            <>
              <span className="sep">·</span>
              <span className="stat amber">
                <strong>{urgentTotal}</strong>urgente
                {urgentTotal > 1 ? "s" : ""}
              </span>
            </>
          ) : null}
          {sinEstacion && sinEstacion.stats.total > 0 ? (
            <>
              <span className="sep">·</span>
              <span className="stat danger">
                <strong>{sinEstacion.stats.total}</strong>sin estación
              </span>
            </>
          ) : null}
        </div>
        <Link className="sta-toolbar-cta" href="/produccion/estaciones">
          <CogIcon />
          <span>Configurar estaciones</span>
        </Link>
      </div>

      {estaciones.filter((estacion) => estacion.activo).length === 0 ? (
        <div className="sta-config-hint">
          Todavía no configuraste estaciones: todo el trabajo aparece en «Sin
          estación». <Link href="/produccion/estaciones">Crear estaciones</Link>{" "}
          y asignales familias de pasos para agrupar el tablero por tu taller
          real.
        </div>
      ) : null}

      {byEtapa.map((category) => {
        const catTotal = category.items.reduce(
          (acc, entry) => acc + entry.stats.total,
          0,
        );
        return (
          <section key={category.key} className="sta-cat">
            <div className="sta-cat-head">
              <h3>{category.nm}</h3>
              <span className="rule" />
              <span className="ct">
                <strong>{catTotal}</strong> pasos · {category.items.length}{" "}
                {category.items.length === 1 ? "estación" : "estaciones"}
              </span>
            </div>
            <div className="sta-grid">
              {category.items.map(({ station, stats }) => (
                <StationCard
                  key={station.key}
                  station={station}
                  stats={stats}
                  noLaborables={noLaborables}
                  hoyMin={llegadasHoyMin.get(station.key) ?? 0}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        );
      })}

      {tercerizados ? (
        <section className="sta-cat">
          <div className="sta-cat-head">
            <h3>Proveedor tercerizado</h3>
            <span className="rule" />
            <span className="ct">
              <strong>{tercerizados.stats.total}</strong> pasos · se gestionan
              desde Compras de la orden
            </span>
          </div>
          <div className="sta-grid">
            <StationCard
              station={tercerizados.station}
              stats={tercerizados.stats}
              noLaborables={noLaborables}
              hoyMin={llegadasHoyMin.get(tercerizados.station.key) ?? 0}
              onSelect={onSelect}
            />
          </div>
        </section>
      ) : null}

      {sinEstacion ? (
        <section className="sta-cat">
          <div className="sta-cat-head">
            <h3>Sin estación asignada</h3>
            <span className="rule" />
            <span className="ct">
              <strong>{sinEstacion.stats.total}</strong> pasos ·{" "}
              <Link href="/produccion/estaciones">asignar familias</Link>
            </span>
          </div>
          <div className="sta-grid">
            <StationCard
              station={sinEstacion.station}
              stats={sinEstacion.stats}
              noLaborables={noLaborables}
              hoyMin={llegadasHoyMin.get(sinEstacion.station.key) ?? 0}
              onSelect={onSelect}
            />
          </div>
        </section>
      ) : null}

      {idle.length > 0 ? (
        <div className="sta-idle">
          <div className="sta-idle-head">
            <span className="dot" />
            <span>Sin actividad ahora</span>
            <span className="ct">{idle.length} estaciones</span>
          </div>
          <div className="sta-idle-chips">
            {idle.map(({ station }) => (
              <button
                key={station.key}
                type="button"
                className="sta-idle-chip"
                onClick={() => onSelect(station.key)}
              >
                <span className="ic">{stationIcon(station)}</span>
                <span className="nm">{station.nm}</span>
                <span className="arr">
                  <ArrowRightIcon />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({
  task,
  inMesa,
  canManage,
  onMoveToMesa,
  onOpen,
  dragHint,
}: {
  task: StationTask;
  inMesa: boolean;
  canManage: boolean;
  onMoveToMesa: (id: string) => void;
  onOpen: (id: string) => void;
  dragHint?: boolean;
}) {
  const statusLabel = task.isBlocked
    ? "BLOQUEADO"
    : task.step.status === "paused"
      ? "PAUSADO"
      : task.isCurrent
        ? "EN CURSO"
        : "PENDIENTE";
  const statusCls = task.isBlocked
    ? "blocked"
    : task.step.status === "paused"
      ? "paused"
      : task.isCurrent
        ? "current"
        : "pending";
  const [dragging, setDragging] = React.useState(false);
  // Reclamada por OTRO usuario (mesaEsMia la pondría en MI columna).
  const enMesaDe = !inMesa ? task.step.paso.mesaUsuarioNombre : null;

  return (
    <div
      className={`sta-task status-${statusCls} ${task.overdue ? "overdue" : ""} ${task.urgent ? "urgent" : ""} ${inMesa ? "in-mesa" : ""} ${dragging ? "dragging" : ""}`}
      draggable={canManage}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/paso-id", taskId(task));
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <div className="sta-task-row1">
        {canManage ? (
          <span className="grip" title="Arrastrá para mover">
            <GripVerticalIcon />
          </span>
        ) : null}
        <span className="code">{task.item.code}</span>
        <span className={`task-status ${statusCls}`}>{statusLabel}</span>
        {task.overdue ? (
          <span className="task-vencido">
            <BanIcon />
            VENCIDO
          </span>
        ) : null}
        {enMesaDe ? (
          <span
            className="task-mesa-de"
            title="Otro usuario la tiene en su mesa"
          >
            <UserIcon />
            {enMesaDe}
          </span>
        ) : null}
        <span className="ot">{task.item.otCode}</span>
      </div>
      <div className="sta-task-body">
        <div className="meta">
          <span className="ic">
            <UserIcon />
          </span>
          <span className="v">{task.item.customer}</span>
        </div>
        <div className="meta">
          <span className="ic">
            <BoxIcon />
          </span>
          <span className="v">
            {task.item.product}{" "}
            <span className="qty">· {task.item.qtyLabel}</span>
          </span>
        </div>
        <div className="meta step">
          <span className="ic">
            <CogIcon />
          </span>
          <span className="v">{task.step.paso.nombre}</span>
        </div>
        {task.step.paso.motivoBloqueo ? (
          <div className="meta sub-detail">
            <span className="v">{task.step.paso.motivoBloqueo}</span>
          </div>
        ) : null}
      </div>
      <div className="sta-task-foot">
        <div className="ts">
          <ClockIcon />
          <span>{task.item.dueLabel}</span>
          <span className="sep">·</span>
          <span className={task.overdue ? "warn" : ""}>
            {textoEntregaRelativa(task.item.dueDays, task.item.dueIn)}
          </span>
        </div>
        <div className="actions">
          {canManage ? (
            <button
              type="button"
              className="sta-btn ghost"
              onClick={(event) => {
                event.stopPropagation();
                onMoveToMesa(taskId(task));
              }}
            >
              {inMesa ? (
                <>
                  <ArrowLeftIcon />
                  Devolver
                </>
              ) : (
                <>
                  Mover a mi mesa
                  <ArrowRightIcon />
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="sta-btn primary"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(task.item.id);
            }}
          >
            Ver detalles
          </button>
        </div>
      </div>
      {dragHint ? (
        <div className="sta-task-hint">
          Arrastrá esta tarea a Mesa de trabajo o Pendientes.
        </div>
      ) : null}
    </div>
  );
}

function StationDetail({
  items,
  estaciones,
  medianas,
  noLaborables,
  stationKey,
  canManage,
  onMesa,
  onBack,
  onOpen,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  noLaborables: Set<string>;
  stationKey: string;
  canManage: boolean;
  onMesa: (pasoId: string, en: boolean) => void;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { stations, tareas, entrantes } = buildStationsModel(items, estaciones);
  const station = stations.find((entry) => entry.key === stationKey);
  const tasks = tareas.get(stationKey) ?? [];
  const stats = computeStationStats(
    tasks,
    entrantes.get(stationKey) ?? [],
    medianas,
  );
  const diasCola =
    station && station.capacidad != null && stats.colaMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  // Rango honesto (D12): el calendario caminado dos veces — sólo la cola,
  // y cola + lo en camino (cota superior si todo lo conocido llegara).
  const diasTotal =
    station && station.capacidad != null && stats.entranteMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin + stats.entranteMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  const [filter, setFilter] = React.useState("todos");
  /** Columna resaltada mientras se arrastra una tarea encima. */
  const [dragOver, setDragOver] = React.useState<"mesa" | "shared" | null>(
    null,
  );
  const etapa = station?.etapa ? etapaDeEstacion(station.etapa) : null;
  const estacionConfig = estaciones.find((entry) => entry.id === stationKey);

  // "Mi mesa" es PERSISTENTE por usuario (paso.mesaEsMia, backend):
  // reclamar acá lo ve todo el taller, y sobrevive recargas y sesiones.
  const mesaTasks = tasks.filter((task) => task.step.paso.mesaEsMia);
  const sharedTasks = tasks.filter((task) => !task.step.paso.mesaEsMia);

  const toggleMesa = (id: string) => {
    const task = tasks.find((entry) => taskId(entry) === id);
    if (task) onMesa(id, !task.step.paso.mesaEsMia);
  };

  const permitirSoltar =
    (zona: "mesa" | "shared") => (event: React.DragEvent) => {
      if (!canManage) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOver(zona);
    };

  const soltarEn = (zona: "mesa" | "shared") => (event: React.DragEvent) => {
    if (!canManage) return;
    event.preventDefault();
    setDragOver(null);
    const pasoId = event.dataTransfer.getData("text/paso-id");
    const task = tasks.find((entry) => taskId(entry) === pasoId);
    if (!task) return;
    const en = zona === "mesa";
    if (task.step.paso.mesaEsMia !== en) onMesa(pasoId, en);
  };
  let visibleShared = sharedTasks;
  let visibleMesa = mesaTasks;
  if (filter === "pendientes")
    visibleShared = sharedTasks.filter((task) => task.isPending);
  if (filter === "mesa") visibleShared = [];
  if (filter === "urgentes") {
    visibleShared = sharedTasks.filter((task) => task.urgent);
    visibleMesa = mesaTasks.filter((task) => task.urgent);
  }
  return (
    <div className="sta-detail">
      <div className="sta-detail-head">
        <div className="sta-detail-head-top">
          <span className="sta-detail-ico">
            {station ? stationIcon(station) : <FactoryIcon />}
          </span>
          <div className="body">
            <h2>{station?.nm ?? "Estación"}</h2>
            <p>
              {station?.tercerizada
                ? "Pasos tercerizados (compras a proveedor): se gestionan desde Compras de la orden, no se ejecutan en el piso"
                : station?.sinEstacion
                  ? "Pasos cuya familia no está asignada a ninguna estación activa"
                  : estacionConfig?.descripcion ||
                    [etapa?.nm, etiquetaCalendario(estacionConfig?.calendario)]
                      .filter(Boolean)
                      .join(" · ") ||
                    "Estación del taller"}
            </p>
            <div className="actions">
              <button type="button" className="sta-btn ghost" onClick={onBack}>
                <ArrowLeftIcon />
                Ver todas las estaciones
              </button>
            </div>
          </div>
          <div className="counter">
            <div className="num">{tasks.length}</div>
            <div className="lbl">pasos activos</div>
          </div>
        </div>
      </div>

      <div className="sta-detail-kpis">
        {/* Ocupación instantánea (en curso/puestos) — el diseño tiene exactamente 5 cards. */}
        <div
          className={`kpi ${station?.capacidad && stats.enCurso >= station.capacidad ? "warm" : ""}`}
        >
          <div className="k">En curso</div>
          <div className="v">
            {station?.capacidad
              ? `${stats.enCurso}/${station.capacidad}`
              : stats.enCurso}
          </div>
        </div>
        <div className={`kpi ${mesaTasks.length > 0 ? "ok" : "warn"}`}>
          <div className="k">Mi mesa de trabajo</div>
          <div className="v">{mesaTasks.length}</div>
        </div>
        <div className="kpi cool">
          <div className="k">Pendientes</div>
          <div className="v">
            {tasks.filter((task) => task.isPending).length}
          </div>
        </div>
        <div
          className={`kpi ${tasks.some((task) => task.urgent) ? "warm" : ""}`}
        >
          <div className="k">Urgentes</div>
          <div className="v">{tasks.filter((task) => task.urgent).length}</div>
        </div>
        <div className="kpi">
          <div className="k">
            {diasTotal != null && diasTotal >= 0.05
              ? `Cola · ≈ ${etiquetaDias(Math.max(diasCola ?? 0, 0))} · hasta ${etiquetaDias(diasTotal)}`
              : diasCola != null && diasCola >= 0.05
                ? `Cola · ≈ ${etiquetaDias(diasCola)}`
                : "Cola estimada"}
          </div>
          <div className="v">
            {stats.colaMin > 0
              ? etiquetaDuracion(stats.colaMin)
              : stats.entranteMin > 0
                ? "0 min"
                : "—"}
            {stats.entranteMin > 0 ? (
              <span className="kpi-extra">
                {" "}
                +{etiquetaDuracion(stats.entranteMin)} en camino
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="sta-detail-filters">
        <span className="lbl">Filtros:</span>
        {[
          { k: "todos", l: "Todos" },
          { k: "pendientes", l: "Pendientes" },
          { k: "mesa", l: "Mi mesa" },
          { k: "urgentes", l: "Solo urgentes" },
        ].map((entry) => (
          <button
            key={entry.k}
            type="button"
            aria-pressed={filter === entry.k}
            className={`chip ${filter === entry.k ? "on" : ""}`}
            onClick={() => setFilter(entry.k)}
          >
            {entry.l}
          </button>
        ))}
      </div>

      <div className="sta-detail-board">
        <div className="sta-col mesa-col">
          <div className="sta-col-head">
            <span className="dot mesa" />
            <span className="ttl">Mi mesa de trabajo</span>
            <span className="ct">
              <strong>{mesaTasks.length}</strong> pasos
            </span>
          </div>
          <div
            className={`sta-col-body ${mesaTasks.length === 0 ? "empty-mesa" : ""} ${dragOver === "mesa" ? "drag-over" : ""}`}
            onDragOver={permitirSoltar("mesa")}
            onDragLeave={() =>
              setDragOver((current) => (current === "mesa" ? null : current))
            }
            onDrop={soltarEn("mesa")}
          >
            {mesaTasks.length === 0 ? (
              <div className="sta-mesa-empty">
                <div className="ic">
                  <SquareDashedIcon />
                </div>
                <div className="ttl">
                  {canManage
                    ? "Arrastrá tareas acá para trabajar en ellas"
                    : "No hay tareas en tu mesa"}
                </div>
                <div className="sub">
                  {canManage
                    ? "Las tareas pasan a tu mesa cuando las tomás de la fila compartida."
                    : "Esta vista es de sólo lectura."}
                </div>
              </div>
            ) : null}
            {visibleMesa.map((task) => (
              <TaskCard
                key={taskId(task)}
                task={task}
                inMesa
                canManage={canManage}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>

        <div className="sta-col shared-col">
          <div className="sta-col-head">
            <span className="dot shared" />
            <span className="ttl">Pendientes compartidas</span>
            <span className="ct">
              <strong>{visibleShared.length}</strong> pasos
            </span>
          </div>
          <div
            className={`sta-col-body ${dragOver === "shared" ? "drag-over" : ""}`}
            onDragOver={permitirSoltar("shared")}
            onDragLeave={() =>
              setDragOver((current) => (current === "shared" ? null : current))
            }
            onDrop={soltarEn("shared")}
          >
            {visibleShared.length === 0 ? (
              <div className="sta-shared-empty">
                {filter === "mesa"
                  ? "Solo se muestran las tareas de tu mesa."
                  : "No quedan tareas pendientes que coincidan con el filtro."}
              </div>
            ) : null}
            {visibleShared.map((task, index) => (
              <TaskCard
                key={taskId(task)}
                task={task}
                inMesa={false}
                canManage={canManage}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
                dragHint={
                  canManage &&
                  index === 0 &&
                  mesaTasks.length === 0 &&
                  filter === "todos"
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ByStationView({
  items,
  estaciones,
  medianas,
  noLaborables,
  llegadasHoyMin,
  canManage,
  estacionIdsEjecutables,
  onMesa,
  onOpen,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  noLaborables: Set<string>;
  llegadasHoyMin: Map<string, number>;
  canManage: boolean;
  estacionIdsEjecutables: string[] | null;
  onMesa: (pasoId: string, en: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const [stationKey, setStationKey] = React.useState<string | null>(null);
  const puedeEjecutarEstacion =
    stationKey != null &&
    canManage &&
    (estacionIdsEjecutables === null ||
      estacionIdsEjecutables.includes(stationKey));
  if (stationKey)
    return (
      <StationDetail
        items={items}
        estaciones={estaciones}
        medianas={medianas}
        noLaborables={noLaborables}
        stationKey={stationKey}
        canManage={puedeEjecutarEstacion}
        onMesa={onMesa}
        onBack={() => setStationKey(null)}
        onOpen={onOpen}
      />
    );
  return (
    <StationGrid
      items={items}
      estaciones={estaciones}
      medianas={medianas}
      noLaborables={noLaborables}
      llegadasHoyMin={llegadasHoyMin}
      onSelect={setStationKey}
    />
  );
}

// ── Kanban ───────────────────────────────────────────────────────────────

function getKanbanBucket(item: ItemView): KanbanBucketKey {
  return bucketKanbanProduccion({
    iniciado: item.started,
    atrasado: item.delayed,
    diasEntrega: item.dueDays,
  });
}

function kanbanStepIcon(item: ItemView) {
  if (item.blocked) return <BanIcon />;
  const IconCmp = item.currentStep
    ? getStepIcon(item.currentStep.iconKey)
    : LayoutDashboardIcon;
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
  const step = item.currentStep;

  return (
    <button
      type="button"
      className={`kan-card priority-${item.priority} ${item.blocked ? "blocked" : item.delayed ? "delayed" : ""}`}
      onClick={() => onOpen(item.id)}
    >
      <div className="kan-card-top">
        <span className="item-code">{item.code}</span>
        <span className="ot-badge">{item.otCode}</span>
        {item.data.componenteDe ? (
          <span
            className="ot-badge"
            title={`Componente fabricado de ${item.data.componenteDe.nombre}`}
          >
            Componente
          </span>
        ) : null}
        {item.priority !== "normal" ? (
          <span className={`prio-pill prio-${item.priority}`}>
            {priorityLabel(item.priority)}
          </span>
        ) : null}
        <span className="kan-pct">{item.progressPct}%</span>
      </div>
      <div className="kan-title">{item.product}</div>
      <div className="kan-meta">
        {item.customer} · {item.spec}
      </div>
      <div className="kan-step">
        <span className="kan-step-ico">{kanbanStepIcon(item)}</span>
        <div>
          <div className="tec">
            {step?.paso.nombre ?? (item.sinRuta ? "Sin ruta" : "Completado")}
          </div>
          <div className="sub">{item.statusLine}</div>
        </div>
      </div>
      <div className="kan-progress" aria-label={`Avance ${item.progressPct}%`}>
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
}) {
  const { zonaHoraria } = useConfigRegional();
  const permisoEjecutar = usePuede("produccion.ejecutar");
  const permisoSupervisar = usePuede("produccion.supervisar");
  const [items, setItems] = React.useState<TableroItemData[]>(initialItems);
  const [meta, setMeta] = React.useState(initialMeta);
  const [mode, setMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [defaultMode, setDefaultMode] =
    React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [tabMenu, setTabMenu] = React.useState<{
    mode: Mode;
    x: number;
    y: number;
  } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(
    initialLoadError,
  );
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [actualizadoEl, setActualizadoEl] = React.useState<Date | null>(
    initialLoadError ? null : new Date(),
  );
  const [filters, setFilters] = React.useState<{
    status: StatusFilter;
    priority: PriorityFilter;
    query: string;
  }>({ status: "all", priority: "all", query: "" });
  const searchParams = useSearchParams();
  const canManage =
    (permisoEjecutar || permisoSupervisar) && meta.puedeGestionar;

  React.useEffect(() => {
    const savedMode = readStoredBoardMode();
    setDefaultMode(savedMode);
    setMode(savedMode);
  }, []);

  // Deep-link del widget "En curso": /produccion/tablero?item=<id> abre el
  // sheet de ese item directo (searchParams cambia de instancia en cada
  // navegación, así que re-clickear el link vuelve a abrirlo).
  React.useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam) setSelectedId(itemParam);
  }, [searchParams]);

  // ── Tablero EN VIVO: lo que hace otro operario aparece sin recargar ────
  // Polling del dataset (es chico) cada POLL_TABLERO_MS, pausado con la
  // pestaña oculta y refrescado al volver al foco. Dos protecciones que el
  // tracking público no necesita: no se aplica un snapshot con mutaciones
  // propias EN VUELO (pisaría el update optimista) ni durante un DRAG (el
  // re-render reemplaza la card arrastrada y corta el drop).
  const mutacionesRef = React.useRef(0);
  const dragActivoRef = React.useRef(false);
  const ultimoSnapshotRef = React.useRef<string | null>(
    JSON.stringify(initialItems),
  );
  const montadoRef = React.useRef(true);

  React.useEffect(
    () => () => {
      montadoRef.current = false;
    },
    [],
  );

  const refrescar = React.useCallback(async (forzar = false) => {
    if (
      !debeRefrescarTablero({
        pestanaOculta: !forzar && document.hidden,
        mutacionesEnCurso: mutacionesRef.current,
        arrastreActivo: dragActivoRef.current,
      })
    )
      return;
    if (forzar) setRefreshing(true);
    try {
      const respuesta = await getTableroProduccion();
      if (
        !montadoRef.current ||
        mutacionesRef.current > 0 ||
        dragActivoRef.current
      )
        return;
      const snapshot = JSON.stringify(respuesta.items);
      if (snapshot !== ultimoSnapshotRef.current) {
        ultimoSnapshotRef.current = snapshot;
        setItems(respuesta.items);
      }
      setMeta({
        alcance: respuesta.alcance,
        puedeGestionar: respuesta.puedeGestionar,
        estacionIdsEjecutables: respuesta.estacionIdsEjecutables,
        vendedorSinVinculo: respuesta.vendedorSinVinculo,
      });
      setLoadError(null);
      setSyncError(null);
      setActualizadoEl(new Date());
    } catch (err) {
      if (!montadoRef.current) return;
      setSyncError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el tablero. Se conservan los últimos datos.",
      );
    } finally {
      if (montadoRef.current && forzar) setRefreshing(false);
    }
  }, []);

  useCambiosSistema(
    (cambio) => {
      if (cambio.topicos.includes("tablero-produccion")) {
        void refrescar();
      }
    },
    [refrescar],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => void refrescar(), POLL_TABLERO_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    const onDragStart = () => {
      dragActivoRef.current = true;
    };
    const onDragEnd = () => {
      dragActivoRef.current = false;
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, [refrescar]);

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
    () => items.map((item) => buildItemView(item, estaciones)),
    [items, estaciones],
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

  /** Minutos de carga en camino que LLEGAN HOY, por estación. */
  const llegadasHoyMin = React.useMemo(() => {
    const resultado = new Map<string, number>();
    const hoy = new Date().toDateString();
    for (const [key, lista] of sim.llegadasPorEstacion) {
      const minutosHoy = lista
        .filter((llegada) => llegada.llegada.toDateString() === hoy)
        .reduce((acc, llegada) => acc + llegada.duracionMin, 0);
      if (minutosHoy > 0) resultado.set(key, minutosHoy);
    }
    return resultado;
  }, [sim]);

  /**
   * Acción sobre un paso: el backend devuelve el item re-proyectado, pero
   * la acción puede promover la orden (pendiente → produccion) y eso afecta
   * a los items hermanos: se refresca el dataset completo (es chico).
   */
  const handleAccion = React.useCallback(
    async (
      item: ItemView,
      paso: TableroPasoData,
      accion: TableroPasoAccion,
      opts?: {
        motivo?: string;
        motivoDetalle?: string;
        tiempoDeclaradoMin?: number;
      },
    ) => {
      if (!canManage) return;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      try {
        const actualizado = await accionPasoProduccion(
          item.data.ordenId,
          item.id,
          paso.id,
          { accion, ...opts },
        );
        setItems((current) =>
          current.map((entry) =>
            entry.id === actualizado.id ? actualizado : entry,
          ),
        );
        const { items: refrescados } = await getTableroProduccion();
        setItems(refrescados);
        ultimoSnapshotRef.current = JSON.stringify(refrescados);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo ejecutar la acción.",
        );
      } finally {
        mutacionesRef.current -= 1;
        setBusy(false);
      }
    },
    [canManage],
  );

  const handleGate = React.useCallback<GateHandler>(
    async (paso, tipo, estado) => {
      if (!permisoSupervisar) return;
      setBusy(true);
      setError(null);
      mutacionesRef.current += 1;
      try {
        await resolverGatePasoProduccion(paso.id, { tipo, estado });
        const respuesta = await getTableroProduccion();
        setItems(respuesta.items);
        ultimoSnapshotRef.current = JSON.stringify(respuesta.items);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar la condición operativa.",
        );
      } finally {
        mutacionesRef.current -= 1;
        setBusy(false);
      }
    },
    [permisoSupervisar],
  );

  /**
   * Tomar/soltar un paso de MI mesa (persistente por usuario). Optimista:
   * la card se mueve al soltar; el server confirma con el item
   * re-proyectado (trae el nombre real del dueño) o se revierte.
   */
  const handleMesa = React.useCallback(
    async (pasoId: string, en: boolean) => {
      if (!canManage) return;
      const previo = items;
      mutacionesRef.current += 1;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          pasos: item.pasos.map((paso) =>
            paso.id === pasoId
              ? { ...paso, mesaEsMia: en, mesaUsuarioNombre: en ? "vos" : null }
              : paso,
          ),
        })),
      );
      try {
        const actualizado = await mesaPasoProduccion(pasoId, en);
        setItems((current) =>
          actualizado.pasos.length === 0
            ? current.filter((entry) => entry.id !== actualizado.id)
            : current.map((entry) =>
                entry.id === actualizado.id ? actualizado : entry,
              ),
        );
      } catch (err) {
        setItems(previo);
        setError(
          err instanceof Error ? err.message : "No se pudo mover el paso.",
        );
      } finally {
        mutacionesRef.current -= 1;
      }
    },
    [canManage, items],
  );

  const tabEntries: Array<{ mode: Mode; label: string; count?: number }> = [
    { mode: "items", label: BOARD_MODE_LABELS.items, count: views.length },
    { mode: "estacion", label: BOARD_MODE_LABELS.estacion },
    { mode: "kanban", label: BOARD_MODE_LABELS.kanban },
    { mode: "simulacion", label: BOARD_MODE_LABELS.simulacion },
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
          `${item.code} ${item.otCode} ${item.customer} ${item.product} ${item.spec}`.toLowerCase();
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
    <div className="tablero-produccion">
      <div className="tab-page">
        <div className="page-head">
          <div className="title-block">
            <h1>Tablero de producción en tiempo real</h1>
            <div className="sub">
              Items de las órdenes emitidas, con cliente y ruta real de pasos.
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

        <div className="d-kpi-row">
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
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div
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
        </div>

        {tabMenu ? (
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
          role="tabpanel"
          aria-labelledby={`tablero-tab-${mode}`}
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
              {mode === "estacion" ? (
                <ByStationView
                  items={views}
                  estaciones={estaciones}
                  medianas={medianas}
                  noLaborables={noLaborables}
                  llegadasHoyMin={llegadasHoyMin}
                  canManage={canManage}
                  estacionIdsEjecutables={meta.estacionIdsEjecutables}
                  onMesa={handleMesa}
                  onOpen={setSelectedId}
                />
              ) : null}
              {mode === "simulacion" ? (
                <SimulacionView
                  items={items}
                  estaciones={estaciones}
                  sim={sim}
                  noLaborables={noLaborables}
                  onOpen={setSelectedId}
                />
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
