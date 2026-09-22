"use client";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import * as React from "react";
import { Input, TextArea } from "@heroui/react";
import {
  CalendarDays,
  CogIcon,
  Cpu,
  InfoIcon,
  ListChecks,
  TrashIcon,
  UserRound,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { FormSheet } from "@/components/design-system/form-sheet";
import { CalendarioEditor, diasInvalidos } from "./calendario-editor";
import { HorarioEmpleadoDialog } from "./horario-empleado-dialog";
import { StationIcon, STATION_ICONS } from "./estaciones-iconos";
import { EstacionAsignaciones } from "./estacion-asignaciones";
import {
  EstacionAsignacionSelect,
  type OpcionAsignacion,
} from "./estacion-asignacion-select";
import {
  createEmptyEstacion,
  ETAPAS_ESTACION,
  etapaDeEstacion,
  type Estacion,
  type EstacionPayload,
  type FamiliaPasoCatalogo,
  etiquetaCalendario,
  type CalendarioEstacion,
} from "@/lib/estaciones";
import {
  actualizarConfiguracionProduccion,
  crearDiaNoLaborable,
  eliminarDiaNoLaborable,
  getConfiguracionProduccion,
  getDiasNoLaborables,
  type DiaNoLaborable,
} from "@/lib/estaciones-api";
import { CATEGORIAS_FAMILIA } from "@/lib/tablero-produccion";
import s2 from "./estaciones-panel.module.css";
import f from "./estacion-form.module.css";
const cx = (names: string) =>
  names
    .split(/\s+/)
    .map((name) => f[name])
    .filter(Boolean)
    .join(" ");
const iconEl = (icono: string | null | undefined) => (
  <StationIcon icono={icono} />
);
export type EmpleadoRef = import("@/lib/estaciones").EstacionEmpleadoRef;
export type MaquinaRef = { id: string; codigo: string; nombre: string };
function InfoTip({ text }: { text: string }) {
  return (
    <span
      className={s2.info}
      title={text}
      tabIndex={0}
      role="img"
      aria-label={text}
    >
      <InfoIcon size={13} aria-hidden />
    </span>
  );
}

// ── Form (sheet) ─────────────────────────────────────────────────────────

function Stepper({
  label,
  value,
  min,
  step,
  unit,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  unit?: string;
  help: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={cx("est-field")}>
      {label ? <label>{label}</label> : null}
      <div className={cx("est-stepper")}>
        <ActionButton
          variant="outline"
          type="button"
          onPress={() => onChange(Math.max(min, value - step))}
        >
          −
        </ActionButton>
        <Input
          aria-label={label}
          type="number"
          value={value}
          onChange={(event) =>
            onChange(
              Math.max(min, Number.parseInt(event.target.value, 10) || min),
            )
          }
        />
        {unit ? <span className={cx("unit")}>{unit}</span> : null}
        <ActionButton
          variant="outline"
          type="button"
          onPress={() => onChange(value + step)}
        >
          +
        </ActionButton>
      </div>
      <div className={cx("help")}>{help}</div>
    </div>
  );
}

// ── Feriados y cierres del taller (días no laborables, a nivel tenant) ───

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
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
export function FeriadosSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [dias, setDias] = React.useState<DiaNoLaborable[] | null>(null);
  const [fecha, setFecha] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [margen, setMargen] = React.useState<number | null>(null);
  const [corte, setCorte] = React.useState<string | null>(null);
  const [entrePasos, setEntrePasos] = React.useState<number | null>(null);
  const fechaRef = React.useRef<HTMLInputElement | null>(null);
  const configRef = React.useRef({
    margenEtaDias: 0,
    corteJornada: "20:00",
    tiempoEntrePasosMin: 0,
  });
  const guardadoRef = React.useRef<Promise<void>>(Promise.resolve());
  const versionRef = React.useRef(0);

  React.useEffect(() => {
    let vigente = true;
    getDiasNoLaborables()
      .then((lista) => {
        if (vigente) setDias(lista);
      })
      .catch(() => {
        if (vigente) setDias([]);
      });
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
        setError(
          "No se pudo cargar la configuración del taller. Cerrá y volvé a abrir para reintentar.",
        );
      });
    return () => {
      vigente = false;
    };
  }, []);

  const guardarConfiguracion = (patch: Partial<typeof configRef.current>) => {
    configRef.current = { ...configRef.current, ...patch };
    const snapshot = { ...configRef.current };
    const version = ++versionRef.current;
    guardadoRef.current = guardadoRef.current
      .catch(() => undefined)
      .then(async () => {
        await actualizarConfiguracionProduccion(snapshot);
        await onSaved();
      })
      .catch(async () => {
        if (version !== versionRef.current) return;
        setError(
          "No se pudo guardar la configuración. Se restauraron los últimos valores confirmados.",
        );
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
      const creado = await crearDiaNoLaborable({
        fecha,
        descripcion: descripcion || undefined,
      });
      setDias((current) =>
        [...(current ?? []), creado].sort((a, b) =>
          a.fecha.localeCompare(b.fecha),
        ),
      );
      setFecha("");
      setDescripcion("");
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo agregar la fecha.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (dia: DiaNoLaborable) => {
    setError(null);
    try {
      await eliminarDiaNoLaborable(dia.id);
      setDias((current) =>
        (current ?? []).filter((entry) => entry.id !== dia.id),
      );
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar la fecha.",
      );
    }
  };

  const hoy = new Date();
  const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return (
    <FormSheet
      className={f.sheet}
      title="Calendario del taller"
      description="Feriados, cierres y ajustes que alimentan la planificación y las fechas de entrega."
      onClose={onClose}
      footer={
        <ActionButton variant="outline" onPress={onClose}>
          Cerrar
        </ActionButton>
      }
    >
      <div className={cx("sheet-body est-form")}>
        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>01</span>
            <div>
              <div className={cx("ttl")}>Margen para prometer</div>
              <div className={cx("sub")}>
                Colchón sobre la fecha que el sistema estima en el cotizador.
              </div>
            </div>
          </div>
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
            <div className={cx("feriados-empty")}>Cargando…</div>
          )}
        </section>
        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>02</span>
            <div>
              <div className={cx("ttl")}>Tiempo entre pasos</div>
              <div className={cx("sub")}>
                Lo que cuesta llevar el material a la próxima estación y dejarlo
                listo. Cada estación puede declarar el suyo; esto es el valor por
                defecto.
              </div>
            </div>
          </div>
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
            <div className={cx("feriados-empty")}>Cargando…</div>
          )}
        </section>
        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>03</span>
            <div>
              <div className={cx("ttl")}>Corte de jornada</div>
              <div className={cx("sub")}>
                Hora a la que los cronómetros de pasos que quedaron corriendo se
                cierran solos (el tiempo no sigue sumando de noche ni el fin de
                semana).
              </div>
            </div>
          </div>
          {corte !== null ? (
            <div className={cx("feriados-add")} style={{ maxWidth: 220 }}>
              <Input
                className={cx("est-input")}
                type="time"
                value={corte}
                onChange={(event) => cambiarCorte(event.target.value)}
                aria-label="Hora de corte de jornada"
              />
            </div>
          ) : (
            <div className={cx("feriados-empty")}>Cargando…</div>
          )}
        </section>
        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>04</span>
            <div>
              <div className={cx("ttl")}>Feriados y cierres</div>
              <div className={cx("sub")}>
                Días en que el taller no trabaja: no aportan capacidad en ninguna
                proyección.
              </div>
            </div>
          </div>
          <div className={cx("feriados-add")}>
            <Input
              ref={fechaRef}
              className={cx("est-input")}
              type="date"
              value={fecha}
              onClick={() => fechaRef.current?.showPicker?.()}
              onChange={(event) => setFecha(event.target.value)}
              aria-label="Fecha no laborable"
            />
            <Input
              aria-label="Motivo del cierre"
              className={cx("est-input")}
              placeholder="Motivo (feriado, vacaciones…)"
              value={descripcion}
              maxLength={120}
              onChange={(event) => setDescripcion(event.target.value)}
            />
            <ActionButton
              variant="primary"
              type="button"
              isDisabled={!fecha || guardando}
              onPress={() => void agregar()}
            >
              {guardando ? "Agregando…" : "Agregar"}
            </ActionButton>
          </div>
          {error ? (
            <p className={f.error} role="alert">
              {error}
            </p>
          ) : null}

          {dias === null ? (
            <div className={cx("feriados-empty")}>Cargando…</div>
          ) : dias.length === 0 ? (
            <div className={cx("feriados-empty")}>
              Sin fechas cargadas: el taller opera según el calendario semanal de
              cada estación.
            </div>
          ) : (
            <div className={cx("feriados-list")}>
              {dias.map((dia) => (
                <div
                  key={dia.id}
                  className={cx(
                    `feriados-row ${dia.fecha < hoyClave ? "pasado" : ""}`,
                  )}
                >
                  <span className={cx("fecha")}>
                    {etiquetaFeriado(dia.fecha)}
                  </span>
                  <span className={cx("motivo")}>
                    {dia.descripcion || "Sin motivo"}
                  </span>
                  <ActionButton
                    variant="outline"
                    type="button"
                    className={cx("quitar")}
                    onPress={() => void quitar(dia)}
                    aria-label={`Quitar ${dia.fecha}`}
                  >
                    <TrashIcon />
                  </ActionButton>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </FormSheet>
  );
}

export function StationForm({
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
  const conEquipos = useCapacidad("equipos_produccion");
  const [draft, setDraft] = React.useState<EstacionPayload>(() =>
    initial
      ? {
          nombre: initial.nombre,
          descripcion: initial.descripcion,
          activo: initial.activo,
          etapa: initial.etapa,
          icono: initial.icono ?? "Tool",
          planificacionPorEmpleados: conEquipos || initial.planificacionPorEmpleados,
          tiempoPreparacionMin: initial.tiempoPreparacionMin,
          calendario: initial.calendario,
          familias:
            initial.pasosSinMaquina ??
            [
              ...new Set([
                ...initial.familias,
                ...(initial.reglas ?? [])
                  .filter((r) => r.tipo === "paso")
                  .map((r) => r.valor),
              ]),
            ].filter((c) => familias.some((f) => f.codigo === c)),
          empleadoIds: initial.empleados.map((entry) => entry.id),
          maquinaIds: initial.maquinas.map((entry) => entry.id),
          reglas: [],
        }
      : {
          ...createEmptyEstacion(),
          planificacionPorEmpleados: conEquipos,
          ...(etapaInicial ? { etapa: etapaInicial } : {}),
        },
  );
  const update = (patch: Partial<EstacionPayload>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const toggleLista = (
    key: "familias" | "empleadoIds" | "maquinaIds",
    val: string,
  ) => {
    if (key === "empleadoIds" && !conEquipos) return;
    setDraft((current) => {
      const next = new Set(current[key]);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return { ...current, [key]: [...next] };
    });
  };
  const [horarios, setHorarios] = React.useState<
    Record<string, CalendarioEstacion>
  >({});
  const [editandoHorario, setEditandoHorario] = React.useState<string | null>(
    null,
  );
  const horarioDe = (id: string) =>
    horarios[id] ??
    empleados.find((e) => e.id === id)?.calendario ??
    initial?.empleados.find((e) => e.id === id)?.calendario ??
    null;
  const faltaHorario = conEquipos && draft.empleadoIds.some(
    (id) => !horarioDe(id) || diasInvalidos(horarioDe(id)).length > 0,
  );
  const migrandoSinPersonas =
    conEquipos &&
    !!initial?.equipoProduccion &&
    !initial.planificacionPorEmpleados &&
    draft.empleadoIds.length === 0;
  const valid =
    !faltaHorario &&
    !migrandoSinPersonas &&
    draft.nombre.trim().length > 0 &&
    diasInvalidos(draft.calendario ?? null).length === 0;
  const etapa = etapaDeEstacion(draft.etapa);

  // El buscador conserva la disponibilidad; la lista inferior muestra lo elegido.
  const catLabel = new Map(CATEGORIAS_FAMILIA.map((cat) => [cat.key, cat.nm]));
  const nombreFamilia = (codigo: string) =>
    familias.find((f) => f.codigo === codigo)?.nombre ?? codigo;
  const opcionesFamilia: OpcionAsignacion[] = familias
    .filter((f) => f.visibleEnSelector && !draft.familias.includes(f.codigo))
    .map((f) => {
      const otra = f.estaciones.find((e) => e.id !== initial?.id);
      return {
        value: f.codigo,
        label: f.nombre,
        grupo: catLabel.get(f.categoria) ?? f.categoria,
        disabled: Boolean(otra),
        detalle: otra ? `Ya en “${otra.nombre}”` : null,
      };
    });

  // Recursos: mismo patrón de buscador y lista de asignaciones.
  const nombreMaquina = (id: string) =>
    maquinas.find((m) => m.id === id)?.nombre ??
    initial?.maquinas.find((m) => m.id === id)?.nombre ??
    id;
  const nombreEmpleado = (id: string) =>
    empleados.find((e) => e.id === id)?.nombreCompleto ?? initial?.empleados.find(e => e.id === id)?.nombreCompleto ?? id;

  const opcionesMaquina: OpcionAsignacion[] = maquinas
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
        detalle: enOtraDistinta
          ? `hoy en ${enOtraDistinta} · se mueve acá`
          : null,
      };
    });

  const opcionesEmpleado: OpcionAsignacion[] = empleados
    .filter((e) => !draft.empleadoIds.includes(e.id))
    .map((e) => ({
      value: e.id,
      label: e.nombreCompleto,
      grupo: e.sector || null,
    }));

  return (
    <FormSheet
      className={f.sheet}
      title={initial ? `Configurar ${initial.nombre}` : "Nueva estación"}
      description={`${etapa.nm} · ${etapa.desc}`}
      onClose={onCancel}
      busy={saving}
      footer={
        <>
          {initial && onDelete && (
            <ActionButton
              variant="outline"
              className={f.danger}
              onPress={() => onDelete(initial)}
              isDisabled={saving}
            >
              <TrashIcon />
              Eliminar
            </ActionButton>
          )}
          <span className={f.spacer} />
          <ActionButton
            variant="outline"
            onPress={onCancel}
            isDisabled={saving}
          >
            Cancelar
          </ActionButton>
          <ActionButton
            onPress={() =>
              onSave({
                ...draft,
                planificacionPorEmpleados: conEquipos || (initial?.planificacionPorEmpleados ?? false),
                horariosEmpleados: Object.entries(conEquipos ? horarios : {})
                  .filter(([id]) => draft.empleadoIds.includes(id))
                  .map(([empleadoId, calendario]) => ({
                    empleadoId,
                    calendario,
                  })),
              })
            }
            isDisabled={!valid || saving}
          >
            {saving
              ? "Guardando…"
              : initial
                ? "Guardar cambios"
                : "Crear estación"}
          </ActionButton>
        </>
      }
    >
      {error && (
        <p className={f.error} role="alert">
          {error}
        </p>
      )}
      <div className={cx("sheet-body est-form")}>
        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>01</span>
            <div>
              <div className={cx("ttl")}>Identidad</div>
              <div className={cx("sub")}>
                Nombre interno y la etapa productiva a la que pertenece.
              </div>
            </div>
          </div>
          <div className={cx("est-field")}>
            <label>
              Etapa <span className={cx("req")}>·</span>
            </label>
            <div className={cx("etapa-picker")}>
              {ETAPAS_ESTACION.map((entry) => (
                <ActionButton
                  variant="outline"
                  key={entry.key}
                  type="button"
                  aria-pressed={draft.etapa === entry.key}
                  className={cx(
                    `etapa-chip ${draft.etapa === entry.key ? "on" : ""}`,
                  )}
                  onPress={() => update({ etapa: entry.key })}
                >
                  <span className={cx("num")}>
                    {String(entry.order).padStart(2, "0")}
                  </span>
                  <span className={cx("nm")}>{entry.nm}</span>
                </ActionButton>
              ))}
            </div>
            <div className={cx("help")}>
              Fija por el sistema · ordena las estaciones en las vistas
              operativas.
            </div>
          </div>

          <div className={cx("est-grid-2")}>
            <div className={cx("est-field")}>
              <label>
                Nombre de la estación <span className={cx("req")}>·</span>
              </label>
              <Input
                aria-label="Nombre de la estación"
                className={cx("est-input")}
                value={draft.nombre}
                onChange={(event) => update({ nombre: event.target.value })}
                placeholder="Ej: Impresión digital"
                autoFocus
              />
            </div>
            <div className={cx("est-field")}>
              <label>Estado</label>
              <div className={cx("est-toggle")}>
                <ActionButton
                  variant="outline"
                  type="button"
                  aria-pressed={draft.activo}
                  onPress={() => update({ activo: true })}
                >
                  <span className={cx("dot ok")} />
                  Activa
                </ActionButton>
                <ActionButton
                  variant="outline"
                  type="button"
                  aria-pressed={!draft.activo}
                  onPress={() => update({ activo: false })}
                >
                  <span className={cx("dot off")} />
                  Inactiva
                </ActionButton>
              </div>
              <div className={cx("help")}>
                Inactiva: su trabajo cae a &quot;Sin estación&quot; en el
                tablero.
              </div>
            </div>
          </div>

          <div className={cx("est-field")}>
            <label>Descripción</label>
            <TextArea
              aria-label="Descripción"
              className={cx("est-input")}
              value={draft.descripcion ?? ""}
              onChange={(event) => update({ descripcion: event.target.value })}
              placeholder="Qué procesos ocurren en esta estación, observaciones."
              rows={2}
            />
          </div>

          <div className={cx("est-field")}>
            <label>Icono visual</label>
            <div className={cx("icon-picker")}>
              {STATION_ICONS.map((icon) => (
                <ActionButton
                  variant="outline"
                  key={icon.key}
                  type="button"
                  className={cx(
                    `icon-chip ${draft.icono === icon.key ? "on" : ""}`,
                  )}
                  onPress={() => update({ icono: icon.key })}
                  title={icon.nm}
                  aria-label={icon.nm}
                  aria-pressed={draft.icono === icon.key}
                >
                  {iconEl(icon.key)}
                </ActionButton>
              ))}
            </div>
          </div>
        </section>

        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>02</span>
            <div>
              <div className={cx("ttl")}>Pasos sin máquina</div>
              <div className={cx("sub")}>
                Elegí el trabajo que se realiza acá sin máquina, como diseño,
                embalaje o instalación. Los pasos de una máquina llegan
                automáticamente a la estación donde está asignada.
              </div>
            </div>
          </div>
          <EstacionAsignaciones
            titulo="Pasos asignados"
            icono={ListChecks}
            seleccionados={draft.familias.map((codigo) => ({
              id: codigo,
              nombre: nombreFamilia(codigo),
              detalle: catLabel.get(
                familias.find((familia) => familia.codigo === codigo)
                  ?.categoria ?? "",
              ),
            }))}
            vacio="Sin pasos manuales asignados. Buscá un paso arriba para agregarlo."
            onQuitar={(codigo) => toggleLista("familias", codigo)}
            disabled={saving}
          >
            <EstacionAsignacionSelect
              isDisabled={saving}
              value=""
              onChange={(valor) => valor && toggleLista("familias", valor)}
              opciones={opcionesFamilia}
              placeholder="Agregar paso sin máquina…"
              placeholderBusqueda="Buscar paso…"
              vacio="No quedan pasos sin máquina por agregar."
              ariaLabel="Agregar paso sin máquina"
            />
          </EstacionAsignaciones>
        </section>

        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>03</span>
            <div>
              <div className={cx("ttl")}>Recursos asignados</div>
              <div className={cx("sub")}>
                Los trabajos que usen estas máquinas se muestran acá
                automáticamente. Cada máquina conserva su nombre y su propia
                capacidad de producción.
              </div>
            </div>
          </div>
          <div className={s2.eje}>
            <div className={s2.ejeHead}>
              <label>
                Máquinas
                <InfoTip text="Una máquina pertenece a una sola estación. Elegir una que está en otra estación la mueve acá, junto con sus tareas pendientes." />
              </label>
            </div>
            <EstacionAsignaciones
              titulo="Máquinas asignadas"
              icono={Cpu}
              seleccionados={draft.maquinaIds.map((id) => ({
                id,
                nombre: nombreMaquina(id),
              }))}
              vacio="Sin máquinas asignadas. Esta estación recibe sólo los pasos sin máquina que elegiste."
              onQuitar={(id) => toggleLista("maquinaIds", id)}
              disabled={saving}
            >
              <EstacionAsignacionSelect
                isDisabled={saving}
                value=""
                onChange={(valor) => valor && toggleLista("maquinaIds", valor)}
                opciones={opcionesMaquina}
                placeholder="Agregar máquina…"
                placeholderBusqueda="Buscar máquina…"
                vacio={
                  maquinas.length === 0
                    ? "No hay máquinas en el sistema."
                    : "No quedan máquinas por agregar."
                }
                ariaLabel="Agregar máquina a la estación"
              />
            </EstacionAsignaciones>
          </div>

          <div className={s2.eje}>
            <div className={s2.ejeHead}>
              <label>
                Personal asignado
                <InfoTip text="Quiénes pueden operar en esta estación. Una persona puede estar habilitada en varias estaciones." />
              </label>
            </div>
            <p className={cx("help")}>
              La capacidad depende de las personas disponibles y de los
              operarios que necesita cada paso. El horario de cada persona se
              comparte entre todas sus estaciones. Para registrar trabajo siguen
              necesitando usuario vinculado y permiso de ejecución.
            </p>
            <EstacionAsignaciones
              titulo="Personal asignado"
              icono={UserRound}
              seleccionados={draft.empleadoIds.map((id) => ({
                id,
                nombre: nombreEmpleado(id),
                detalle:
                  etiquetaCalendario(horarioDe(id)) ??
                  (horarioDe(id)
                    ? "Sin disponibilidad semanal"
                    : "Horario pendiente"),
              }))}
              vacio="Agregá al personal que trabaja en esta estación y configurá sus horarios."
              acciones={(id) => (
                <ActionButton
                  variant="outline"
                  isIconOnly
                  isDisabled={saving || !conEquipos}
                  aria-label={`Horario de ${nombreEmpleado(id)}`}
                  onPress={() => setEditandoHorario(id)}
                >
                  <CalendarDays />
                </ActionButton>
              )}
              onQuitar={(id) => toggleLista("empleadoIds", id)}
              disabled={saving || !conEquipos}
            >
              <EstacionAsignacionSelect
                isDisabled={saving || !conEquipos}
                value=""
                onChange={(valor) => valor && toggleLista("empleadoIds", valor)}
                opciones={opcionesEmpleado}
                placeholder="Agregar personal…"
                placeholderBusqueda="Buscar personal…"
                vacio={
                  empleados.length === 0
                    ? "No hay personal registrado en el sistema."
                    : "No queda personal por agregar."
                }
                ariaLabel="Asignar personal a la estación"
              />
            </EstacionAsignaciones>
            {faltaHorario && (
              <p className={cx("help")}>
                Completá el horario de cada persona antes de guardar.
              </p>
            )}
            {!conEquipos && (
              <p className={cx("help")}>
                El plan no incluye la configuración de equipos. Se conserva el personal y los horarios existentes.
              </p>
            )}
            {conEquipos && initial?.equipoProduccion &&
              !initial.planificacionPorEmpleados && (
                <p className={cx("help")}>
                  Hasta guardar el personal y sus horarios, esta estación conserva la
                  capacidad anterior de {initial.equipoProduccion.nombre} (
                  {initial.equipoProduccion.personas} personas). Podés copiar
                  ese horario y adaptarlo a cada persona.
                </p>
              )}
          </div>
        </section>

        <section className={cx("est-section")}>
          <div className={cx("est-section-head")}>
            <span className={cx("num")}>04</span>
            <div>
              <div className={cx("ttl")}>Capacidad y planificación</div>
              <div className={cx("sub")}>
                Tiempo entre pasos y días de producción de la estación.
              </div>
            </div>
          </div>
          <div className={s2.capTop}>
            <div className={cx("est-field")}>
              <label>
                Tiempo entre pasos
                <InfoTip text="Separación después de cada paso para cambio de material o traslado. Reserva una persona y mantiene ocupado el recurso hasta finalizar. «Del taller» hereda el valor global; «Propio» le da uno distinto." />
              </label>
              <div className={`${f["est-toggle"]} ${s2.tiempoToggle}`}>
                <ActionButton
                  variant="outline"
                  type="button"
                  aria-pressed={draft.tiempoPreparacionMin == null}
                  onPress={() => update({ tiempoPreparacionMin: null })}
                >
                  Del taller · {entrePasosDefault} min
                </ActionButton>
                <ActionButton
                  variant="outline"
                  type="button"
                  aria-pressed={draft.tiempoPreparacionMin != null}
                  onPress={() =>
                    update({
                      tiempoPreparacionMin:
                        draft.tiempoPreparacionMin ?? entrePasosDefault,
                    })
                  }
                >
                  Propio
                </ActionButton>
              </div>
              {draft.tiempoPreparacionMin != null ? (
                <div className={`${f["est-stepper"]} ${s2.tiempoStepper}`}>
                  <ActionButton
                    variant="outline"
                    type="button"
                    onPress={() =>
                      update({
                        tiempoPreparacionMin: Math.max(
                          0,
                          (draft.tiempoPreparacionMin ?? 0) - 5,
                        ),
                      })
                    }
                  >
                    −
                  </ActionButton>
                  <Input
                    aria-label="Tiempo entre pasos propio"
                    type="number"
                    value={draft.tiempoPreparacionMin}
                    onChange={(event) =>
                      update({
                        tiempoPreparacionMin: Math.max(
                          0,
                          Number.parseInt(event.target.value, 10) || 0,
                        ),
                      })
                    }
                  />
                  <span className={cx("unit")}>min</span>
                  <ActionButton
                    variant="outline"
                    type="button"
                    onPress={() =>
                      update({
                        tiempoPreparacionMin:
                          (draft.tiempoPreparacionMin ?? 0) + 5,
                      })
                    }
                  >
                    +
                  </ActionButton>
                </div>
              ) : null}
            </div>
          </div>

          <CalendarioEditor
            value={draft.calendario ?? null}
            onChange={(calendario) => update({ calendario })}
            fuentes={estaciones.filter(
              (estacion) => estacion.id !== initial?.id && estacion.activo,
            )}
          />
        </section>

        {editandoHorario && (
          <HorarioEmpleadoDialog
            key={editandoHorario}
            nombre={nombreEmpleado(editandoHorario)}
            value={horarioDe(editandoHorario)}
            fuentes={[
              ...empleados
                .filter((e) => e.id !== editandoHorario && horarioDe(e.id))
                .map((e) => ({
                  id: e.id,
                  nombre: e.nombreCompleto,
                  calendario: horarioDe(e.id),
                })),
              ...(initial?.equipoProduccion?.calendario
                ? [
                    {
                      id: "horario-anterior",
                      nombre: "Horario del equipo anterior",
                      calendario: initial.equipoProduccion.calendario,
                    },
                  ]
                : []),
              ...(draft.calendario
                ? [
                    {
                      id: "horario-estacion",
                      nombre: "Horario de esta estación",
                      calendario: draft.calendario,
                    },
                  ]
                : []),
            ]}
            onClose={() => setEditandoHorario(null)}
            onApply={(calendario) => {
              setHorarios((prev) => ({
                ...prev,
                [editandoHorario]: calendario,
              }));
              setEditandoHorario(null);
            }}
          />
        )}
        <div className={cx("est-tip")}>
          <CogIcon />
          <span>
            Los pasos con máquina llegan a la estación de{" "}
            <strong>esa máquina</strong>. Para el resto, configurá los{" "}
            <strong>pasos sin máquina</strong>. El tiempo estimado proviene de
            la cotización.
          </span>
        </div>
      </div>
    </FormSheet>
  );
}
