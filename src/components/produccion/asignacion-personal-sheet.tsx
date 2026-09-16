"use client";

import { useEffect, useState } from "react";
import { Checkbox, Input, Label, TextArea } from "@heroui/react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Factory,
  Search,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { ActionButton } from "@/components/design-system/action-button";
import { FormSheet } from "@/components/design-system/form-sheet";
import {
  getContextoAsignacionPersonal,
  simularAsignacionPersonal,
  type ContextoAsignacionPersonal,
  type ImpactoPasoAsignacion,
  type RevisionAsignacionPersonal,
} from "@/lib/asignacion-personal-api";
import s from "./asignacion-personal-sheet.module.css";

export function tiempoAsignacion(minutos: number | null, cambio = false) {
  if (minutos === null) return "Sin estimación comparable";
  if (minutos === 0) return cambio ? "Sin cambio de horario" : "En horario";
  const n = Math.abs(minutos),
    dias = Math.floor(n / 1440),
    horas = Math.floor((n % 1440) / 60),
    min = n % 60;
  const tiempo = [
    dias && `${dias} d`,
    horas && `${horas} h`,
    min && `${min} min`,
  ]
    .filter(Boolean)
    .join(" ");
  return cambio
    ? `${minutos > 0 ? "+" : "−"}${tiempo}`
    : `${minutos > 0 ? "Demorado" : "Adelantado"} ${tiempo}`;
}

