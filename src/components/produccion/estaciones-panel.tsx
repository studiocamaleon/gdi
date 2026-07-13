"use client";

import * as React from "react";
import {
  CheckIcon,
  CircleDotIcon,
  CogIcon,
  FactoryIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PaintbrushIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  ScissorsIcon,
  SearchIcon,
  ShieldCheckIcon,
  SunIcon,
  TrashIcon,
  TruckIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

import type { Estacion } from "@/lib/estaciones";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type EtapaKey =
  | "preprensa"
  | "impresion"
  | "postprensa"
  | "terminaciones"
  | "instalacion"
  | "qa-despacho";

type EstacionItem = {
  id: string;
  nm: string;
  etapa: EtapaKey;
  icon: string;
  desc: string;
  maquinas: string[];
  empleados: string[];
  capacidad: number;
  horario: string;
  tiempoPromedio: number;
  activa: boolean;
  tasksCount: number;
};

type SheetState = "new" | EstacionItem | null;

const ETAPAS: Array<{ key: EtapaKey; nm: string; desc: string; order: number; color: string }> = [
  { key: "preprensa", nm: "Pre-prensa", desc: "Diseño, verificación de archivos, CTP y planchas", order: 1, color: "#1d4ed8" },
  { key: "impresion", nm: "Impresión", desc: "Offset, digital, ploteo y gran formato", order: 2, color: "#14141a" },
  { key: "postprensa", nm: "Post-prensa", desc: "Secado, estabilización, refilado preliminar", order: 3, color: "#92929b" },
  { key: "terminaciones", nm: "Terminaciones", desc: "Laminado, troquel, corte, plegado, encuadernación, armado", order: 4, color: "#c08025" },
  { key: "instalacion", nm: "Instalación", desc: "Instalación en obra, montaje en sitio", order: 5, color: "#16794a" },
  { key: "qa-despacho", nm: "QA & Despacho", desc: "Control de calidad, empaque, retiro y flete", order: 6, color: "#c2410c" },
];

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

const INITIAL_ESTACIONES: EstacionItem[] = [
  { id: "EST-001", nm: "Diseño y verificación", etapa: "preprensa", icon: "Layout", desc: "Diseño gráfico y pre-flight de archivos", maquinas: ["DI-01"], empleados: ["AC", "MP"], capacidad: 8, horario: "8 a 18 hs", tiempoPromedio: 45, activa: true, tasksCount: 2 },
  { id: "EST-002", nm: "CTP y planchas", etapa: "preprensa", icon: "Layers", desc: "Imposición y montaje de plancha CTP", maquinas: ["CTP-01"], empleados: ["JS"], capacidad: 4, horario: "8 a 16 hs", tiempoPromedio: 22, activa: true, tasksCount: 1 },
  { id: "EST-003", nm: "Impresión Offset", etapa: "impresion", icon: "Printer", desc: "Heidelberg GTO y SM 52", maquinas: ["PR-01", "PR-02"], empleados: ["DS"], capacidad: 6, horario: "Turno A + B", tiempoPromedio: 95, activa: true, tasksCount: 1 },
  { id: "EST-004", nm: "Impresión Digital", etapa: "impresion", icon: "Printer", desc: "Impresión digital pliego", maquinas: ["DG-01"], empleados: ["LM"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 60, activa: true, tasksCount: 0 },
  { id: "EST-005", nm: "Plotter Latex - Gran formato", etapa: "impresion", icon: "Plot", desc: "HP Latex 365 - vinilo, lona y rígidos", maquinas: ["DG-02"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 78, activa: true, tasksCount: 1 },
  { id: "EST-006", nm: "Secado", etapa: "postprensa", icon: "Sun", desc: "Estabilización post-impresión", maquinas: ["SEC-01"], empleados: [], capacidad: 12, horario: "24h", tiempoPromedio: 480, activa: true, tasksCount: 1 },
  { id: "EST-007", nm: "Plotter de corte vinilo", etapa: "terminaciones", icon: "Cut", desc: "Corte de vinilo autoadhesivo", maquinas: ["VC-01"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 40, activa: true, tasksCount: 0 },
  { id: "EST-008", nm: "Router CNC", etapa: "terminaciones", icon: "Cnc", desc: "Corte de placas y materiales rígidos", maquinas: ["CNC-01"], empleados: ["HC"], capacidad: 2, horario: "8 a 18 hs", tiempoPromedio: 110, activa: true, tasksCount: 1 },
  { id: "EST-009", nm: "Guillotina y plegado", etapa: "terminaciones", icon: "Scissors", desc: "Refilado, corte final y plegado en línea", maquinas: ["AC-01", "AC-02"], empleados: ["RG"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 35, activa: true, tasksCount: 1 },
  { id: "EST-010", nm: "Laminado y troquel", etapa: "terminaciones", icon: "Brush", desc: "Laminado UV y troquelado mecánico", maquinas: ["DG-04"], empleados: ["PR"], capacidad: 3, horario: "8 a 18 hs", tiempoPromedio: 45, activa: true, tasksCount: 1 },
  { id: "EST-011", nm: "Armado y encuadernación", etapa: "terminaciones", icon: "Tool", desc: "Armado, cableado y encuadernación", maquinas: ["AC-03"], empleados: ["RT"], capacidad: 4, horario: "8 a 18 hs", tiempoPromedio: 150, activa: true, tasksCount: 2 },
  { id: "EST-012", nm: "Láser CO₂", etapa: "terminaciones", icon: "Beam", desc: "Corte y grabado láser", maquinas: ["LSR-01"], empleados: [], capacidad: 2, horario: "8 a 18 hs", tiempoPromedio: 55, activa: false, tasksCount: 0 },
  { id: "EST-013", nm: "QA + Empaque", etapa: "qa-despacho", icon: "Shield", desc: "Control de calidad y embalaje final", maquinas: ["QA-01"], empleados: ["LM"], capacidad: 6, horario: "8 a 18 hs", tiempoPromedio: 30, activa: true, tasksCount: 1 },
  { id: "EST-014", nm: "Despacho", etapa: "qa-despacho", icon: "Truck", desc: "Retiro, flete y logística externa", maquinas: ["LOG-01"], empleados: [], capacidad: 8, horario: "8 a 17 hs", tiempoPromedio: 25, activa: true, tasksCount: 0 },
];

const EMPLEADOS_MOCK = [
  { iniciales: "AC", nm: "Ana Cardozo", role: "Diseño" },
  { iniciales: "MP", nm: "Mariana Pérez", role: "Diseño" },
  { iniciales: "JS", nm: "Julián Sandoval", role: "Pre-prensa" },
  { iniciales: "DS", nm: "Daniel Sosa", role: "Maquinista offset" },
  { iniciales: "LM", nm: "Lucas Méndez", role: "Operador" },
  { iniciales: "PR", nm: "Pablo Rivero", role: "Acabado" },
  { iniciales: "RG", nm: "Ricardo Genaro", role: "Acabado" },
  { iniciales: "HC", nm: "Hugo Cabrera", role: "Acabado" },
  { iniciales: "RT", nm: "Roberto Tévez", role: "Armado" },
];

const MAQUINAS_MOCK = [
  { code: "DI-01", nm: "Estación de diseño" },
  { code: "CTP-01", nm: "Heidelberg Suprasetter" },
  { code: "PR-01", nm: "Heidelberg GTO" },
  { code: "PR-02", nm: "Heidelberg SM 52" },
  { code: "DG-01", nm: "HP Indigo 5500" },
  { code: "DG-02", nm: "HP Latex 365" },
  { code: "DG-04", nm: "Laminadora Flexa" },
  { code: "VC-01", nm: "Roland GR-540" },
  { code: "CNC-01", nm: "Router CNC ShopBot" },
  { code: "LSR-01", nm: "Láser CO₂ 100W" },
  { code: "AC-01", nm: "Polar 78 guillotina" },
  { code: "AC-02", nm: "Plegadora Stahl" },
  { code: "AC-03", nm: "Encuadernadora Müller" },
  { code: "QA-01", nm: "Sala QA" },
  { code: "SEC-01", nm: "Sala de secado" },
  { code: "LOG-01", nm: "Logística" },
];

const ICONS: Record<string, IconComponent> = {
  Layout: LayoutDashboardIcon,
  Layers: LayersIcon,
  Printer: PrinterIcon,
  Plot: FactoryIcon,
  Cut: ScissorsIcon,
  Scissors: ScissorsIcon,
  Brush: PaintbrushIcon,
  Stamp: CircleDotIcon,
  Fold: LayersIcon,
  Cnc: FactoryIcon,
  Beam: ZapIcon,
  Book: LayersIcon,
  Tool: WrenchIcon,
  Shield: ShieldCheckIcon,
  Package: PackageIcon,
  Truck: TruckIcon,
  Wrench: WrenchIcon,
  Sun: SunIcon,
};

function getIcon(icon: string) {
  return ICONS[icon] ?? LayoutDashboardIcon;
}

function emptyStation(etapa: EtapaKey = "preprensa"): Omit<EstacionItem, "id" | "tasksCount"> {
  return {
    nm: "",
    etapa,
    icon: "Layout",
    desc: "",
    maquinas: [],
    empleados: [],
    capacidad: 4,
    horario: "8 a 18 hs",
    tiempoPromedio: 60,
    activa: true,
  };
}

function StationForm({
  initial,
  etapaInicial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: EstacionItem;
  etapaInicial?: EtapaKey;
  onSave: (draft: Omit<EstacionItem, "id" | "tasksCount">) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const [draft, setDraft] = React.useState(() => initial ?? emptyStation(etapaInicial));
  const etapa = ETAPAS.find((entry) => entry.key === draft.etapa) ?? ETAPAS[0];
  const IconCmp = getIcon(draft.icon);
  const valid = draft.nm.trim().length > 0;
  const update = (patch: Partial<EstacionItem>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleArray = (key: "maquinas" | "empleados", val: string) => {
    setDraft((current) => {
      const next = new Set(current[key]);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return { ...current, [key]: [...next] };
    });
  };

  return (
    <>
      <div className="sheet-backdrop est-sheet-backdrop" onClick={onCancel} />
      <div className="sheet est-sheet" role="dialog" aria-modal="true">
        <div className="sheet-head est-sheet-head">
          <div className="head-icon" style={{ background: etapa.color }}><IconCmp /></div>
          <div className="body">
            <div className="eyebrow">{initial ? "Editar estación" : "Nueva estación"}</div>
            <h2>{draft.nm.trim() || (initial ? initial.nm : "Estación sin nombre")}</h2>
            <div className="sub">{etapa.nm} · {etapa.desc}</div>
          </div>
          <span className="close" onClick={onCancel}><XIcon /></span>
        </div>

        <div className="sheet-body est-form">
          <section className="est-section">
            <div className="est-section-head"><span className="num">01</span><div><div className="ttl">Identidad</div><div className="sub">Nombre interno y la etapa productiva a la que pertenece.</div></div></div>
            <div className="est-field">
              <label>Etapa <span className="req">·</span></label>
              <div className="etapa-picker">
                {ETAPAS.map((entry) => (
                  <button key={entry.key} type="button" className={`etapa-chip ${draft.etapa === entry.key ? "on" : ""}`} onClick={() => update({ etapa: entry.key })}>
                    <span className="num">{String(entry.order).padStart(2, "0")}</span><span className="nm">{entry.nm}</span>
                  </button>
                ))}
              </div>
              <div className="help">Fijo por el sistema · ordena las estaciones en las vistas operativas.</div>
            </div>

            <div className="est-grid-2">
              <div className="est-field">
                <label>Nombre de la estación <span className="req">·</span></label>
                <input className="est-input" value={draft.nm} onChange={(event) => update({ nm: event.target.value })} placeholder="Ej: Plotter Latex - Gran formato" autoFocus />
              </div>
              <div className="est-field">
                <label>Estado</label>
                <div className="est-toggle">
                  <button type="button" className={draft.activa ? "on" : ""} onClick={() => update({ activa: true })}><span className="dot ok" />Activa</button>
                  <button type="button" className={!draft.activa ? "on" : ""} onClick={() => update({ activa: false })}><span className="dot off" />Inactiva</button>
                </div>
              </div>
            </div>

            <div className="est-field">
              <label>Descripción</label>
              <textarea className="est-input" value={draft.desc} onChange={(event) => update({ desc: event.target.value })} placeholder="Qué procesos ocurren en esta estación, equipos típicos, observaciones." rows={2} />
            </div>

            <div className="est-field">
              <label>Icono visual</label>
              <div className="icon-picker">
                {STATION_ICONS.map((icon) => {
                  const Icon = getIcon(icon.key);
                  return <button key={icon.key} type="button" className={`icon-chip ${draft.icon === icon.key ? "on" : ""}`} onClick={() => update({ icon: icon.key })} title={icon.nm}><Icon /></button>;
                })}
              </div>
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">02</span><div><div className="ttl">Recursos asignados</div><div className="sub">Máquinas y personal que opera en esta estación. Podés cambiarlo después.</div></div></div>
            <div className="est-field">
              <label>Máquinas asociadas <span className="opt">opcional</span></label>
              <div className="multi-chips">
                {MAQUINAS_MOCK.map((machine) => (
                  <button key={machine.code} type="button" className={`m-chip ${draft.maquinas.includes(machine.code) ? "on" : ""}`} onClick={() => toggleArray("maquinas", machine.code)}>
                    {draft.maquinas.includes(machine.code) ? <CheckIcon /> : null}<span className="code">{machine.code}</span><span className="nm">{machine.nm}</span>
                  </button>
                ))}
              </div>
              {draft.maquinas.length > 0 ? <div className="help">{draft.maquinas.length} máquina(s) seleccionada(s).</div> : null}
            </div>

            <div className="est-field">
              <label>Empleados habilitados <span className="opt">opcional</span></label>
              <div className="emp-chips">
                {EMPLEADOS_MOCK.map((employee) => (
                  <button key={employee.iniciales} type="button" className={`emp-chip ${draft.empleados.includes(employee.iniciales) ? "on" : ""}`} onClick={() => toggleArray("empleados", employee.iniciales)}>
                    <span className="av">{employee.iniciales}</span><span className="info"><span className="nm">{employee.nm.split(" ")[0]} {employee.nm.split(" ")[1]?.[0]}.</span><span className="role">{employee.role}</span></span>{draft.empleados.includes(employee.iniciales) ? <CheckIcon /> : null}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">03</span><div><div className="ttl">Capacidad y planificación</div><div className="sub">Datos operativos para calcular cargas y tiempos de entrega.</div></div></div>
            <div className="est-grid-3">
              <Stepper label="Items concurrentes" value={draft.capacidad} min={1} step={1} onChange={(value) => update({ capacidad: value })} help="Items que pueden procesarse en paralelo." />
              <Stepper label="Tiempo promedio por paso" value={draft.tiempoPromedio} min={5} step={5} unit="min" onChange={(value) => update({ tiempoPromedio: value })} help="Estimado para planificación." />
              <div className="est-field">
                <label>Horario operativo</label>
                <input className="est-input" value={draft.horario} onChange={(event) => update({ horario: event.target.value })} placeholder="8 a 18 hs" />
                <div className="help">Para alertas y entregas.</div>
              </div>
            </div>
          </section>

          <div className="est-tip"><CogIcon /><span>Una vez creada, la estación aparece en las vistas <strong>Por estación</strong> y <strong>Línea de tiempo</strong>, y puede asignarse a los pasos de las rutas de producción.</span></div>
        </div>

        <div className="sheet-foot est-foot">
          {initial && onDelete ? <button type="button" className="btn btn-danger" onClick={() => onDelete(initial.id)}><TrashIcon />Eliminar</button> : null}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)} disabled={!valid}>{initial ? "Guardar cambios" : "Crear estación"}</button>
        </div>
      </div>
    </>
  );
}

function Stepper({ label, value, min, step, unit, help, onChange }: { label: string; value: number; min: number; step: number; unit?: string; help: string; onChange: (value: number) => void }) {
  return (
    <div className="est-field">
      <label>{label}</label>
      <div className="est-stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <input type="number" value={value} onChange={(event) => onChange(Math.max(min, Number.parseInt(event.target.value, 10) || min))} />
        {unit ? <span className="unit">{unit}</span> : null}
        <button type="button" onClick={() => onChange(value + step)}>+</button>
      </div>
      <div className="help">{help}</div>
    </div>
  );
}

function EstacionCard({ est, onEdit }: { est: EstacionItem; onEdit: (station: EstacionItem) => void }) {
  const etapa = ETAPAS.find((entry) => entry.key === est.etapa) ?? ETAPAS[0];
  const IconCmp = getIcon(est.icon);
  return (
    <button type="button" className={`est-card ${!est.activa ? "inactive" : ""}`} onClick={() => onEdit(est)}>
      <div className="est-card-head">
        <span className="est-card-ico" style={{ background: etapa.color }}><IconCmp /></span>
        <div className="est-card-titles"><div className="nm">{est.nm}</div><div className="desc">{est.desc}</div></div>
        <span className="est-card-edit"><PencilIcon /></span>
      </div>
      <div className="est-card-stats">
        <Stat label="Máquinas" value={est.maquinas.length} />
        <Stat label="Empleados" value={est.empleados.length} />
        <Stat label="Capacidad" value={est.capacidad} />
        <Stat label="T. prom." value={est.tiempoPromedio} unit="min" />
      </div>
      <div className="est-card-foot">
        <span className={`est-status ${est.activa ? "ok" : "off"}`}><span className="dot" />{est.activa ? "Activa" : "Inactiva"}</span>
        <span className="est-card-id">{est.id}</span>
        {est.tasksCount > 0 ? <span className="est-tasks">{est.tasksCount} en curso</span> : null}
      </div>
    </button>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return <div className="s"><div className="k">{label}</div><div className="v">{value}{unit ? <span className="u">{unit}</span> : null}</div></div>;
}

export function EstacionesPanel({ initialEstaciones }: { initialEstaciones?: Estacion[] }) {
  const [items, setItems] = React.useState(INITIAL_ESTACIONES);
  const [sheet, setSheet] = React.useState<SheetState>(null);
  const [newEtapa, setNewEtapa] = React.useState<EtapaKey>("preprensa");
  const [query, setQuery] = React.useState("");
  const [filterEtapa, setFilterEtapa] = React.useState<EtapaKey | "all">("all");

  React.useEffect(() => {
    if (!initialEstaciones?.length) return;
    // La vista usa el diseño/mock enriquecido; la DB actual todavía no expone etapa, recursos ni capacidad.
  }, [initialEstaciones]);

  const filtered = items.filter((entry) => {
    if (filterEtapa !== "all" && entry.etapa !== filterEtapa) return false;
    if (query) {
      const haystack = `${entry.nm} ${entry.desc} ${entry.id}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });
  const grouped = ETAPAS.map((etapa) => ({ etapa, items: filtered.filter((item) => item.etapa === etapa.key) })).filter((group) => group.items.length > 0);

  const openNew = (etapa: EtapaKey = "preprensa") => {
    setNewEtapa(etapa);
    setSheet("new");
  };
  const handleSave = (draft: Omit<EstacionItem, "id" | "tasksCount">) => {
    if (sheet && sheet !== "new") {
      setItems((current) => current.map((item) => (item.id === sheet.id ? { ...sheet, ...draft } : item)));
    } else {
      const id = `EST-${String(items.length + 1).padStart(3, "0")}`;
      setItems((current) => [...current, { ...draft, id, tasksCount: 0 }]);
    }
    setSheet(null);
  };
  const handleDelete = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setSheet(null);
  };

  return (
    <div
      className="est-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        width: "auto",
        maxWidth: "none",
        margin: 0,
        padding: "28px 32px 40px",
      }}
    >
      <div className="page-head">
        <div className="title-block">
          <h1>Estaciones</h1>
          <div className="sub">Configurá las estaciones productivas de tu planta. Se ordenan automáticamente por etapa en las vistas operativas.</div>
        </div>
        <button type="button" className="btn">Importar</button>
        <button type="button" className="btn btn-primary" onClick={() => openNew()}><PlusIcon />Nueva estación</button>
      </div>

      <div className="est-toolbar">
        <div className="search">
          <SearchIcon />
          <input placeholder="Buscar por nombre, descripción o ID…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <span className="kbd">/</span>
        </div>
        <div className="est-etapa-filter">
          <button type="button" className={filterEtapa === "all" ? "on" : ""} onClick={() => setFilterEtapa("all")}>Todas <span className="ct">{items.length}</span></button>
          {ETAPAS.map((etapa) => {
            const count = items.filter((item) => item.etapa === etapa.key).length;
            return <button key={etapa.key} type="button" className={filterEtapa === etapa.key ? "on" : ""} onClick={() => setFilterEtapa(etapa.key)}>{etapa.nm}{count > 0 ? <span className="ct">{count}</span> : null}</button>;
          })}
        </div>
      </div>

      {grouped.map(({ etapa, items: groupItems }) => (
        <section key={etapa.key} className="est-group">
          <div className="est-group-head"><span className="dot" style={{ background: etapa.color }} /><h3>{etapa.nm}</h3><span className="rule" /><span className="ct">{groupItems.length} estación{groupItems.length === 1 ? "" : "es"}</span></div>
          <div className="est-group-grid">
            {groupItems.map((est) => <EstacionCard key={est.id} est={est} onEdit={setSheet} />)}
            <button type="button" className="est-add-card" onClick={() => openNew(etapa.key)}><PlusIcon /><span>Nueva estación en {etapa.nm}</span></button>
          </div>
        </section>
      ))}

      {filtered.length === 0 ? (
        <div className="est-empty">
          <div className="ic"><CogIcon /></div><div className="ttl">No hay estaciones que coincidan</div><div className="sub">Probá cambiando los filtros o creá una nueva.</div>
          <button type="button" className="btn btn-primary" onClick={() => openNew()}><PlusIcon />Nueva estación</button>
        </div>
      ) : null}

      {sheet === "new" ? <StationForm etapaInicial={newEtapa} onSave={handleSave} onCancel={() => setSheet(null)} /> : null}
      {sheet && sheet !== "new" ? <StationForm initial={sheet} onSave={handleSave} onCancel={() => setSheet(null)} onDelete={handleDelete} /> : null}
    </div>
  );
}
