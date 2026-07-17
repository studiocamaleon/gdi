"use client";

import * as React from "react";
import {
  BookOpenIcon,
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

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  createEmptyEstacion,
  DIAS_SEMANA,
  ETAPAS_ESTACION,
  etapaDeEstacion,
  etiquetaCalendario,
  type CalendarioEstacion,
  type DiaSemana,
  type Estacion,
  type EstacionPayload,
  type FamiliaPasoCatalogo,
} from "@/lib/estaciones";
import {
  createEstacion,
  deleteEstacion,
  getEstaciones,
  getFamiliasPasos,
  updateEstacion,
} from "@/lib/estaciones-api";
import { CATEGORIAS_FAMILIA } from "@/lib/tablero-produccion";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type EmpleadoRef = { id: string; nombreCompleto: string; sector: string };
export type MaquinaRef = { id: string; codigo: string; nombre: string };

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
  Book: BookOpenIcon,
  Tool: WrenchIcon,
  Shield: ShieldCheckIcon,
  Package: PackageIcon,
  Truck: TruckIcon,
  Wrench: WrenchIcon,
  Sun: SunIcon,
};

function getIcon(icon: string | null | undefined) {
  return (icon && ICONS[icon]) || CogIcon;
}

function iconEl(icon: string | null | undefined) {
  const IconCmp = getIcon(icon);
  return <IconCmp />;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Form (sheet) ─────────────────────────────────────────────────────────

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

// ── Editor del calendario semanal ────────────────────────────────────────

const DIA_NOMBRE: Record<DiaSemana, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

/** Calendario con los 7 días inactivos (base para editar desde cero). */
function calendarioVacio(): CalendarioEstacion {
  return { dias: { lun: null, mar: null, mie: null, jue: null, vie: null, sab: null, dom: null } };
}

/** Franjas activas con desde >= hasta (bloquean el guardado con aviso). */
function diasInvalidos(calendario: CalendarioEstacion | null): DiaSemana[] {
  if (!calendario) return [];
  return DIAS_SEMANA.filter((dia) => {
    const franja = calendario.dias[dia];
    return franja !== null && franja.desde >= franja.hasta;
  });
}

/**
 * Editor semanal: toggle por día + franja desde/hasta. Al activar un día
 * hereda la franja del último día activo anterior (o 9–18). "Copiar
 * horarios de:" pisa el calendario del borrador con el de otra estación
 * (sólo el calendario; los puestos no se copian) — acción de cliente pura.
 */
function CalendarioEditor({
  value,
  onChange,
  fuentes,
}: {
  value: CalendarioEstacion | null;
  onChange: (calendario: CalendarioEstacion | null) => void;
  fuentes: Estacion[];
}) {
  const calendario = value ?? calendarioVacio();
  const invalidos = new Set(diasInvalidos(calendario));

  const setDia = (dia: DiaSemana, franja: { desde: string; hasta: string } | null) => {
    onChange({ dias: { ...calendario.dias, [dia]: franja } });
  };

  const toggleDia = (dia: DiaSemana) => {
    if (calendario.dias[dia]) {
      setDia(dia, null);
      return;
    }
    // Hereda la franja del día activo anterior: cargar L y activar M-V sale gratis.
    const previos = DIAS_SEMANA.slice(0, DIAS_SEMANA.indexOf(dia)).reverse();
    const heredada = previos.map((previo) => calendario.dias[previo]).find(Boolean);
    setDia(dia, heredada ? { ...heredada } : { desde: "09:00", hasta: "18:00" });
  };

  const copiables = fuentes.filter((estacion) => estacion.calendario !== null);

  return (
    <div className="cal-editor">
      <div className="cal-editor-head">
        <label>Calendario operativo</label>
        {copiables.length > 0 ? (
          <select
            className="cal-copy"
            value=""
            onChange={(event) => {
              const fuente = copiables.find((estacion) => estacion.id === event.target.value);
              if (fuente?.calendario) onChange({ dias: { ...fuente.calendario.dias } });
            }}
          >
            <option value="" disabled>Copiar horarios de…</option>
            {copiables.map((estacion) => (
              <option key={estacion.id} value={estacion.id}>{estacion.nombre} — {etiquetaCalendario(estacion.calendario)}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="cal-rows">
        {DIAS_SEMANA.map((dia) => {
          const franja = calendario.dias[dia];
          return (
            <div key={dia} className={`cal-row ${franja ? "on" : ""} ${invalidos.has(dia) ? "invalid" : ""}`}>
              <button type="button" className="cal-day" onClick={() => toggleDia(dia)} aria-pressed={franja !== null}>
                <span className="dot" />{DIA_NOMBRE[dia]}
              </button>
              {franja ? (
                <div className="cal-times">
                  <input type="time" value={franja.desde} onChange={(event) => setDia(dia, { ...franja, desde: event.target.value })} />
                  <span className="sep">–</span>
                  <input type="time" value={franja.hasta} onChange={(event) => setDia(dia, { ...franja, hasta: event.target.value })} />
                </div>
              ) : (
                <span className="cal-off">No se trabaja</span>
              )}
            </div>
          );
        })}
      </div>
      <div className={`help ${invalidos.size > 0 ? "err" : ""}`}>
        {invalidos.size > 0
          ? `Revisá ${[...invalidos].map((dia) => DIA_NOMBRE[dia]).join(", ")}: "desde" debe ser anterior a "hasta".`
          : "Horas disponibles para proyectar la cola del tablero en días."}
      </div>
    </div>
  );
}

function StationForm({
  initial,
  etapaInicial,
  estaciones,
  familias,
  empleados,
  maquinas,
  maquinaEnEstacion,
  saving,
  error,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Estacion;
  etapaInicial?: string;
  /** Todas las estaciones (fuentes de "Copiar horarios de:"). */
  estaciones: Estacion[];
  familias: FamiliaPasoCatalogo[];
  empleados: EmpleadoRef[];
  maquinas: MaquinaRef[];
  /** maquinaId → nombre de la estación donde vive hoy. */
  maquinaEnEstacion: Map<string, string>;
  saving: boolean;
  error: string | null;
  onSave: (draft: EstacionPayload) => void;
  onCancel: () => void;
  onDelete?: (estacion: Estacion) => void;
}) {
  const [draft, setDraft] = React.useState<EstacionPayload>(() =>
    initial
      ? {
          nombre: initial.nombre,
          descripcion: initial.descripcion,
          activo: initial.activo,
          etapa: initial.etapa,
          icono: initial.icono ?? "Tool",
          capacidadConcurrente: initial.capacidadConcurrente,
          calendario: initial.calendario,
          familias: initial.familias,
          empleadoIds: initial.empleados.map((entry) => entry.id),
          maquinaIds: initial.maquinas.map((entry) => entry.id),
        }
      : { ...createEmptyEstacion(), ...(etapaInicial ? { etapa: etapaInicial } : {}) },
  );
  const update = (patch: Partial<EstacionPayload>) => setDraft((current) => ({ ...current, ...patch }));
  const toggleLista = (key: "familias" | "empleadoIds" | "maquinaIds", val: string) => {
    setDraft((current) => {
      const next = new Set(current[key]);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return { ...current, [key]: [...next] };
    });
  };

  const valid =
    draft.nombre.trim().length > 0 &&
    diasInvalidos(draft.calendario ?? null).length === 0;
  const etapa = etapaDeEstacion(draft.etapa);

  // Familias agrupadas por categoría; las tomadas por OTRA estación se
  // muestran deshabilitadas con la dueña (una familia, una estación).
  const familiasPorCategoria = CATEGORIAS_FAMILIA.map((cat) => ({
    ...cat,
    items: familias.filter(
      (familia) =>
        familia.categoria === cat.key &&
        (familia.visibleEnSelector || draft.familias.includes(familia.codigo)),
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <>
      <div className="sheet-backdrop est-sheet-backdrop" onClick={onCancel} />
      <div className="sheet est-sheet" role="dialog" aria-modal="true">
        <div className="sheet-head est-sheet-head">
          <div className="head-icon" style={{ background: etapa.color }}>{iconEl(draft.icono)}</div>
          <div className="body">
            <div className="eyebrow">{initial ? "Editar estación" : "Nueva estación"}</div>
            <h2>{draft.nombre.trim() || (initial ? initial.nombre : "Estación sin nombre")}</h2>
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
                {ETAPAS_ESTACION.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`etapa-chip ${draft.etapa === entry.key ? "on" : ""}`}
                    onClick={() => update({ etapa: entry.key })}
                    style={draft.etapa === entry.key ? { borderColor: entry.color, boxShadow: `inset 3px 0 0 ${entry.color}` } : undefined}
                  >
                    <span className="num">{String(entry.order).padStart(2, "0")}</span><span className="nm">{entry.nm}</span>
                  </button>
                ))}
              </div>
              <div className="help">Fija por el sistema · ordena las estaciones en las vistas operativas.</div>
            </div>

            <div className="est-grid-2">
              <div className="est-field">
                <label>Nombre de la estación <span className="req">·</span></label>
                <input className="est-input" value={draft.nombre} onChange={(event) => update({ nombre: event.target.value })} placeholder="Ej: Impresión digital" autoFocus />
              </div>
              <div className="est-field">
                <label>Estado</label>
                <div className="est-toggle">
                  <button type="button" className={draft.activo ? "on" : ""} onClick={() => update({ activo: true })}><span className="dot ok" />Activa</button>
                  <button type="button" className={!draft.activo ? "on" : ""} onClick={() => update({ activo: false })}><span className="dot off" />Inactiva</button>
                </div>
                <div className="help">Inactiva: su trabajo cae a &quot;Sin estación&quot; en el tablero.</div>
              </div>
            </div>

            <div className="est-field">
              <label>Descripción</label>
              <textarea className="est-input" value={draft.descripcion ?? ""} onChange={(event) => update({ descripcion: event.target.value })} placeholder="Qué procesos ocurren en esta estación, observaciones." rows={2} />
            </div>

            <div className="est-field">
              <label>Icono visual</label>
              <div className="icon-picker">
                {STATION_ICONS.map((icon) => (
                  <button key={icon.key} type="button" className={`icon-chip ${draft.icono === icon.key ? "on" : ""}`} onClick={() => update({ icono: icon.key })} title={icon.nm}>{iconEl(icon.key)}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">02</span><div><div className="ttl">Familias de pasos</div><div className="sub">Qué tipo de trabajo se ejecuta acá: la clave que rutea cada paso del tablero. Una familia puede repetirse entre estaciones CON máquinas (las máquinas filtran); a lo sumo una estación general (sin máquinas) por familia.</div></div></div>
            {familiasPorCategoria.map((cat) => (
              <div key={cat.key} className="est-field">
                <label>{cat.nm}</label>
                <div className="multi-chips">
                  {cat.items.map((familia) => {
                    const seleccionada = draft.familias.includes(familia.codigo);
                    const otras = familia.estaciones.filter((entry) => entry.id !== initial?.id);
                    const generalAjena = otras.find((entry) => !entry.conMaquinas);
                    // Bloqueada sólo si ELEGIRLA crearía dos estaciones
                    // generales con la misma familia (ruteo ambiguo).
                    const bloqueada =
                      !seleccionada && Boolean(generalAjena) && draft.maquinaIds.length === 0;
                    const tag =
                      otras.length > 0
                        ? `en ${otras[0].nombre}${otras.length > 1 ? ` +${otras.length - 1}` : ""}`
                        : null;
                    return (
                      <button
                        key={familia.codigo}
                        type="button"
                        className={`m-chip ${seleccionada ? "on" : ""} ${bloqueada ? "taken" : ""}`}
                        disabled={bloqueada}
                        title={
                          bloqueada
                            ? `Ya está en la estación general "${generalAjena?.nombre}". Asigná máquinas a esta estación para repartir la familia por máquina.`
                            : otras.length > 0
                              ? `También en: ${otras.map((entry) => entry.nombre).join(", ")}`
                              : familia.codigo
                        }
                        onClick={() => toggleLista("familias", familia.codigo)}
                      >
                        {seleccionada ? <CheckIcon /> : null}
                        <span className="nm">{familia.nombre}</span>
                        {tag ? <span className="en-tag">{tag}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {draft.familias.length > 0 ? <div className="help">{draft.familias.length} familia(s) asignada(s).</div> : <div className="help">Sin familias, esta estación no recibe pasos del tablero.</div>}
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">03</span><div><div className="ttl">Recursos asignados</div><div className="sub">Máquinas y personal que opera en esta estación.</div></div></div>
            <div className="est-field">
              <label>Máquinas <span className="opt">una máquina vive en una sola estación</span></label>
              <div className="multi-chips">
                {maquinas.map((machine) => {
                  const seleccionada = draft.maquinaIds.includes(machine.id);
                  const enOtra = !seleccionada ? maquinaEnEstacion.get(machine.id) : undefined;
                  const enOtraDistinta = enOtra && enOtra !== initial?.nombre ? enOtra : undefined;
                  return (
                    <button
                      key={machine.id}
                      type="button"
                      className={`m-chip ${seleccionada ? "on" : ""}`}
                      title={enOtraDistinta ? `Hoy está en "${enOtraDistinta}": seleccionarla la mueve acá.` : machine.nombre}
                      onClick={() => toggleLista("maquinaIds", machine.id)}
                    >
                      {seleccionada ? <CheckIcon /> : null}
                      <span className="nm">{machine.nombre}</span>
                      {enOtraDistinta ? <span className="en-tag">en {enOtraDistinta}</span> : null}
                    </button>
                  );
                })}
                {maquinas.length === 0 ? <div className="help">No hay máquinas cargadas en el sistema.</div> : null}
              </div>
              {draft.maquinaIds.length > 0 ? <div className="help">{draft.maquinaIds.length} máquina(s) en esta estación.</div> : null}
            </div>

            <div className="est-field">
              <label>Empleados habilitados <span className="opt">pueden estar en varias estaciones</span></label>
              <div className="emp-chips">
                {empleados.map((employee) => (
                  <button key={employee.id} type="button" className={`emp-chip ${draft.empleadoIds.includes(employee.id) ? "on" : ""}`} onClick={() => toggleLista("empleadoIds", employee.id)}>
                    <span className="av">{iniciales(employee.nombreCompleto)}</span>
                    <span className="info"><span className="nm">{employee.nombreCompleto}</span><span className="role">{employee.sector}</span></span>
                    {draft.empleadoIds.includes(employee.id) ? <CheckIcon /> : null}
                  </button>
                ))}
                {empleados.length === 0 ? <div className="help">No hay empleados cargados en el sistema.</div> : null}
              </div>
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">04</span><div><div className="ttl">Capacidad y planificación</div><div className="sub">Puestos y calendario: la cola del tablero se mide en horas.</div></div></div>
            <Stepper label="Puestos de trabajo" value={draft.capacidadConcurrente ?? 1} min={1} step={1} onChange={(value) => update({ capacidadConcurrente: value })} help="Cuántos pasos avanzan EN PARALELO de verdad (2 mesas con 2 operarios = 2). Una impresora es 1, aunque tenga cola." />
            <CalendarioEditor
              value={draft.calendario ?? null}
              onChange={(calendario) => update({ calendario })}
              fuentes={estaciones.filter((estacion) => estacion.id !== initial?.id && estacion.activo)}
            />
          </section>

          <div className="est-tip"><CogIcon /><span>Los pasos del Tablero llegan a esta estación por su <strong>familia</strong>; si la estación tiene <strong>máquinas</strong>, sólo recibe los pasos que usan esas máquinas. El tiempo estimado por paso sale de la ruta real de cada item, no se configura acá.</span></div>
        </div>

        <div className="sheet-foot est-foot">
          {initial && onDelete ? <button type="button" className="btn btn-danger" onClick={() => onDelete(initial)} disabled={saving}><TrashIcon />Eliminar</button> : null}
          {error ? <span className="est-error" role="alert">{error}</span> : null}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)} disabled={!valid || saving}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear estación"}</button>
        </div>
      </div>
    </>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────

function EstacionCard({
  est,
  onEdit,
}: {
  est: Estacion;
  onEdit: (station: Estacion) => void;
}) {
  const etapa = etapaDeEstacion(est.etapa);
  return (
    <button type="button" className={`est-card ${!est.activo ? "inactive" : ""}`} onClick={() => onEdit(est)}>
      <div className="est-card-head">
        <span className="est-card-ico" style={{ background: etapa.color }}>{iconEl(est.icono)}</span>
        <div className="est-card-titles"><div className="nm">{est.nombre}</div><div className="desc">{est.descripcion || etapa.nm}</div></div>
        <span className="est-card-edit"><PencilIcon /></span>
      </div>
      <div className="est-card-stats">
        <Stat label="Familias" value={est.familias.length} />
        <Stat label="Máquinas" value={est.maquinas.length} />
        <Stat label="Empleados" value={est.empleados.length} />
        <Stat label="Puestos" value={est.capacidadConcurrente} />
      </div>
      <div className="est-card-foot">
        <span className={`est-status ${est.activo ? "ok" : "off"}`}><span className="dot" />{est.activo ? "Activa" : "Inactiva"}</span>
        {etiquetaCalendario(est.calendario) ? <span className="est-card-id">{etiquetaCalendario(est.calendario)}</span> : null}
        {est.familias.length === 0 ? <span className="est-tasks">Sin familias: no recibe pasos</span> : null}
      </div>
    </button>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return <div className="s"><div className="k">{label}</div><div className="v">{value}{unit ? <span className="u">{unit}</span> : null}</div></div>;
}

// ── Panel ────────────────────────────────────────────────────────────────

export function EstacionesPanel({
  initialEstaciones,
  initialFamilias,
  empleados,
  maquinas,
}: {
  initialEstaciones: Estacion[];
  initialFamilias: FamiliaPasoCatalogo[];
  empleados: EmpleadoRef[];
  maquinas: MaquinaRef[];
}) {
  const [items, setItems] = React.useState(initialEstaciones);
  const [familias, setFamilias] = React.useState(initialFamilias);
  const [sheet, setSheet] = React.useState<"new" | Estacion | null>(null);
  const [nuevaEtapa, setNuevaEtapa] = React.useState<string | undefined>(undefined);
  const [aEliminar, setAEliminar] = React.useState<Estacion | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filterCategoria, setFilterCategoria] = React.useState<string>("all");

  // maquinaId → estación dueña (para avisar el "movimiento" en el picker).
  const maquinaEnEstacion = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const est of items) {
      for (const machine of est.maquinas) map.set(machine.id, est.nombre);
    }
    return map;
  }, [items]);

  const refrescar = React.useCallback(async () => {
    const [ests, fams] = await Promise.all([getEstaciones(), getFamiliasPasos()]);
    setItems(ests);
    setFamilias(fams);
  }, []);

  const filtered = items.filter((entry) => {
    if (filterCategoria !== "all" && entry.etapa !== filterCategoria) return false;
    if (query) {
      const haystack = `${entry.nombre} ${entry.descripcion}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const grouped = ETAPAS_ESTACION.map((cat) => ({
    cat,
    items: filtered.filter((item) => item.etapa === cat.key),
  })).filter((group) => group.items.length > 0);

  const handleSave = async (draft: EstacionPayload) => {
    setSaving(true);
    setError(null);
    try {
      if (sheet && sheet !== "new") await updateEstacion(sheet.id, draft);
      else await createEstacion(draft);
      await refrescar();
      setSheet(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la estación.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!aEliminar) return;
    await deleteEstacion(aEliminar.id);
    await refrescar();
    setAEliminar(null);
    setSheet(null);
  };

  return (
    <div
      className="est-page"
      style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 32px 40px" }}
    >
      <div className="page-head">
        <div className="title-block">
          <h1>Estaciones</h1>
          <div className="sub">Configurá las estaciones de tu taller: familias de pasos (rutean el tablero), máquinas, empleados y capacidad.</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setNuevaEtapa(undefined); setSheet("new"); }}><PlusIcon />Nueva estación</button>
      </div>

      <div className="est-toolbar">
        <div className="search">
          <SearchIcon />
          <input placeholder="Buscar por nombre o descripción…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <span className="kbd">/</span>
        </div>
        <div className="est-etapa-filter">
          <button type="button" className={filterCategoria === "all" ? "on" : ""} onClick={() => setFilterCategoria("all")}>Todas <span className="ct">{items.length}</span></button>
          {ETAPAS_ESTACION.map((cat) => {
            const count = items.filter((item) => item.etapa === cat.key).length;
            if (count === 0) return null;
            return <button key={cat.key} type="button" className={filterCategoria === cat.key ? "on" : ""} onClick={() => setFilterCategoria(cat.key)}>{cat.nm}<span className="ct">{count}</span></button>;
          })}
        </div>
      </div>

      {grouped.map(({ cat, items: groupItems }) => (
        <section key={cat.key} className="est-group">
          <div className="est-group-head"><span className="dot" style={{ background: cat.color }} /><h3>{cat.nm}</h3><span className="rule" /><span className="ct">{groupItems.length} estación{groupItems.length === 1 ? "" : "es"}</span></div>
          <div className="est-group-grid">
            {groupItems.map((est) => <EstacionCard key={est.id} est={est} onEdit={setSheet} />)}
            <button type="button" className="est-add-card" onClick={() => { setNuevaEtapa(cat.key); setSheet("new"); }}>
              <PlusIcon />
              <span>Nueva estación en {cat.nm}</span>
            </button>
          </div>
        </section>
      ))}

      {items.length === 0 ? (
        <div className="est-empty">
          <div className="ic"><FactoryIcon /></div>
          <div className="ttl">Todavía no hay estaciones</div>
          <div className="sub">Creá las estaciones de tu taller y asignales familias de pasos: el Tablero va a agrupar el trabajo por ellas.</div>
          <button type="button" className="btn btn-primary" onClick={() => { setNuevaEtapa(undefined); setSheet("new"); }}><PlusIcon />Nueva estación</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="est-empty">
          <div className="ic"><CogIcon /></div><div className="ttl">No hay estaciones que coincidan</div><div className="sub">Probá cambiando los filtros o creá una nueva.</div>
        </div>
      ) : null}

      {sheet ? (
        <StationForm
          key={sheet === "new" ? `new-${nuevaEtapa ?? "def"}` : sheet.id}
          initial={sheet === "new" ? undefined : sheet}
          etapaInicial={sheet === "new" ? nuevaEtapa : undefined}
          estaciones={items}
          familias={familias}
          empleados={empleados}
          maquinas={maquinas}
          maquinaEnEstacion={maquinaEnEstacion}
          saving={saving}
          error={error}
          onSave={(draft) => void handleSave(draft)}
          onCancel={() => { setSheet(null); setError(null); }}
          onDelete={(est) => setAEliminar(est)}
        />
      ) : null}

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(open) => { if (!open) setAEliminar(null); }}
        titulo="Eliminar estación"
        descripcion="La estación se elimina del taller."
        impacto={[
          "Sus familias de pasos quedan libres: el trabajo vivo cae a \"Sin estación\" en el tablero.",
          "Las máquinas quedan sin estación asignada.",
          "Los empleados dejan de estar habilitados en ella.",
        ]}
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar estación"
        onConfirmar={handleDelete}
      />
    </div>
  );
}
