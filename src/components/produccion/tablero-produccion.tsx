"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  BookOpenIcon,
  BoxIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  ClockIcon,
  CogIcon,
  DownloadIcon,
  FactoryIcon,
  FileIcon,
  GripVerticalIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PauseIcon,
  PrinterIcon,
  ScissorsIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TruckIcon,
  UserIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

import {
  PROD_ACTIVITY,
  PROD_ITEMS,
  PROD_STEPS,
  STATION_CATEGORIES,
  STATIONS,
  STEP_TO_STATION,
  type TableroActivity,
  type TableroItem,
  type TableroStep,
} from "@/lib/tablero-produccion-mock";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type Mode = "items" | "estacion" | "kanban";
type StatusFilter = "all" | "in-progress" | "blocked" | "delayed" | "due-today";
type PriorityFilter = "all" | "urgent" | "high" | "normal";
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
  Sun: SunIcon,
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
  Pause: PauseIcon,
  Block: BanIcon,
};

const TL_HOUR_PX = 9;
const TL_PAST_H = 72;
const TL_FUTURE_H = 192;
const TL_TOTAL_H = TL_PAST_H + TL_FUTURE_H;
const TL_WIDTH = TL_TOTAL_H * TL_HOUR_PX;
const TL_ORIGIN_PX = TL_PAST_H * TL_HOUR_PX;
const TL_DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getStepIcon(icon: string) {
  return TIco[icon] ?? LayoutDashboardIcon;
}

function priorityLabel(priority: TableroItem["priority"]) {
  return priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : "Normal";
}

function routeStatusIcon(step: TableroStep, metaIcon: string, fallback?: React.ReactNode) {
  const IconCmp = getStepIcon(metaIcon);
  if (step.status === "done") return <CheckIcon />;
  if (step.status === "blocked") return <BanIcon />;
  if (step.status === "pending" && fallback) return fallback;
  return <IconCmp />;
}

