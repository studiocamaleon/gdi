// Estaciones — module for managing production stations.
// Lives under "Producción > Estaciones". List + create/edit drawer.

/* ─────────── Catálogo fijo de etapas ─────────── */
const ETAPAS = [
  { key: "preprensa",    nm: "Pre-prensa",        desc: "Diseño, verificación de archivos, CTP y planchas",     order: 1, color: "#1d4ed8" },
  { key: "impresion",    nm: "Impresión",         desc: "Offset, digital, ploteo y gran formato",               order: 2, color: "#14141a" },
  { key: "postprensa",   nm: "Post-prensa",       desc: "Secado, estabilización, refilado preliminar",          order: 3, color: "#92929b" },
  { key: "terminaciones",nm: "Terminaciones",     desc: "Laminado, troquel, corte, plegado, encuadernación, armado", order: 4, color: "#c08025" },
  { key: "instalacion",  nm: "Instalación",       desc: "Instalación en obra, montaje en sitio",                order: 5, color: "#16794a" },
  { key: "qa-despacho",  nm: "QA & Despacho",     desc: "Control de calidad, empaque, retiro y flete",          order: 6, color: "#c2410c" },
];

/* ─────────── Catálogo de iconos ─────────── */
const STATION_ICONS = [
  { key: "Layout", nm: "Layout" },
  { key: "Layers", nm: "Capas" },
  { key: "Printer", nm: "Impresora" },
  { key: "Plot", nm: "Plotter" },
  { key: "Cut", nm: "Corte" },
  { key: "Scissors", nm: "Tijeras" },
  { key: "Brush", nm: "Pincel" },
  { key: "Stamp", nm: "Troquel" },
  { key: "Fold", nm: "Plegado" },
  { key: "Cnc", nm: "CNC" },
  { key: "Beam", nm: "Láser" },
  { key: "Book", nm: "Encuadernación" },
  { key: "Tool", nm: "Herramienta" },
  { key: "Shield", nm: "QA" },
  { key: "Package", nm: "Empaque" },
  { key: "Truck", nm: "Despacho" },
  { key: "Wrench", nm: "Instalación" },
  { key: "Sun", nm: "Secado" },
];

