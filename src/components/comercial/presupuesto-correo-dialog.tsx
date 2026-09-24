"use client";

import * as React from "react";
import { Input, TextArea } from "@heroui/react";
import { FileText, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { useCapacidad } from "@/components/navigation/capacidades-provider";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  enviarCorreoPresupuesto,
  enviarPresupuesto,
  prepararCorreoPresupuesto,
  previsualizarCorreoPresupuesto,
  historialCorreosPresupuesto,
  reintentarCorreoPresupuesto,
  type CorreoPresupuestoPreparacion,
  type CorreoPresupuestoEnvio,
} from "@/lib/presupuestos-api";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./presupuesto-correo-dialog.module.css";

export type CanalPresupuesto = "correo" | "whatsapp" | "ambos";
const canales = [
  { value: "correo", label: "Correo electrónico · PDF y enlace" },
  { value: "whatsapp", label: "WhatsApp · enlace" },
  { value: "ambos", label: "Correo electrónico y WhatsApp" },
];

export function ElegirCanalPresupuesto({
  onCerrar,
  onEmitir,
  trabajando,
}: {
  onCerrar: () => void;
  onEmitir: (canal: CanalPresupuesto) => void;
  trabajando: boolean;
}) {
  const [canal, setCanal] = React.useState<CanalPresupuesto>("whatsapp");
  const conPdf = useCapacidad("documentos_pdf");
  const conEnlace = useCapacidad("aprobacion_presupuestos");
  const conCorreo = conPdf && conEnlace;
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
      isDismissable={!trabajando}
      title="Emitir presupuesto"
      description="Elegí cómo querés compartirlo con el cliente."
    >
      <div className={s.body}>
        <SelectField
          aria-label="Canal de envío"
          value={canal}
          onChange={(v) => setCanal(v as CanalPresupuesto)}
          options={canales.map((c) => ({
            ...c,
            disabled: c.value !== "whatsapp" && !conCorreo,
          }))}
          disabled={trabajando}
        />
        <p className={s.hint}>
          {canal === "whatsapp"
            ? "Se utilizará la notificación de WhatsApp configurada por tu empresa."
            : "Primero guardaremos el presupuesto. Después podrás revisar el destinatario y editar el correo antes de enviarlo."}
        </p>
      </div>
      <footer className={s.footer}>
        <ActionButton
          variant="outline"
          isDisabled={trabajando}
          onPress={onCerrar}
        >
          Volver
        </ActionButton>
        <ActionButton isDisabled={trabajando} onPress={() => onEmitir(canal)}>
          {trabajando
            ? "Emitiendo…"
            : canal === "whatsapp"
              ? "Emitir presupuesto"
              : "Emitir y preparar correo"}
        </ActionButton>
      </footer>
    </FormDialog>
  );
}

