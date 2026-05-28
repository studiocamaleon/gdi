// Tablero de producción — vista "Línea de tiempo" (Gantt por item).
// Cada item es una fila con sus pasos como segmentos en un eje temporal.

const TL_HOUR_PX = 9;            // 9 px por hora — 1 día = 216 px
const TL_PAST_H = 72;            // horas a mostrar a la izquierda del "ahora"
const TL_FUTURE_H = 192;         // horas a mostrar a la derecha del "ahora"
const TL_TOTAL_H = TL_PAST_H + TL_FUTURE_H;
const TL_WIDTH = TL_TOTAL_H * TL_HOUR_PX;
const TL_ORIGIN_PX = TL_PAST_H * TL_HOUR_PX;

const TL_DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function parseDurH(s) {
  if (!s || s === "—") return 1;
  let total = 0;
  const d = s.match(/(\d+)\s*d/);
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*min/);
  if (d) total += parseInt(d[1]) * 24;
  if (h) total += parseInt(h[1]);
  if (m) total += parseInt(m[1]) / 60;
  return total || 1;
}

function computeTimeline(item) {
  // Returns { segments: [{key, status, startH, durH}], startH, endH, dueH }
  const segments = [];
  const currentIdx = item.steps.findIndex(s => s.status === "current" || s.status === "blocked");
  const splitIdx = currentIdx === -1 ? item.steps.length : currentIdx;

  // Past (done) steps — walk backwards from current
  let cursor = 0;
  if (splitIdx > 0) {
    let backCursor = 0;
    for (let i = splitIdx - 1; i >= 0; i--) {
      const s = item.steps[i];
      const dur = parseDurH(s.dur);
      backCursor -= dur;
      segments.unshift({ key: s.key, status: "done", startH: backCursor, durH: dur, ref: s });
    }
  }

  // Current step
  if (currentIdx !== -1) {
    const s = item.steps[currentIdx];
    const dur = Math.max(parseDurH(s.dur), 1);
    const progress = s.progress != null ? s.progress : (s.status === "blocked" ? 0 : 0.3);
    const doneH = dur * progress;
    segments.push({ key: s.key, status: s.status, startH: -doneH, durH: dur, ref: s, progress });
    cursor = dur - doneH;
  }

  // Pending steps — walk forward
  for (let i = splitIdx + 1; i < item.steps.length; i++) {
    const s = item.steps[i];
    const dur = parseDurH(s.dur);
    segments.push({ key: s.key, status: "pending", startH: cursor, durH: dur, ref: s });
    cursor += dur;
  }

  const startH = segments.length ? segments[0].startH : 0;
  const endH   = segments.length ? segments[segments.length - 1].startH + segments[segments.length - 1].durH : 0;

  // Due offset: parse "dueIn" like "2d 4h", "5h", "Hoy 17h"
  let dueH = endH + 1;
  if (item.dueIn) {
    const di = item.dueIn.toLowerCase();
    if (di.includes("hoy") || di.includes("h") && !di.includes("d")) {
      const m = di.match(/(\d+)/);
      if (m) dueH = parseInt(m[1]);
    } else {
      const d = di.match(/(\d+)\s*d/);
      const h = di.match(/(\d+)\s*h/);
      let total = 0;
      if (d) total += parseInt(d[1]) * 24;
      if (h) total += parseInt(h[1]);
      if (total > 0) dueH = total;
    }
  }

  return { segments, startH, endH, dueH };
}