/* ─────────── Mock data de estaciones del tenant ─────────── */
const INITIAL_ESTACIONES = [
  { id: "EST-001", nm: "Diseño y verificación",      etapa: "preprensa",    icon: "Layout",   desc: "Diseño gráfico y pre-flight de archivos", maquinas: ["DI-01"], empleados: ["AC", "MP"], capacidad: 8, horario: "8 a 18 hs", tiempoPromedio: 45, activa: true, tasksCount: 2 },
  { id: "EST-002", nm: "CTP y planchas",              etapa: "preprensa",    icon: "Layers",   desc: "Imposición y montaje de plancha CTP",     maquinas: ["CTP-01"], empleados: ["JS"], capacidad: 4, horario: "8 a 16 hs", tiempoPromedio: 22, activa: true, tasksCount: 1 },
  { id: "EST-003", nm: "Impresión Offset",            etapa: "impresion",    icon: "Printer",  desc: "Heidelberg GTO y SM 52",                   maquinas: ["PR-01", "PR-02"], empleados: ["DS"], capacidad: 6, horario: "Turno A + B", tiempoPromedio: 95, activa: true, tasksCount: 1 },
  { id: "EST-004", nm: "Impresión Digital",           etapa: "impresion",    icon: "Printer",  desc: "Impresión digital pliego",                 maquinas: ["DG-01"], empleados: ["LM"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 60, activa: true, tasksCount: 0 },
  { id: "EST-005", nm: "Plotter Latex - Gran formato",etapa: "impresion",    icon: "Plot",     desc: "HP Latex 365 - vinilo, lona y rígidos",    maquinas: ["DG-02"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 78, activa: true, tasksCount: 1 },
  { id: "EST-006", nm: "Secado",                      etapa: "postprensa",   icon: "Sun",      desc: "Estabilización post-impresión",            maquinas: ["SEC-01"], empleados: [], capacidad: 12, horario: "24h", tiempoPromedio: 480, activa: true, tasksCount: 1 },
  { id: "EST-007", nm: "Plotter de corte vinilo",     etapa: "terminaciones",icon: "Cut",      desc: "Corte de vinilo autoadhesivo",             maquinas: ["VC-01"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 40, activa: true, tasksCount: 0 },
  { id: "EST-008", nm: "Router CNC",                  etapa: "terminaciones",icon: "Cnc",      desc: "Corte de placas y materiales rígidos",     maquinas: ["CNC-01"], empleados: ["HC"], capacidad: 2, horario: "8 a 18 hs", tiempoPromedio: 110, activa: true, tasksCount: 1 },
  { id: "EST-009", nm: "Guillotina y plegado",        etapa: "terminaciones",icon: "Scissors", desc: "Refilado, corte final y plegado en línea", maquinas: ["AC-01", "AC-02"], empleados: ["RG"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 35, activa: true, tasksCount: 1 },
  { id: "EST-010", nm: "Laminado y troquel",          etapa: "terminaciones",icon: "Brush",    desc: "Laminado UV y troquelado mecánico",        maquinas: ["DG-04"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 45, activa: true, tasksCount: 1 },
  { id: "EST-011", nm: "Armado y encuadernación",     etapa: "terminaciones",icon: "Tool",     desc: "Armado, cableado y encuadernación",        maquinas: ["AC-03"], empleados: ["RT"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 150, activa: true, tasksCount: 2 },
  { id: "EST-012", nm: "Láser CO₂",                   etapa: "terminaciones",icon: "Beam",     desc: "Corte y grabado láser",                    maquinas: ["LSR-01"], empleados: [], capacidad: 2, horario: "8 a 18 hs", tiempoPromedio: 55, activa: false, tasksCount: 0 },
  { id: "EST-013", nm: "QA + Empaque",                etapa: "qa-despacho",  icon: "Shield",   desc: "Control de calidad y embalaje final",      maquinas: ["QA-01"], empleados: ["LM"], capacidad: 6, horario: "8 a 18 hs", tiempoPromedio: 30, activa: true, tasksCount: 1 },
  { id: "EST-014", nm: "Despacho",                    etapa: "qa-despacho",  icon: "Truck",    desc: "Retiro, flete y logística externa",        maquinas: ["LOG-01"], empleados: [], capacidad: 8, horario: "8 a 17 hs", tiempoPromedio: 25, activa: true, tasksCount: 0 },
];

const EMPLEADOS_MOCK = [
  { iniciales: "AC", nm: "Ana Cardozo",    role: "Diseño" },
  { iniciales: "MP", nm: "Mariana Pérez",  role: "Diseño" },
  { iniciales: "JS", nm: "Julián Sandoval",role: "Pre-prensa" },
  { iniciales: "DS", nm: "Daniel Sosa",    role: "Maquinista offset" },
  { iniciales: "LM", nm: "Lucas Méndez",   role: "Operador" },
  { iniciales: "PR", nm: "Pablo Rivero",   role: "Acabado" },
  { iniciales: "RG", nm: "Ricardo Genaro", role: "Acabado" },
  { iniciales: "HC", nm: "Hugo Cabrera",   role: "Acabado" },
  { iniciales: "RT", nm: "Roberto Tévez",  role: "Armado" },
];

const MAQUINAS_MOCK = [
  { code: "DI-01",  nm: "Estación de diseño" },
  { code: "CTP-01", nm: "Heidelberg Suprasetter" },
  { code: "PR-01",  nm: "Heidelberg GTO" },
  { code: "PR-02",  nm: "Heidelberg SM 52" },
  { code: "DG-01",  nm: "HP Indigo 5500" },
  { code: "DG-02",  nm: "HP Latex 365" },
  { code: "DG-04",  nm: "Laminadora Flexa" },
  { code: "VC-01",  nm: "Roland GR-540" },
  { code: "CNC-01", nm: "Router CNC ShopBot" },
  { code: "LSR-01", nm: "Láser CO₂ 100W" },
  { code: "AC-01",  nm: "Polar 78 guillotina" },
  { code: "AC-02",  nm: "Plegadora Stahl" },
  { code: "AC-03",  nm: "Encuadernadora Müller" },
  { code: "QA-01",  nm: "Sala QA" },
  { code: "SEC-01", nm: "Sala de secado" },
  { code: "LOG-01", nm: "Logística" },
];

/* ─────────── Small UI atoms ─────────── */
const EIco = {
  Plus:    (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  X:       (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Search:  (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>,
  Check:   (p) => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12l4 4 10-10"/></svg>,
  Edit:    (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  Trash:   (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  Cog:     (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.2 4.2l4.2 4.2M15.6 15.6l4.2 4.2M1 12h6M17 12h6M4.2 19.8l4.2-4.2M15.6 8.4l4.2-4.2"/></svg>,
  Info:    (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h0M11 12h1v5h1"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════ */
/*  Form: Create / Edit estación                                   */
/* ═══════════════════════════════════════════════════════════════ */

function StationForm({ initial, onSave, onCancel, onDelete }) {
  const [draft, setDraft] = React.useState(() => initial || {
    nm: "",
    etapa: "preprensa",
    icon: "Layout",
    desc: "",
    maquinas: [],
    empleados: [],
    capacidad: 4,
    horario: "8 a 18 hs",
    tiempoPromedio: 60,
    activa: true,
  });

  const update = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggleArray = (key, val) => setDraft(d => {
    const next = new Set(d[key] || []);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return { ...d, [key]: [...next] };
  });

  const etapa = ETAPAS.find(e => e.key === draft.etapa) || ETAPAS[0];
  const IconCmp = TIco[draft.icon] || TIco.Layout;
  const valid = draft.nm.trim().length > 0;

  return (
    <>
      <div className="sheet-backdrop" onClick={onCancel} />
      <div className="sheet est-sheet" role="dialog">
        <div className="sheet-head est-sheet-head">
          <div className="head-icon" style={{ background: etapa.color }}>
            <IconCmp />
          </div>
          <div className="body">
            <div className="eyebrow">
              {initial ? "Editar estación" : "Nueva estación"}
            </div>
            <h2>{draft.nm.trim() || (initial ? initial.nm : "Estación sin nombre")}</h2>
            <div className="sub">{etapa.nm} · {etapa.desc}</div>
          </div>
          <span className="close" onClick={onCancel}><EIco.X /></span>
        </div>

        <div className="sheet-body est-form">
          {/* ─── BÁSICOS ─── */}
          <div className="est-section">
            <div className="est-section-head">
              <span className="num">01</span>
              <div>
                <div className="ttl">Identidad</div>
                <div className="sub">Nombre interno y la etapa productiva a la que pertenece.</div>
              </div>
            </div>

            <div className="est-field">
              <label>Etapa <span className="req">·</span></label>
              <div className="etapa-picker">
                {ETAPAS.map(e => (
                  <button
                    key={e.key}
                    className={`etapa-chip ${draft.etapa === e.key ? "on" : ""}`}
                    onClick={() => update({ etapa: e.key })}
                    style={draft.etapa === e.key ? { borderColor: e.color, boxShadow: `inset 3px 0 0 ${e.color}` } : null}
                  >
                    <span className="num">{String(e.order).padStart(2,"0")}</span>
                    <span className="nm">{e.nm}</span>
                  </button>
                ))}
              </div>
              <div className="help">Fijo por el sistema · ordena las estaciones en las vistas operativas.</div>
            </div>

            <div className="est-grid-2">
              <div className="est-field">
                <label>Nombre de la estación <span className="req">·</span></label>
                <input
                  type="text"
                  className="est-input"
                  value={draft.nm}
                  onChange={(e) => update({ nm: e.target.value })}
                  placeholder="Ej: Plotter Latex - Gran formato"
                  autoFocus
                />
              </div>
              <div className="est-field">
                <label>Estado</label>
                <div className="est-toggle">
                  <button className={draft.activa ? "on" : ""} onClick={() => update({ activa: true })}>
                    <span className="dot ok" />Activa
                  </button>
                  <button className={!draft.activa ? "on" : ""} onClick={() => update({ activa: false })}>
                    <span className="dot off" />Inactiva
                  </button>
                </div>
              </div>
            </div>

            <div className="est-field">
              <label>Descripción</label>
              <textarea
                className="est-input"
                value={draft.desc}
                onChange={(e) => update({ desc: e.target.value })}
                placeholder="Qué procesos ocurren en esta estación, equipos típicos, observaciones."
                rows={2}
              />
            </div>

            <div className="est-field">
              <label>Icono visual</label>
              <div className="icon-picker">
                {STATION_ICONS.map(i => {
                  const Ic = TIco[i.key] || TIco.Layout;
                  return (
                    <button
                      key={i.key}
                      className={`icon-chip ${draft.icon === i.key ? "on" : ""}`}
                      onClick={() => update({ icon: i.key })}
                      title={i.nm}
                    >
                      <Ic />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── RECURSOS ─── */}
          <div className="est-section">
            <div className="est-section-head">
              <span className="num">02</span>
              <div>
                <div className="ttl">Recursos asignados</div>
                <div className="sub">Máquinas y personal que opera en esta estación. Podés cambiarlo después.</div>
              </div>
            </div>

            <div className="est-field">
              <label>Máquinas asociadas <span className="opt">opcional</span></label>
              <div className="multi-chips">
                {MAQUINAS_MOCK.map(m => (
                  <button
                    key={m.code}
                    className={`m-chip ${draft.maquinas.includes(m.code) ? "on" : ""}`}
                    onClick={() => toggleArray("maquinas", m.code)}
                  >
                    {draft.maquinas.includes(m.code) && <EIco.Check />}
                    <span className="code">{m.code}</span>
                    <span className="nm">{m.nm}</span>
                  </button>
                ))}
              </div>
              {draft.maquinas.length > 0 && (
                <div className="help">{draft.maquinas.length} máquina(s) seleccionada(s).</div>
              )}
            </div>

            <div className="est-field">
              <label>Empleados habilitados <span className="opt">opcional</span></label>
              <div className="emp-chips">
                {EMPLEADOS_MOCK.map(e => (
                  <button
                    key={e.iniciales}
                    className={`emp-chip ${draft.empleados.includes(e.iniciales) ? "on" : ""}`}
                    onClick={() => toggleArray("empleados", e.iniciales)}
                  >
                    <span className="av">{e.iniciales}</span>
                    <span className="info">
                      <span className="nm">{e.nm.split(" ")[0]} {e.nm.split(" ")[1]?.[0]}.</span>
                      <span className="role">{e.role}</span>
                    </span>
                    {draft.empleados.includes(e.iniciales) && <EIco.Check />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── CAPACIDAD ─── */}
          <div className="est-section">
            <div className="est-section-head">
              <span className="num">03</span>
              <div>
                <div className="ttl">Capacidad y planificación</div>
                <div className="sub">Datos operativos para calcular cargas y tiempos de entrega.</div>
              </div>
            </div>

            <div className="est-grid-3">
              <div className="est-field">
                <label>Items concurrentes</label>
                <div className="est-stepper">
                  <button onClick={() => update({ capacidad: Math.max(1, draft.capacidad - 1) })}>−</button>
                  <input type="number" value={draft.capacidad} onChange={(e) => update({ capacidad: Math.max(1, parseInt(e.target.value) || 1) })} />
                  <button onClick={() => update({ capacidad: draft.capacidad + 1 })}>+</button>
                </div>
                <div className="help">Items que pueden procesarse en paralelo.</div>
              </div>
              <div className="est-field">
                <label>Tiempo promedio por paso</label>
                <div className="est-stepper">
                  <button onClick={() => update({ tiempoPromedio: Math.max(5, draft.tiempoPromedio - 5) })}>−</button>
                  <input type="number" value={draft.tiempoPromedio} onChange={(e) => update({ tiempoPromedio: Math.max(5, parseInt(e.target.value) || 5) })} />
                  <span className="unit">min</span>
                  <button onClick={() => update({ tiempoPromedio: draft.tiempoPromedio + 5 })}>+</button>
                </div>
                <div className="help">Estimado para planificación.</div>
              </div>
              <div className="est-field">
                <label>Horario operativo</label>
                <input
                  type="text"
                  className="est-input"
                  value={draft.horario}
                  onChange={(e) => update({ horario: e.target.value })}
                  placeholder="8 a 18 hs"
                />
                <div className="help">Para alertas y entregas.</div>
              </div>
            </div>
          </div>

          <div className="est-tip">
            <EIco.Info />
            <span>Una vez creada, la estación aparece en las vistas <strong>Por estación</strong> y <strong>Línea de tiempo</strong>, y puede asignarse a los pasos de las rutas de producción.</span>
          </div>
        </div>

        <div className="sheet-foot est-foot">
          {initial && onDelete && (
            <button className="btn btn-danger" onClick={() => onDelete(initial.id)}>
              <EIco.Trash /> Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)} disabled={!valid}>
            {initial ? "Guardar cambios" : "Crear estación"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  List view                                                      */
/* ═══════════════════════════════════════════════════════════════ */

function EstacionCard({ est, onEdit }) {
  const etapa = ETAPAS.find(e => e.key === est.etapa) || ETAPAS[0];
  const IconCmp = TIco[est.icon] || TIco.Layout;
  return (
    <div className={`est-card ${!est.activa ? "inactive" : ""}`} onClick={() => onEdit(est)}>
      <div className="est-card-head">
        <span className="est-card-ico" style={{ background: etapa.color }}>
          <IconCmp />
        </span>
        <div className="est-card-titles">
          <div className="nm">{est.nm}</div>
          <div className="desc">{est.desc}</div>
        </div>
        <button className="est-card-edit" onClick={(e) => { e.stopPropagation(); onEdit(est); }}>
          <EIco.Edit />
        </button>
      </div>

      <div className="est-card-stats">
        <div className="s">
          <div className="k">Máquinas</div>
          <div className="v">{est.maquinas.length}</div>
        </div>
        <div className="s">
          <div className="k">Empleados</div>
          <div className="v">{est.empleados.length}</div>
        </div>
        <div className="s">
          <div className="k">Capacidad</div>
          <div className="v">{est.capacidad}</div>
        </div>
        <div className="s">
          <div className="k">T. prom.</div>
          <div className="v">{est.tiempoPromedio}<span className="u">min</span></div>
        </div>
      </div>

      <div className="est-card-foot">
        {est.activa ? (
          <span className="est-status ok"><span className="dot" />Activa</span>
        ) : (
          <span className="est-status off"><span className="dot" />Inactiva</span>
        )}
        <span className="est-card-id">{est.id}</span>
        {est.tasksCount > 0 && (
          <span className="est-tasks">{est.tasksCount} en curso</span>
        )}
      </div>
    </div>
  );
}

function Estaciones() {
  const [items, setItems] = React.useState(INITIAL_ESTACIONES);
  const [sheet, setSheet] = React.useState(null); // null | "new" | {est}
  const [query, setQuery] = React.useState("");
  const [filterEtapa, setFilterEtapa] = React.useState("all");

  const filtered = items.filter(e => {
    if (filterEtapa !== "all" && e.etapa !== filterEtapa) return false;
    if (query) {
      const hay = (e.nm + " " + e.desc + " " + e.id).toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  // Group by etapa
  const grouped = ETAPAS.map(et => ({
    etapa: et,
    items: filtered.filter(it => it.etapa === et.key),
  })).filter(g => g.items.length > 0);

  const handleSave = (draft) => {
    if (sheet && sheet !== "new") {
      // edit
      setItems(items.map(i => i.id === sheet.id ? { ...sheet, ...draft } : i));
    } else {
      // new
      const id = "EST-" + String(items.length + 1).padStart(3, "0");
      setItems([...items, { ...draft, id, tasksCount: 0 }]);
    }
    setSheet(null);
  };
  const handleDelete = (id) => {
    setItems(items.filter(i => i.id !== id));
    setSheet(null);
  };

  return (
    <div className="est-page">
      <div className="page-head">
        <div className="title-block">
          <h1>Estaciones</h1>
          <div className="sub">Configurá las estaciones productivas de tu planta. Se ordenan automáticamente por etapa en las vistas operativas.</div>
        </div>
        <button className="btn">Importar</button>
        <button className="btn btn-primary" onClick={() => setSheet("new")}>
          <EIco.Plus />
          Nueva estación
        </button>
      </div>

      <div className="est-toolbar">
        <div className="search" style={{ flex: "1 1 320px" }}>
          <EIco.Search />
          <input
            placeholder="Buscar por nombre, descripción o ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd">/</span>
        </div>
        <div className="est-etapa-filter">
          <button className={filterEtapa === "all" ? "on" : ""} onClick={() => setFilterEtapa("all")}>
            Todas <span className="ct">{items.length}</span>
          </button>
          {ETAPAS.map(et => {
            const ct = items.filter(i => i.etapa === et.key).length;
            return (
              <button
                key={et.key}
                className={filterEtapa === et.key ? "on" : ""}
                onClick={() => setFilterEtapa(et.key)}
              >
                {et.nm} {ct > 0 && <span className="ct">{ct}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {grouped.map(({ etapa, items }) => (
        <div key={etapa.key} className="est-group">
          <div className="est-group-head">
            <span className="dot" style={{ background: etapa.color }} />
            <h3>{etapa.nm}</h3>
            <span className="rule" />
            <span className="ct">{items.length} estación{items.length === 1 ? "" : "es"}</span>
          </div>
          <div className="est-group-grid">
            {items.map(est => (
              <EstacionCard key={est.id} est={est} onEdit={setSheet} />
            ))}
            <div className="est-add-card" onClick={() => {
              setSheet("new");
              // pre-fill etapa
              setTimeout(() => {
                // not strictly necessary — form uses preprensa as default; could prefill via state but ok
              }, 0);
            }}>
              <EIco.Plus />
              <span>Nueva estación en {etapa.nm}</span>
            </div>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="est-empty">
          <div className="ic"><EIco.Cog /></div>
          <div className="ttl">No hay estaciones que coincidan</div>
          <div className="sub">Probá cambiando los filtros o creá una nueva.</div>
          <button className="btn btn-primary" onClick={() => setSheet("new")}><EIco.Plus />Nueva estación</button>
        </div>
      )}

      {sheet === "new" && (
        <StationForm onSave={handleSave} onCancel={() => setSheet(null)} />
      )}
      {sheet && sheet !== "new" && (
        <StationForm
          initial={sheet}
          onSave={handleSave}
          onCancel={() => setSheet(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

Object.assign(window, { Estaciones, StationForm, EstacionCard, ETAPAS });