function fecha(value: string | null, zona: string) {
  return value
    ? new Date(value).toLocaleString("es-AR", {
        timeZone: zona,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "Sin estimar";
}

function ComparacionPaso({
  paso,
  zona,
}: {
  paso: ImpactoPasoAsignacion;
  zona: string;
}) {
  return (
    <div className={s.comparacion}>
      <div className={s.fechas}>
        <div>
          <span>Previsto</span>
          <strong>{fecha(paso.previsto, zona)}</strong>
        </div>
        <div>
          <span>Estimado actual</span>
          <strong>{fecha(paso.actual, zona)}</strong>
        </div>
        <div>
          <span>Con esta asignación</span>
          <strong>{fecha(paso.propuesto, zona)}</strong>
        </div>
      </div>
      <div className={s.cumplimiento}>
        <div>
          <span>Cumplimiento proyectado</span>
          <strong data-delay={(paso.desvioPropuestoMin ?? 0) > 0 || undefined}>
            {tiempoAsignacion(paso.desvioPropuestoMin)}
          </strong>
        </div>
        <div>
          <span>Efecto de este cambio</span>
          <strong data-delay={(paso.diferenciaMin ?? 0) > 0 || undefined}>
            {tiempoAsignacion(paso.diferenciaMin, true)}
          </strong>
        </div>
      </div>
    </div>
  );
}

export function AsignacionPersonalSheet({
  pasoId,
  onClose,
  onConfirmar,
}: {
  pasoId: string;
  onClose: () => void;
  onConfirmar: (
    pasoId: string,
    token: string,
    motivo?: string,
  ) => Promise<void>;
}) {
  const [contexto, setContexto] = useState<ContextoAsignacionPersonal | null>(
    null,
  );
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [revision, setRevision] = useState<RevisionAsignacionPersonal | null>(
    null,
  );
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"simular" | "confirmar" | null>(null);
  const [intento, setIntento] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    getContextoAsignacionPersonal(pasoId, controller.signal)
      .then((datos) => {
        if (controller.signal.aborted) return;
        setContexto(datos);
        setSeleccion((actual) =>
          (intento === 0 ? datos.seleccionActual : actual).filter((id) =>
            datos.candidatos.some((c) => c.id === id && c.tieneHorario),
          ),
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el personal.",
          );
      });
    return () => controller.abort();
  }, [pasoId, intento]);
  useEffect(() => {
    if (!revision) return;
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [revision]);
  const vencida = !!revision && ahora >= Date.parse(revision.venceEl);
  const busy = !!ocupado;
  const seleccionValida =
    !!contexto && seleccion.length === contexto.personasNecesarias;
  const actualizarAnteConflicto = (err: unknown) => {
    if (err instanceof ApiError && [400, 404, 409].includes(err.status)) {
      setContexto(null);
      setIntento((n) => n + 1);
    }
  };
  const revisar = async () => {
    setError(null);
    setRevision(null);
    setOcupado("simular");
    try {
      setRevision(await simularAsignacionPersonal(pasoId, seleccion));
      setAhora(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo simular la asignación.",
      );
      actualizarAnteConflicto(err);
    } finally {
      setOcupado(null);
    }
  };
  const confirmar = async () => {
    if (!revision?.token || vencida) return;
    setError(null);
    setOcupado("confirmar");
    try {
      await onConfirmar(pasoId, revision.token, motivo.trim() || undefined);
      toast.success("Personal asignado. La planificación fue actualizada.");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la asignación.",
      );
      setRevision(null);
      actualizarAnteConflicto(err);
    } finally {
      setOcupado(null);
    }
  };
  return (
    <FormSheet
      title="Asignar personal"
      description="Revisá la disponibilidad y el impacto antes de confirmar el cambio."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <ActionButton variant="outline" onPress={onClose} isDisabled={busy}>
            Cancelar
          </ActionButton>
          {revision?.viable && !vencida ? (
            <ActionButton onPress={() => void confirmar()} isDisabled={busy}>
              <Check />
              {ocupado === "confirmar" ? "Guardando…" : "Confirmar asignación"}
            </ActionButton>
          ) : (
            <ActionButton
              onPress={() => void revisar()}
              isDisabled={busy || !seleccionValida}
            >
              <CalendarClock />
              {ocupado === "simular"
                ? "Calculando…"
                : vencida
                  ? "Actualizar impacto"
                  : "Revisar impacto"}
            </ActionButton>
          )}
        </>
      }
    >
      <div className={s.content}>
        {error && (
          <div className={s.error} role="alert">
            <TriangleAlert size={17} />
            <span>{error}</span>
            {!contexto && (
              <ActionButton
                variant="outline"
                onPress={() => {
                  setError(null);
                  setIntento((n) => n + 1);
                }}
              >
                Reintentar
              </ActionButton>
            )}
          </div>
        )}
        {!contexto && !error && (
          <p role="status">Cargando personal de la estación…</p>
        )}
        {contexto && (
          <>
            <div className={s.trabajo}>
              <span>
                {contexto.orden} · {contexto.trabajo}
              </span>
              <h3>{contexto.paso}</h3>
              <span>
                <Factory size={14} />
                {contexto.estacion}
              </span>
            </div>
            <section className={s.section} aria-label="Seleccionar personal">
              <div className={s.heading}>
                <UsersRound size={17} />
                <h3>Personal habilitado</h3>
                <span>
                  {seleccion.length} / {contexto.personasNecesarias}
                </span>
              </div>
              <p>
                Elegí{" "}
                {contexto.personasNecesarias === 1
                  ? "una persona"
                  : `${contexto.personasNecesarias} personas`}{" "}
                para atender este paso. La misma dotación se conserva hasta
                terminarlo, respetando sus horarios.
              </p>
              {contexto.candidatos.length > 5 && (
                <div className={s.search}>
                  <Search size={15} />
                  <Input
                    aria-label="Buscar personal"
                    placeholder="Buscar por nombre…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              )}
              <div className={s.candidatos}>
                {contexto.candidatos
                  .filter((c) =>
                    c.nombre
                      .toLocaleLowerCase()
                      .includes(busqueda.trim().toLocaleLowerCase()),
                  )
                  .map((c) => (
                    <Checkbox
                      key={c.id}
                      isSelected={seleccion.includes(c.id)}
                      isDisabled={busy || !c.tieneHorario}
                      className={s.persona}
                      onChange={(selected) => {
                        setSeleccion((actual) =>
                          selected
                            ? [...actual, c.id]
                            : actual.filter((id) => id !== c.id),
                        );
                        setRevision(null);
                        setError(null);
                      }}
                    >
                      <Checkbox.Content className={s.personaContent}>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <UserRound size={16} />
                        <Label>
                          {c.nombre}
                          {!c.tieneHorario && (
                            <small>Sin horario configurado</small>
                          )}
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                {!contexto.candidatos.length && (
                  <p>
                    La estación no tiene personal activo asignado. Configuralo
                    desde Estaciones.
                  </p>
                )}
              </div>
              {seleccion.length > contexto.personasNecesarias && (
                <p className={s.warning}>
                  Seleccionaste más personas de las que requiere este paso.
                </p>
              )}
            </section>
            {revision && (
              <section
                className={s.section}
                aria-label="Impacto de la asignación"
                aria-live="polite"
              >
                <div className={s.heading}>
                  <CalendarClock size={17} />
                  <h3>Impacto en la planificación</h3>
                </div>
                <ComparacionPaso paso={revision.paso} zona={revision.zona} />
                <p>
                  Previsto conserva su fecha. Las diferencias se expresan en
                  tiempo calendario.
                </p>
                {revision.advertencias.map((a) => (
                  <p key={a} className={s.warning}>
                    {a}
                  </p>
                ))}
                {!!revision.motivos.length && (
                  <div role="alert" className={s.error}>
                    <TriangleAlert size={17} />
                    <div>
                      <strong>No se puede confirmar esta asignación</strong>
                      <ul>
                        {revision.motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <details
                  className={s.details}
                  open={revision.afectados.some(
                    (p) => (p.diferenciaMin ?? 0) > 0 || !p.propuesto,
                  )}
                >
                  <summary>
                    Otros pasos afectados{" "}
                    <span>{revision.afectados.length}</span>
                  </summary>
                  {!revision.afectados.length && (
                    <p>La proyección de los demás pasos se mantiene.</p>
                  )}
                  <div className={s.afectados}>
                    {revision.afectados.map((p) => (
                      <div key={p.pasoId} className={s.afectado}>
                        <small>
                          {p.orden} · {p.trabajo}
                        </small>
                        <strong>{p.paso}</strong>
                        <span>
                          {fecha(p.actual, revision.zona)}{" "}
                          <ArrowRight size={13} />{" "}
                          {fecha(p.propuesto, revision.zona)}
                        </span>
                        <span
                          data-delay={(p.diferenciaMin ?? 0) > 0 || undefined}
                        >
                          {tiempoAsignacion(p.diferenciaMin, true)}
                        </span>
                        <small>
                          {p.personalActual.join(", ") || "Sin asignar"} →{" "}
                          {p.personalPropuesto.join(", ") || "Sin asignar"}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
                {!!revision.entregas.length && (
                  <details
                    className={s.details}
                    open={revision.entregas.some((e) => e.enRiesgo)}
                  >
                    <summary>
                      Finalización de trabajos{" "}
                      <span>{revision.entregas.length}</span>
                    </summary>
                    <div className={s.afectados}>
                      {revision.entregas.map((e) => (
                        <div className={s.afectado} key={e.itemId}>
                          <strong>
                            {e.orden} · {e.trabajo}
                          </strong>
                          <span>
                            {fecha(e.actual, revision.zona)}{" "}
                            <ArrowRight size={13} />{" "}
                            {fecha(e.propuesto, revision.zona)}
                          </span>
                          <small>
                            Entrega comprometida:{" "}
                            {e.entrega
                              ? e.entrega.split("-").reverse().join("/")
                              : "Sin fecha"}
                            {e.enRiesgo ? " · En riesgo" : ""}
                          </small>
                          <small>
                            Entrega sugerida con el margen del taller:{" "}
                            {e.entregaSugerida
                              ? e.entregaSugerida.split("-").reverse().join("/")
                              : "Sin estimar"}
                          </small>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <label className={s.motivo}>
                  Motivo del cambio <span>Opcional</span>
                  <TextArea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    disabled={busy}
                    placeholder="Ej.: cambio de disponibilidad"
                  />
                </label>
                <p className={vencida ? s.warning : s.nota}>
                  {vencida
                    ? "La propuesta venció. Actualizá el impacto para confirmar."
                    : "Al confirmar se vuelven a comprobar los horarios y los trabajos del taller."}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </FormSheet>
  );
}
