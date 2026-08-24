"use client";

import * as React from "react";
import {
  BookOpenIcon,
  ChevronRightIcon,
  CircleDotIcon,
  CogIcon,
  FactoryIcon,
  InfoIcon,
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
  CalendarOffIcon,
  TrashIcon,
  TruckIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  actualizarConfiguracionProduccion,
  createEstacion,
  crearDiaNoLaborable,
  deleteEstacion,
  eliminarDiaNoLaborable,
  getConfiguracionProduccion,
  getDiasNoLaborables,
  getEstaciones,
  getFamiliasPasos,
  updateEstacion,
  type DiaNoLaborable,
} from "@/lib/estaciones-api";
import { CATEGORIAS_FAMILIA } from "@/lib/tablero-produccion";
import { tecnologiaMaquinaItems } from "@/lib/maquinaria";
import {
  SelectBuscable,
  type OpcionSelect,
} from "@/components/ui/select-buscable";
import s2 from "./estaciones-panel.module.css";

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

/**
 * Ícono de ayuda con el detalle en un tooltip: saca el texto chico de la UI
 * (queda sólo la etiqueta) sin perder la explicación. Nativo (`title`) para
 * que no lo recorte el `overflow` del sheet.
 */
function InfoTip({ text }: { text: string }) {
  return (
    <span className={s2.info} title={text} tabIndex={0} role="img" aria-label={text}>
      <InfoIcon size={13} aria-hidden />
    </span>
  );
}

// ── Form (sheet) ─────────────────────────────────────────────────────────