export function PresupuestoCorreoDialog({
  id,
  canalInicial = "correo",
  onCerrar,
  onEnviado,
}: {
  id: string;
  canalInicial?: CanalPresupuesto;
  onCerrar: () => void;
  onEnviado: () => void;
}) {
  const puedeEnviar = usePuede("comercial.gestionar");
  const conPresupuestos = useCapacidad("presupuestos");
  const conPdf = useCapacidad("documentos_pdf");
  const conEnlace = useCapacidad("aprobacion_presupuestos");
  const conCorreo = conPdf && conEnlace;
  const [canal, setCanal] = React.useState<CanalPresupuesto>(
    conCorreo ? canalInicial : "whatsapp",
  );
  const [datos, setDatos] = React.useState<CorreoPresupuestoPreparacion | null>(
    null,
  );
  const [para, setPara] = React.useState("");
  const [asunto, setAsunto] = React.useState("");
  const [mensaje, setMensaje] = React.useState("");
  const [error, setError] = React.useState("");
  const [trabajando, setTrabajando] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);
  const enviando = React.useRef(false);
  const intento = React.useRef<{ firma: string; id: string } | null>(null);
  const form = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (!conCorreo) return;
    let activo = true;
    prepararCorreoPresupuesto(id)
      .then((d) => {
        if (!activo) return;
        setDatos(d);
        setPara(d.para);
        setAsunto(d.asunto);
        setMensaje(d.mensaje);
      })
      .catch((e) => {
        if (activo)
          setError(
            e instanceof Error ? e.message : "No se pudo preparar el correo.",
          );
      });
    return () => {
      activo = false;
    };
  }, [id, conCorreo]);
  const payload = () => {
    const firma = JSON.stringify([
      id,
      para.trim(),
      asunto.trim(),
      mensaje.trim(),
    ]);
    if (intento.current?.firma !== firma)
      intento.current = { firma, id: crypto.randomUUID() };
    return {
      idempotencia: intento.current.id,
      para: para.trim(),
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
    };
  };
  const enviar = async () => {
    if (enviando.current || !puedeEnviar || !conPresupuestos) return;
    enviando.current = true;
    setTrabajando(true);
    setError("");
    try {
      if (canal !== "whatsapp") {
        await enviarCorreoPresupuesto(id, payload());
        if (canal === "ambos") {
          try {
            await enviarPresupuesto(id);
          } catch {
            toast.warning(
              "El correo quedó en cola. No se pudo solicitar WhatsApp; podés reintentar sólo ese canal.",
            );
          }
        }
        toast.success(
          "Correo en cola. Grafo enviará el PDF y el enlace; podés seguir el estado en esta ficha.",
        );
      } else {
        const resultado = await enviarPresupuesto(id);
        if (resultado.estado === "pendiente_aprobacion")
          toast.info(
            "El presupuesto requiere aprobación interna antes de enviarse.",
          );
        else
          toast.success(
            "Envío solicitado según la configuración de WhatsApp de tu empresa.",
          );
      }
      onEnviado();
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
      onEnviado();
    } finally {
      enviando.current = false;
      setTrabajando(false);
    }
  };
  const previsualizar = async () => {
    if (!form.current?.reportValidity()) return;
    setTrabajando(true);
    setError("");
    try {
      setHtml((await previsualizarCorreoPresupuesto(id, payload())).html);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo obtener la vista previa.",
      );
    } finally {
      setTrabajando(false);
    }
  };
  const bloqueado =
    !puedeEnviar ||
    !conPresupuestos ||
    (canal !== "whatsapp" && (!datos?.disponible || !datos.responderA));
  return (
    <FormDialog
      isOpen
      isDismissable={!trabajando}
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
      title={
        <span className={s.title}>
          <Mail size={18} aria-hidden /> Enviar presupuesto
        </span>
      }
      description="PDF adjunto y aprobación en línea. Las respuestas llegan a tu empresa."
    >
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <div className={s.body}>
          <SelectField
            aria-label="Canal de envío"
            value={canal}
            onChange={(v) => {
              setCanal(v as CanalPresupuesto);
              setHtml(null);
            }}
            disabled={trabajando}
            options={canales.map((c) => ({
              ...c,
              disabled: c.value !== "whatsapp" && !conCorreo,
            }))}
          />
          {canal === "whatsapp" ? (
            <p className={s.hint}>
              Se utilizará la notificación configurada para WhatsApp y el enlace
              de este presupuesto.
            </p>
          ) : (
            <>
              {!datos ? (
                !error && <p className={s.hint}>Preparando mensaje…</p>
              ) : (
                <>
                  <p className={s.hint}>
                    De: {datos.remitente}
                    <br />
                    Respuestas a:{" "}
                    <strong>{datos.responderA || "Sin configurar"}</strong>
                  </p>
                  {!datos.disponible && (
                    <p role="alert" className={s.error}>
                      El servicio de correo todavía no está configurado.
                    </p>
                  )}
                  {!datos.responderA && (
                    <p role="alert" className={s.error}>
                      Configurá el correo comercial en Configuración de
                      presupuestos o en los datos de tu empresa.
                    </p>
                  )}
                  {html ? (
                    <iframe
                      title="Vista previa del correo"
                      sandbox=""
                      srcDoc={html}
                      className={s.preview}
                    />
                  ) : (
                    <>
                      <label className={s.field}>
                        Para
                        <Input
                          type="email"
                          required
                          maxLength={254}
                          value={para}
                          onChange={(e) => setPara(e.target.value)}
                          className={focus.singleBorder}
                          disabled={trabajando}
                        />
                      </label>
                      {datos.contactos.length > 0 && (
                        <SelectField
                          aria-label="Usar correo de un contacto"
                          value=""
                          options={[
                            { value: "", label: "Usar correo de un contacto…" },
                            ...datos.contactos.map((c) => ({
                              value: c.email,
                              label: `${c.nombre} · ${c.email}`,
                            })),
                          ]}
                          onChange={(v) => {
                            if (v) setPara(v);
                          }}
                          disabled={trabajando}
                        />
                      )}
                      <label className={s.field}>
                        Asunto
                        <Input
                          required
                          maxLength={200}
                          value={asunto}
                          onChange={(e) => setAsunto(e.target.value)}
                          className={focus.singleBorder}
                          disabled={trabajando}
                        />
                      </label>
                      <label className={s.field}>
                        Mensaje
                        <TextArea
                          required
                          maxLength={8000}
                          rows={7}
                          value={mensaje}
                          onChange={(e) => setMensaje(e.target.value)}
                          className={focus.singleBorder}
                          disabled={trabajando}
                        />
                      </label>
                    </>
                  )}
                  <div className={s.attachment}>
                    <FileText size={18} aria-hidden />
                    <div>
                      <strong>{datos.numero}.pdf</strong>
                      <span>
                        Se adjunta siempre · Incluye botón «Ver y aprobar
                        presupuesto» en el correo.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
        </div>
        <footer className={s.footer}>
          {canal !== "whatsapp" && (
            <ActionButton
              variant="outline"
              isDisabled={trabajando || !datos}
              onPress={() => (html ? setHtml(null) : void previsualizar())}
            >
              {html ? "Editar mensaje" : "Vista previa"}
            </ActionButton>
          )}
          <ActionButton
            variant="outline"
            isDisabled={trabajando}
            onPress={onCerrar}
          >
            Cancelar
          </ActionButton>
          <ActionButton type="submit" isDisabled={trabajando || bloqueado}>
            <Send size={15} aria-hidden />
            {trabajando ? "Procesando…" : "Enviar"}
          </ActionButton>
        </footer>
      </form>
    </FormDialog>
  );
}

const estados = {
  PENDIENTE: "Preparando PDF y envío",
  ENVIANDO: "Enviando correo",
  ENVIADO: "Enviado",
  FALLIDO: "Requiere atención",
};
export function HistorialCorreosPresupuesto({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const puedeGestionar = usePuede("comercial.gestionar");
  const conPresupuestos = useCapacidad("presupuestos");
  const conPdf = useCapacidad("documentos_pdf");
  const conEnlace = useCapacidad("aprobacion_presupuestos");
  const [filas, setFilas] = React.useState<CorreoPresupuestoEnvio[]>([]);
  const [reintentando, setReintentando] = React.useState<string | null>(null);
  const cargar = React.useCallback(
    async () => setFilas(await historialCorreosPresupuesto(id)),
    [id],
  );
  React.useEffect(() => {
    void cargar().catch(() => {});
  }, [cargar, revision]);
  const pendientes = filas.some(
    (f) => f.estado === "PENDIENTE" || f.estado === "ENVIANDO",
  );
  React.useEffect(() => {
    if (!pendientes) return;
    const timer = setInterval(() => {
      void cargar().catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [pendientes, cargar]);
  if (!filas.length) return null;
  const reintentar = async (correoId: string) => {
    setReintentando(correoId);
    try {
      await reintentarCorreoPresupuesto(id, correoId);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reintentar.");
    } finally {
      setReintentando(null);
    }
  };
  return (
    <details className={s.history}>
      <summary>
        Correos · {filas.length} {filas.length === 1 ? "envío" : "envíos"}
        <span>{estados[filas[0].estado]}</span>
      </summary>
      <p className={s.hint}>
        «Enviado» confirma que el servicio de correo aceptó el mensaje; no
        confirma su lectura.
      </p>
      {filas.map((f) => (
        <article key={f.id} className={s.historyItem}>
          <div>
            <strong>{f.asunto}</strong>
            <p>
              {f.para} · {new Date(f.createdAt).toLocaleString("es-AR")}
            </p>
            <span>{estados[f.estado]}</span>
          </div>
          {f.error && <p className={s.error}>{f.error}</p>}
          <details>
            <summary>Ver mensaje enviado</summary>
            <p className={s.message}>{f.mensaje}</p>
            <p className={s.hint}>
              Respuestas a: {f.responderA} · PDF y enlace incluidos.
            </p>
          </details>
          {f.puedeReintentar &&
            puedeGestionar &&
            conPresupuestos &&
            conPdf &&
            conEnlace && (
              <ActionButton
                variant="outline"
                isDisabled={reintentando !== null}
                onPress={() => void reintentar(f.id)}
              >
                {reintentando === f.id ? "Reintentando…" : "Reintentar envío"}
              </ActionButton>
            )}
        </article>
      ))}
    </details>
  );
}
