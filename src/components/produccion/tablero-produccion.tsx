"use client";

import * as React from "react";
import Link from "next/link";
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
  GripVerticalIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PlayIcon,
  PrinterIcon,
  ScissorsIcon,
  SearchIcon,
  ShieldCheckIcon,
  TruckIcon,
  UnlockIcon,
  UserIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import {
  codigoVisibleItem,
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
  lineaEstado,
  resolverEstacionDePaso,
  pasoActivo,
  pasoActual,
  pasoReabrible,
  prioridadDerivada,
  progresoItem,
  SIN_ESTACION_KEY,
  type TableroItemData,
  type TableroPasoAccion,
  type TableroPasoData,
  type TableroPrioridad,
} from "@/lib/tablero-produccion";
import {
  accionPasoProduccion,
  getOrdenTrabajo,
  getTableroProduccion,
} from "@/lib/ordenes-trabajo-api";
import type {
  OrdenTrabajoDetalle,
  OrdenTrabajoEvento,
} from "@/lib/ordenes-trabajo";
import { ETAPAS_ESTACION, etapaDeEstacion, type Estacion } from "@/lib/estaciones";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Mode = "items" | "estacion" | "kanban";
type StatusFilter = "all" | "in-progress" | "blocked" | "delayed" | "due-today";
type PriorityFilter = "all" | TableroPrioridad;
type KanbanBucketKey = "not-started" | "today" | "delayed" | "active";

const DEFAULT_BOARD_MODE: Mode = "items";
const BOARD_MODE_STORAGE_KEY = "grafoprint:produccion:tablero-default-mode:v1";
const BOARD_MODE_LABELS: Record<Mode, string> = {
  items: "Por items",
  estacion: "Por estación",
  kanban: "Kanban",
};

function isBoardMode(value: string | null): value is Mode {
  return value === "items" || value === "estacion" || value === "kanban";
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
  return priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : "Normal";
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

// ── View-model: derivados de presentación por item ───────────────────────

type StepStatus = "done" | "current" | "pending" | "blocked";

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
  steps: StepView[];
};

function stepStatus(paso: TableroPasoData): StepStatus {
  switch (paso.estado) {
    case "hecho":
      return "done";
    case "en_curso":
      return "current";
    case "bloqueado":
      return "blocked";
    default:
      return "pending";
  }
}

function buildItemView(item: TableroItemData, estaciones: Estacion[]): ItemView {
  const actual = pasoActual(item);
  const estacionActual = actual ? resolverEstacionDePaso(estaciones, actual) : null;
  const steps = item.pasos.map<StepView>((paso) => ({
    paso,
    status: stepStatus(paso),
    esActivo: paso.id === actual?.id,
    iconKey: familiaIcono(paso.familiaCodigo),
    tec: paso.centroCostoNombre ?? "Paso manual",
  }));
  const currentStep = actual ? steps.find((s) => s.paso.id === actual.id) : undefined;
  const blocked = itemBloqueado(item);
  const bloqueadoPaso = item.pasos.find((paso) => paso.estado === "bloqueado");
  const spec = item.specs
    .slice(0, 3)
    .map((entry) => entry.valor)
    .filter(Boolean)
    .join(" · ");

  return {
    data: item,
    id: item.id,
    code: codigoVisibleItem(item.ordenNumero, item.itemIndice),
    otCode: item.ordenNumero,
    customer: item.clienteNombre,
    vendedor: item.vendedorNombre,
    product: item.nombre,
    spec: spec || item.codigo,
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
    station: actual ? estacionActual?.nombre ?? "Sin estación" : "—",
    stationIcon: estacionActual?.icono ?? null,
    currentStep,
    steps,
  };
}

// ── Ruta compacta (strip de pasos) ───────────────────────────────────────

function routeStatusIcon(step: StepView, fallback?: React.ReactNode) {
  const IconCmp = getStepIcon(step.iconKey);
  if (step.status === "done") return <CheckIcon />;
  if (step.status === "blocked") return <BanIcon />;
  if (step.status === "pending" && fallback) return fallback;
  return <IconCmp />;
}

