// Tablero de producción — vista "Por estación" rediseñada.
// Patrón de dos niveles:
//   (1) Grid de estaciones con resumen por cada una
//   (2) Drill-down a una estación: KPIs + "Mi mesa de trabajo" + "Pendientes compartidas"

/* ─────────── Catálogo de estaciones granular ─────────── */
const STATIONS = [
  { key: "diseno",     nm: "Diseño y verificación",        desc: "Diseño gráfico y pre-flight de archivos",   icon: "Layout" },
  { key: "ctp",        nm: "CTP y planchas",               desc: "Imposición y montaje de plancha CTP",       icon: "Layers" },
  { key: "offset",     nm: "Impresión Offset",             desc: "Heidelberg GTO y SM 52",                    icon: "Printer" },
  { key: "digital",    nm: "Impresión Digital",            desc: "Impresión digital pliego",                  icon: "Printer" },
  { key: "latex",      nm: "Plotter Latex - Gran formato", desc: "HP Latex 365 - vinilo, lona y rígidos",     icon: "Plot" },
  { key: "vinilo_cut", nm: "Plotter de corte vinilo",      desc: "Corte de vinilo autoadhesivo",              icon: "Cut" },
  { key: "cnc",        nm: "Router CNC",                   desc: "Corte de placas y materiales rígidos",      icon: "Cnc" },
  { key: "laser",      nm: "Láser CO₂",                    desc: "Corte y grabado láser",                     icon: "Beam" },
  { key: "guillotina", nm: "Guillotina y plegado",         desc: "Refilado, corte final y plegado en línea",  icon: "Scissors" },
  { key: "laminado",   nm: "Laminado y troquel",           desc: "Laminado UV y troquelado mecánico",         icon: "Brush" },
  { key: "armado",     nm: "Armado y encuadernación",      desc: "Armado, cableado y encuadernación",         icon: "Tool" },
  { key: "qa-empaque", nm: "QA + Empaque",                 desc: "Control de calidad y embalaje final",      icon: "Shield" },
  { key: "despacho",   nm: "Despacho",                     desc: "Retiro, flete e instalación en obra",      icon: "Truck" },
];

const STEP_TO_STATION = {
  diseno: "diseno", verif: "diseno",
  ctp: "ctp",
  impresion_of: "offset",
  impresion_dg: "digital",
  ploteo: "latex",
  vinilo_corte: "vinilo_cut",
  cnc: "cnc",
  laser: "laser",
  laminado: "laminado",
  guillotina: "guillotina",
  plegado: "guillotina",
  troquel: "laminado",
  secado: "armado",
  encuad: "armado",
  armado: "armado",
  qa: "qa-empaque",
  empaque: "qa-empaque",
  despacho: "despacho",
  instalacion: "despacho",
};

/* Tiny inline glyphs for task card metadata */
const TaskGlyph = {
  User: () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 16 0v1"/></svg>,
  Box:  () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10l9 5 9-5V7l-9-5Z"/><path d="m3 7 9 4 9-4"/></svg>,
  Cog:  () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>,
  Clock:() => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  Grip: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>,
  Warn: () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 1 21h22Z"/><path d="M12 10v5M12 18h0"/></svg>,
  Calendar:() => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>,
  Arrow:() => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  ArrowL:() => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  ChevDn:() => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
};