function Stepper({ label, value, min, step, unit, help, onChange }: { label: string; value: number; min: number; step: number; unit?: string; help: string; onChange: (value: number) => void }) {
  return (
    <div className="est-field">
      {label ? <label>{label}</label> : null}
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

// ── Feriados y cierres del taller (días no laborables, a nivel tenant) ───

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA_SEMANA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "2026-07-20" → "lun 20 jul 2026" (fecha local, sin zona). */
function etiquetaFeriado(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const local = new Date(anio, mes - 1, dia);
  return `${DIA_SEMANA_CORTO[local.getDay()]} ${dia} ${MES_CORTO[mes - 1]} ${anio}`;
}

/**
 * Sheet de gestión de fechas no laborables: la proyección de cola del
 * tablero y la demora sugerida del cotizador las saltan (D8 del doc de
 * capacidad). Lista simple + alta (fecha, motivo) + borrado directo (es
 * config reversible).
 */
function FeriadosSheet({ onClose }: { onClose: () => void }) {
  const [dias, setDias] = React.useState<DiaNoLaborable[] | null>(null);
  const [fecha, setFecha] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [margen, setMargen] = React.useState<number | null>(null);
  const [corte, setCorte] = React.useState<string | null>(null);
  const [entrePasos, setEntrePasos] = React.useState<number | null>(null);
  const fechaRef = React.useRef<HTMLInputElement | null>(null);
  const configRef = React.useRef({ margenEtaDias: 0, corteJornada: "20:00", tiempoEntrePasosMin: 0 });
  const guardadoRef = React.useRef<Promise<void>>(Promise.resolve());
  const versionRef = React.useRef(0);

  React.useEffect(() => {
    let vigente = true;
    getDiasNoLaborables()
      .then((lista) => { if (vigente) setDias(lista); })
      .catch(() => { if (vigente) setDias([]); });
    getConfiguracionProduccion()
      .then((config) => {
        if (!vigente) return;
        setMargen(config.margenEtaDias);
        setCorte(config.corteJornada);
        setEntrePasos(config.tiempoEntrePasosMin);
        configRef.current = config;
      })
      .catch(() => {
        if (!vigente) return;
        setMargen(0);
        setCorte("20:00");
        setEntrePasos(0);
      });
    return () => { vigente = false; };
  }, []);

  const guardarConfiguracion = (patch: Partial<typeof configRef.current>) => {
    configRef.current = { ...configRef.current, ...patch };
    const snapshot = { ...configRef.current };
    const version = ++versionRef.current;
    guardadoRef.current = guardadoRef.current
      .catch(() => undefined)
      .then(async () => {
        await actualizarConfiguracionProduccion(snapshot);
      })
      .catch(async () => {
        if (version !== versionRef.current) return;
        setError("No se pudo guardar la configuración. Se restauraron los últimos valores confirmados.");
        try {
          const confirmada = await getConfiguracionProduccion();
          configRef.current = confirmada;
          setMargen(confirmada.margenEtaDias);
          setCorte(confirmada.corteJornada);
          setEntrePasos(confirmada.tiempoEntrePasosMin);
        } catch {
          // El aviso permanece visible; no inventamos valores confirmados.
        }
      });
  };

  const cambiarMargen = (valor: number) => {
    const acotado = Math.max(0, Math.min(15, valor));
    setMargen(acotado);
    guardarConfiguracion({ margenEtaDias: acotado });
  };

  /** Minutos que cuesta llevar el material a la próxima estación. */
  const cambiarEntrePasos = (valor: number) => {
    const acotado = Math.max(0, Math.min(240, valor));
    setEntrePasos(acotado);
    guardarConfiguracion({ tiempoEntrePasosMin: acotado });
  };

  const cambiarCorte = (valor: string) => {
    setCorte(valor); // optimista: el picker responde al toque
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return;
    guardarConfiguracion({ corteJornada: valor });
  };

  const agregar = async () => {
    if (!fecha) return;
    setGuardando(true);
    setError(null);
    try {
      const creado = await crearDiaNoLaborable({ fecha, descripcion: descripcion || undefined });
      setDias((current) => [...(current ?? []), creado].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setFecha("");
      setDescripcion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la fecha.");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (dia: DiaNoLaborable) => {
    setError(null);
    try {
      await eliminarDiaNoLaborable(dia.id);
      setDias((current) => (current ?? []).filter((entry) => entry.id !== dia.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la fecha.");
    }
  };

  const hoy = new Date();
  const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="est-sheet feriados-sheet gap-0 p-0 sm:max-w-none" showCloseButton={false}>
        <div className="sheet-head est-sheet-head">
          <div>
            <div className="kicker">PRODUCCIÓN</div>
            <SheetTitle>Calendario del taller</SheetTitle>
            <SheetDescription>Feriados, cierres y margen para prometer fechas: alimentan la proyección de cola y la demora estimada.</SheetDescription>
          </div>
          <SheetClose render={<button type="button" className="close" aria-label="Cerrar calendario" />}><XIcon /></SheetClose>
        </div>
        <div className="sheet-body est-form">
          <div className="est-section-head"><span className="num">01</span><div><div className="ttl">Margen para prometer</div><div className="sub">Colchón sobre la fecha que el sistema estima en el cotizador.</div></div></div>
          {margen !== null ? (
            <Stepper
              label="Días hábiles de margen"
              value={margen}
              min={0}
              step={1}
              onChange={cambiarMargen}
              help='Se suman a la ETA cruda al sugerir la fecha prometible ("terminaría ≈ mar 21 · prometé desde jue 23"). 0 = sin margen.'
            />
          ) : (
            <div className="feriados-empty">Cargando…</div>
          )}

          <div className="est-section-head" style={{ marginTop: 18 }}><span className="num">02</span><div><div className="ttl">Tiempo entre pasos</div><div className="sub">Lo que cuesta llevar el material a la próxima estación y dejarlo listo. Cada estación puede declarar el suyo; esto es el valor por defecto.</div></div></div>
          {entrePasos !== null ? (
            <Stepper
              label="Minutos de traslado"
              value={entrePasos}
              min={0}
              step={5}
              onChange={cambiarEntrePasos}
              help="Nadie termina 9:35 y arranca otro paso 9:35. Lo hace el operario, así que ocupa un puesto de la estación destino — pero no su máquina. 0 = sin colchón."
            />
          ) : (
            <div className="feriados-empty">Cargando…</div>
          )}

          <div className="est-section-head" style={{ marginTop: 18 }}><span className="num">03</span><div><div className="ttl">Corte de jornada</div><div className="sub">Hora a la que los cronómetros de pasos que quedaron corriendo se cierran solos (el tiempo no sigue sumando de noche ni el fin de semana).</div></div></div>
          {corte !== null ? (
            <div className="feriados-add" style={{ maxWidth: 220 }}>
              <input
                className="est-input"
                type="time"
                value={corte}
                onChange={(event) => cambiarCorte(event.target.value)}
                aria-label="Hora de corte de jornada"
              />
            </div>
          ) : (
            <div className="feriados-empty">Cargando…</div>
          )}

          <div className="est-section-head" style={{ marginTop: 18 }}><span className="num">04</span><div><div className="ttl">Feriados y cierres</div><div className="sub">Días en que el taller no trabaja: no aportan capacidad en ninguna proyección.</div></div></div>
          <div className="feriados-add">
            <input
              ref={fechaRef}
              className="est-input"
              type="date"
              value={fecha}
              onClick={() => fechaRef.current?.showPicker?.()}
              onChange={(event) => setFecha(event.target.value)}
              aria-label="Fecha no laborable"
            />
            <input
              className="est-input"
              placeholder="Motivo (feriado, vacaciones…)"
              value={descripcion}
              maxLength={120}
              onChange={(event) => setDescripcion(event.target.value)}
            />
            <button type="button" className="btn btn-primary" disabled={!fecha || guardando} onClick={() => void agregar()}>
              {guardando ? "Agregando…" : "Agregar"}
            </button>
          </div>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

          {dias === null ? (
            <div className="feriados-empty">Cargando…</div>
          ) : dias.length === 0 ? (
            <div className="feriados-empty">Sin fechas cargadas: el taller opera según el calendario semanal de cada estación.</div>
          ) : (
            <div className="feriados-list">
              {dias.map((dia) => (
                <div key={dia.id} className={`feriados-row ${dia.fecha < hoyClave ? "pasado" : ""}`}>
                  <span className="fecha">{etiquetaFeriado(dia.fecha)}</span>
                  <span className="motivo">{dia.descripcion || "Sin motivo"}</span>
                  <button type="button" className="quitar" onClick={() => void quitar(dia)} aria-label={`Quitar ${dia.fecha}`}>
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sheet-foot est-foot">
          <div className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </SheetContent>
    </Sheet>
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

/**
 * Días con franjas inválidas: alguna con desde >= hasta, o dos que se
 * solapan (comparadas ya ordenadas). Bloquean el guardado con aviso.
 */
function diasInvalidos(calendario: CalendarioEstacion | null): DiaSemana[] {
  if (!calendario) return [];
  return DIAS_SEMANA.filter((dia) => {
    const franjas = calendario.dias[dia];
    if (!franjas) return false;
    if (franjas.some((franja) => franja.desde >= franja.hasta)) return true;
    const ordenadas = [...franjas].sort((a, b) => (a.desde < b.desde ? -1 : 1));
    return ordenadas.some(
      (franja, i) => i > 0 && franja.desde < ordenadas[i - 1].hasta,
    );
  });
}

/** Franja nueva a continuación de la última del día (turno tarde típico). */
function franjaSiguiente(franjas: Array<{ desde: string; hasta: string }>) {
  const ultima = franjas[franjas.length - 1];
  if (!ultima) return { desde: "09:00", hasta: "18:00" };
  const [hh] = ultima.hasta.split(":").map(Number);
  const desde = Math.min(hh + 1, 22);
  const hasta = Math.min(desde + 4, 23);
  const aHora = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return { desde: aHora(desde), hasta: aHora(hasta) };
}

/**
 * Editor semanal: toggle por día + N franjas desde/hasta (jornada cortada:
 * 9–12 y 15–19). Al activar un día hereda las franjas del último día activo
 * anterior (o 9–18). "Copiar horarios de:" pisa el calendario del borrador
 * con el de otra estación (sólo el calendario; los puestos no se copian) —
 * acción de cliente pura.
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

  const setDia = (dia: DiaSemana, franjas: Array<{ desde: string; hasta: string }> | null) => {
    onChange({ dias: { ...calendario.dias, [dia]: franjas } });
  };

  const setFranja = (dia: DiaSemana, indice: number, franja: { desde: string; hasta: string }) => {
    const franjas = calendario.dias[dia] ?? [];
    setDia(dia, franjas.map((previa, i) => (i === indice ? franja : previa)));
  };

  const quitarFranja = (dia: DiaSemana, indice: number) => {
    const franjas = (calendario.dias[dia] ?? []).filter((_, i) => i !== indice);
    setDia(dia, franjas.length > 0 ? franjas : null);
  };

  const toggleDia = (dia: DiaSemana) => {
    if (calendario.dias[dia]) {
      setDia(dia, null);
      return;
    }
    // Hereda las franjas del día activo anterior: cargar L y activar M-V sale gratis.
    const previos = DIAS_SEMANA.slice(0, DIAS_SEMANA.indexOf(dia)).reverse();
    const heredadas = previos.map((previo) => calendario.dias[previo]).find(Boolean);
    setDia(
      dia,
      heredadas ? heredadas.map((franja) => ({ ...franja })) : [{ desde: "09:00", hasta: "18:00" }],
    );
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
          const franjas = calendario.dias[dia];
          return (
            <div key={dia} className={`cal-row ${franjas ? "on" : ""} ${invalidos.has(dia) ? "invalid" : ""}`}>
              <button type="button" className="cal-day" onClick={() => toggleDia(dia)} aria-pressed={franjas !== null}>
                <span className="dot" />{DIA_NOMBRE[dia]}
              </button>
              {franjas ? (
                <div className="cal-franjas">
                  {franjas.map((franja, indice) => (
                    <div key={indice} className="cal-times">
                      <input type="time" value={franja.desde} onChange={(event) => setFranja(dia, indice, { ...franja, desde: event.target.value })} />
                      <span className="sep">–</span>
                      <input type="time" value={franja.hasta} onChange={(event) => setFranja(dia, indice, { ...franja, hasta: event.target.value })} />
                      {franjas.length > 1 ? (
                        <button
                          type="button"
                          className="cal-quitar"
                          onClick={() => quitarFranja(dia, indice)}
                          aria-label={`Quitar franja ${franja.desde}–${franja.hasta} de ${DIA_NOMBRE[dia]}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="cal-agregar"
                    onClick={() => setDia(dia, [...franjas, franjaSiguiente(franjas)])}
                    aria-label={`Agregar franja a ${DIA_NOMBRE[dia]}`}
                    title="Agregar otra franja (jornada cortada)"
                  >
                    +
                  </button>
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
          ? `Revisá ${[...invalidos].map((dia) => DIA_NOMBRE[dia]).join(", ")}: cada franja necesita "desde" anterior a "hasta", sin solaparse con las demás.`
          : "Horas disponibles para proyectar la cola del tablero en días. El + de cada día agrega otra franja (ej.: 9–12 y 15–19)."}
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
  entrePasosDefault,
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
  /** Tiempo entre pasos del taller, para mostrar qué se hereda. */
  entrePasosDefault: number;
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
          tiempoPreparacionMin: initial.tiempoPreparacionMin,
          calendario: initial.calendario,
          familias: initial.familias,
          empleadoIds: initial.empleados.map((entry) => entry.id),
          maquinaIds: initial.maquinas.map((entry) => entry.id),
          reglas: initial.reglas ?? [],
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
  // Reglas de captura por tecnología / paso concreto (rediseño por reglas):
  // conviven con la familia y la máquina como filtros de la estación.
  const tieneRegla = (tipo: "tecnologia" | "paso", valor: string) =>
    (draft.reglas ?? []).some((r) => r.tipo === tipo && r.valor === valor);
  const toggleRegla = (tipo: "tecnologia" | "paso", valor: string) => {
    setDraft((current) => {
      const reglas = current.reglas ?? [];
      const existe = reglas.some((r) => r.tipo === tipo && r.valor === valor);
      return {
        ...current,
        reglas: existe
          ? reglas.filter((r) => !(r.tipo === tipo && r.valor === valor))
          : [...reglas, { tipo, valor }],
      };
    });
  };
  // Qué OTRA estación ya captura una tecnología / paso: una tecnología o un
  // paso concreto vive en una sola estación (evita el ruteo ambiguo). Espeja el
  // "en X" de las familias, contra la lista de estaciones cargadas.
  const reglaEnEstacion = (tipo: "tecnologia" | "paso") => {
    const mapa = new Map<string, string>();
    for (const est of estaciones) {
      if (est.id === initial?.id) continue;
      for (const regla of est.reglas ?? []) {
        if (regla.tipo === tipo && !mapa.has(regla.valor)) {
          mapa.set(regla.valor, est.nombre);
        }
      }
    }
    return mapa;
  };
  const tecnologiaEnEstacion = reglaEnEstacion("tecnologia");
  const pasoEnEstacion = reglaEnEstacion("paso");
  // El ajuste fino por paso concreto arranca plegado, salvo que ya tenga reglas.
  const [mostrarPaso, setMostrarPaso] = React.useState(() =>
    (initial?.reglas ?? []).some((r) => r.tipo === "paso"),
  );

  const valid =
    draft.nombre.trim().length > 0 &&
    diasInvalidos(draft.calendario ?? null).length === 0;
  const etapa = etapaDeEstacion(draft.etapa);

  // "Reglas de captura": chips de lo elegido + un buscable para agregar (evita
  // pintar el catálogo entero como paredes de chips). Máquina vive en Recursos.
  const catLabel = new Map(CATEGORIAS_FAMILIA.map((cat) => [cat.key, cat.nm]));
  const nombreFamilia = (codigo: string) =>
    familias.find((f) => f.codigo === codigo)?.nombre ?? codigo;
  const labelTecnologia = (valor: string) =>
    tecnologiaMaquinaItems.find((t) => t.value === valor)?.label ?? valor;

  const reglasTecnologia = (draft.reglas ?? []).filter(
    (r) => r.tipo === "tecnologia",
  );
  const reglasPaso = (draft.reglas ?? []).filter((r) => r.tipo === "paso");

  // Opciones del buscable = catálogo MENOS lo ya elegido; las tomadas por otra
  // estación quedan deshabilitadas con la dueña en el detalle.
  const opcionesTecnologia: OpcionSelect[] = tecnologiaMaquinaItems
    .filter((t) => !tieneRegla("tecnologia", t.value))
    .map((t) => {
      const enOtra = tecnologiaEnEstacion.get(t.value);
      return {
        value: t.value,
        label: t.label,
        disabled: Boolean(enOtra),
        detalle: enOtra ? `Ya en "${enOtra}"` : null,
      };
    });

  const opcionesFamilia: OpcionSelect[] = familias
    .filter(
      (f) =>
        (f.visibleEnSelector || draft.familias.includes(f.codigo)) &&
        !draft.familias.includes(f.codigo),
    )
    .map((f) => {
      const otras = f.estaciones.filter((e) => e.id !== initial?.id);
      const generalAjena = otras.find((e) => !e.conMaquinas);
      // Bloqueada sólo si crearía dos estaciones generales con la misma familia.
      const bloqueada = Boolean(generalAjena) && draft.maquinaIds.length === 0;
      return {
        value: f.codigo,
        label: f.nombre,
        grupo: catLabel.get(f.categoria) ?? f.categoria,
        disabled: bloqueada,
        detalle: bloqueada
          ? `General en "${generalAjena?.nombre}"`
          : otras.length > 0
            ? `también en ${otras[0].nombre}`
            : null,
      };
    });

  const opcionesPaso: OpcionSelect[] = familias
    .filter(
      (f) =>
        (f.visibleEnSelector || tieneRegla("paso", f.codigo)) &&
        !tieneRegla("paso", f.codigo),
    )
    .map((f) => {
      const enOtra = pasoEnEstacion.get(f.codigo);
      return {
        value: f.codigo,
        label: f.nombre,
        grupo: catLabel.get(f.categoria) ?? f.categoria,
        disabled: Boolean(enOtra),
        detalle: enOtra ? `Ya en "${enOtra}"` : null,
      };
    });

  // Recursos: mismo patrón compacto (chips elegidos + buscable para agregar).
  const nombreMaquina = (id: string) =>
    maquinas.find((m) => m.id === id)?.nombre ?? id;
  const nombreEmpleado = (id: string) =>
    empleados.find((e) => e.id === id)?.nombreCompleto ?? id;

  const opcionesMaquina: OpcionSelect[] = maquinas
    .filter((m) => !draft.maquinaIds.includes(m.id))
    .map((m) => {
      const enOtra = maquinaEnEstacion.get(m.id);
      const enOtraDistinta =
        enOtra && enOtra !== initial?.nombre ? enOtra : undefined;
      return {
        value: m.id,
        label: m.nombre,
        // Elegirla la MUEVE acá (una máquina vive en una estación): se avisa,
        // no se bloquea.
        detalle: enOtraDistinta ? `hoy en ${enOtraDistinta} · se mueve acá` : null,
      };
    });

  const opcionesEmpleado: OpcionSelect[] = empleados
    .filter((e) => !draft.empleadoIds.includes(e.id))
    .map((e) => ({
      value: e.id,
      label: e.nombreCompleto,
      grupo: e.sector || null,
    }));

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <SheetContent className="est-sheet est-editor-sheet gap-0 p-0 sm:max-w-none" showCloseButton={false}>
        <div className="sheet-head est-sheet-head">
          <div className="head-icon" style={{ background: etapa.color }}>{iconEl(draft.icono)}</div>
          <div className="body">
            <div className="eyebrow">{initial ? "Editar estación" : "Nueva estación"}</div>
            <SheetTitle>{draft.nombre.trim() || (initial ? initial.nombre : "Estación sin nombre")}</SheetTitle>
            <SheetDescription>{etapa.nm} · {etapa.desc}</SheetDescription>
          </div>
          <SheetClose render={<button type="button" className="close" aria-label="Cerrar editor" />}><XIcon /></SheetClose>
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
            <div className="est-section-head"><span className="num">02</span><div><div className="ttl">Reglas de captura</div><div className="sub">Qué pasos agarra esta estación. Se evalúan de lo más específico a lo general: <strong>máquina</strong> (en Recursos) › <strong>tecnología</strong> › <strong>paso concreto</strong> › <strong>familia</strong>. Un paso cae en una sola estación: gana la regla más específica.</div></div></div>

            <div className={s2.eje}>
              <div className={s2.ejeHead}>
                <label>Por tecnología<InfoTip text="La máquina del paso es de esta tecnología. Ej: UV y eco solvente, cada una a su estación de impresión. La tecnología sale de la máquina que ejecutó el paso." /></label>
                {reglasTecnologia.length > 0 ? <span className={s2.conteo}>{reglasTecnologia.length}</span> : null}
              </div>
              {reglasTecnologia.length > 0 ? (
                <div className="multi-chips">
                  {reglasTecnologia.map((regla) => (
                    <button key={regla.valor} type="button" className="m-chip on" title="Quitar" onClick={() => toggleRegla("tecnologia", regla.valor)}>
                      <span className="nm">{labelTecnologia(regla.valor)}</span>
                      <span className={s2.quitar}><XIcon size={12} /></span>
                    </button>
                  ))}
                </div>
              ) : null}
              <SelectBuscable
                className={s2.agregar}
                value=""
                onChange={(valor) => valor && toggleRegla("tecnologia", valor)}
                opciones={opcionesTecnologia}
                placeholder="Agregar tecnología…"
                placeholderBusqueda="Buscar tecnología…"
                vacio="No quedan tecnologías por agregar."
                ariaLabel="Agregar regla por tecnología"
              />
            </div>

            <div className={s2.eje}>
              <div className={s2.ejeHead}>
                <label>Por familia<InfoTip text="Captura todo el trabajo de esta familia de pasos. Una familia puede repetirse entre estaciones con máquinas (filtran); a lo sumo una estación general (sin máquinas) por familia." /></label>
                {draft.familias.length > 0 ? <span className={s2.conteo}>{draft.familias.length}</span> : null}
              </div>
              {draft.familias.length > 0 ? (
                <div className="multi-chips">
                  {draft.familias.map((codigo) => (
                    <button key={codigo} type="button" className="m-chip on" title="Quitar" onClick={() => toggleLista("familias", codigo)}>
                      <span className="nm">{nombreFamilia(codigo)}</span>
                      <span className={s2.quitar}><XIcon size={12} /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={s2.vacio}>Sin familias: por este eje no recibe pasos.</div>
              )}
              <SelectBuscable
                className={s2.agregar}
                value=""
                onChange={(valor) => valor && toggleLista("familias", valor)}
                opciones={opcionesFamilia}
                placeholder="Agregar familia…"
                placeholderBusqueda="Buscar familia…"
                vacio="No quedan familias por agregar."
                ariaLabel="Agregar regla por familia"
              />
            </div>

            <div className={s2.avanzado}>
              <button type="button" className={s2.avToggle} data-abierto={mostrarPaso ? "si" : undefined} onClick={() => setMostrarPaso((v) => !v)}>
                <ChevronRightIcon size={14} />
                Ajuste fino por paso concreto
                {reglasPaso.length > 0 ? <span className={s2.conteo}>· {reglasPaso.length}</span> : null}
              </button>
              <InfoTip text="Manda un paso puntual a esta estación aunque su familia esté en otra. Gana sobre la regla por familia." />
              {mostrarPaso ? (
                <div className={s2.avBody}>
                  {reglasPaso.length > 0 ? (
                    <div className="multi-chips">
                      {reglasPaso.map((regla) => (
                        <button key={regla.valor} type="button" className="m-chip on" title="Quitar" onClick={() => toggleRegla("paso", regla.valor)}>
                          <span className="nm">{nombreFamilia(regla.valor)}</span>
                          <span className={s2.quitar}><XIcon size={12} /></span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <SelectBuscable
                    className={s2.agregar}
                    value=""
                    onChange={(valor) => valor && toggleRegla("paso", valor)}
                    opciones={opcionesPaso}
                    placeholder="Agregar paso…"
                    placeholderBusqueda="Buscar paso…"
                    vacio="No quedan pasos por agregar."
                    ariaLabel="Agregar regla por paso concreto"
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">03</span><div><div className="ttl">Recursos asignados</div><div className="sub">Máquinas y personal que opera en esta estación. La <strong>máquina</strong> es la regla de captura más específica: un paso hecho con ella cae acá antes que por tecnología, paso o familia.</div></div></div>
            <div className={s2.eje}>
              <div className={s2.ejeHead}>
                <label>Máquinas<InfoTip text="Una máquina vive en una sola estación. Es la regla de captura más específica. Elegir una que hoy está en otra estación la mueve acá." /></label>
                {draft.maquinaIds.length > 0 ? <span className={s2.conteo}>{draft.maquinaIds.length}</span> : null}
              </div>
              {draft.maquinaIds.length > 0 ? (
                <div className="multi-chips">
                  {draft.maquinaIds.map((id) => (
                    <button key={id} type="button" className="m-chip on" title="Quitar" onClick={() => toggleLista("maquinaIds", id)}>
                      <span className="nm">{nombreMaquina(id)}</span>
                      <span className={s2.quitar}><XIcon size={12} /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={s2.vacio}>Sin máquinas: captura por tecnología, paso o familia.</div>
              )}
              <SelectBuscable
                className={s2.agregar}
                value=""
                onChange={(valor) => valor && toggleLista("maquinaIds", valor)}
                opciones={opcionesMaquina}
                placeholder="Agregar máquina…"
                placeholderBusqueda="Buscar máquina…"
                vacio={maquinas.length === 0 ? "No hay máquinas en el sistema." : "No quedan máquinas por agregar."}
                ariaLabel="Agregar máquina a la estación"
              />
            </div>

            <div className={s2.eje}>
              <div className={s2.ejeHead}>
                <label>Empleados habilitados<InfoTip text="Quiénes pueden operar en esta estación. Un empleado puede estar habilitado en varias estaciones." /></label>
                {draft.empleadoIds.length > 0 ? <span className={s2.conteo}>{draft.empleadoIds.length}</span> : null}
              </div>
              {draft.empleadoIds.length > 0 ? (
                <div className="multi-chips">
                  {draft.empleadoIds.map((id) => (
                    <button key={id} type="button" className="m-chip on" title="Quitar" onClick={() => toggleLista("empleadoIds", id)}>
                      <span className="nm">{nombreEmpleado(id)}</span>
                      <span className={s2.quitar}><XIcon size={12} /></span>
                    </button>
                  ))}
                </div>
              ) : null}
              <SelectBuscable
                className={s2.agregar}
                value=""
                onChange={(valor) => valor && toggleLista("empleadoIds", valor)}
                opciones={opcionesEmpleado}
                placeholder="Agregar empleado…"
                placeholderBusqueda="Buscar empleado…"
                vacio={empleados.length === 0 ? "No hay empleados en el sistema." : "No quedan empleados por agregar."}
                ariaLabel="Habilitar empleado en la estación"
              />
            </div>
          </section>

          <section className="est-section">
            <div className="est-section-head"><span className="num">04</span><div><div className="ttl">Capacidad y planificación</div><div className="sub">Puestos y calendario: la cola del tablero se mide en horas.</div></div></div>
            <div className={s2.capTop}>
              <div className="est-field">
                <label>Puestos<InfoTip text="Cuántos pasos avanzan EN PARALELO de verdad (2 mesas con 2 operarios = 2). Una impresora es 1, aunque tenga cola." /></label>
                <div className={`est-stepper ${s2.puestosStepper}`}>
                  <button type="button" onClick={() => update({ capacidadConcurrente: Math.max(1, (draft.capacidadConcurrente ?? 1) - 1) })}>−</button>
                  <input type="number" value={draft.capacidadConcurrente ?? 1} onChange={(event) => update({ capacidadConcurrente: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })} />
                  <button type="button" onClick={() => update({ capacidadConcurrente: (draft.capacidadConcurrente ?? 1) + 1 })}>+</button>
                </div>
              </div>

              <div className="est-field">
                <label>Tiempo entre pasos<InfoTip text="Traslado hasta esta estación antes de empezar un paso. Ocupa un puesto (lo hace el operario), no la máquina. «Del taller» hereda el valor global; «Propio» le da uno distinto." /></label>
                <div className={`est-toggle ${s2.tiempoToggle}`}>
                  <button type="button" className={draft.tiempoPreparacionMin == null ? "on" : ""} onClick={() => update({ tiempoPreparacionMin: null })}>
                    Del taller · {entrePasosDefault} min
                  </button>
                  <button type="button" className={draft.tiempoPreparacionMin != null ? "on" : ""} onClick={() => update({ tiempoPreparacionMin: draft.tiempoPreparacionMin ?? entrePasosDefault })}>
                    Propio
                  </button>
                </div>
                {draft.tiempoPreparacionMin != null ? (
                  <div className={`est-stepper ${s2.tiempoStepper}`}>
                    <button type="button" onClick={() => update({ tiempoPreparacionMin: Math.max(0, (draft.tiempoPreparacionMin ?? 0) - 5) })}>−</button>
                    <input type="number" value={draft.tiempoPreparacionMin} onChange={(event) => update({ tiempoPreparacionMin: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} />
                    <span className="unit">min</span>
                    <button type="button" onClick={() => update({ tiempoPreparacionMin: (draft.tiempoPreparacionMin ?? 0) + 5 })}>+</button>
                  </div>
                ) : null}
              </div>
            </div>

            <CalendarioEditor
              value={draft.calendario ?? null}
              onChange={(calendario) => update({ calendario })}
              fuentes={estaciones.filter((estacion) => estacion.id !== initial?.id && estacion.activo)}
            />
          </section>

          <div className="est-tip"><CogIcon /><span>Cada paso del Tablero cae en <strong>una sola</strong> estación: gana la regla más específica que lo matchea (<strong>máquina › tecnología › paso › familia</strong>). El tiempo estimado por paso sale de la ruta real de cada item, no se configura acá.</span></div>
        </div>

        <div className="sheet-foot est-foot">
          {initial && onDelete ? <button type="button" className="btn btn-danger" onClick={() => onDelete(initial)} disabled={saving}><TrashIcon />Eliminar</button> : null}
          {error ? <span className="est-error" role="alert">{error}</span> : null}
          <div className="spacer" />
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)} disabled={!valid || saving}>{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear estación"}</button>
        </div>
      </SheetContent>
    </Sheet>
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
        {est.familias.length === 0 && (est.reglas?.length ?? 0) === 0 && est.maquinas.length === 0 ? <span className="est-tasks">Sin reglas: no recibe pasos</span> : null}
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
  initialLoadWarning,
}: {
  initialEstaciones: Estacion[];
  initialFamilias: FamiliaPasoCatalogo[];
  empleados: EmpleadoRef[];
  maquinas: MaquinaRef[];
  initialLoadWarning?: string | null;
}) {
  const [items, setItems] = React.useState(initialEstaciones);
  const [familias, setFamilias] = React.useState(initialFamilias);
  const [sheet, setSheet] = React.useState<"new" | Estacion | null>(null);
  const [nuevaEtapa, setNuevaEtapa] = React.useState<string | undefined>(undefined);
  const [aEliminar, setAEliminar] = React.useState<Estacion | null>(null);
  const [feriadosOpen, setFeriadosOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [filterCategoria, setFilterCategoria] = React.useState<string>("all");
  /* El tiempo entre pasos del taller, sólo para mostrar qué hereda una
     estación sin valor propio. Se refresca al abrir un formulario porque
     puede haberse cambiado en la hoja del calendario. */
  const [entrePasosDefault, setEntrePasosDefault] = React.useState(0);
  React.useEffect(() => {
    if (!sheet) return;
    let vivo = true;
    getConfiguracionProduccion()
      .then((cfg) => {
        if (vivo) setEntrePasosDefault(cfg.tiempoEntrePasosMin);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [sheet]);
  React.useEffect(() => {
    const enfocarBusqueda = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", enfocarBusqueda);
    return () => window.removeEventListener("keydown", enfocarBusqueda);
  }, []);

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
      style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
    >
      <div className="page-head">
        <div className="title-block">
          <h1>Estaciones</h1>
          <div className="sub">Configurá las estaciones de tu taller: familias de pasos (rutean el tablero), máquinas, empleados y capacidad.</div>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setFeriadosOpen(true)}><CalendarOffIcon />Calendario del taller</button>
          <button type="button" className="btn btn-primary" onClick={() => { setNuevaEtapa(undefined); setSheet("new"); }}><PlusIcon />Nueva estación</button>
        </div>
      </div>

      {initialLoadWarning ? (
        <Alert variant="destructive">
          <AlertDescription>{initialLoadWarning} Actualizá la página para reintentar.</AlertDescription>
        </Alert>
      ) : null}

      <div className="est-toolbar">
        <div className="search">
          <SearchIcon />
          <input ref={searchRef} placeholder="Buscar por nombre o descripción…" value={query} onChange={(event) => setQuery(event.target.value)} />
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
          <div className="est-group-head"><span className="dot" style={{ background: cat.color }} /><h3>{cat.nm}</h3><span className="rule" /><span className="ct">{groupItems.length} {groupItems.length === 1 ? "estación" : "estaciones"}</span></div>
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
          entrePasosDefault={entrePasosDefault}
          saving={saving}
          error={error}
          onSave={(draft) => void handleSave(draft)}
          onCancel={() => { setSheet(null); setError(null); }}
          onDelete={(est) => setAEliminar(est)}
        />
      ) : null}

      {feriadosOpen ? <FeriadosSheet onClose={() => setFeriadosOpen(false)} /> : null}

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
