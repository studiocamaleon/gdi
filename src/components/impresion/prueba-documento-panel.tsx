"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Activity, Download, Printer } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { ImpresoraPuesto } from "@/lib/impresora-puesto";
import {
  escucharImpresora,
  imprimirPruebaDocumento,
  type EscuchaImpresora,
} from "@/lib/qz-impresion";
import { eventoImpresora, type EventoImpresora } from "@/lib/qz-eventos";
import s from "./impresion.module.css";

export function PruebaDocumentoPanel({
  tenantId,
  config,
  disabled,
  onOcupado,
}: {
  tenantId: string;
  config: ImpresoraPuesto;
  disabled: boolean;
  onOcupado: (value: boolean) => void;
}) {
  const id = useId();
  const [faz, setFaz] = useState("simple");
  const [copias, setCopias] = useState("1");
  const [ocupado, setOcupado] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [eventos, setEventos] = useState<EventoImpresora[]>([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const escucha = useRef<EscuchaImpresora | null>(null);
  const trabajos = useRef(new Set<string>());
  const operando = useRef(false);
  const generacion = useRef(0);
  const numeroCopias = Number(copias);
  const validas =
    Number.isInteger(numeroCopias) && numeroCopias >= 1 && numeroCopias <= 3;
  const bloqueado = disabled || ocupado || !config.impresora;
  useEffect(
    () => () => {
      generacion.current++;
      escucha.current?.cerrar();
      escucha.current = null;
    },
    [],
  );

  async function asegurarEscucha() {
    if (escucha.current) return escucha.current;
    const turno = generacion.current;
    const nueva = await escucharImpresora(
      tenantId,
      config,
      (dato) => {
        if (turno !== generacion.current) return;
        const evento = eventoImpresora(
          dato,
          config.impresora,
          trabajos.current,
        );
        if (evento) setEventos((prev) => [evento, ...prev].slice(0, 100));
      },
      () => {
        if (turno !== generacion.current) return;
        escucha.current = null;
        setConectado(false);
        setError(
          "Se perdió la conexión con QZ. El último evento no confirma el estado actual. Volvé a conectar para consultar la impresora.",
        );
      },
    );
    if (turno !== generacion.current) {
      nueva.cerrar();
      throw new Error("La prueba se cerró.");
    }
    escucha.current = nueva;
    setConectado(true);
    return nueva;
  }
  async function ejecutar(accion: () => Promise<void>) {
    if (operando.current) return;
    const turno = generacion.current;
    operando.current = true;
    setOcupado(true);
    onOcupado(true);
    setError("");
    setMensaje("");
    try {
      await accion();
    } catch (e) {
      if (turno === generacion.current)
        setError(
          e instanceof Error ? e.message : "No se pudo completar la prueba.",
        );
    } finally {
      operando.current = false;
      if (turno === generacion.current) {
        setOcupado(false);
        onOcupado(false);
      }
    }
  }
  function imprimir() {
    if (!validas) return;
    const turno = generacion.current;
    void ejecutar(async () => {
      await asegurarEscucha();
      await imprimirPruebaDocumento(
        tenantId,
        config,
        numeroCopias,
        faz === "doble",
        (nombre) => trabajos.current.add(nombre),
      );
      if (turno === generacion.current)
        setMensaje(
          "Prueba enviada. Revisá las hojas y los eventos de la cola.",
        );
    });
  }
  function descargar() {
    const contenido = {
      impresora: config.impresora,
      host: config.host,
      generado: new Date().toISOString(),
      eventos: [...eventos].reverse(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(contenido, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "grafo-prueba-impresora.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className={s.setup} aria-label="Prueba de documentos A4">
      <div className={s.sectionTitle}>
        <Printer aria-hidden="true" />
        <div>
          <strong>Prueba de documentos A4</strong>
          <p>Dos páginas numeradas, en blanco y negro.</p>
        </div>
      </div>
      <p className={s.help}>
        {config.impresora || "Guardá primero la impresora de documentos."}
      </p>
      <FieldGroup className={s.testFields}>
        <Field>
          <FieldLabel htmlFor={`${id}-faz`}>Faz</FieldLabel>
          <SelectField
            id={`${id}-faz`}
            aria-label="Faz de la prueba"
            value={faz}
            onChange={setFaz}
            disabled={bloqueado}
            options={[
              { value: "simple", label: "Simple faz" },
              { value: "doble", label: "Doble faz · borde largo" },
            ]}
          />
        </Field>
        <Field data-invalid={!validas || undefined}>
          <FieldLabel htmlFor={`${id}-copias`}>Copias</FieldLabel>
          <Input
            id={`${id}-copias`}
            aria-invalid={!validas}
            type="number"
            min={1}
            max={3}
            step={1}
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            disabled={bloqueado}
          />
        </Field>
      </FieldGroup>
      <p className={s.help}>
        {validas
          ? `Resultado esperado: ${numeroCopias * (faz === "doble" ? 1 : 2)} hoja${numeroCopias * (faz === "doble" ? 1 : 2) === 1 ? "" : "s"}. ${faz === "doble" ? "Páginas 1 y 2 en frente y dorso, derechas como un libro." : "Una página por hoja."}`
          : "Ingresá entre 1 y 3 copias."}{" "}
        Esta prueba no genera una OT ni cargos.
      </p>
      <div className={s.testActions}>
        <ActionButton isDisabled={bloqueado || !validas} onPress={imprimir}>
          <Printer data-icon="inline-start" />
          {ocupado ? "Procesando…" : "Imprimir prueba A4"}
        </ActionButton>
        <ActionButton
          variant="outline"
          isDisabled={bloqueado}
          onPress={() =>
            void ejecutar(async () => {
              if (escucha.current) await escucha.current.consultar();
              else await asegurarEscucha();
            })
          }
        >
          <Activity data-icon="inline-start" />
          {conectado ? "Consultar estado" : "Escuchar impresora"}
        </ActionButton>
        {conectado && (
          <ActionButton
            variant="ghost"
            isDisabled={ocupado}
            onPress={() => {
              escucha.current?.cerrar();
              escucha.current = null;
              setConectado(false);
            }}
          >
            Detener escucha
          </ActionButton>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {mensaje && (
        <p role="status" className={s.help}>
          {mensaje}
        </p>
      )}
      <div className={s.selected}>
        <strong>Eventos de la impresora</strong>
        <span className={s.help}>
          {conectado ? "Escucha activa" : "Escucha detenida"}
        </span>
      </div>
      <p className={s.help}>
        Se muestran los últimos 100 eventos de esta sesión. La escucha termina
        al salir de esta pantalla. «Finalizado según la cola» no garantiza que
        todas las hojas hayan salido.
      </p>
      <div
        className={s.eventLog}
        role="log"
        aria-label="Eventos de impresión"
        aria-live="polite"
      >
        {!eventos.length && (
          <p className={s.help}>
            {conectado
              ? "Sin eventos recibidos todavía. La información disponible depende del controlador."
              : "Conectá la escucha para ver los avisos que informa Windows."}
          </p>
        )}
        {eventos.map((evento, indice) => (
          <div
            className={s.eventRow}
            key={`${evento.hora}-${indice}`}
            data-severity={evento.severidad}
          >
            <time className={s.help} dateTime={evento.hora}>
              {new Date(evento.hora).toLocaleTimeString("es-AR")}
            </time>
            <div>
              <strong>{evento.detalle}</strong>
              <p className={s.help}>
                {evento.tipo === "JOB" ? evento.jobName : "Impresora"} ·{" "}
                {evento.estado}
              </p>
            </div>
          </div>
        ))}
      </div>
      <ActionButton
        variant="outline"
        isDisabled={!eventos.length}
        onPress={descargar}
      >
        <Download data-icon="inline-start" />
        Descargar eventos
      </ActionButton>
    </section>
  );
}
