"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Clock3,
  LockKeyhole,
  MessageCircle,
  Send,
  RefreshCw,
} from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import {
  enviarTextoInbox,
  type EnviarTextoInbox,
  type RespuestaInbox,
} from "@/lib/meta-inbox-api";
import s from "./inbox-composer.module.css";
export type BorradorInbox = { texto: string; clave?: string };
export type BorradoresInbox = Map<string, BorradorInbox>;

/** El padre cambia la key al cambiar de cuenta, canal o conversación.
 * Los borradores viven sólo en memoria: nunca en almacenamiento del navegador. */
export function InboxComposer({
  canalId,
  conversacionId,
  destino,
  respuesta,
  enviar = enviarTextoInbox,
  actualizar,
  borradores,
  scope,
}: {
  canalId: string;
  conversacionId: string;
  destino: string;
  respuesta: RespuestaInbox;
  enviar?: EnviarTextoInbox;
  actualizar: () => Promise<unknown>;
  borradores: BorradoresInbox;
  scope: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<BorradorInbox>(
    () => borradores.get(scope) ?? { texto: "" },
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setReloj] = useState(0);
  const vivo = useRef(true),
    peticion = useRef<AbortController | null>(null);
  const base = useMemo(
    () => ({
      local: performance.now(),
      servidor: Date.parse(respuesta.servidorEl),
    }),
    [respuesta.servidorEl],
  );
  useEffect(() => {
    const timer = setInterval(() => setReloj((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      peticion.current?.abort();
    };
  }, []);
  const restante = Math.max(
    0,
    Date.parse(respuesta.hasta ?? "") -
      base.servidor -
      (performance.now() - base.local),
  );
  const abierta = respuesta.abierta && restante > 0;
  const minutos = Math.ceil(restante / 60000);
  function guardar(next: BorradorInbox) {
    setDraft(next);
    borradores.set(scope, next);
  }
  async function enviarTexto() {
    if (
      peticion.current ||
      !respuesta.habilitado ||
      (!abierta && !draft.clave) ||
      !draft.texto.trim() ||
      draft.texto.length > 4096
    )
      return;
    const dto = {
      texto: draft.texto,
      clave: draft.clave ?? crypto.randomUUID(),
      canalId,
    };
    guardar({ texto: dto.texto, clave: dto.clave });
    const control = new AbortController();
    peticion.current = control;
    setOcupado(true);
    setError(null);
    try {
      const r = await enviar(
        conversacionId,
        dto,
        AbortSignal.any([control.signal, AbortSignal.timeout(25000)]),
      );
      if (!vivo.current || control.signal.aborted) return;
      // Una respuesta confirmada se muestra en el hilo, también si fue rechazada.
      if (
        !r?.id ||
        !["ENVIANDO", "ACEPTADO", "RECHAZADO", "INCIERTO"].includes(r.estado)
      )
        throw new Error("Respuesta inválida");
      guardar({ texto: "" });
      await actualizar();
    } catch (e) {
      if (!vivo.current || control.signal.aborted) return;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        setError(
          `${e.message} El intento quedó guardado para comprobarlo sin duplicarlo.`,
        );
        if ([401, 403, 409].includes(e.status)) await actualizar();
      } else {
        setError(
          "No pudimos confirmar el resultado. Comprobá el envío antes de escribirlo de nuevo.",
        );
      }
    } finally {
      if (vivo.current && !control.signal.aborted) setOcupado(false);
      if (peticion.current === control) peticion.current = null;
    }
  }
  if (!respuesta.habilitado)
    return (
      <div className={s.closed}>
        <LockKeyhole size={18} />
        <div>
          <strong>Conversaciones sincronizadas</strong>
          <p>Las respuestas desde el inbox todavía no están habilitadas.</p>
        </div>
      </div>
    );
  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault();
        void enviarTexto();
      }}
    >
      <div className={s.header}>
        <span className={s.channel}>
          <MessageCircle size={14} aria-hidden="true" /> RESPONDER POR WHATSAPP
        </span>
        <span className={s.window} data-open={abierta}>
          <Clock3 size={13} aria-hidden="true" />
          {abierta
            ? `${Math.floor(minutos / 60)} h ${minutos % 60} min disponibles`
            : "Ventana de atención cerrada"}
        </span>
      </div>
      {!abierta && (
        <Alert>
          <AlertDescription>
            Para retomar esta conversación hace falta una plantilla aprobada.
            Por ahora, podés responder cuando el cliente vuelva a escribir.
          </AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field data-disabled={!abierta && !draft.clave}>
          <FieldLabel htmlFor={id} className="sr-only">
            Mensaje para {destino}
          </FieldLabel>
          <InputGroup>
            <InputGroupTextarea
              id={id}
              placeholder={
                abierta
                  ? `Escribí un mensaje para ${destino}…`
                  : "Esperá un nuevo mensaje del cliente para responder."
              }
              value={draft.texto}
              onChange={(e) => guardar({ texto: e.target.value })}
              rows={2}
              maxLength={4096}
              disabled={!abierta && !draft.clave}
              readOnly={ocupado || Boolean(draft.clave)}
              aria-describedby={`${id}-hint`}
              className="min-h-20 max-h-48"
              onKeyDown={(e) => {
                if (
                  (e.ctrlKey || e.metaKey) &&
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void enviarTexto();
                }
              }}
            />
            <InputGroupAddon
              align="block-end"
              className="justify-between gap-3"
            >
              <span className={s.counter}>
                {draft.texto.length.toLocaleString("es-AR")} / 4.096
              </span>
              <InputGroupButton
                type="submit"
                variant="brand"
                size="sm"
                disabled={
                  ocupado || (!abierta && !draft.clave) || !draft.texto.trim()
                }
              >
                {ocupado ? (
                  <Spinner data-icon="inline-start" />
                ) : draft.clave ? (
                  <RefreshCw data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {ocupado
                  ? "Comprobando…"
                  : draft.clave
                    ? "Comprobar envío"
                    : "Enviar mensaje"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <span id={`${id}-hint`} className={s.hint}>
        Enter para nueva línea · Ctrl o ⌘ + Enter para enviar
      </span>
    </form>
  );
}