function RouteStrip({ steps, compact = false }: { steps: TableroStep[]; compact?: boolean }) {
  return (
    <div className={`route-strip ${compact ? "compact" : ""}`}>
      {steps.map((step, index) => {
        const meta = PROD_STEPS[step.key];
        const cls = `route-step ${step.status}` + (step.status === "done" || (index > 0 && steps[index - 1]?.status === "done") ? " link-done" : "");

        return (
          <div key={`${step.key}-${index}`} className={cls} title={`${meta.nm} · ${meta.tec}`}>
            <span className="ri-dot">{routeStatusIcon(step, meta.ico)}</span>
            <span className="ri-label">{meta.nm}</span>
            {step.status === "current" && step.progress != null && !compact ? (
              <span className="ri-progress">
                <span style={{ width: `${Math.round(step.progress * 100)}%` }} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({ item, onOpen }: { item: TableroItem; onOpen: (code: string) => void }) {
  const cssRow = `tab-row priority-${item.priority}` + (item.blocked ? " blocked" : "") + (!item.onTrack && !item.blocked ? " delayed" : "");

  return (
    <button type="button" className={cssRow} onClick={() => onOpen(item.code)}>
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
        <div className={`tab-status-line ${item.blocked ? "blocked" : item.onTrack ? "" : "delayed"}`}>
          <span className={`dot ${item.blocked ? "dot-block" : item.onTrack ? "dot-ok" : "dot-warn"}`} />
          <span>{item.statusLine}</span>
        </div>
      </div>

      <div className="tab-row-right">
        <div className={`tab-due ${!item.onTrack && !item.blocked ? "delayed" : ""}`}>
          <span className="due-label">{item.dueDate}</span>
          <span className="due-in">{item.dueIn} restantes</span>
        </div>
        <div className="tab-assigned" title={item.operator.nombre}>
          <span className="av">{item.operator.iniciales}</span>
          <div>
            <div className="nm">{item.operator.nombre.split(" ")[0]} {item.operator.nombre.split(" ")[1]?.[0]}.</div>
            <div className="role">{item.machine !== "—" ? item.machine.split(" · ")[0] : item.operator.role}</div>
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

function DetailRuta({ item }: { item: TableroItem }) {
  return (
    <div className="detail-route">
      {item.steps.map((step, index) => {
        const meta = PROD_STEPS[step.key];
        return (
          <div key={`${step.key}-${index}`} className={`detail-step ${step.status}`}>
            <div className="ds-line">
              <span className="ds-dot">{routeStatusIcon(step, meta.ico, <span className="ix">{index + 1}</span>)}</span>
            </div>
            <div className="ds-body">
              <div className="ds-head">
                <div>
                  <div className="ds-tec">{meta.tec}</div>
                  <div className="ds-nm">{meta.nm}</div>
                </div>
                {step.status === "done" && step.end ? <span className="ds-time done"><CheckIcon />{step.end} · {step.dur}</span> : null}
                {step.status === "current" ? <span className="ds-time current"><span className="dot" />En curso · {step.progress != null ? `${Math.round(step.progress * 100)}%` : "—"}</span> : null}
                {step.status === "pending" && step.dur ? <span className="ds-time">estimado {step.dur}</span> : null}
                {step.status === "blocked" ? <span className="ds-time blocked"><BanIcon />Bloqueado</span> : null}
              </div>

              {step.status === "current" ? (
                <div className="ds-current-detail">
                  <div className="ds-cd-row"><span className="k">Máquina</span><span className="v">{step.machine || "—"}</span></div>
                  <div className="ds-cd-row"><span className="k">Operario</span><span className="v">{step.op || "—"}</span></div>
                  {step.sub ? <div className="ds-cd-row"><span className="k">Avance</span><span className="v">{step.sub}</span></div> : null}
                  {step.progress != null ? <div className="ds-cd-bar"><span style={{ width: `${Math.round(step.progress * 100)}%` }} /></div> : null}
                </div>
              ) : null}
              {step.status === "blocked" && step.sub ? <div className="ds-blocked-detail">{step.sub}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailMateriales() {
  const mats = [
    { code: "PAP-OPL-300", nm: "Opalina 300gr 70 x 100", qty: "4 rs · estimado", consumed: "3,2 rs", left: "0,8 rs" },
    { code: "TIN-OFF-K", nm: "Tinta offset negra", qty: "1,2 kg · estimado", consumed: "0,9 kg", left: "0,3 kg" },
    { code: "TIN-OFF-CMY", nm: "Tintas CMY (set)", qty: "0,8 kg · estimado", consumed: "0,6 kg", left: "0,2 kg" },
    { code: "LAM-MAT-UV", nm: "Laminado mate UV", qty: "5,2 m2 · estimado", consumed: "—", left: "5,2 m2" },
  ];

  return (
    <table className="detail-tbl">
      <thead>
        <tr><th>Material</th><th className="right">Estimado</th><th className="right">Consumido</th><th className="right">Restante</th></tr>
      </thead>
      <tbody>
        {mats.map((mat) => (
          <tr key={mat.code}>
            <td><div className="nm">{mat.nm}</div><div className="code">{mat.code}</div></td>
            <td className="right mono">{mat.qty}</td>
            <td className="right mono">{mat.consumed}</td>
            <td className="right mono">{mat.left}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailActividad({ activity }: { activity: TableroActivity[] }) {
  return (
    <div className="detail-activity">
      {activity.map((row, index) => (
        <div key={`${row.t}-${index}`} className={`act-row ${row.kind}`}>
          <span className="t">{row.t}</span>
          <div className="body">
            <div className="what">{row.what}</div>
            <div className="who">por {row.who}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailArchivos() {
  const files = [
    { nm: "Arte_final_v3.pdf", size: "12,4 MB", kind: "PDF", when: "hace 2h" },
    { nm: "Prueba_color_lab.jpg", size: "1,8 MB", kind: "JPG", when: "Ayer" },
    { nm: "OT-2487.pdf", size: "240 KB", kind: "PDF", when: "Lun 12 may" },
  ];

  return (
    <div className="detail-files">
      {files.map((file) => (
        <div key={file.nm} className="file-row">
          <span className="kind"><FileIcon />{file.kind}</span>
          <div className="body">
            <div className="nm">{file.nm}</div>
            <div className="meta">{file.size} · {file.when}</div>
          </div>
          <button type="button" className="btn"><DownloadIcon />Descargar</button>
        </div>
      ))}
    </div>
  );
}

function ItemDetailSheet({ item, onClose }: { item: TableroItem | undefined; onClose: () => void }) {
  const [tab, setTab] = React.useState("ruta");
  if (!item) return null;

  const totalSteps = item.steps.length;
  const doneSteps = item.steps.filter((step) => step.status === "done").length;
  const currentStep = item.steps.find((step) => step.status === "current");
  const currentMeta = currentStep ? PROD_STEPS[currentStep.key] : undefined;
  const activity = PROD_ACTIVITY[item.code] ?? [{ t: "Sin actividad reciente", who: "—", what: "—", kind: "" }];

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

          <div className={`item-status-banner ${item.blocked ? "blocked" : item.onTrack ? "ok" : "delayed"}`}>
            <span className="dot" />
            <div className="body">
              <div className="ttl">{item.statusLine}</div>
              {item.blocked && item.blockedReason ? <div className="sub">{item.blockedReason}</div> : null}
              {!item.blocked && currentMeta ? (
                <div className="sub">
                  Paso actual · <strong>{currentMeta.tec}</strong>
                  {currentStep?.machine && currentStep.machine !== "—" ? <> · en <strong>{currentStep.machine}</strong></> : null}
                </div>
              ) : null}
            </div>
            <div className="due">
              <div className="lbl">Entrega</div>
              <div className="val">{item.dueDate}</div>
              <div className="sub">{item.dueIn} restantes</div>
            </div>
          </div>

          <div className="item-meta-strip">
            <div className="m"><div className="k">Avance</div><div className="v">{item.progressPct}%<span className="sub">· {doneSteps}/{totalSteps} pasos</span></div></div>
            <div className="m"><div className="k">Cantidad</div><div className="v">{item.qty.toLocaleString("es-AR")} u</div></div>
            <div className="m"><div className="k">Vendedor</div><div className="v"><span className="mini-av">{item.vendedor}</span></div></div>
            <div className="m"><div className="k">Operario</div><div className="v">{item.operator.nombre}</div></div>
            <div className="m"><div className="k">Máquina</div><div className="v mono">{item.machine}</div></div>
          </div>

          <div className="sheet-tabs">
            {[
              { k: "ruta", l: "Ruta de producción", n: totalSteps },
              { k: "materiales", l: "Materiales", n: 4 },
              { k: "actividad", l: "Actividad", n: activity.length },
              { k: "archivos", l: "Archivos", n: 3 },
            ].map((entry) => (
              <button key={entry.k} type="button" className={tab === entry.k ? "on" : ""} onClick={() => setTab(entry.k)}>
                {entry.l}<span className="ct">{entry.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-body">
          {tab === "ruta" ? <DetailRuta item={item} /> : null}
          {tab === "materiales" ? <DetailMateriales /> : null}
          {tab === "actividad" ? <DetailActividad activity={activity} /> : null}
          {tab === "archivos" ? <DetailArchivos /> : null}
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn"><PauseIcon />Pausar item</button>
          {item.blocked ? <button type="button" className="btn">Desbloquear</button> : null}
          <div className="spacer" />
          <button type="button" className="btn btn-primary">Marcar paso completado</button>
        </div>
      </aside>
    </>
  );
}

function parseDueInHours(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("hoy")) {
    const match = lower.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 12;
  }

  let total = 0;
  const days = lower.match(/(\d+)\s*d/);
  const hours = lower.match(/(\d+)\s*h/);
  if (days) total += parseInt(days[1], 10) * 24;
  if (hours) total += parseInt(hours[1], 10);
  return total || 999;
}

function fmtHoursUntil(hours: number) {
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

type StationTask = {
  itemCode: string;
  item: TableroItem;
  step: TableroStep;
  stepIdx: number;
  isCurrent: boolean;
  isBlocked: boolean;
  isPending: boolean;
  overdue: boolean;
  urgent: boolean;
};

function getActiveStepsAtStation(stationKey: string) {
  const out: StationTask[] = [];
  PROD_ITEMS.forEach((item) => {
    item.steps.forEach((step, index) => {
      if (STEP_TO_STATION[step.key] !== stationKey || step.status === "done") return;
      out.push({
        itemCode: item.code,
        item,
        step,
        stepIdx: index,
        isCurrent: step.status === "current",
        isBlocked: step.status === "blocked",
        isPending: step.status === "pending",
        overdue: !item.onTrack && step.status !== "blocked",
        urgent: item.priority === "urgent" || (!item.onTrack && step.status !== "blocked") || step.status === "blocked",
      });
    });
  });

  return out.sort((a, b) => {
    const aw = (a.isBlocked ? 0 : 1) + (a.overdue ? 0 : 2) + (a.isCurrent ? 1 : 4);
    const bw = (b.isBlocked ? 0 : 1) + (b.overdue ? 0 : 2) + (b.isCurrent ? 1 : 4);
    return aw - bw;
  });
}

function taskId(task: StationTask) {
  return `${task.itemCode}:${task.stepIdx}`;
}

function computeStationStats(stationKey: string) {
  const tasks = getActiveStepsAtStation(stationKey);
  const blocked = tasks.filter((task) => task.isBlocked).length;
  const urgent = tasks.filter((task) => task.urgent && !task.isBlocked).length;
  const pending = tasks.length - blocked - urgent;
  const minHours = tasks.reduce((min, task) => Math.min(min, parseDueInHours(task.item.dueIn)), Infinity);

  return {
    tasks,
    total: tasks.length,
    pending,
    urgent,
    blocked,
    minHours: Number.isFinite(minHours) ? minHours : null,
    oldestBlocked: tasks.find((task) => task.isBlocked),
  };
}

function LoadBar({ pending, urgent, blocked, max }: { pending: number; urgent: number; blocked: number; max: number }) {
  const total = pending + urgent + blocked;
  if (max === 0 || total === 0) return <div className="load-bar"><div className="track" /></div>;
  const width = (value: number) => `${(value / max) * 100}%`;
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

function StationCard({
  station,
  stats,
  maxLoad,
  onSelect,
}: {
  station: (typeof STATIONS)[number];
  stats: ReturnType<typeof computeStationStats>;
  maxLoad: number;
  onSelect: (stationKey: string) => void;
}) {
  const IconCmp = getStepIcon(station.icon);
  const tone = stats.blocked > 0 ? "block" : stats.urgent > 0 ? "urgent" : "ok";
  const loadPct = maxLoad > 0 ? Math.round((stats.total / maxLoad) * 100) : 0;

  return (
    <button type="button" className={`sta-card tone-${tone}`} onClick={() => onSelect(station.key)}>
      <div className="sta-card-head">
        <span className="sta-card-ico"><IconCmp /></span>
        <div className="sta-card-titles"><div className="nm">{station.nm}</div><div className="desc">{station.desc}</div></div>
      </div>
      <div className="sta-card-load">
        <div className="lh"><span className="num">{stats.total}</span><span className="lbl">pasos activos</span><span className="pct">{loadPct}% carga</span></div>
        <LoadBar pending={stats.pending} urgent={stats.urgent} blocked={stats.blocked} max={maxLoad} />
        <div className="sta-card-segs">
          {stats.pending > 0 ? <span className="seg-lbl"><span className="dot pending" />{stats.pending} pendientes</span> : null}
          {stats.urgent > 0 ? <span className="seg-lbl"><span className="dot urgent" />{stats.urgent} urgente{stats.urgent > 1 ? "s" : ""}</span> : null}
          {stats.blocked > 0 ? <span className="seg-lbl"><span className="dot blocked" />{stats.blocked} bloqueado{stats.blocked > 1 ? "s" : ""}</span> : null}
        </div>
      </div>
      <div className="sta-card-signals">
        {stats.oldestBlocked ? <div className="sig sig-block"><BanIcon /><span><strong>{stats.oldestBlocked.step.sub || "Sin detalle"}</strong></span></div> : null}
        {stats.minHours != null ? <div className={`sig ${stats.minHours < 24 ? "sig-warn" : ""}`}><ClockIcon /><span>Próxima entrega · <strong>{fmtHoursUntil(stats.minHours)}</strong></span></div> : null}
      </div>
      <div className="sta-card-foot"><span>Ver detalles</span><ArrowRightIcon /></div>
    </button>
  );
}

function StationGrid({ onSelect }: { onSelect: (stationKey: string) => void }) {
  const allStats = STATIONS.map((station) => ({ station, stats: computeStationStats(station.key) }));
  const totalActive = allStats.reduce((acc, entry) => acc + entry.stats.total, 0);
  const maxLoad = Math.max(1, ...allStats.map((entry) => entry.stats.total));
  const blockedTotal = allStats.reduce((acc, entry) => acc + entry.stats.blocked, 0);
  const urgentTotal = allStats.reduce((acc, entry) => acc + entry.stats.urgent, 0);
  const active = allStats.filter((entry) => entry.stats.total > 0);
  const idle = allStats.filter((entry) => entry.stats.total === 0);
  const byCategory = STATION_CATEGORIES.map((category) => ({
    ...category,
    items: active
      .filter(({ station }) => (category.stations as readonly string[]).includes(station.key))
      .sort((a, b) => b.stats.blocked - a.stats.blocked || b.stats.urgent - a.stats.urgent || b.stats.total - a.stats.total),
  })).filter((category) => category.items.length > 0);

  return (
    <div className="sta-grid-wrap">
      <div className="sta-toolbar">
        <div className="sta-select"><span className="lbl">Todas las estaciones</span><ChevronDownIcon /></div>
        <div className="sta-toolbar-stats">
          <span className="stat"><strong>{totalActive}</strong>pasos activos</span>
          <span className="sep">·</span>
          <span className="stat"><strong>{active.length}</strong>de {STATIONS.length} estaciones activas</span>
          {blockedTotal > 0 ? <><span className="sep">·</span><span className="stat warn"><strong>{blockedTotal}</strong>bloqueado{blockedTotal > 1 ? "s" : ""}</span></> : null}
          {urgentTotal > 0 ? <><span className="sep">·</span><span className="stat amber"><strong>{urgentTotal}</strong>urgente{urgentTotal > 1 ? "s" : ""}</span></> : null}
        </div>
        <button type="button" className="sta-toolbar-cta"><CalendarIcon /><span>Entrega: Próximas</span></button>
      </div>

      {byCategory.map((category) => {
        const catTotal = category.items.reduce((acc, entry) => acc + entry.stats.total, 0);
        return (
          <section key={category.key} className="sta-cat">
            <div className="sta-cat-head">
              <h3>{category.nm}</h3>
              <span className="rule" />
              <span className="ct"><strong>{catTotal}</strong> pasos · {category.items.length} {category.items.length === 1 ? "estación" : "estaciones"}</span>
            </div>
            <div className="sta-grid">
              {category.items.map(({ station, stats }) => <StationCard key={station.key} station={station} stats={stats} maxLoad={maxLoad} onSelect={onSelect} />)}
            </div>
          </section>
        );
      })}

      {idle.length > 0 ? (
        <div className="sta-idle">
          <div className="sta-idle-head"><span className="dot" /><span>Sin actividad ahora</span><span className="ct">{idle.length} estaciones</span></div>
          <div className="sta-idle-chips">
            {idle.map(({ station }) => {
              const IconCmp = getStepIcon(station.icon);
              return (
                <button key={station.key} type="button" className="sta-idle-chip" onClick={() => onSelect(station.key)}>
                  <span className="ic"><IconCmp /></span><span className="nm">{station.nm}</span><span className="arr"><ArrowRightIcon /></span>
                </button>
              );
            })}
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
  onOpen: (code: string) => void;
  dragHint?: boolean;
}) {
  const meta = PROD_STEPS[task.step.key];
  const statusLabel = task.isBlocked ? "BLOQUEADO" : task.isCurrent ? "EN CURSO" : "PENDIENTE";
  const statusCls = task.isBlocked ? "blocked" : task.isCurrent ? "current" : "pending";

  return (
    <div className={`sta-task status-${statusCls} ${task.overdue ? "overdue" : ""} ${task.urgent ? "urgent" : ""} ${inMesa ? "in-mesa" : ""}`}>
      <div className="sta-task-row1">
        <span className="grip" title="Arrastrar a tu mesa"><GripVerticalIcon /></span>
        <span className="cbx" role="checkbox" aria-checked="false" />
        <span className="code">{task.itemCode}</span>
        <span className={`task-status ${statusCls}`}>{statusLabel}</span>
        {task.overdue ? <span className="task-vencido"><BanIcon />VENCIDO</span> : null}
        <span className="ot">{task.item.otCode}</span>
      </div>
      <div className="sta-task-body">
        <div className="meta"><span className="ic"><UserIcon /></span><span className="v">{task.item.customer}</span></div>
        <div className="meta"><span className="ic"><BoxIcon /></span><span className="v">{task.item.product} <span className="qty">· {task.item.qty.toLocaleString("es-AR")} u</span></span></div>
        <div className="meta step"><span className="ic"><CogIcon /></span><span className="v">{meta.tec}</span></div>
        {task.step.sub ? <div className="meta sub-detail"><span className="v">{task.step.sub}</span></div> : null}
      </div>
      <div className="sta-task-foot">
        <div className="ts"><ClockIcon /><span>{task.item.dueDate}</span><span className="sep">·</span><span className={task.overdue ? "warn" : ""}>{task.item.dueIn}</span></div>
        <div className="actions">
          <button type="button" className="sta-btn ghost" onClick={(event) => { event.stopPropagation(); onMoveToMesa(taskId(task)); }}>
            {inMesa ? <><ArrowLeftIcon />Devolver</> : <>Mover a mi mesa<ArrowRightIcon /></>}
          </button>
          <button type="button" className="sta-btn primary" onClick={(event) => { event.stopPropagation(); onOpen(task.itemCode); }}>Ver detalles</button>
        </div>
      </div>
      {dragHint ? <div className="sta-task-hint">Arrastrá esta tarea a Mesa de trabajo o Pendientes.</div> : null}
    </div>
  );
}

function StationDetail({ stationKey, onBack, onOpen }: { stationKey: string; onBack: () => void; onOpen: (code: string) => void }) {
  const station = STATIONS.find((entry) => entry.key === stationKey) ?? STATIONS[0];
  const IconCmp = getStepIcon(station.icon);
  const tasks = getActiveStepsAtStation(stationKey);
  const [mesa, setMesa] = React.useState(() => new Set<string>());
  const [filter, setFilter] = React.useState("todos");

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
          <span className="sta-detail-ico"><IconCmp /></span>
          <div className="body">
            <h2>{station.nm}</h2>
            <p>{station.desc}</p>
            <div className="actions">
              <button type="button" className="sta-btn ghost" onClick={onBack}><ArrowLeftIcon />Ver todas las estaciones</button>
              <button type="button" className="sta-btn ghost"><CheckIcon />Seleccionar todos</button>
            </div>
          </div>
          <div className="counter"><div className="num">{tasks.length}</div><div className="lbl">pasos activos</div></div>
        </div>
      </div>

      <div className="sta-detail-kpis">
        <div className="kpi"><div className="k">Total activos</div><div className="v">{tasks.length}</div></div>
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
            {mesaTasks.length === 0 ? <div className="sta-mesa-empty"><BoxIcon /><div className="ttl">Arrastrá tareas acá para trabajar en ellas</div><div className="sub">Las tareas pasan a tu mesa cuando las tomás de la fila compartida.</div></div> : null}
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

function ByStationView({ onOpen }: { onOpen: (code: string) => void }) {
  const [stationKey, setStationKey] = React.useState<string | null>(null);
  if (stationKey) return <StationDetail stationKey={stationKey} onBack={() => setStationKey(null)} onOpen={onOpen} />;
  return <StationGrid onSelect={setStationKey} />;
}

function getCurrentStep(item: TableroItem) {
  return item.steps.find((step) => step.status === "current" || step.status === "blocked");
}

function getKanbanBucket(item: TableroItem): KanbanBucketKey {
  if (!item.steps.some((step) => step.status === "done")) return "not-started";
  if (/Hoy/i.test(item.dueDate)) return "today";
  if (!item.onTrack) return "delayed";
  return "active";
}

function KanbanCard({ item, onOpen }: { item: TableroItem; onOpen: (code: string) => void }) {
  const step = getCurrentStep(item);
  const meta = step ? PROD_STEPS[step.key] : null;
  const IconCmp = meta ? getStepIcon(meta.ico) : LayoutDashboardIcon;

  return (
    <button type="button" className={`kan-card priority-${item.priority} ${item.blocked ? "blocked" : !item.onTrack ? "delayed" : ""}`} onClick={() => onOpen(item.code)}>
      <div className="kan-card-top">
        <span className="item-code">{item.code}</span>
        <span className="ot-badge">{item.otCode}</span>
        {item.priority !== "normal" ? <span className={`prio-pill prio-${item.priority}`}>{priorityLabel(item.priority)}</span> : null}
        <span className="kan-pct">{item.progressPct}%</span>
      </div>
      <div className="kan-title">{item.product}</div>
      <div className="kan-meta">{item.customer} · {item.spec}</div>
      <div className="kan-step">
        <span className="kan-step-ico">{item.blocked ? <BanIcon /> : <IconCmp />}</span>
        <div>
          <div className="tec">{meta?.tec ?? "Sin paso actual"}</div>
          <div className="sub">{step?.sub ?? item.statusLine}</div>
        </div>
      </div>
      <div className="kan-progress" aria-label={`Avance ${item.progressPct}%`}><span style={{ width: `${item.progressPct}%` }} /></div>
      <div className="kan-foot">
        <span className={`due ${!item.onTrack || /Hoy/i.test(item.dueDate) ? "warn" : ""}`}><ClockIcon />{item.dueDate} · {item.dueIn}</span>
        <span className="op"><span className="mini-av">{item.operator.iniciales}</span>{item.operator.nombre.split(" ")[0]}</span>
      </div>
    </button>
  );
}

function KanbanView({ items, onOpen }: { items: TableroItem[]; onOpen: (code: string) => void }) {
  const columns: Array<{ key: KanbanBucketKey; title: string; description: string }> = [
    { key: "not-started", title: "No iniciados", description: "Sin pasos completados" },
    { key: "today", title: "Vencen hoy", description: "Prioridad de despacho" },
    { key: "delayed", title: "Con retraso", description: "Fuera del plan" },
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
            {column.items.map((item) => <KanbanCard key={item.code} item={item} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function parseDurH(value?: string) {
  if (!value || value === "—") return 1;
  let total = 0;
  const days = value.match(/(\d+)\s*d/);
  const hours = value.match(/(\d+)\s*h/);
  const minutes = value.match(/(\d+)\s*min/);
  if (days) total += parseInt(days[1], 10) * 24;
  if (hours) total += parseInt(hours[1], 10);
  if (minutes) total += parseInt(minutes[1], 10) / 60;
  return total || 1;
}

function computeTimeline(item: TableroItem) {
  const segments: Array<{ key: TableroStep["key"]; status: TableroStep["status"]; startH: number; durH: number; ref: TableroStep; progress?: number }> = [];
  const currentIdx = item.steps.findIndex((step) => step.status === "current" || step.status === "blocked");
  const splitIdx = currentIdx === -1 ? item.steps.length : currentIdx;
  let cursor = 0;

  for (let i = splitIdx - 1; i >= 0; i -= 1) {
    const step = item.steps[i];
    const dur = parseDurH(step.dur);
    cursor -= dur;
    segments.unshift({ key: step.key, status: "done", startH: cursor, durH: dur, ref: step });
  }

  cursor = 0;
  if (currentIdx !== -1) {
    const step = item.steps[currentIdx];
    const dur = Math.max(parseDurH(step.dur), 1);
    const progress = step.progress ?? (step.status === "blocked" ? 0 : 0.3);
    const doneH = dur * progress;
    segments.push({ key: step.key, status: step.status, startH: -doneH, durH: dur, ref: step, progress });
    cursor = dur - doneH;
  }

  for (let i = splitIdx + 1; i < item.steps.length; i += 1) {
    const step = item.steps[i];
    const dur = parseDurH(step.dur);
    segments.push({ key: step.key, status: "pending", startH: cursor, durH: dur, ref: step });
    cursor += dur;
  }

  const endH = segments.length ? segments[segments.length - 1].startH + segments[segments.length - 1].durH : 0;
  return { segments, endH, dueH: parseDueInHours(item.dueIn) };
}

function TimelineAxis() {
  const ticks = [];
  for (let h = -TL_PAST_H; h <= TL_FUTURE_H; h += 6) ticks.push({ h, isDay: h % 24 === 0 });
  const dayLabels = [];
  for (let d = Math.floor(-TL_PAST_H / 24); d <= Math.ceil(TL_FUTURE_H / 24); d += 1) {
    const h = d * 24;
    if (h < -TL_PAST_H || h > TL_FUTURE_H) continue;
    const dayIdx = ((3 + d) % 7 + 7) % 7;
    dayLabels.push({ h, label: TL_DAY_NAMES[dayIdx], num: 27 + d, isToday: d === 0 });
  }

  return (
    <div className="tl-axis" style={{ width: TL_WIDTH }}>
      <div className="tl-axis-days">
        {dayLabels.map((day) => <div key={`${day.label}-${day.num}`} className={`tl-day ${day.isToday ? "today" : ""}`} style={{ left: TL_ORIGIN_PX + day.h * TL_HOUR_PX }}><span className="nm">{day.label}</span><span className="num">{day.num}</span></div>)}
      </div>
      <div className="tl-axis-ticks">
        {ticks.map((tick) => <div key={tick.h} className={`tl-tick ${tick.isDay ? "day" : ""}`} style={{ left: TL_ORIGIN_PX + tick.h * TL_HOUR_PX }}>{!tick.isDay ? <span className="hr">{((tick.h % 24) + 24) % 24}h</span> : null}</div>)}
      </div>
    </div>
  );
}

function TimelineRow({ item, onOpen }: { item: TableroItem; onOpen: (code: string) => void }) {
  const { segments, endH, dueH } = computeTimeline(item);
  const currentStep = item.steps.find((step) => step.status === "current" || step.status === "blocked");
  const isDelayed = !item.onTrack && !item.blocked;
  const overdue = dueH < endH;

  return (
    <button type="button" className={`tl-row ${item.blocked ? "blocked" : ""} ${isDelayed ? "delayed" : ""} priority-${item.priority}`} onClick={() => onOpen(item.code)}>
      <div className="tl-row-left">
        <div className="tl-row-codes"><span className="item-code">{item.code}</span>{item.priority !== "normal" ? <span className={`prio-pill prio-${item.priority}`}>{item.priority === "urgent" ? "Urg." : "Alta"}</span> : null}</div>
        <div className="tl-row-product">{item.product}</div>
        <div className="tl-row-meta"><span>{item.customer}</span><span className="sep">·</span><span className="mono">{item.qty.toLocaleString("es-AR")} u</span></div>
      </div>

      <div className="tl-row-bar" style={{ width: TL_WIDTH }}>
        {segments.map((seg, index) => {
          const meta = PROD_STEPS[seg.key];
          const IconCmp = getStepIcon(meta.ico);
          const left = TL_ORIGIN_PX + seg.startH * TL_HOUR_PX;
          const width = Math.max(2, seg.durH * TL_HOUR_PX);
          return (
            <div key={`${seg.key}-${index}`} className={`tl-seg ${seg.status}`} style={{ left, width }} title={`${meta.nm} · ${meta.tec}`}>
              {seg.status === "current" && seg.progress != null ? <span className="tl-seg-progress" style={{ width: `${Math.round(seg.progress * 100)}%` }} /> : null}
              {width >= 28 ? <span className="tl-seg-ico">{seg.status === "done" ? <CheckIcon /> : seg.status === "blocked" ? <BanIcon /> : <IconCmp />}</span> : null}
              {width >= 70 ? <span className="tl-seg-label">{meta.nm}</span> : null}
            </div>
          );
        })}
        <div className={`tl-due ${overdue ? "overdue" : ""}`} style={{ left: TL_ORIGIN_PX + dueH * TL_HOUR_PX }} title={`Entrega · ${item.dueDate}`}>
          <span className="pin" />
          <span className="lbl">{item.dueDate}</span>
        </div>
      </div>
      <span className="sr-only">{currentStep ? PROD_STEPS[currentStep.key].nm : "Sin paso actual"}</span>
    </button>
  );
}

function TimelineView({ onOpen }: { onOpen: (code: string) => void }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, TL_ORIGIN_PX - scrollRef.current.clientWidth * 0.25);
  }, []);

  return (
    <div className="tl-wrap">
      <div className="tl-legend">
        <div className="tl-legend-items">
          <span className="lg"><span className="sw done" /> Pasos completados</span>
          <span className="lg"><span className="sw current" /> En curso</span>
          <span className="lg"><span className="sw pending" /> Pendientes</span>
          <span className="lg"><span className="sw blocked" /> Bloqueado</span>
          <span className="lg"><span className="sw due" /> Entrega comprometida</span>
        </div>
        <div className="tl-legend-now"><span className="tl-now-mark" /> Ahora</div>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-axis-wrap"><div className="tl-axis-left">Items en producción</div><TimelineAxis /></div>
        <div className="tl-body">
          <div className="tl-rows">{PROD_ITEMS.map((item) => <TimelineRow key={item.code} item={item} onOpen={onOpen} />)}</div>
          <div className="tl-now-line" style={{ left: 280 + TL_ORIGIN_PX }}><div className="tl-now-pill"><span className="dot" />AHORA</div></div>
        </div>
      </div>
    </div>
  );
}

export function TableroProduccion() {
  const [mode, setMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [defaultMode, setDefaultMode] = React.useState<Mode>(DEFAULT_BOARD_MODE);
  const [tabMenu, setTabMenu] = React.useState<{ mode: Mode; x: number; y: number } | null>(null);
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);
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

  const tabEntries: Array<{ mode: Mode; label: string; count?: number }> = [
    { mode: "items", label: BOARD_MODE_LABELS.items, count: PROD_ITEMS.length },
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
    return PROD_ITEMS.filter((item) => {
      if (filters.status === "in-progress" && (item.blocked || !item.onTrack)) return false;
      if (filters.status === "blocked" && !item.blocked) return false;
      if (filters.status === "delayed" && (item.onTrack || item.blocked)) return false;
      if (filters.status === "due-today" && !/Hoy/i.test(item.dueDate)) return false;
      if (filters.priority !== "all" && item.priority !== filters.priority) return false;
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const haystack = `${item.code} ${item.otCode} ${item.customer} ${item.product} ${item.spec}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filters]);

  const counts = {
    all: PROD_ITEMS.length,
    shown: filtered.length,
    inProgress: PROD_ITEMS.filter((item) => item.onTrack && !item.blocked).length,
    blocked: PROD_ITEMS.filter((item) => item.blocked).length,
    delayed: PROD_ITEMS.filter((item) => !item.onTrack && !item.blocked).length,
    today: PROD_ITEMS.filter((item) => /Hoy/i.test(item.dueDate)).length,
  };
  const selectedItem = selectedCode ? PROD_ITEMS.find((item) => item.code === selectedCode) : undefined;

  return (
    <div className="tablero-produccion">
      <div className="tab-page">
        <div className="page-head">
          <div className="title-block">
            <h1>Tablero de producción <span className="live-pill"><span className="dot" />En vivo</span></h1>
            <div className="sub">Items en producción agrupados por su recorrido individual. Click en un item para ver el detalle de la ruta y acciones rápidas.</div>
          </div>
          <button type="button" className="btn">Exportar</button>
          <button type="button" className="btn">Ajustes de tablero</button>
        </div>

        <div className="d-kpi-row">
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Items en producción</span></div><div className="d-kpi-val"><span className="num">{PROD_ITEMS.length}</span></div><div className="d-kpi-foot"><span className="d-delta tone-ok">↑ 2</span><span className="d-kpi-sub">vs ayer</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">En curso · OK</span></div><div className="d-kpi-val"><span className="num ok">{counts.inProgress}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">avanzando sin retraso</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Con retraso</span></div><div className="d-kpi-val"><span className="num signal">{counts.delayed}</span></div><div className="d-kpi-foot"><span className="d-delta tone-signal">vencimiento próximo</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Bloqueados</span></div><div className="d-kpi-val"><span className="num">{counts.blocked}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">requieren intervención</span></div></div>
          <div className="d-kpi"><div className="d-kpi-head"><span className="d-kpi-lbl">Vencen hoy</span></div><div className="d-kpi-val"><span className="num">{counts.today}</span></div><div className="d-kpi-foot"><span className="d-kpi-sub">prioridad de despacho</span></div></div>
        </div>

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

        {mode === "items" ? (
          <>
            <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
            <div className="tab-board">
              {filtered.map((item) => <ItemRow key={item.code} item={item} onOpen={setSelectedCode} />)}
              {filtered.length === 0 ? <div className="empty-results">No hay items que coincidan con los filtros.</div> : null}
            </div>
          </>
        ) : null}
        {mode === "estacion" ? <ByStationView onOpen={setSelectedCode} /> : null}
        {mode === "kanban" ? (
          <>
            <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
            <KanbanView items={filtered} onOpen={setSelectedCode} />
          </>
        ) : null}
      </div>

      <ItemDetailSheet item={selectedItem} onClose={() => setSelectedCode(null)} />
    </div>
  );
}
