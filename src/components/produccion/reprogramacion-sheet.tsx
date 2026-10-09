"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { claveFechaEnZona, partesEnZona, sumarDiasAClave } from "@/lib/zona";
import {
  confirmarReprogramacion,
  simularReprogramacion,
  type RevisionReprogramacion,
  type SolicitudReprogramacion,
} from "@/lib/reprogramacion-api";
import { ActionButton } from "@/components/design-system/action-button";
import { FormSheet } from "@/components/design-system/form-sheet";
import { SelectField } from "@/components/design-system/select-field";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import s from "./reprogramacion-sheet.module.css";

const fecha = (valor: string | null, zona: string) =>
  valor
    ? valor.length === 10
      ? valor.split("-").reverse().join("/")
      : new Date(valor).toLocaleString("es-AR", {
          timeZone: zona,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
    : "Sin fecha";

const API = {
  simular: simularReprogramacion,
  confirmar: confirmarReprogramacion,
};

export function ReprogramacionSheet({
  pasoId,
  paso,
  trabajo,
  zona,
  inicio,
  entrega,
  tipo,
  onClose,
  onSaved,
  acciones = API,
}: {
  pasoId: string;
  paso: string;
  trabajo: string;
  zona: string;
  inicio: Date | null;
  entrega: string | null;
  tipo: SolicitudReprogramacion["tipo"];
  onClose: () => void;
  onSaved: () => void;
  acciones?: typeof API;
}) {
  const id = useId();
  const [ahora, setAhora] = useState(() => Date.now());
  const fechaInicial =
    inicio && inicio.getTime() > ahora
      ? inicio
      : new Date(Math.ceil((ahora + 60_000) / 60_000) * 60_000);
  const [dia, setDia] = useState(() =>
    tipo === "entrega" && entrega
      ? entrega
      : claveFechaEnZona(fechaInicial, zona),
  );
  const [hora, setHora] = useState(() => {
    const p = partesEnZona(fechaInicial, zona);
    return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
  });
  const [alcance, setAlcance] = useState<"paso" | "item">(
    tipo === "entrega" ? "item" : "paso",
  );
  const [motivo, setMotivo] = useState("");
  const [revision, setRevision] = useState<RevisionReprogramacion | null>(null);
  const [ocupado, setOcupado] = useState<"simular" | "confirmar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tituloRevision = useRef<HTMLHeadingElement>(null);
  const enCurso = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (revision) tituloRevision.current?.focus();
  }, [revision]);
  const vencida = !!revision && Date.parse(revision.venceEl) <= ahora;
  const editar = () => {
    setRevision(null);
    setError(null);
  };
  async function revisar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado("simular");
    setError(null);
    setRevision(null);
    try {
      setRevision(
        await acciones.simular(pasoId, {
          tipo,
          alcance,
          fecha: dia,
          ...(tipo === "produccion" ? { hora } : {}),
        }),
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "No pudimos revisar el cambio. Volvé a intentar.",
      );
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }
  async function guardar() {
    if (enCurso.current || !revision?.token || vencida) return;
    enCurso.current = true;
    setOcupado("confirmar");
    setError(null);
    try {
      await acciones.confirmar(
        pasoId,
        revision.token,
        motivo.trim() || undefined,
      );
      toast.success(
        tipo === "produccion"
          ? "Producción reprogramada"
          : "Entrega actualizada",
      );
      onSaved();
    } catch (e) {
      setRevision(null);
      setError(
        e instanceof ApiError
          ? e.message
          : "No pudimos confirmar el cambio. Revisá nuevamente la propuesta.",
      );
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }
  return (
    <FormSheet
      title={
        tipo === "produccion"
          ? "Reprogramar producción"
          : "Cambiar entrega comprometida"
      }
      description={`${trabajo} · ${paso}`}
      onClose={onClose}
      busy={!!ocupado}
      footer={
        <>
          <ActionButton
            variant="outline"
            onPress={onClose}
            isDisabled={!!ocupado}
          >
            Cancelar
          </ActionButton>
          {revision?.viable && !vencida ? (
            <ActionButton
              onPress={() => void guardar()}
              isDisabled={!!ocupado}
              isPending={ocupado === "confirmar"}
            >
              Confirmar cambio
            </ActionButton>
          ) : (
            <ActionButton
              type="submit"
              form={`${id}-form`}
              isDisabled={!!ocupado || !dia || (tipo === "produccion" && !hora)}
              isPending={ocupado === "simular"}
            >
              {vencida ? "Actualizar propuesta" : "Revisar impacto"}
            </ActionButton>
          )}
        </>
      }
    >
      <form
        id={`${id}-form`}
        className={s.content}
        onSubmit={(e) => {
          e.preventDefault();
          void revisar();
        }}
      >
        <div className={s.context}>
          <CalendarClock size={20} />
          <p>
            {tipo === "produccion"
              ? "Elegí desde cuándo querés producir. Te mostraremos el horario posible y los pasos afectados antes de guardar."
              : "Este cambio modifica la fecha acordada para el ítem o lote seleccionado."}
            <span>Horario del taller · {zona.replaceAll("_", " ")}</span>
          </p>
        </div>
        <FieldGroup>
          {tipo === "produccion" && (
            <Field>
              <FieldLabel id={`${id}-alcance`}>
                Qué querés reprogramar
              </FieldLabel>
              <SelectField
                aria-label="Qué querés reprogramar"
                value={alcance}
                disabled={!!ocupado}
                options={[
                  { value: "paso", label: "Sólo este paso y sus siguientes" },
                  { value: "item", label: "Todo el ítem o lote pendiente" },
                ]}
                onChange={(valor) => {
                  if (valor === "paso" || valor === "item") {
                    setAlcance(valor);
                    editar();
                  }
                }}
              />
              <FieldDescription>
                Los pasos ya iniciados conservan sus registros.
              </FieldDescription>
            </Field>
          )}
          <div className={s.fields}>
            <Field>
              <FieldLabel htmlFor={`${id}-fecha`}>
                {tipo === "produccion" ? "Fecha de inicio" : "Nueva entrega"}
              </FieldLabel>
              <Input
                id={`${id}-fecha`}
                type="date"
                required
                min={claveFechaEnZona(new Date(ahora), zona)}
                max={
                  tipo === "produccion"
                    ? sumarDiasAClave(
                        claveFechaEnZona(new Date(ahora), zona),
                        119,
                      )
                    : undefined
                }
                value={dia}
                disabled={!!ocupado}
                onChange={(e) => {
                  setDia(e.target.value);
                  editar();
                }}
              />
            </Field>
            {tipo === "produccion" && (
              <Field>
                <FieldLabel htmlFor={`${id}-hora`}>Hora de inicio</FieldLabel>
                <Input
                  id={`${id}-hora`}
                  type="time"
                  required
                  value={hora}
                  disabled={!!ocupado}
                  onChange={(e) => {
                    setHora(e.target.value);
                    editar();
                  }}
                />
              </Field>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-motivo`}>
              Motivo del cambio <span>(opcional)</span>
            </FieldLabel>
            <Textarea
              id={`${id}-motivo`}
              maxLength={500}
              value={motivo}
              disabled={!!ocupado}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: nueva fecha acordada con el cliente"
            />
          </Field>
        </FieldGroup>
        {error && (
          <Alert variant="destructive" role="alert">
            <TriangleAlert />
            <AlertTitle>No se guardó el cambio</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {revision && (
          <section
            className={s.revision}
            aria-label="Impacto de la reprogramación"
          >
            <h3 ref={tituloRevision} tabIndex={-1}>
              Revisá el cambio
            </h3>
            <p>
              {revision.alcance} · Solicitado:{" "}
              <strong>{fecha(revision.solicitado, revision.zona)}</strong>
            </p>
            {!!revision.motivos.length && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>No se puede confirmar esta propuesta</AlertTitle>
                <AlertDescription>
                  <ul>
                    {revision.motivos.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {revision.advertencias.map((a) => (
              <p key={a}>{a}</p>
            ))}
            {revision.pasos.length > 0 && (
              <details className={s.details} open>
                <summary>
                  {revision.pasos.length}{" "}
                  {revision.pasos.length === 1 ? "paso" : "pasos"} en la
                  propuesta
                </summary>
                <div>
                  {revision.pasos.map((p) => (
                    <article className={s.row} key={p.id}>
                      <small>
                        {p.orden} · {p.trabajo}
                      </small>
                      <strong>{p.paso}</strong>
                      <dl>
                        <dt>Antes</dt>
                        <dd>
                          {fecha(p.inicioActual, zona)} →{" "}
                          {fecha(p.finActual, zona)}
                        </dd>
                        <dt>Propuesto</dt>
                        <dd>
                          {fecha(p.inicioPropuesto, zona)} →{" "}
                          {fecha(p.finPropuesto, zona)}
                        </dd>
                      </dl>
                      {!p.seGuarda && (
                        <small>
                          Su estimación cambia por la carga del taller.
                        </small>
                      )}
                    </article>
                  ))}
                </div>
              </details>
            )}
            <details className={s.details} open>
              <summary>
                Entregas · {revision.entregas.filter((e) => e.enRiesgo).length}{" "}
                para revisar
              </summary>
              {revision.entregas.map((e) => (
                <article
                  key={e.id}
                  className={s.row}
                  data-risk={e.enRiesgo || undefined}
                >
                  <small>{e.orden}</small>
                  <strong>{e.trabajo}</strong>
                  <p>
                    Compromiso: {fecha(e.actual, zona)}
                    {e.actual !== e.propuesta && (
                      <>
                        {" "}
                        → <strong>{fecha(e.propuesta, zona)}</strong>
                      </>
                    )}
                  </p>
                  <p>Fin de producción: {fecha(e.finPropuesto, zona)}</p>
                  {e.enRiesgo && (
                    <strong className={s.risk}>
                      La entrega requiere revisión
                    </strong>
                  )}
                </article>
              ))}
            </details>
            <p>
              Entrega final de la OT:{" "}
              {fecha(revision.entregaOrden.actual, zona)}
              {revision.entregaOrden.actual !==
                revision.entregaOrden.propuesta && (
                <>
                  {" "}
                  →{" "}
                  <strong>
                    {fecha(revision.entregaOrden.propuesta, zona)}
                  </strong>
                </>
              )}
            </p>
            {vencida && (
              <Alert>
                <TriangleAlert />
                <AlertDescription>
                  La propuesta venció. Actualizala para comprobar la
                  disponibilidad antes de guardar.
                </AlertDescription>
              </Alert>
            )}
          </section>
        )}
      </form>
    </FormSheet>
  );
}