/* ─────────── Helpers ─────────── */
function getActiveStepsAtStation(stationKey) {
  // Returns [{ itemCode, item, step, stepIdx, meta, status }]
  const out = [];
  PROD_ITEMS.forEach(item => {
    item.steps.forEach((step, idx) => {
      if (STEP_TO_STATION[step.key] !== stationKey) return;
      if (step.status === "done") return;
      out.push({
        itemCode: item.code,
        item,
        step,
        stepIdx: idx,
        meta: PROD_STEPS[step.key],
        status: step.status,
        isCurrent: step.status === "current",
        isBlocked: step.status === "blocked",
        isPending: step.status === "pending",
        overdue: !item.onTrack && step.status !== "blocked",
        urgent: item.priority === "urgent" || (!item.onTrack && step.status !== "blocked") || step.status === "blocked",
      });
    });
  });
  // Order: blocked / overdue first, then current, then by item priority
  return out.sort((a, b) => {
    const aw = (a.isBlocked ? 0 : 1) + (a.overdue ? 0 : 2) + (a.isCurrent ? 1 : 4);
    const bw = (b.isBlocked ? 0 : 1) + (b.overdue ? 0 : 2) + (b.isCurrent ? 1 : 4);
    return aw - bw;
  });
}

function taskId(t) { return `${t.itemCode}:${t.stepIdx}`; }

/* ═══════════════════════════════════════════════════════════════ */
/*  LEVEL 1 · Grid of stations — workload-aware, grouped, alerts   */
/* ═══════════════════════════════════════════════════════════════ */

const STATION_CATEGORIES = [
  { key: "preprensa",  nm: "Pre-prensa",        stations: ["diseno", "ctp"] },
  { key: "impresion",  nm: "Impresión",         stations: ["offset", "digital", "latex"] },
  { key: "corte",      nm: "Corte y router",    stations: ["vinilo_cut", "cnc", "laser"] },
  { key: "acabado",    nm: "Acabado",           stations: ["guillotina", "laminado", "armado"] },
  { key: "post",       nm: "QA y despacho",     stations: ["qa-empaque", "despacho"] },
];

