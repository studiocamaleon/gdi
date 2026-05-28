// Tablero de producción — main board view.

/* ─────────── Route progress strip ─────────── */
function RouteStrip({ steps, compact = false }) {
  return (
    <div className={`route-strip ${compact ? "compact" : ""}`}>
      {steps.map((s, i) => {
        const meta = PROD_STEPS[s.key];
        if (!meta) return null;
        const IconCmp = TIco[meta.ico] || TIco.Layout;
        const cls = `route-step ${s.status}` + (s.status === "done" || (i > 0 && steps[i-1].status === "done") ? " link-done" : "");
        return (
          <div key={i} className={cls} title={`${meta.nm} · ${meta.tec}`}>
            <span className="ri-dot">
              {s.status === "done" && <TIco.Check />}
              {s.status === "current" && <IconCmp />}
              {s.status === "pending" && <IconCmp />}
              {s.status === "blocked" && <TIco.Block />}
            </span>
            <span className="ri-label">{meta.nm}</span>
            {s.status === "current" && s.progress != null && !compact && (
              <span className="ri-progress">
                <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Item row ─────────── */
function ItemRow({ item, onOpen }) {
  const priorityLabel = { urgent: "Urgente", high: "Alta", normal: "Normal" }[item.priority] || "Normal";
  const cssRow = `tab-row priority-${item.priority}` + (item.blocked ? " blocked" : "") + (!item.onTrack && !item.blocked ? " delayed" : "");

  return (
    <div className={cssRow} onClick={() => onOpen(item.code)}>
      {/* LEFT — identifier + product */}
      <div className="tab-row-left">
        <div className="tab-row-codes">
          <span className="item-code">{item.code}</span>
          <span className="ot-badge" title="Orden de trabajo origen">{item.otCode}</span>
          {item.priority !== "normal" && (
            <span className={`prio-pill prio-${item.priority}`}>{priorityLabel}</span>
          )}
        </div>
        <div className="tab-row-product">{item.product}</div>
        <div className="tab-row-spec">
          <span className="cust">{item.customer}</span>
          <span className="sep">·</span>
          <span className="spec">{item.spec}</span>
        </div>
      </div>

      {/* CENTER — route strip + status line */}
      <div className="tab-row-route">
        <RouteStrip steps={item.steps} />
        <div className={`tab-status-line ${item.blocked ? "blocked" : item.onTrack ? "" : "delayed"}`}>
          {item.blocked && <span className="dot dot-block" />}
          {!item.blocked && <span className={`dot ${item.onTrack ? "dot-ok" : "dot-warn"}`} />}
          <span>{item.statusLine}</span>
        </div>
      </div>

      {/* RIGHT — due + assigned */}
      <div className="tab-row-right">
        <div className={`tab-due ${(!item.onTrack && !item.blocked) ? "delayed" : ""}`}>
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
        <Ico.Chev />
      </div>
    </div>
  );
}

/* ─────────── Filters bar ─────────── */
function FiltersBar({ filters, setFilters, counts }) {
  const { status, priority, query } = filters;
  return (
    <div className="tab-filters">
      <div className="search">
        <Ico.Search />
        <input
          placeholder="Buscar por item, OT, cliente, producto…"
          value={query}
          onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
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
        ].map(s => (
          <button
            key={s.k}
            className={status === s.k ? "on" : ""}
            onClick={() => setFilters(f => ({ ...f, status: s.k }))}
          >
            {s.l}
            <span className="ct">{s.c}</span>
          </button>
        ))}
      </div>

      <div className="seg-prio">
        <span className="lbl">Prioridad</span>
        {["all", "urgent", "high", "normal"].map(p => (
          <button
            key={p}
            className={priority === p ? "on" : ""}
            onClick={() => setFilters(f => ({ ...f, priority: p }))}
          >
            {p === "all" ? "Todas" : p === "urgent" ? "Urgente" : p === "high" ? "Alta" : "Normal"}
          </button>
        ))}
      </div>

      <div className="tab-filter-summary">
        <strong>{counts.shown}</strong> de <strong>{counts.all}</strong> items
      </div>
    </div>
  );
}

/* ─────────── Item detail sheet ─────────── */
function ItemDetailSheet({ item, onClose }) {
  const [tab, setTab] = React.useState("ruta");
  if (!item) return null;

  const totalSteps = item.steps.length;
  const doneSteps = item.steps.filter(s => s.status === "done").length;
  const currentStep = item.steps.find(s => s.status === "current");
  const currentMeta = currentStep && PROD_STEPS[currentStep.key];

  const activity = PROD_ACTIVITY[item.code] || [
    { t: "Sin actividad reciente", who: "—", what: "—", kind: "" },
  ];

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" style={{ width: "min(720px, 80vw)" }}>
        <div className="sheet-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 0, padding: "20px 24px 0" }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="item-code" style={{ fontSize: 12 }}>{item.code}</span>
                <span className="ot-badge">{item.otCode}</span>
                {item.priority !== "normal" && (
                  <span className={`prio-pill prio-${item.priority}`}>
                    {item.priority === "urgent" ? "Urgente" : "Alta prioridad"}
                  </span>
                )}
                {item.blocked && <span className="prio-pill prio-blocked"><TIco.Block />Bloqueado</span>}
              </div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}>{item.product}</h2>
              <div className="sub" style={{ marginTop: 4 }}>{item.customer} · {item.spec}</div>
            </div>
            <span className="close" onClick={onClose} style={{ cursor: "pointer" }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </span>
          </div>

          {/* Status banner */}
          <div className={`item-status-banner ${item.blocked ? "blocked" : item.onTrack ? "ok" : "delayed"}`}>
            <span className="dot" />
            <div className="body">
              <div className="ttl">{item.statusLine}</div>
              {item.blocked && item.blockedReason && (
                <div className="sub">{item.blockedReason}</div>
              )}
              {!item.blocked && currentMeta && (
                <div className="sub">
                  Paso actual · <strong>{currentMeta.tec}</strong>
                  {currentStep.machine && currentStep.machine !== "—" && (
                    <> · en <strong>{currentStep.machine}</strong></>
                  )}
                </div>
              )}
            </div>
            <div className="due">
              <div className="lbl">Entrega</div>
              <div className="val">{item.dueDate}</div>
              <div className="sub">{item.dueIn} restantes</div>
            </div>
          </div>

          {/* Quick meta strip */}
          <div className="item-meta-strip">
            <div className="m">
              <div className="k">Avance</div>
              <div className="v">{item.progressPct}%<span className="sub" style={{ marginLeft: 4 }}>· {doneSteps}/{totalSteps} pasos</span></div>
            </div>
            <div className="m">
              <div className="k">Cantidad</div>
              <div className="v">{item.qty.toLocaleString("es-AR")} u</div>
            </div>
            <div className="m">
              <div className="k">Vendedor</div>
              <div className="v"><span className="mini-av">{item.vendedor}</span></div>
            </div>
            <div className="m">
              <div className="k">Operario</div>
              <div className="v">{item.operator.nombre}</div>
            </div>
            <div className="m">
              <div className="k">Máquina</div>
              <div className="v" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{item.machine}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="sheet-tabs">
            {[
              { k: "ruta",       l: "Ruta de producción", n: totalSteps },
              { k: "materiales", l: "Materiales",          n: 4 },
              { k: "actividad",  l: "Actividad",           n: activity.length },
              { k: "archivos",   l: "Archivos",            n: 3 },
            ].map(t => (
              <button key={t.k} className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>
                {t.l}
                <span className="ct">{t.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-body" style={{ padding: "20px 24px" }}>
          {tab === "ruta" && <DetailRuta item={item} />}
          {tab === "materiales" && <DetailMateriales item={item} />}
          {tab === "actividad" && <DetailActividad activity={activity} />}
          {tab === "archivos" && <DetailArchivos />}
        </div>

        <div className="sheet-foot">
          <button className="btn">
            <TIco.Pause /> Pausar item
          </button>
          {item.blocked && (
            <button className="btn">Desbloquear</button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary">
            Marcar paso completado
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Ruta tab ─── */
function DetailRuta({ item }) {
  return (
    <div className="detail-route">
      {item.steps.map((s, i) => {
        const meta = PROD_STEPS[s.key];
        if (!meta) return null;
        const IconCmp = TIco[meta.ico] || TIco.Layout;
        return (
          <div key={i} className={`detail-step ${s.status}`}>
            <div className="ds-line">
              <span className="ds-dot">
                {s.status === "done" && <TIco.Check />}
                {s.status === "current" && <IconCmp />}
                {s.status === "pending" && <span className="ix">{i + 1}</span>}
                {s.status === "blocked" && <TIco.Block />}
              </span>
            </div>
            <div className="ds-body">
              <div className="ds-head">
                <div>
                  <div className="ds-tec">{meta.tec}</div>
                  <div className="ds-nm">{meta.nm}</div>
                </div>
                {s.status === "done" && s.end && (
                  <span className="ds-time done">
                    <TIco.Check />
                    {s.end} · {s.dur}
                  </span>
                )}
                {s.status === "current" && (
                  <span className="ds-time current">
                    <span className="dot" />En curso · {s.progress != null ? `${Math.round(s.progress*100)}%` : "—"}
                  </span>
                )}
                {s.status === "pending" && s.dur && (
                  <span className="ds-time">estimado {s.dur}</span>
                )}
                {s.status === "blocked" && (
                  <span className="ds-time blocked"><TIco.Block />Bloqueado</span>
                )}
              </div>
              {s.status === "current" && (
                <div className="ds-current-detail">
                  <div className="ds-cd-row">
                    <span className="k">Máquina</span>
                    <span className="v">{s.machine || "—"}</span>
                  </div>
                  <div className="ds-cd-row">
                    <span className="k">Operario</span>
                    <span className="v">{s.op || "—"}</span>
                  </div>
                  {s.sub && (
                    <div className="ds-cd-row">
                      <span className="k">Avance</span>
                      <span className="v">{s.sub}</span>
                    </div>
                  )}
                  {s.progress != null && (
                    <div className="ds-cd-bar">
                      <span style={{ width: `${Math.round(s.progress * 100)}%` }} />
                    </div>
                  )}
                </div>
              )}
              {s.status === "blocked" && s.sub && (
                <div className="ds-blocked-detail">{s.sub}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Materiales tab ─── */
function DetailMateriales({ item }) {
  const mats = [
    { code: "PAP-OPL-300", nm: "Opalina 300gr 70×100", qty: "4 rs · estimado", consumed: "3,2 rs", left: "0,8 rs" },
    { code: "TIN-OFF-K",   nm: "Tinta offset negra",   qty: "1,2 kg · estimado", consumed: "0,9 kg", left: "0,3 kg" },
    { code: "TIN-OFF-CMY", nm: "Tintas CMY (set)",     qty: "0,8 kg · estimado", consumed: "0,6 kg", left: "0,2 kg" },
    { code: "LAM-MAT-UV",  nm: "Laminado mate UV",     qty: "5,2 m² · estimado", consumed: "—",      left: "5,2 m²" },
  ];
  return (
    <table className="detail-tbl">
      <thead>
        <tr><th>Material</th><th className="right">Estimado</th><th className="right">Consumido</th><th className="right">Restante</th></tr>
      </thead>
      <tbody>
        {mats.map(m => (
          <tr key={m.code}>
            <td>
              <div className="nm">{m.nm}</div>
              <div className="code">{m.code}</div>
            </td>
            <td className="right mono">{m.qty}</td>
            <td className="right mono">{m.consumed}</td>
            <td className="right mono">{m.left}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Actividad tab ─── */
function DetailActividad({ activity }) {
  const ICONS = { progress: "📊", step: "✓", comment: "💬", block: "⚠" };
  return (
    <div className="detail-activity">
      {activity.map((a, i) => (
        <div key={i} className={`act-row ${a.kind}`}>
          <span className="t">{a.t}</span>
          <div className="body">
            <div className="what">{a.what}</div>
            <div className="who">por {a.who}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Archivos tab ─── */
function DetailArchivos() {
  const files = [
    { nm: "Arte_final_v3.pdf",  size: "12,4 MB", kind: "PDF", when: "hace 2h" },
    { nm: "Prueba_color_lab.jpg", size: "1,8 MB", kind: "JPG", when: "Ayer" },
    { nm: "OT-2487.pdf",        size: "240 KB",  kind: "PDF", when: "Lun 12 may" },
  ];
  return (
    <div className="detail-files">
      {files.map((f, i) => (
        <div key={i} className="file-row">
          <span className="kind">{f.kind}</span>
          <div className="body">
            <div className="nm">{f.nm}</div>
            <div className="meta">{f.size} · {f.when}</div>
          </div>
          <button className="btn">Descargar</button>
        </div>
      ))}
    </div>
  );
}

/* ─── Empty state for not-yet-built modes ─── */
function PlaceholderView({ title, sub }) {
  return (
    <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{title}</div>
      <div>{sub}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main component                                                 */
/* ═══════════════════════════════════════════════════════════════ */

function TableroProduccion() {
  const [mode, setMode] = React.useState("items");
  const [selectedCode, setSelectedCode] = React.useState(null);
  const [filters, setFilters] = React.useState({ status: "all", priority: "all", query: "" });

  const filtered = PROD_ITEMS.filter(it => {
    if (filters.status === "in-progress" && (it.blocked || !it.onTrack)) return false;
    if (filters.status === "blocked" && !it.blocked) return false;
    if (filters.status === "delayed" && (it.onTrack || it.blocked)) return false;
    if (filters.status === "due-today" && !/Hoy/i.test(it.dueDate)) return false;
    if (filters.priority !== "all" && it.priority !== filters.priority) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = (it.code + " " + it.otCode + " " + it.customer + " " + it.product + " " + it.spec).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: PROD_ITEMS.length,
    shown: filtered.length,
    inProgress: PROD_ITEMS.filter(i => i.onTrack && !i.blocked).length,
    blocked: PROD_ITEMS.filter(i => i.blocked).length,
    delayed: PROD_ITEMS.filter(i => !i.onTrack && !i.blocked).length,
    today: PROD_ITEMS.filter(i => /Hoy/i.test(i.dueDate)).length,
  };

  const selectedItem = selectedCode ? PROD_ITEMS.find(i => i.code === selectedCode) : null;

  return (
    <div className="tab-page">
      <div className="page-head">
        <div className="title-block">
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            Tablero de producción
            <span className="live-pill"><span className="dot" />En vivo</span>
          </h1>
          <div className="sub">Items en producción agrupados por su recorrido individual. Click en un item para ver el detalle de la ruta y acciones rápidas.</div>
        </div>
        <button className="btn">Exportar</button>
        <button className="btn">Ajustes de tablero</button>
      </div>

      {/* KPI strip */}
      <div className="d-kpi-row cols-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="d-kpi">
          <div className="d-kpi-head"><span className="d-kpi-lbl">Items en producción</span></div>
          <div className="d-kpi-val"><span className="num">{PROD_ITEMS.length}</span></div>
          <div className="d-kpi-foot"><span className="d-delta tone-ok">↑ 2</span><span className="d-kpi-sub">vs ayer</span></div>
        </div>
        <div className="d-kpi">
          <div className="d-kpi-head"><span className="d-kpi-lbl">En curso · OK</span></div>
          <div className="d-kpi-val"><span className="num" style={{ color: "var(--ok)" }}>{counts.inProgress}</span></div>
          <div className="d-kpi-foot"><span className="d-kpi-sub">avanzando sin retraso</span></div>
        </div>
        <div className="d-kpi">
          <div className="d-kpi-head"><span className="d-kpi-lbl">Con retraso</span></div>
          <div className="d-kpi-val"><span className="num" style={{ color: "var(--signal)" }}>{counts.delayed}</span></div>
          <div className="d-kpi-foot"><span className="d-delta tone-signal">vencimiento próximo</span></div>
        </div>
        <div className="d-kpi">
          <div className="d-kpi-head"><span className="d-kpi-lbl">Bloqueados</span></div>
          <div className="d-kpi-val"><span className="num">{counts.blocked}</span></div>
          <div className="d-kpi-foot"><span className="d-kpi-sub">requieren intervención</span></div>
        </div>
        <div className="d-kpi">
          <div className="d-kpi-head"><span className="d-kpi-lbl">Vencen hoy</span></div>
          <div className="d-kpi-val"><span className="num">{counts.today}</span></div>
          <div className="d-kpi-foot"><span className="d-kpi-sub">prioridad de despacho</span></div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="dash-tabs" style={{ marginBottom: 16 }}>
        <button className={`dash-tab ${mode === "items" ? "on" : ""}`} onClick={() => setMode("items")}>
          <span>Por items</span>
          <span className="count">{PROD_ITEMS.length}</span>
        </button>
        <button className={`dash-tab ${mode === "estacion" ? "on" : ""}`} onClick={() => setMode("estacion")}>
          <span>Por estación</span>
        </button>
        <button className={`dash-tab ${mode === "linea" ? "on" : ""}`} onClick={() => setMode("linea")}>
          <span>Línea de tiempo</span>
        </button>
      </div>

      {mode === "items" && (
        <>
          <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />

          <div className="tab-board">
            {filtered.map(item => (
              <ItemRow key={item.code} item={item} onOpen={setSelectedCode} />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
                No hay items que coincidan con los filtros.
              </div>
            )}
          </div>
        </>
      )}

      {mode === "estacion" && <ByStationView onOpen={setSelectedCode} />}
      {mode === "linea" && <TimelineView onOpen={setSelectedCode} />}

      {selectedItem && <ItemDetailSheet item={selectedItem} onClose={() => setSelectedCode(null)} />}
    </div>
  );
}

Object.assign(window, { TableroProduccion, RouteStrip, ItemRow, FiltersBar, ItemDetailSheet });
