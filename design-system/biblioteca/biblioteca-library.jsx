// Biblioteca · Library browse view — marketplace-style grid of canonical materials.

/* ─────────── Icons ─────────── */
const BIco = {
  Library: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 4v17M21 4v17"/><path d="M3 9h18M3 16h18"/><path d="M7 4v17M14 4v17"/></svg>,
  Search:  (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>,
  Chev:    (p) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6"/></svg>,
  ChevDn:  (p) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  ChevLeft:(p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m15 18-6-6 6-6"/></svg>,
  ChevRight:(p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6"/></svg>,
  X:       (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:   (p) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l4 4 10-10"/></svg>,
  CheckCircle: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>,
  CheckCircleFill: (p) => <svg width="42" height="42" viewBox="0 0 48 48" fill="none" {...p}><circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.16"/><circle cx="24" cy="24" r="14" fill="currentColor"/><path d="m18 24 4 4 8-8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Plus:    (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Edit:    (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  Arrow:   (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  Info:    (p) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h0M11 12h1v5h1"/></svg>,
  Warn:    (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 1 21h22Z"/><path d="M12 10v5M12 18h0"/></svg>,
  Sparkles:(p) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M6.3 17.7l2-2M15.7 8.3l2-2"/></svg>,
  Cube:    (p) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 21 7.5v9L12 21 3 16.5v-9Z"/><path d="M3 7.5 12 12l9-4.5"/><path d="M12 12v9"/></svg>,
};

/* ─────────── Material visual icons (one per iconKind) ─────────── */
function MaterialIcon({ kind, size = 28 }) {
  // Subtle monochrome glyphs that hint at material structure.
  const s = size;
  const inks = {
    bg: "#fafaf9",
    line: "#92929b",
    fill: "#14141a",
    light: "#d4d2cd",
  };
  switch (kind) {
    case "foam": // PVC espumado — solid white plate with subtle inner cells
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="#fff" stroke={inks.fill} strokeWidth="1.2"/>
          <circle cx="9"  cy="13" r="1.3" fill={inks.light}/>
          <circle cx="14" cy="17" r="1.0" fill={inks.light}/>
          <circle cx="20" cy="12" r="1.4" fill={inks.light}/>
          <circle cx="24" cy="20" r="1.1" fill={inks.light}/>
          <circle cx="10" cy="22" r="0.9" fill={inks.light}/>
        </svg>
      );
    case "wood": // MDF — horizontal grain
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="#e6dfd0" stroke={inks.fill} strokeWidth="1.2"/>
          <path d="M5 10 Q12 9 19 11 T29 11" stroke="#a88f6c" strokeWidth=".7" fill="none" opacity=".55"/>
          <path d="M3 15 Q14 14 22 16 T29 16" stroke="#a88f6c" strokeWidth=".7" fill="none" opacity=".5"/>
          <path d="M5 21 Q12 20 18 22 T29 22" stroke="#a88f6c" strokeWidth=".7" fill="none" opacity=".55"/>
        </svg>
      );
    case "layered": // ACM, plywood — sandwich layers
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="8"  width="26" height="3"  rx="0.5" fill={inks.fill}/>
          <rect x="3" y="12" width="26" height="8"  rx="0.5" fill="#cfd0d0"/>
          <rect x="3" y="21" width="26" height="3"  rx="0.5" fill={inks.fill}/>
        </svg>
      );
    case "transparent": // Acrílico — outline w/ shine
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="rgba(20,20,26,0.04)" stroke={inks.fill} strokeWidth="1.2"/>
          <path d="M8 6 L8 26" stroke="#fff" strokeWidth="1.2" opacity=".9"/>
          <path d="M11 6 L11 26" stroke={inks.line} strokeWidth=".4" opacity=".5"/>
        </svg>
      );
    case "corrugated": // PP corrugado — vertical lines
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="#fff" stroke={inks.fill} strokeWidth="1.2"/>
          {[8,11,14,17,20,23,26].map((x,i) => (
            <line key={i} x1={x} y1="8" x2={x} y2="24" stroke={inks.line} strokeWidth=".55" opacity=".5"/>
          ))}
        </svg>
      );
    case "sandwich": // Foamboard — two thin lines + foam in middle
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="9"  width="26" height="1.5" rx="0.3" fill={inks.fill}/>
          <rect x="3" y="11" width="26" height="10" rx="0.3" fill="#fff" stroke={inks.line} strokeWidth=".4"/>
          <circle cx="9"  cy="16" r="0.9" fill={inks.light}/>
          <circle cx="15" cy="14" r="0.7" fill={inks.light}/>
          <circle cx="22" cy="17" r="0.9" fill={inks.light}/>
          <rect x="3" y="21.5" width="26" height="1.5" rx="0.3" fill={inks.fill}/>
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="2" fill="#fff" stroke={inks.fill} strokeWidth="1.2"/>
        </svg>
      );
  }
}

/* ─────────── Material card ─────────── */
function MaterialCard({ item, onConfigure }) {
  const state = item.installState || { status: "not-installed" };
  const uses = item.usosRecomendados.slice(0, 4).map(u => USES[u]).filter(Boolean);
  const moreUses = item.usosRecomendados.length - uses.length;
  const aliases = item.aliasDisponibles.slice(1, 4); // skip first (== canonical name)

  return (
    <div
      className={`bm-card ${state.visibleName ? "has-banner" : ""}`}
      onClick={() => onConfigure(item.canonicalKey)}
    >
      {state.visibleName && (
        <div className="bm-visible-banner">
          <span className="ic"><BIco.Check /></span>
          <span>Instalado como</span>
          <span className="nm">{state.visibleName}</span>
        </div>
      )}

      <div className="bm-card-head">
        <div className="bm-card-icon">
          <MaterialIcon kind={item.iconKind} size={32} />
        </div>
        <div className="bm-card-meta">
          <div className="bm-card-canonical">
            <span className="nm" title={item.nombreCanonico}>{item.nombreCanonico}</span>
          </div>
          <div className="bm-card-fam">{FAMILIES[item.subfamilia]?.nm || item.subfamilia}</div>
        </div>
        <span className={`bm-status ${state.status}`}>
          <span className="d" />
          {statusLabel(state)}
        </span>
      </div>

      <div className="bm-card-desc">{item.descripcionCorta}</div>

      {aliases.length > 0 && (
        <div className="bm-card-aliases">
          <span className="lbl">Alias</span>
          {aliases.map((a, i) => (
            <React.Fragment key={a}>
              <span className="alias">{a}</span>
              {i < aliases.length - 1 && <span className="sep">·</span>}
            </React.Fragment>
          ))}
          {item.aliasDisponibles.length > 4 && (
            <span className="sep">+{item.aliasDisponibles.length - 4}</span>
          )}
        </div>
      )}

      <div className="bm-card-uses">
        {uses.map(u => (
          <span key={u.code} className="bm-use">{u.code}</span>
        ))}
        {moreUses > 0 && <span className="bm-use more">+{moreUses}</span>}
      </div>

      <div className="bm-card-foot">
        <span className="bm-card-counts">
          {state.status === "partial" ? (
            <>
              <strong>{state.installedCount}</strong> de <strong>{item.variantes.length}</strong> variantes
            </>
          ) : (
            <><strong>{item.variantes.length}</strong> variantes sugeridas</>
          )}
        </span>
        <span className="bm-card-cta">
          {state.status === "not-installed" && <>Configurar instalación <span className="arr"><BIco.Arrow /></span></>}
          {state.status === "partial" && <>Completar instalación <span className="arr"><BIco.Arrow /></span></>}
          {state.status === "installed" && <>Ver instalación <span className="arr"><BIco.Arrow /></span></>}
        </span>
      </div>
    </div>
  );
}

/* ─────────── Library browse ─────────── */
function Library({ onConfigure }) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [useFilter, setUseFilter] = React.useState(null);

  const items = CATALOG.filter(it => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = (it.nombreCanonico + " " + it.aliasDisponibles.join(" ") + " " + it.descripcionCorta).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== "all") {
      const st = it.installState?.status || "not-installed";
      if (statusFilter === "installed" && st === "not-installed") return false;
      if (statusFilter === "not-installed" && st !== "not-installed") return false;
    }
    if (useFilter && !it.usosRecomendados.includes(useFilter)) return false;
    return true;
  });

  const counts = {
    all: CATALOG.length,
    installed: CATALOG.filter(c => c.installState?.status !== "not-installed").length,
    "not-installed": CATALOG.filter(c => (c.installState?.status || "not-installed") === "not-installed").length,
  };

  return (
    <>
      <div className="bm-page">
        <div className="bm-head">
          <div className="title-block">
            <div className="eyebrow">
              <span className="ic"><BIco.Library /></span>
              Inventario · Materias primas
            </div>
            <h1>Biblioteca de materias primas</h1>
            <div className="sub">Instalá materiales comunes con variantes ya preparadas. El sistema mantiene la relación canónica para reportes y compatibilidad cross-tenant.</div>
          </div>
          <div className="actions">
            <button className="bm-btn ghost">Ver instaladas <span className="ct" style={{ marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: 11, padding: "0 5px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 3 }}>{counts.installed}</span></button>
            <button className="bm-btn">Sugerir material</button>
            <button className="bm-btn primary">Crear personalizado</button>
          </div>
        </div>

        <div className="bm-toolbar">
          <div className="bm-search">
            <span className="ic"><BIco.Search /></span>
            <input
              placeholder="Buscar por nombre, alias o descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="kbd">/</span>
          </div>
          <div className="bm-filter">
            <span className="lbl">Familia</span>
            <span className="v">Sustrato rígido</span>
            <BIco.ChevDn />
          </div>
          <div className="bm-filter">
            <span className="lbl">Uso</span>
            <span className="v">{useFilter ? USES[useFilter]?.nm : "Todos"}</span>
            <BIco.ChevDn />
          </div>
          <div className="bm-seg">
            <button className={statusFilter === "all" ? "on" : ""} onClick={() => setStatusFilter("all")}>Todos<span className="ct">{counts.all}</span></button>
            <button className={statusFilter === "not-installed" ? "on" : ""} onClick={() => setStatusFilter("not-installed")}>No instalados<span className="ct">{counts["not-installed"]}</span></button>
            <button className={statusFilter === "installed" ? "on" : ""} onClick={() => setStatusFilter("installed")}>Instalados<span className="ct">{counts.installed}</span></button>
          </div>
          <div className="bm-toolbar-summary">
            Mostrando <strong>{items.length}</strong> de <strong>{CATALOG.length}</strong>
          </div>
        </div>

        <div className="bm-grid">
          {items.map(it => (
            <MaterialCard key={it.canonicalKey} item={it} onConfigure={onConfigure} />
          ))}
        </div>

        {items.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>
            No se encontraron materiales con esos filtros.
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { Library, MaterialCard, MaterialIcon, BIco });