function RouteStrip({ steps, compact = false }: { steps: StepView[]; compact?: boolean }) {
  if (steps.length === 0) {
    return (
      <div className={`route-strip ${compact ? "compact" : ""}`}>
        <div className="route-step pending" title="Item sin ruta de producción">
          <span className="ri-dot"><BanIcon /></span>
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
        const visual = step.esActivo && step.status === "pending" ? "current" : step.status;
        const cls =
          `route-step ${visual}` +
          (step.status === "done" || (index > 0 && steps[index - 1]?.status === "done") ? " link-done" : "");
        return (
          <div key={step.paso.id} className={cls} title={`${step.paso.nombre} · ${step.tec}`}>
            <span className="ri-dot">{routeStatusIcon(step)}</span>
            <span className="ri-label">{step.paso.nombre}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista Por items ──────────────────────────────────────────────────────

function ItemRow({ item, onOpen }: { item: ItemView; onOpen: (id: string) => void }) {
  const cssRow =
    `tab-row priority-${item.priority}` +
    (item.blocked ? " blocked" : "") +
    (item.delayed && !item.blocked ? " delayed" : "");

  return (
    <button type="button" className={cssRow} onClick={() => onOpen(item.id)}>
      <div className="tab-row-left">
        <div className="tab-row-codes">
          <span className="item-code">{item.code}</span>
          <span className="ot-badge" title="Orden de trabajo origen">{item.otCode}</span>
          {item.priority !== "normal" ? <span className={`prio-pill prio-${item.priority}`}>{priorityLabel(item.priority)}</span> : null}
        </div>
        <div className="tab-row-product">{item.product}</div>
        <div className="tab-row-spec">
          <span className="cust">{item.customer}</span>
          <span className="sep">·</span>
          <span className="spec">{item.spec}</span>
        </div>
      </div>

      <div className="tab-row-route">
        <RouteStrip steps={item.steps} />
        <div className={`tab-status-line ${item.blocked ? "blocked" : item.delayed ? "delayed" : ""}`}>
          <span className={`dot ${item.blocked ? "dot-block" : item.delayed ? "dot-warn" : "dot-ok"}`} />
          <span>{item.statusLine}</span>
        </div>
      </div>

      <div className="tab-row-right">
        <div className={`tab-due ${item.delayed && !item.blocked ? "delayed" : ""}`}>
          <span className="due-label">{item.dueLabel}</span>
          <span className="due-in">{item.dueIn === "Hoy" ? "vence hoy" : `${item.dueIn} restantes`}</span>
        </div>
        <div className="tab-assigned" title={`Estación actual: ${item.station}`}>
          <span className="av">{item.stationIcon ? React.createElement(getStepIcon(item.stationIcon)) : <FactoryIcon />}</span>
          <div>
            <div className="nm">{item.station}</div>
            <div className="role">{item.qtyLabel}</div>
          </div>
        </div>
      </div>

      <div className="tab-row-cta">
        <ChevronRightIcon />
      </div>
    </button>
  );
}

function FiltersBar({
  filters,
  setFilters,
  counts,
}: {
  filters: { status: StatusFilter; priority: PriorityFilter; query: string };
  setFilters: React.Dispatch<React.SetStateAction<{ status: StatusFilter; priority: PriorityFilter; query: string }>>;
  counts: { all: number; shown: number; inProgress: number; blocked: number; delayed: number; today: number };
}) {
  return (
    <div className="tab-filters">
      <div className="search">
        <SearchIcon />
        <input
          placeholder="Buscar por item, OT, cliente, producto..."
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
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
            onClick={() => setFilters((current) => ({ ...current, status: status.k as StatusFilter }))}
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
            onClick={() => setFilters((current) => ({ ...current, priority: priority.k as PriorityFilter }))}
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
  motivo?: string,
) => Promise<void>;

function PasoAcciones({
  item,
  step,
  busy,
  onAccion,
}: {
  item: ItemView;
  step: StepView;
  busy: boolean;
  onAccion: AccionHandler;
}) {
  const [bloqueando, setBloqueando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const paso = step.paso;
  const esActual = item.currentStep?.paso.id === paso.id;

  if (paso.estado === "hecho") {
    // Reabrir sólo el último hecho: deshacer en el medio rompe la secuencia.
    if (!pasoReabrible(item.data, paso)) return null;
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
    return (
      <div className="ds-acciones">
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "desbloquear")}
        >
          <UnlockIcon />Desbloquear
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
            void onAccion(item, paso, "bloquear", motivo.trim());
            setBloqueando(false);
            setMotivo("");
          }}
        >
          Bloquear
        </button>
        <button type="button" className="sta-btn ghost" onClick={() => setBloqueando(false)}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="ds-acciones">
      {paso.estado === "pendiente" ? (
        <button
          type="button"
          className="sta-btn primary"
          disabled={busy}
          onClick={() => void onAccion(item, paso, "iniciar")}
        >
          <PlayIcon />Iniciar
        </button>
      ) : null}
      <button
        type="button"
        className={`sta-btn ${paso.estado === "en_curso" ? "primary" : "ghost"}`}
        disabled={busy}
        onClick={() => void onAccion(item, paso, "completar")}
      >
        <CheckIcon />Completar
      </button>
      <button type="button" className="sta-btn ghost" disabled={busy} onClick={() => setBloqueando(true)}>
        <BanIcon />Bloquear
      </button>
    </div>
  );
}

function DetailRuta({
  item,
  busy,
  onAccion,
}: {
  item: ItemView;
  busy: boolean;
  onAccion: AccionHandler;
}) {
  if (item.sinRuta) {
    return (
      <div className="detail-route-empty">
        Este item no tiene ruta de producción: es una orden manual o histórica sin
        snapshot del cotizador. Los pasos se materializan al emitir órdenes creadas
        desde el cotizador.
      </div>
    );
  }
  return (
    <div className="detail-route">
      {item.steps.map((step, index) => {
        const paso = step.paso;
        const dur = etiquetaDuracion(paso.duracionEstimadaMin);
        // El paso ACTIVO (la frontera de la secuencia) se resalta con borde
        // para ubicar de un vistazo dónde está parado el trabajo.
        const esActivo = item.currentStep?.paso.id === paso.id;
        return (
          <div key={paso.id} className={`detail-step ${step.status}${esActivo ? " is-active" : ""}`}>
            <div className="ds-line">
              <span className="ds-dot">{routeStatusIcon(step, <span className="ix">{index + 1}</span>)}</span>
            </div>
            <div className="ds-body">
              <div className="ds-head">
                {/* El protagonista es el PASO; el centro de costo vive en la
                    vista Por estación y en el banner del paso actual. */}
                <div>
                  <div className="ds-tec">{paso.nombre}</div>
                </div>
                {step.status === "done" && paso.completadoEl ? (
                  <span className="ds-time done"><CheckIcon />{etiquetaMomento(paso.completadoEl)}</span>
                ) : null}
                {step.status === "current" ? (
                  <span className="ds-time current"><span className="dot" />En curso{paso.iniciadoEl ? ` · desde ${etiquetaMomento(paso.iniciadoEl)}` : ""}</span>
                ) : null}
                {step.status === "pending" && dur ? <span className="ds-time">estimado {dur}</span> : null}
                {step.status === "blocked" ? <span className="ds-time blocked"><BanIcon />Bloqueado</span> : null}
              </div>

              {step.status === "blocked" && paso.motivoBloqueo ? (
                <div className="ds-blocked-detail">{paso.motivoBloqueo}</div>
              ) : null}
              <PasoAcciones item={item} step={step} busy={busy} onAccion={onAccion} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type MaterialRow = { nombre: string; cantidad: number; unidad: string };

/** Materiales estimados del item, desde la trazabilidad del snapshot. */
function materialesDeDetalle(detalle: OrdenTrabajoDetalle, itemId: string): MaterialRow[] {
  const producto = detalle.productos.find((entry) => entry.id === itemId);
  const trazabilidad = producto?.snapshot?.trazabilidad as
    | { pasos?: Array<{ activado?: boolean; materiales?: Array<Record<string, unknown>> }> }
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

function DetailMateriales({ materiales, cargando }: { materiales: MaterialRow[]; cargando: boolean }) {
  if (cargando) return <div className="detail-route-empty">Cargando materiales…</div>;
  if (materiales.length === 0) {
    return <div className="detail-route-empty">Este item no tiene materiales estimados en su ruta.</div>;
  }
  return (
    <table className="detail-tbl">
      <thead>
        <tr><th>Material</th><th className="right">Estimado</th></tr>
      </thead>
      <tbody>
        {materiales.map((mat, index) => (
          <tr key={`${mat.nombre}-${index}`}>
            <td><div className="nm">{mat.nombre}</div></td>
            <td className="right mono">
              {mat.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 2 })} {mat.unidad}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailActividad({ eventos, cargando }: { eventos: OrdenTrabajoEvento[]; cargando: boolean }) {
  if (cargando) return <div className="detail-route-empty">Cargando actividad…</div>;
  if (eventos.length === 0) {
    return <div className="detail-route-empty">Sin actividad registrada todavía.</div>;
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
  onAccion,
  onClose,
}: {
  item: ItemView | undefined;
  busy: boolean;
  onAccion: AccionHandler;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState("ruta");
  const [detalle, setDetalle] = React.useState<OrdenTrabajoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = React.useState(false);
  const ordenId = item?.data.ordenId;

  // Materiales y actividad viven en el detalle de la orden: se trae una vez
  // al abrir el sheet (y se refresca si cambió la orden seleccionada).
  React.useEffect(() => {
    if (!ordenId) return;
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
  }, [ordenId]);

  if (!item) return null;

  const totalSteps = item.steps.length;
  const doneSteps = item.steps.filter((step) => step.status === "done").length;
  const currentStep = item.currentStep;
  const materiales = detalle ? materialesDeDetalle(detalle, item.id) : [];
  const eventos = detalle?.eventos ?? [];
  const estimadoTotal = etiquetaDuracion(
    item.data.pasos.reduce((acc, paso) => acc + (paso.duracionEstimadaMin ?? 0), 0),
  );

  return (
    <>
      <button type="button" aria-label="Cerrar detalle" className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-label={`Detalle ${item.code}`}>
        <div className="sheet-head item-sheet-head">
          <div className="sheet-title-row">
            <div className="sheet-title-copy">
              <div className="sheet-codes">
                <span className="item-code">{item.code}</span>
                <span className="ot-badge">{item.otCode}</span>
                {item.priority !== "normal" ? <span className={`prio-pill prio-${item.priority}`}>{item.priority === "urgent" ? "Urgente" : "Alta prioridad"}</span> : null}
                {item.blocked ? <span className="prio-pill prio-blocked"><BanIcon />Bloqueado</span> : null}
              </div>
              <h2>{item.product}</h2>
              <div className="sub">{item.customer} · {item.spec}</div>
            </div>
            <button type="button" className="close" onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <div className={`item-status-banner ${item.blocked ? "blocked" : item.delayed ? "delayed" : "ok"}`}>
            <span className="dot" />
            <div className="body">
              <div className="ttl">{item.statusLine}</div>
              {item.blocked && item.blockedReason ? <div className="sub">{item.blockedReason}</div> : null}
              {!item.blocked && currentStep ? (
                <div className="sub">
                  Paso actual · <strong>{currentStep.paso.nombre}</strong>
                  {currentStep.paso.centroCostoNombre ? <> · en <strong>{currentStep.paso.centroCostoNombre}</strong></> : null}
                </div>
              ) : null}
            </div>
            <div className="due">
              <div className="lbl">Entrega</div>
              <div className="val">{item.dueLabel}</div>
              <div className="sub">{item.dueIn === "Hoy" ? "vence hoy" : `${item.dueIn} restantes`}</div>
            </div>
          </div>

          <div className="item-meta-strip">
            <div className="m"><div className="k">Avance</div><div className="v">{item.progressPct}%<span className="sub">· {doneSteps}/{totalSteps} pasos</span></div></div>
            <div className="m"><div className="k">Cantidad</div><div className="v">{item.qtyLabel}</div></div>
            <div className="m"><div className="k">Vendedor</div><div className="v"><span className="mini-av">{iniciales(item.vendedor)}</span>{item.vendedor.split(" ")[0]}</div></div>
            <div className="m"><div className="k">Estación actual</div><div className="v">{item.station}</div></div>
            <div className="m"><div className="k">Tiempo estimado</div><div className="v mono">{estimadoTotal ?? "—"}</div></div>
          </div>

          <div className="sheet-tabs">
            {[
              { k: "ruta", l: "Ruta de producción", n: totalSteps },
              { k: "materiales", l: "Materiales", n: materiales.length },
              { k: "actividad", l: "Actividad", n: eventos.length },
            ].map((entry) => (
              <button key={entry.k} type="button" className={tab === entry.k ? "on" : ""} onClick={() => setTab(entry.k)}>
                {entry.l}<span className="ct">{entry.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-body">
          {tab === "ruta" ? <DetailRuta item={item} busy={busy} onAccion={onAccion} /> : null}
          {tab === "materiales" ? <DetailMateriales materiales={materiales} cargando={cargandoDetalle} /> : null}
          {tab === "actividad" ? <DetailActividad eventos={eventos} cargando={cargandoDetalle} /> : null}
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
          <Link className="btn" href={`/produccion/ordenes?orden=${item.data.ordenId}`}>
            Ver orden {item.otCode}
          </Link>
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
  /** Pasos concurrentes configurados; null para el bucket "Sin estación". */
  capacidad: number | null;
  horario: string | null;
  /** Etapa productiva fija elegida en la estación (null = sin estación). */
  etapa: string | null;
  sinEstacion: boolean;
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

function ordenarTareas(tasks: StationTask[]): StationTask[] {
  return tasks.sort((a, b) => {
    const aw = (a.isBlocked ? 0 : 1) + (a.overdue ? 0 : 2) + (a.isCurrent ? 1 : 4);
    const bw = (b.isBlocked ? 0 : 1) + (b.overdue ? 0 : 2) + (b.isCurrent ? 1 : 4);
    return aw - bw;
  });
}

/**
 * Modelo de la vista: las estaciones ACTIVAS configuradas + el bucket "Sin
 * estación", con sus tareas activas. La ruta es secuencial, así que acá
 * entra únicamente el paso listo para hacerse de cada item (el primero, o
 * con todos los anteriores hechos): los futuros no son trabajo de nadie
 * todavía. El paso llega a su estación por la FAMILIA, y las máquinas de la
 * estación FILTRAN (ver resolverEstacionDePaso).
 */
function buildStationsModel(items: ItemView[], estaciones: Estacion[]) {
  const tareas = new Map<string, StationTask[]>();

  for (const item of items) {
    for (const step of item.steps) {
      if (!pasoActivo(item.data, step.paso)) continue;
      const estacion = resolverEstacionDePaso(estaciones, step.paso);
      const key = estacion?.id ?? SIN_ESTACION_KEY;
      const lista = tareas.get(key) ?? [];
      lista.push({
        item,
        step,
        isCurrent: step.status === "current",
        isBlocked: step.status === "blocked",
        isPending: step.status === "pending",
        overdue: item.delayed && step.status !== "blocked",
        urgent: item.priority === "urgent" || (item.delayed && step.status !== "blocked") || step.status === "blocked",
      });
      tareas.set(key, lista);
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
      horario: estacion.horario,
      etapa: estacion.etapa,
      sinEstacion: false,
    }));
  if (tareas.has(SIN_ESTACION_KEY)) {
    stations.push({
      key: SIN_ESTACION_KEY,
      nm: "Sin estación",
      icono: null,
      capacidad: null,
      horario: null,
      etapa: null,
      sinEstacion: true,
    });
  }

  return { stations, tareas };
}

function taskId(task: StationTask) {
  return task.step.paso.id;
}

function computeStationStats(tasks: StationTask[]) {
  const blocked = tasks.filter((task) => task.isBlocked).length;
  const urgent = tasks.filter((task) => task.urgent && !task.isBlocked).length;
  const pending = tasks.length - blocked - urgent;
  const minDias = tasks.reduce<number | null>((min, task) => {
    const dias = task.item.dueDays;
    if (dias === null) return min;
    return min === null ? dias : Math.min(min, dias);
  }, null);

  return {
    tasks,
    total: tasks.length,
    pending,
    urgent,
    blocked,
    minDias,
    oldestBlocked: tasks.find((task) => task.isBlocked),
  };
}

function fmtDiasEntrega(dias: number) {
  if (dias < 0) return `vencida ${Math.abs(dias)}d`;
  if (dias === 0) return "hoy";
  return `${dias}d`;
}

function LoadBar({ pending, urgent, blocked, max }: { pending: number; urgent: number; blocked: number; max: number }) {
  const total = pending + urgent + blocked;
  if (max === 0 || total === 0) return <div className="load-bar"><div className="track" /></div>;
  const width = (value: number) => `${Math.min(100, (value / max) * 100)}%`;
  return (
    <div className="load-bar">
      <div className="track">
        {pending > 0 ? <span className="seg pending" style={{ width: width(pending) }} /> : null}
        {urgent > 0 ? <span className="seg urgent" style={{ width: width(urgent) }} /> : null}
        {blocked > 0 ? <span className="seg blocked" style={{ width: width(blocked) }} /> : null}
      </div>
    </div>
  );
}

function stationIcon(station: StationInfo) {
  if (station.sinEstacion) return <BanIcon />;
  const IconCmp = station.icono ? getStepIcon(station.icono) : FactoryIcon;
  return <IconCmp />;
}

function StationCard({
  station,
  stats,
  onSelect,
}: {
  station: StationInfo;
  stats: ReturnType<typeof computeStationStats>;
  onSelect: (stationKey: string) => void;
}) {
  const etapa = station.etapa ? etapaDeEstacion(station.etapa) : null;
  const tone = stats.blocked > 0 ? "block" : stats.urgent > 0 ? "urgent" : "ok";
  // Carga REAL: pasos activos sobre la capacidad concurrente configurada.
  const loadPct = station.capacidad ? Math.round((stats.total / station.capacidad) * 100) : null;

  return (
    <button type="button" className={`sta-card tone-${tone}`} onClick={() => onSelect(station.key)}>
      <div className="sta-card-head">
        <span className="sta-card-ico">{stationIcon(station)}</span>
        <div className="sta-card-titles">
          <div className="nm">{station.nm}</div>
          <div className="desc">{station.sinEstacion ? "Familias sin estación asignada" : etapa?.nm ?? "Estación del taller"}</div>
        </div>
      </div>
      <div className="sta-card-load">
        <div className="lh">
          <span className="num">{stats.total}</span>
          <span className="lbl">pasos activos</span>
          {loadPct != null ? <span className="pct">{loadPct}% de capacidad</span> : null}
        </div>
        <LoadBar pending={stats.pending} urgent={stats.urgent} blocked={stats.blocked} max={Math.max(station.capacidad ?? 0, stats.total)} />
        <div className="sta-card-segs">
          {stats.pending > 0 ? <span className="seg-lbl"><span className="dot pending" />{stats.pending} pendientes</span> : null}
          {stats.urgent > 0 ? <span className="seg-lbl"><span className="dot urgent" />{stats.urgent} urgente{stats.urgent > 1 ? "s" : ""}</span> : null}
          {stats.blocked > 0 ? <span className="seg-lbl"><span className="dot blocked" />{stats.blocked} bloqueado{stats.blocked > 1 ? "s" : ""}</span> : null}
        </div>
      </div>
      <div className="sta-card-signals">
        {stats.oldestBlocked ? <div className="sig sig-block"><BanIcon /><span><strong>{stats.oldestBlocked.step.paso.motivoBloqueo || "Sin detalle"}</strong></span></div> : null}
        {stats.minDias != null ? <div className={`sig ${stats.minDias <= 0 ? "sig-warn" : ""}`}><ClockIcon /><span>Próxima entrega · <strong>{fmtDiasEntrega(stats.minDias)}</strong></span></div> : null}
      </div>
      <div className="sta-card-foot"><span>Ver detalles</span><ArrowRightIcon /></div>
    </button>
  );
}

function StationGrid({
  items,
  estaciones,
  onSelect,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  onSelect: (stationKey: string) => void;
}) {
  const { stations, tareas } = buildStationsModel(items, estaciones);
  const allStats = stations.map((station) => ({ station, stats: computeStationStats(tareas.get(station.key) ?? []) }));
  const totalActive = allStats.reduce((acc, entry) => acc + entry.stats.total, 0);
  const blockedTotal = allStats.reduce((acc, entry) => acc + entry.stats.blocked, 0);
  const urgentTotal = allStats.reduce((acc, entry) => acc + entry.stats.urgent, 0);
  const active = allStats.filter((entry) => entry.stats.total > 0 && !entry.station.sinEstacion);
  const idle = allStats.filter((entry) => entry.stats.total === 0);
  const sinEstacion = allStats.find((entry) => entry.station.sinEstacion);
  const byEtapa = ETAPAS_ESTACION.map((etapa) => ({
    ...etapa,
    items: active
      .filter(({ station }) => station.etapa === etapa.key)
      .sort((a, b) => b.stats.blocked - a.stats.blocked || b.stats.urgent - a.stats.urgent || b.stats.total - a.stats.total),
  })).filter((etapa) => etapa.items.length > 0);

  return (
    <div className="sta-grid-wrap">
      <div className="sta-toolbar">
        <div className="sta-select"><span className="lbl">Estaciones del taller · el paso llega por su familia</span></div>
        <div className="sta-toolbar-stats">
          <span className="stat"><strong>{totalActive}</strong>pasos activos</span>
          <span className="sep">·</span>
          <span className="stat"><strong>{active.length}</strong>de {stations.filter((s) => !s.sinEstacion).length} estaciones con trabajo</span>
          {blockedTotal > 0 ? <><span className="sep">·</span><span className="stat warn"><strong>{blockedTotal}</strong>bloqueado{blockedTotal > 1 ? "s" : ""}</span></> : null}
          {urgentTotal > 0 ? <><span className="sep">·</span><span className="stat amber"><strong>{urgentTotal}</strong>urgente{urgentTotal > 1 ? "s" : ""}</span></> : null}
        </div>
        <Link className="sta-toolbar-cta" href="/produccion/estaciones"><CogIcon /><span>Configurar estaciones</span></Link>
      </div>

      {estaciones.filter((estacion) => estacion.activo).length === 0 ? (
        <div className="sta-config-hint">
          Todavía no configuraste estaciones: todo el trabajo aparece en «Sin estación».{" "}
          <Link href="/produccion/estaciones">Crear estaciones</Link> y asignales familias de pasos para agrupar el tablero por tu taller real.
        </div>
      ) : null}

      {byEtapa.map((category) => {
        const catTotal = category.items.reduce((acc, entry) => acc + entry.stats.total, 0);
        return (
          <section key={category.key} className="sta-cat">
            <div className="sta-cat-head">
              <h3>{category.nm}</h3>
              <span className="rule" />
              <span className="ct"><strong>{catTotal}</strong> pasos · {category.items.length} {category.items.length === 1 ? "estación" : "estaciones"}</span>
            </div>
            <div className="sta-grid">
              {category.items.map(({ station, stats }) => <StationCard key={station.key} station={station} stats={stats} onSelect={onSelect} />)}
            </div>
          </section>
        );
      })}

      {sinEstacion ? (
        <section className="sta-cat">
          <div className="sta-cat-head">
            <h3>Sin estación asignada</h3>
            <span className="rule" />
            <span className="ct"><strong>{sinEstacion.stats.total}</strong> pasos · <Link href="/produccion/estaciones">asignar familias</Link></span>
          </div>
          <div className="sta-grid">
            <StationCard station={sinEstacion.station} stats={sinEstacion.stats} onSelect={onSelect} />
          </div>
        </section>
      ) : null}

      {idle.length > 0 ? (
        <div className="sta-idle">
          <div className="sta-idle-head"><span className="dot" /><span>Sin actividad ahora</span><span className="ct">{idle.length} estaciones</span></div>
          <div className="sta-idle-chips">
            {idle.map(({ station }) => (
              <button key={station.key} type="button" className="sta-idle-chip" onClick={() => onSelect(station.key)}>
                <span className="ic">{stationIcon(station)}</span><span className="nm">{station.nm}</span><span className="arr"><ArrowRightIcon /></span>
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
  onMoveToMesa,
  onOpen,
  dragHint,
}: {
  task: StationTask;
  inMesa: boolean;
  onMoveToMesa: (id: string) => void;
  onOpen: (id: string) => void;
  dragHint?: boolean;
}) {
  const statusLabel = task.isBlocked ? "BLOQUEADO" : task.isCurrent ? "EN CURSO" : "PENDIENTE";
  const statusCls = task.isBlocked ? "blocked" : task.isCurrent ? "current" : "pending";

  return (
    <div className={`sta-task status-${statusCls} ${task.overdue ? "overdue" : ""} ${task.urgent ? "urgent" : ""} ${inMesa ? "in-mesa" : ""}`}>
      <div className="sta-task-row1">
        <span className="grip" title="Mover a tu mesa"><GripVerticalIcon /></span>
        <span className="code">{task.item.code}</span>
        <span className={`task-status ${statusCls}`}>{statusLabel}</span>
        {task.overdue ? <span className="task-vencido"><BanIcon />VENCIDO</span> : null}
        <span className="ot">{task.item.otCode}</span>
      </div>
      <div className="sta-task-body">
        <div className="meta"><span className="ic"><UserIcon /></span><span className="v">{task.item.customer}</span></div>
        <div className="meta"><span className="ic"><BoxIcon /></span><span className="v">{task.item.product} <span className="qty">· {task.item.qtyLabel}</span></span></div>
        <div className="meta step"><span className="ic"><CogIcon /></span><span className="v">{task.step.paso.nombre}</span></div>
        {task.step.paso.motivoBloqueo ? <div className="meta sub-detail"><span className="v">{task.step.paso.motivoBloqueo}</span></div> : null}
      </div>
      <div className="sta-task-foot">
        <div className="ts"><ClockIcon /><span>{task.item.dueLabel}</span><span className="sep">·</span><span className={task.overdue ? "warn" : ""}>{task.item.dueIn}</span></div>
        <div className="actions">
          <button type="button" className="sta-btn ghost" onClick={(event) => { event.stopPropagation(); onMoveToMesa(taskId(task)); }}>
            {inMesa ? <><ArrowLeftIcon />Devolver</> : <>Mover a mi mesa<ArrowRightIcon /></>}
          </button>
          <button type="button" className="sta-btn primary" onClick={(event) => { event.stopPropagation(); onOpen(task.item.id); }}>Ver detalles</button>
        </div>
      </div>
      {dragHint ? <div className="sta-task-hint">Movete tareas a tu mesa para ordenar tu trabajo del día.</div> : null}
    </div>
  );
}

function StationDetail({
  items,
  estaciones,
  stationKey,
  onBack,
  onOpen,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  stationKey: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const { stations, tareas } = buildStationsModel(items, estaciones);
  const station = stations.find((entry) => entry.key === stationKey);
  const tasks = tareas.get(stationKey) ?? [];
  const [mesa, setMesa] = React.useState(() => new Set<string>());
  const [filter, setFilter] = React.useState("todos");
  const etapa = station?.etapa ? etapaDeEstacion(station.etapa) : null;
  const estacionConfig = estaciones.find((entry) => entry.id === stationKey);

  const toggleMesa = (id: string) => {
    setMesa((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mesaTasks = tasks.filter((task) => mesa.has(taskId(task)));
  const sharedTasks = tasks.filter((task) => !mesa.has(taskId(task)));
  let visibleShared = sharedTasks;
  let visibleMesa = mesaTasks;
  if (filter === "pendientes") visibleShared = sharedTasks.filter((task) => task.isPending);
  if (filter === "mesa") visibleShared = [];
  if (filter === "urgentes") {
    visibleShared = sharedTasks.filter((task) => task.urgent);
    visibleMesa = mesaTasks.filter((task) => task.urgent);
  }
  const showing = filter === "mesa" ? mesaTasks.length : visibleShared.length + visibleMesa.length;

  return (
    <div className="sta-detail">
      <div className="sta-detail-head">
        <div className="sta-detail-head-top">
          <span className="sta-detail-ico">{station ? stationIcon(station) : <FactoryIcon />}</span>
          <div className="body">
            <h2>{station?.nm ?? "Estación"}</h2>
            <p>
              {station?.sinEstacion
                ? "Pasos cuya familia no está asignada a ninguna estación activa"
                : [etapa?.nm, estacionConfig?.horario].filter(Boolean).join(" · ") || "Estación del taller"}
            </p>
            <div className="actions">
              <button type="button" className="sta-btn ghost" onClick={onBack}><ArrowLeftIcon />Ver todas las estaciones</button>
            </div>
          </div>
          <div className="counter"><div className="num">{tasks.length}</div><div className="lbl">pasos activos</div></div>
        </div>
      </div>

      <div className="sta-detail-kpis">
        <div className="kpi"><div className="k">Total activos</div><div className="v">{tasks.length}</div></div>
        {station?.capacidad ? <div className={`kpi ${tasks.length > station.capacidad ? "warm" : ""}`}><div className="k">Capacidad</div><div className="v">{tasks.length}/{station.capacidad}</div></div> : null}
        <div className={`kpi ${mesa.size > 0 ? "ok" : "warn"}`}><div className="k">Mi mesa de trabajo</div><div className="v">{mesa.size}</div></div>
        <div className="kpi cool"><div className="k">Pendientes</div><div className="v">{tasks.filter((task) => task.isPending).length}</div></div>
        <div className={`kpi ${tasks.some((task) => task.urgent) ? "warm" : ""}`}><div className="k">Urgentes</div><div className="v">{tasks.filter((task) => task.urgent).length}</div></div>
        <div className="kpi"><div className="k">Mostrando</div><div className="v">{showing}</div></div>
      </div>

      <div className="sta-detail-filters">
        <span className="lbl">Filtros:</span>
        {[
          { k: "todos", l: "Todos" },
          { k: "pendientes", l: "Pendientes" },
          { k: "mesa", l: "Mi mesa" },
          { k: "urgentes", l: "Solo urgentes" },
        ].map((entry) => (
          <button key={entry.k} type="button" className={`chip ${filter === entry.k ? "on" : ""}`} onClick={() => setFilter(entry.k)}>{entry.l}</button>
        ))}
      </div>

      <div className="sta-detail-board">
        <div className="sta-col mesa-col">
          <div className="sta-col-head"><span className="dot mesa" /><span className="ttl">Mi mesa de trabajo</span><span className="ct"><strong>{mesaTasks.length}</strong> pasos</span></div>
          <div className={`sta-col-body ${mesaTasks.length === 0 ? "empty-mesa" : ""}`}>
            {mesaTasks.length === 0 ? <div className="sta-mesa-empty"><BoxIcon /><div className="ttl">Movete tareas acá para trabajar en ellas</div><div className="sub">Las tareas pasan a tu mesa cuando las tomás de la fila compartida.</div></div> : null}
            {visibleMesa.map((task, index) => <TaskCard key={taskId(task)} task={task} inMesa onMoveToMesa={toggleMesa} onOpen={onOpen} dragHint={index === 0 && filter !== "mesa"} />)}
          </div>
        </div>

        <div className="sta-col shared-col">
          <div className="sta-col-head"><span className="dot shared" /><span className="ttl">Pendientes compartidas</span><span className="ct"><strong>{visibleShared.length}</strong> pasos</span></div>
          <div className="sta-col-body">
            {visibleShared.length === 0 ? <div className="sta-shared-empty">{filter === "mesa" ? "Solo se muestran las tareas de tu mesa." : "No quedan tareas pendientes que coincidan con el filtro."}</div> : null}
            {visibleShared.map((task) => <TaskCard key={taskId(task)} task={task} inMesa={false} onMoveToMesa={toggleMesa} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ByStationView({
  items,
  estaciones,
  onOpen,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  onOpen: (id: string) => void;
}) {
  const [stationKey, setStationKey] = React.useState<string | null>(null);
  if (stationKey) return <StationDetail items={items} estaciones={estaciones} stationKey={stationKey} onBack={() => setStationKey(null)} onOpen={onOpen} />;
  return <StationGrid items={items} estaciones={estaciones} onSelect={setStationKey} />;
}

// ── Kanban ───────────────────────────────────────────────────────────────

function getKanbanBucket(item: ItemView): KanbanBucketKey {
  if (!item.started) return "not-started";
  if (item.dueDays === 0) return "today";
  if (item.delayed) return "delayed";
  return "active";
}

function kanbanStepIcon(item: ItemView) {
  if (item.blocked) return <BanIcon />;
  const IconCmp = item.currentStep ? getStepIcon(item.currentStep.iconKey) : LayoutDashboardIcon;
  return <IconCmp />;
}

function KanbanCard({ item, onOpen }: { item: ItemView; onOpen: (id: string) => void }) {
  const step = item.currentStep;

  return (
    <button type="button" className={`kan-card priority-${item.priority} ${item.blocked ? "blocked" : item.delayed ? "delayed" : ""}`} onClick={() => onOpen(item.id)}>
      <div className="kan-card-top">
        <span className="item-code">{item.code}</span>
        <span className="ot-badge">{item.otCode}</span>
        {item.priority !== "normal" ? <span className={`prio-pill prio-${item.priority}`}>{priorityLabel(item.priority)}</span> : null}
        <span className="kan-pct">{item.progressPct}%</span>
      </div>
      <div className="kan-title">{item.product}</div>
      <div className="kan-meta">{item.customer} · {item.spec}</div>
      <div className="kan-step">
        <span className="kan-step-ico">{kanbanStepIcon(item)}</span>
        <div>
          <div className="tec">{step?.paso.nombre ?? (item.sinRuta ? "Sin ruta" : "Completado")}</div>
          <div className="sub">{item.statusLine}</div>
        </div>
      </div>
      <div className="kan-progress" aria-label={`Avance ${item.progressPct}%`}><span style={{ width: `${item.progressPct}%` }} /></div>
      <div className="kan-foot">
        <span className={`due ${item.delayed || item.dueDays === 0 ? "warn" : ""}`}><ClockIcon />{item.dueLabel} · {item.dueIn}</span>
        <span className="op"><span className="mini-av">{iniciales(item.vendedor)}</span>{item.vendedor.split(" ")[0]}</span>
      </div>
    </button>
  );
}

function KanbanView({ items, onOpen }: { items: ItemView[]; onOpen: (id: string) => void }) {
  const columns: Array<{ key: KanbanBucketKey; title: string; description: string }> = [
    { key: "not-started", title: "No iniciados", description: "Sin pasos ejecutados" },
    { key: "today", title: "Vencen hoy", description: "Prioridad de despacho" },
    { key: "delayed", title: "Con retraso", description: "Entrega vencida" },
    { key: "active", title: "En curso", description: "Avanzando sin retraso" },
  ];
  const grouped = columns.map((column) => ({
    ...column,
    items: items.filter((item) => getKanbanBucket(item) === column.key),
  }));

  return (
    <div className="kanban-board" aria-label="Kanban de producción">
      {grouped.map((column) => (
        <section key={column.key} className={`kan-col kan-${column.key}`}>
          <div className="kan-col-head">
            <div>
              <h2>{column.title}</h2>
              <p>{column.description}</p>
            </div>
            <span>{column.items.length}</span>
          </div>
          <div className="kan-col-body">
            {column.items.length === 0 ? <div className="kan-empty">No hay items en esta columna.</div> : null}
            {column.items.map((item) => <KanbanCard key={item.id} item={item} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Vista principal ──────────────────────────────────────────────────────

export function TableroProduccion({
  initialItems,
  estaciones,
}: {
  initialItems: TableroItemData[];
  estaciones: Estacion[];
}) {
  const [items, setItems] = React.useState<TableroItemData[]>(initialItems);
  const [mode, setMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [defaultMode, setDefaultMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [tabMenu, setTabMenu] = React.useState<{ mode: Mode; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<{ status: StatusFilter; priority: PriorityFilter; query: string }>({ status: "all", priority: "all", query: "" });

  React.useEffect(() => {
    const savedMode = readStoredBoardMode();
    setDefaultMode(savedMode);
    setMode(savedMode);
  }, []);

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

  /**
   * Acción sobre un paso: el backend devuelve el item re-proyectado, pero
   * la acción puede promover la orden (pendiente → produccion) y eso afecta
   * a los items hermanos: se refresca el dataset completo (es chico).
   */
  const handleAccion = React.useCallback(
    async (item: ItemView, paso: TableroPasoData, accion: TableroPasoAccion, motivo?: string) => {
      setBusy(true);
      setError(null);
      try {
        const actualizado = await accionPasoProduccion(item.data.ordenId, item.id, paso.id, { accion, motivo });
        setItems((current) => current.map((entry) => (entry.id === actualizado.id ? actualizado : entry)));
        const { items: refrescados } = await getTableroProduccion();
        setItems(refrescados);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo ejecutar la acción.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const tabEntries: Array<{ mode: Mode; label: string; count?: number }> = [
    { mode: "items", label: BOARD_MODE_LABELS.items, count: views.length },
    { mode: "estacion", label: BOARD_MODE_LABELS.estacion },
    { mode: "kanban", label: BOARD_MODE_LABELS.kanban },
  ];

  const tabMenuStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!tabMenu || typeof window === "undefined") return undefined;
    return {
      left: Math.max(12, Math.min(tabMenu.x, Math.max(12, window.innerWidth - 244))),
      top: Math.max(12, Math.min(tabMenu.y, Math.max(12, window.innerHeight - 72))),
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
      if (filters.status === "in-progress" && (item.blocked || item.delayed)) return false;
      if (filters.status === "blocked" && !item.blocked) return false;
      if (filters.status === "delayed" && (!item.delayed || item.blocked)) return false;
      if (filters.status === "due-today" && item.dueDays !== 0) return false;
      if (filters.priority !== "all" && item.priority !== filters.priority) return false;
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const haystack = `${item.code} ${item.otCode} ${item.customer} ${item.product} ${item.spec}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [views, filters]);

  const counts = {
    all: views.length,
    shown: filtered.length,
    inProgress: views.filter((item) => !item.blocked && !item.delayed).length,
    blocked: views.filter((item) => item.blocked).length,
    delayed: views.filter((item) => item.delayed && !item.blocked).length,
    today: views.filter((item) => item.dueDays === 0).length,
  };
  const selectedItem = selectedId ? views.find((item) => item.id === selectedId) : undefined;

  return (
    <div className="tablero-produccion">
      <div className="tab-page">
        <div className="page-head">
          <div className="title-block">
            <h1>Tablero de producción</h1>
            <div className="sub">Items de las órdenes emitidas, con su ruta real de pasos. Click en un item para ver el detalle y ejecutar acciones.</div>
          </div>
        </div>

        <div className="d-kpi-row">
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Items en producción</span></div><div className="d-kpi-val"><span className="num">{views.length}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">de órdenes emitidas</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">En curso · OK</span></div><div className="d-kpi-val"><span className="num ok">{counts.inProgress}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">avanzando sin retraso</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Con retraso</span></div><div className="d-kpi-val"><span className="num signal">{counts.delayed}</span></div><div className="d-kpi-foot"><span className="d-delta tone-signal">entrega vencida</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Bloqueados</span></div><div className="d-kpi-val"><span className="num">{counts.blocked}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">requieren intervención</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Vencen hoy</span></div><div className="d-kpi-val"><span className="num">{counts.today}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">prioridad de despacho</span></div></div>
        </div>

        {error ? <div className="tab-error" role="alert">{error}</div> : null}

        <div className="dash-tabs">
          {tabEntries.map((entry) => (
            <button
              key={entry.mode}
              type="button"
              className={`dash-tab ${mode === entry.mode ? "on" : ""}`}
              aria-selected={mode === entry.mode}
              onClick={() => setMode(entry.mode)}
              onContextMenu={(event) => {
                event.preventDefault();
                setTabMenu({ mode: entry.mode, x: event.clientX, y: event.clientY });
              }}
            >
              <span>{entry.label}</span>
              {typeof entry.count === "number" ? <span className="count">{entry.count}</span> : null}
              {defaultMode === entry.mode ? <span className="default-mark">Pred.</span> : null}
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
            <button type="button" role="menuitem" onClick={() => setDefaultBoardMode(tabMenu.mode)}>
              {defaultMode === tabMenu.mode ? <CheckIcon /> : <LayoutDashboardIcon />}
              <span>{defaultMode === tabMenu.mode ? "Vista predeterminada" : "Elegir como predeterminada"}</span>
            </button>
          </div>
        ) : null}

        {views.length === 0 ? (
          <div className="empty-results">
            No hay órdenes en producción. Cuando emitas una orden de trabajo al taller,
            sus items aparecen acá con su ruta de pasos.{" "}
            <Link href="/produccion/ordenes">Ir a Órdenes de trabajo</Link>
          </div>
        ) : (
          <>
            {mode === "items" ? (
              <>
                <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
                <div className="tab-board">
                  {filtered.map((item) => <ItemRow key={item.id} item={item} onOpen={setSelectedId} />)}
                  {filtered.length === 0 ? <div className="empty-results">No hay items que coincidan con los filtros.</div> : null}
                </div>
              </>
            ) : null}
            {mode === "estacion" ? <ByStationView items={views} estaciones={estaciones} onOpen={setSelectedId} /> : null}
            {mode === "kanban" ? (
              <>
                <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
                <KanbanView items={filtered} onOpen={setSelectedId} />
              </>
            ) : null}
          </>
        )}
      </div>

      <ItemDetailSheet item={selectedItem} busy={busy} onAccion={handleAccion} onClose={() => setSelectedId(null)} />
    </div>
  );
}