/* ─────────── Time axis header ─────────── */
function TimelineAxis() {
  // Render day labels every 24h + hour ticks every 6h
  // "Ahora" is at hour 0. Days to the left are negative.
  const ticks = [];
  for (let h = -TL_PAST_H; h <= TL_FUTURE_H; h += 6) {
    const isDay = h % 24 === 0;
    ticks.push({ h, isDay });
  }
  // Day labels: assume "now" is Wed (Mié) — change as needed
  const NOW_DAY = 3;
  const dayLabels = [];
  for (let d = Math.floor(-TL_PAST_H / 24); d <= Math.ceil(TL_FUTURE_H / 24); d++) {
    const h = d * 24;
    if (h < -TL_PAST_H || h > TL_FUTURE_H) continue;
    const dayIdx = ((NOW_DAY + d) % 7 + 7) % 7;
    const dayNum = 27 + d; // synth
    dayLabels.push({ h, label: TL_DAY_NAMES[dayIdx], num: dayNum, isToday: d === 0 });
  }

  return (
    <div className="tl-axis" style={{ width: TL_WIDTH }}>
      <div className="tl-axis-days">
        {dayLabels.map((d, i) => (
          <div
            key={i}
            className={`tl-day ${d.isToday ? "today" : ""}`}
            style={{ left: TL_ORIGIN_PX + d.h * TL_HOUR_PX }}
          >
            <span className="nm">{d.label}</span>
            <span className="num">{d.num}</span>
          </div>
        ))}
      </div>
      <div className="tl-axis-ticks">
        {ticks.map((t, i) => (
          <div
            key={i}
            className={`tl-tick ${t.isDay ? "day" : ""}`}
            style={{ left: TL_ORIGIN_PX + t.h * TL_HOUR_PX }}
          >
            {!t.isDay && <span className="hr">{((t.h % 24) + 24) % 24}h</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Item row (gantt bar) ─────────── */
function TimelineRow({ item, onOpen }) {
  const { segments, startH, endH, dueH } = computeTimeline(item);
  const isBlocked = item.blocked;
  const isDelayed = !item.onTrack && !isBlocked;
  const overdue = dueH < endH;

  const cs = item.steps.find(s => s.status === "current" || s.status === "blocked");
  const csMeta = cs && PROD_STEPS[cs.key];

  return (
    <div
      className={`tl-row ${isBlocked ? "blocked" : ""} ${isDelayed ? "delayed" : ""} priority-${item.priority}`}
      onClick={() => onOpen(item.code)}
    >
      <div className="tl-row-left">
        <div className="tl-row-codes">
          <span className="item-code">{item.code}</span>
          {item.priority === "urgent" && <span className="prio-pill prio-urgent">Urg.</span>}
          {item.priority === "high" && <span className="prio-pill prio-high">Alta</span>}
        </div>
        <div className="tl-row-product">{item.product}</div>
        <div className="tl-row-meta">
          <span>{item.customer}</span>
          <span className="sep">·</span>
          <span className="mono">{item.qty.toLocaleString("es-AR")} u</span>
        </div>
      </div>

      <div className="tl-row-bar" style={{ width: TL_WIDTH }}>
        {/* segments */}
        {segments.map((seg, i) => {
          const meta = PROD_STEPS[seg.key];
          if (!meta) return null;
          const left = TL_ORIGIN_PX + seg.startH * TL_HOUR_PX;
          const width = Math.max(2, seg.durH * TL_HOUR_PX);
          const IconCmp = TIco[meta.ico] || TIco.Layout;
          const showIcon = width >= 28;
          const showLabel = width >= 70;
          return (
            <div
              key={i}
              className={`tl-seg ${seg.status}`}
              style={{ left, width }}
              title={`${meta.nm} · ${meta.tec}`}
            >
              {seg.status === "current" && seg.progress != null && (
                <span
                  className="tl-seg-progress"
                  style={{ width: `${Math.round(seg.progress * 100)}%` }}
                />
              )}
              {showIcon && (
                <span className="tl-seg-ico">
                  {seg.status === "done" ? <TIco.Check /> :
                   seg.status === "blocked" ? <TIco.Block /> :
                   <IconCmp />}
                </span>
              )}
              {showLabel && (
                <span className="tl-seg-label">{meta.nm}</span>
              )}
            </div>
          );
        })}

        {/* Due-date marker */}
        <div
          className={`tl-due ${overdue ? "overdue" : ""}`}
          style={{ left: TL_ORIGIN_PX + dueH * TL_HOUR_PX }}
          title={`Entrega · ${item.dueDate}`}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
            <path d="M2 0 L10 0 L10 8 L6 12 L2 8 Z" fill={overdue ? "var(--signal)" : "var(--ink)"} />
          </svg>
          <span className="lbl">{item.dueDate}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Main timeline view ─────────── */
function TimelineView({ onOpen }) {
  const scrollRef = React.useRef(null);

  // Scroll so "now" line is around 25% from the left
  React.useEffect(() => {
    if (scrollRef.current) {
      const target = TL_ORIGIN_PX - scrollRef.current.clientWidth * 0.25;
      scrollRef.current.scrollLeft = Math.max(0, target);
    }
  }, []);

  return (
    <div className="tl-wrap">
      <div className="tl-legend">
        <div className="tl-legend-items">
          <span className="lg"><span className="sw done" /> Pasos completados</span>
          <span className="lg"><span className="sw current" /> En curso</span>
          <span className="lg"><span className="sw pending" /> Pendientes</span>
          <span className="lg"><span className="sw blocked" /> Bloqueado</span>
          <span className="lg"><svg width="10" height="12" viewBox="0 0 12 14"><path d="M2 0 L10 0 L10 8 L6 12 L2 8 Z" fill="var(--ink)" /></svg> Entrega comprometida</span>
        </div>
        <div className="tl-legend-now">
          <span className="tl-now-mark" /> Ahora
        </div>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        {/* Axis header — sticky top inside scroll */}
        <div className="tl-axis-wrap">
          <div className="tl-axis-left">Items en producción</div>
          <TimelineAxis />
        </div>

        {/* Rows + now line */}
        <div className="tl-body">
          <div className="tl-rows">
            {PROD_ITEMS.map(item => (
              <TimelineRow key={item.code} item={item} onOpen={onOpen} />
            ))}
          </div>

          {/* "Now" vertical line — spans full body height, positioned within tl-rows-bars area */}
          <div className="tl-now-line" style={{ left: 280 + TL_ORIGIN_PX }}>
            <div className="tl-now-pill">
              <span className="dot" />
              AHORA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TimelineView, TimelineRow, TimelineAxis, computeTimeline, parseDurH });