function parseDueInHours(s) {
  if (!s) return 999;
  const l = s.toLowerCase();
  if (l.includes("hoy")) {
    const m = l.match(/(\d+)/);
    return m ? parseInt(m[1]) : 12;
  }
  let total = 0;
  const d = l.match(/(\d+)\s*d/);
  const h = l.match(/(\d+)\s*h/);
  if (d) total += parseInt(d[1]) * 24;
  if (h) total += parseInt(h[1]);
  return total || 999;
}
function fmtHoursUntil(h) {
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function computeStationStats(stationKey) {
  const tasks = getActiveStepsAtStation(stationKey);
  const total = tasks.length;
  const blocked = tasks.filter(t => t.isBlocked).length;
  const urgent = tasks.filter(t => t.urgent && !t.isBlocked).length;
  const pending = total - blocked - urgent;

  let minHours = Infinity;
  let oldestBlocked = null;
  tasks.forEach(t => {
    const h = parseDueInHours(t.item.dueIn);
    if (h < minHours) minHours = h;
    if (t.isBlocked && !oldestBlocked) oldestBlocked = t;
  });
  return {
    tasks, total, pending, urgent, blocked,
    minHours: isFinite(minHours) ? minHours : null,
    oldestBlocked,
  };
}

function LoadBar({ pending, urgent, blocked, max }) {
  if (max === 0 || pending + urgent + blocked === 0) {
    return <div className="load-bar"><div className="track" /></div>;
  }
  const w = (n) => (n / max) * 100;
  return (
    <div className="load-bar">
      <div className="track">
        {pending > 0 && <span className="seg pending" style={{ width: w(pending) + "%" }} />}
        {urgent > 0 && <span className="seg urgent" style={{ width: w(urgent) + "%" }} />}
        {blocked > 0 && <span className="seg blocked" style={{ width: w(blocked) + "%" }} />}
      </div>
    </div>
  );
}

function StationCard({ station, stats, maxLoad, onSelect }) {
  const IconCmp = TIco[station.icon] || TIco.Layout;
  const { total, pending, urgent, blocked, minHours, oldestBlocked } = stats;
  const tone = blocked > 0 ? "block" : urgent > 0 ? "urgent" : "ok";
  const loadPct = maxLoad > 0 ? Math.round((total / maxLoad) * 100) : 0;

  return (
    <div className={`sta-card tone-${tone}`} onClick={() => onSelect(station.key)}>
      <div className="sta-card-head">
        <span className="sta-card-ico"><IconCmp /></span>
        <div className="sta-card-titles">
          <div className="nm">{station.nm}</div>
          <div className="desc">{station.desc}</div>
        </div>
      </div>

      <div className="sta-card-load">
        <div className="lh">
          <span className="num">{total}</span>
          <span className="lbl">pasos activos</span>
          <span className="pct">{loadPct}% carga</span>
        </div>
        <LoadBar pending={pending} urgent={urgent} blocked={blocked} max={maxLoad} />
        <div className="sta-card-segs">
          {pending > 0 && <span className="seg-lbl"><span className="dot pending" />{pending} pendientes</span>}
          {urgent > 0 && <span className="seg-lbl"><span className="dot urgent" />{urgent} urgente{urgent > 1 ? "s" : ""}</span>}
          {blocked > 0 && <span className="seg-lbl"><span className="dot blocked" />{blocked} bloqueado{blocked > 1 ? "s" : ""}</span>}
        </div>
      </div>

      <div className="sta-card-signals">
        {oldestBlocked && (
          <div className="sig sig-block">
            <TaskGlyph.Warn />
            <span><strong>{oldestBlocked.step.sub || "Sin detalle"}</strong></span>
          </div>
        )}
        {minHours != null && (
          <div className={`sig ${minHours < 24 ? "sig-warn" : ""}`}>
            <TaskGlyph.Clock />
            <span>Próxima entrega · <strong>{fmtHoursUntil(minHours)}</strong></span>
          </div>
        )}
      </div>

      <div className="sta-card-foot">
        <span>Ver detalles</span>
        <TaskGlyph.Arrow />
      </div>
    </div>
  );
}

function IdleStationChip({ station, onSelect }) {
  const IconCmp = TIco[station.icon] || TIco.Layout;
  return (
    <div className="sta-idle-chip" onClick={() => onSelect(station.key)}>
      <span className="ic"><IconCmp /></span>
      <span className="nm">{station.nm}</span>
      <span className="arr"><TaskGlyph.Arrow /></span>
    </div>
  );
}

function AlertStrip({ alerts, onSelect }) {
  if (alerts.length === 0) return null;
  return (
    <div className="sta-alerts">
      <div className="sta-alerts-head">
        <span className="ic"><TaskGlyph.Warn /></span>
        <span className="ttl">Requiere atención</span>
        <span className="ct">{alerts.length === 1 ? "estación" : "estaciones"}</span>
      </div>
      <div className="sta-alerts-list">
        {alerts.map(({ station, stats }) => (
          <div key={station.key} className="sta-alert" onClick={() => onSelect(station.key)}>
            <div className="alert-body">
              <div className="nm">{station.nm}</div>
              <div className="reason">
                {stats.blocked > 0 && <span className="b"><strong>{stats.blocked}</strong> bloqueado{stats.blocked > 1 ? "s" : ""}</span>}
                {stats.blocked > 0 && stats.urgent > 0 && <span className="sep">·</span>}
                {stats.urgent > 0 && <span className="u"><strong>{stats.urgent}</strong> urgente{stats.urgent > 1 ? "s" : ""}</span>}
                {stats.oldestBlocked?.step?.sub && (
                  <>
                    <span className="sep">·</span>
                    <span className="quote">"{stats.oldestBlocked.step.sub}"</span>
                  </>
                )}
              </div>
            </div>
            <span className="alert-cta">Ir a estación <TaskGlyph.Arrow /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StationGrid({ onSelect }) {
  const allStats = STATIONS.map(s => ({ station: s, stats: computeStationStats(s.key) }));
  const totalActive = allStats.reduce((acc, s) => acc + s.stats.total, 0);
  const maxLoad = Math.max(1, ...allStats.map(s => s.stats.total));
  const blockedTotal = allStats.reduce((acc, s) => acc + s.stats.blocked, 0);
  const urgentTotal = allStats.reduce((acc, s) => acc + s.stats.urgent, 0);

  const alerts = allStats.filter(({ stats }) => stats.blocked > 0 || stats.urgent >= 2);
  const active = allStats.filter(({ stats }) => stats.total > 0);
  const idle = allStats.filter(({ stats }) => stats.total === 0);

  const byCategory = STATION_CATEGORIES.map(cat => ({
    ...cat,
    items: active
      .filter(({ station }) => cat.stations.includes(station.key))
      .sort((a, b) => {
        if (a.stats.blocked !== b.stats.blocked) return b.stats.blocked - a.stats.blocked;
        if (a.stats.urgent !== b.stats.urgent) return b.stats.urgent - a.stats.urgent;
        return b.stats.total - a.stats.total;
      }),
  })).filter(c => c.items.length > 0);

  return (
    <div className="sta-grid-wrap">
      <div className="sta-toolbar">
        <div className="sta-select">
          <span className="lbl">Todas las estaciones</span>
          <TaskGlyph.ChevDn />
        </div>
        <div className="sta-toolbar-stats">
          <span className="stat"><strong>{totalActive}</strong>pasos activos</span>
          <span className="sep">·</span>
          <span className="stat"><strong>{active.length}</strong>de {STATIONS.length} estaciones activas</span>
          {blockedTotal > 0 && (
            <>
              <span className="sep">·</span>
              <span className="stat warn"><strong>{blockedTotal}</strong>bloqueado{blockedTotal > 1 ? "s" : ""}</span>
            </>
          )}
          {urgentTotal > 0 && (
            <>
              <span className="sep">·</span>
              <span className="stat amber"><strong>{urgentTotal}</strong>urgente{urgentTotal > 1 ? "s" : ""}</span>
            </>
          )}
        </div>
        <button className="sta-toolbar-cta">
          <TaskGlyph.Calendar />
          <span>Entrega: Próximas</span>
        </button>
      </div>

      <AlertStrip alerts={[]} onSelect={onSelect} />

      {/* Alert strip removed per request — keeping component for future use */}

      {byCategory.map(cat => {
        const catTotal = cat.items.reduce((a, s) => a + s.stats.total, 0);
        return (
          <div key={cat.key} className="sta-cat">
            <div className="sta-cat-head">
              <h3>{cat.nm}</h3>
              <span className="rule" />
              <span className="ct">
                <strong>{catTotal}</strong> pasos · {cat.items.length} {cat.items.length === 1 ? "estación" : "estaciones"}
              </span>
            </div>
            <div className="sta-grid">
              {cat.items.map(({ station, stats }) => (
                <StationCard
                  key={station.key}
                  station={station}
                  stats={stats}
                  maxLoad={maxLoad}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}

      {idle.length > 0 && (
        <div className="sta-idle">
          <div className="sta-idle-head">
            <span className="dot" />
            <span>Sin actividad ahora</span>
            <span className="ct">{idle.length} {idle.length === 1 ? "estación" : "estaciones"}</span>
          </div>
          <div className="sta-idle-chips">
            {idle.map(({ station }) => (
              <IdleStationChip key={station.key} station={station} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LEVEL 2 · Station detail                                       */
/* ═══════════════════════════════════════════════════════════════ */

function TaskCard({ task, inMesa, onMoveToMesa, onOpen, dragHint }) {
  const tid = taskId(task);
  const statusLabel =
    task.isBlocked ? "BLOQUEADO" :
    task.isCurrent ? "EN CURSO" :
    "PENDIENTE";
  const statusCls =
    task.isBlocked ? "blocked" :
    task.isCurrent ? "current" :
    "pending";

  return (
    <div className={`sta-task status-${statusCls} ${task.overdue ? "overdue" : ""} ${task.urgent ? "urgent" : ""} ${inMesa ? "in-mesa" : ""}`}>
      <div className="sta-task-row1">
        <span className="grip" title="Arrastrar a tu mesa"><TaskGlyph.Grip /></span>
        <span className="cbx" role="checkbox" aria-checked="false" />
        <span className="code">{task.itemCode}</span>
        <span className={`task-status ${statusCls}`}>{statusLabel}</span>
        {task.overdue && (
          <span className="task-vencido">
            <TaskGlyph.Warn />
            VENCIDO
          </span>
        )}
        <span className="ot">{task.item.otCode}</span>
      </div>

      <div className="sta-task-body">
        <div className="meta">
          <span className="ic"><TaskGlyph.User /></span>
          <span className="v">{task.item.customer}</span>
        </div>
        <div className="meta">
          <span className="ic"><TaskGlyph.Box /></span>
          <span className="v">{task.item.product} <span className="qty">· {task.item.qty.toLocaleString("es-AR")} u</span></span>
        </div>
        <div className="meta step">
          <span className="ic"><TaskGlyph.Cog /></span>
          <span className="v">{task.meta?.tec || task.step.key}</span>
        </div>
        {task.step.sub && (
          <div className="meta sub-detail">
            <span className="v">{task.step.sub}</span>
          </div>
        )}
      </div>

      <div className="sta-task-foot">
        <div className="ts">
          <TaskGlyph.Clock />
          <span>{task.item.dueDate}</span>
          <span className="sep">·</span>
          <span className={task.overdue ? "warn" : ""}>{task.item.dueIn}</span>
        </div>
        <div className="actions">
          {inMesa ? (
            <button className="sta-btn ghost" onClick={(e) => { e.stopPropagation(); onMoveToMesa(tid); }}>
              <TaskGlyph.ArrowL /> Devolver
            </button>
          ) : (
            <button className="sta-btn ghost" onClick={(e) => { e.stopPropagation(); onMoveToMesa(tid); }}>
              Mover a mi mesa <TaskGlyph.Arrow />
            </button>
          )}
          <button className="sta-btn primary" onClick={(e) => { e.stopPropagation(); onOpen(task.itemCode); }}>
            Ver detalles
          </button>
        </div>
      </div>

      {dragHint && <div className="sta-task-hint">Arrastrá esta tarea a Mesa de trabajo o Pendientes.</div>}
    </div>
  );
}

function StationDetail({ stationKey, onBack, onOpen }) {
  const station = STATIONS.find(s => s.key === stationKey);
  const IconCmp = TIco[station.icon] || TIco.Layout;
  const tasks = getActiveStepsAtStation(stationKey);

  const [mesa, setMesa] = React.useState(new Set());
  const [filter, setFilter] = React.useState("todos");

  const toggleMesa = (id) => {
    setMesa(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = tasks.length;
  const pendientes = tasks.filter(t => t.isPending).length;
  const urgentes = tasks.filter(t => t.urgent).length;
  const mesaCount = mesa.size;

  const mesaTasks = tasks.filter(t => mesa.has(taskId(t)));
  const sharedTasks = tasks.filter(t => !mesa.has(taskId(t)));

  let visibleShared = sharedTasks;
  let visibleMesa = mesaTasks;
  if (filter === "pendientes") {
    visibleShared = sharedTasks.filter(t => t.isPending);
  } else if (filter === "mesa") {
    visibleShared = [];
  } else if (filter === "urgentes") {
    visibleShared = sharedTasks.filter(t => t.urgent);
    visibleMesa = mesaTasks.filter(t => t.urgent);
  }

  const showing = (filter === "mesa" ? mesaTasks.length : visibleShared.length + visibleMesa.length);

  return (
    <div className="sta-detail">
      <div className="sta-detail-head">
        <div className="sta-detail-head-top">
          <span className="sta-detail-ico"><IconCmp /></span>
          <div className="body">
            <h2>{station.nm}</h2>
            <p>{station.desc}</p>
            <div className="actions">
              <button className="sta-btn ghost" onClick={onBack}>
                <TaskGlyph.ArrowL />
                Ver todas las estaciones
              </button>
              <button className="sta-btn ghost">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                Seleccionar todos
              </button>
            </div>
          </div>
          <div className="counter">
            <div className="num">{total}</div>
            <div className="lbl">pasos activos</div>
          </div>
        </div>
      </div>

      <div className="sta-detail-kpis">
        <div className="kpi">
          <div className="k">Total activos</div>
          <div className="v">{total}</div>
        </div>
        <div className={`kpi ${mesaCount > 0 ? "ok" : "warn"}`}>
          <div className="k">Mi mesa de trabajo</div>
          <div className="v">{mesaCount}</div>
        </div>
        <div className="kpi cool">
          <div className="k">Pendientes</div>
          <div className="v">{pendientes}</div>
        </div>
        <div className={`kpi ${urgentes > 0 ? "warm" : ""}`}>
          <div className="k">Urgentes</div>
          <div className="v">{urgentes}</div>
        </div>
        <div className="kpi">
          <div className="k">Mostrando</div>
          <div className="v">{showing}</div>
        </div>
      </div>

      <div className="sta-detail-filters">
        <span className="lbl">Filtros:</span>
        {[
          { k: "todos", l: "Todos" },
          { k: "pendientes", l: "Pendientes" },
          { k: "mesa", l: "Mi mesa" },
          { k: "urgentes", l: "Solo urgentes" },
        ].map(f => (
          <button
            key={f.k}
            className={`chip ${filter === f.k ? "on" : ""}`}
            onClick={() => setFilter(f.k)}
          >{f.l}</button>
        ))}
      </div>

      <div className="sta-detail-board">
        {/* ─── Mesa de trabajo ─── */}
        <div className="sta-col mesa-col">
          <div className="sta-col-head">
            <span className="dot mesa" />
            <span className="ttl">Mi mesa de trabajo</span>
            <span className="ct"><strong>{mesaTasks.length}</strong> pasos</span>
          </div>
          <div className={`sta-col-body ${mesaTasks.length === 0 ? "empty-mesa" : ""}`}>
            {mesaTasks.length === 0 && (
              <div className="sta-mesa-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted-2)", marginBottom: 10 }}>
                  <rect x="3" y="6" width="18" height="14" rx="2" strokeDasharray="3 3"/>
                  <path d="M3 11h18"/>
                </svg>
                <div className="ttl">Arrastrá tareas acá para trabajar en ellas</div>
                <div className="sub">Las tareas pasan a tu mesa cuando las tomás de la fila compartida.</div>
              </div>
            )}
            {visibleMesa.map((t, i) => (
              <TaskCard
                key={taskId(t)}
                task={t}
                inMesa={true}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
                dragHint={i === 0 && filter !== "mesa"}
              />
            ))}
          </div>
        </div>

        {/* ─── Pendientes compartidas ─── */}
        <div className="sta-col shared-col">
          <div className="sta-col-head">
            <span className="dot shared" />
            <span className="ttl">Pendientes compartidas</span>
            <span className="ct"><strong>{visibleShared.length}</strong> pasos</span>
          </div>
          <div className="sta-col-body">
            {visibleShared.length === 0 && (
              <div className="sta-shared-empty">
                {filter === "mesa" ? "Solo se muestran las tareas de tu mesa." : "No quedan tareas pendientes que coincidan con el filtro."}
              </div>
            )}
            {visibleShared.map(t => (
              <TaskCard
                key={taskId(t)}
                task={t}
                inMesa={false}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Entry — manages grid/detail state                              */
/* ═══════════════════════════════════════════════════════════════ */

function ByStationView({ onOpen }) {
  const [stationKey, setStationKey] = React.useState(null);

  if (stationKey) {
    return (
      <StationDetail
        stationKey={stationKey}
        onBack={() => setStationKey(null)}
        onOpen={onOpen}
      />
    );
  }
  return <StationGrid onSelect={setStationKey} />;
}

Object.assign(window, { ByStationView, StationGrid, StationDetail, StationCard, TaskCard, STATIONS, STEP_TO_STATION });
