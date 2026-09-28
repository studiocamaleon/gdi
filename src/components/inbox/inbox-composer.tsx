"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LockKeyhole, Smile, Send, RefreshCw } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import {
  enviarTextoInbox,
  type EnviarTextoInbox,
  type RespuestaInbox,
} from "@/lib/meta-inbox-api";
import s from "./inbox-composer.module.css";
import {
  InboxEnviarAdjunto,
  type BorradoresMedios,
} from "./inbox-enviar-adjunto";
import type { MediosInboxApi } from "@/lib/inbox-enviar-medios";
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
  mediosApi,
  borradoresMedios,
  accionesExtras,
}: {
  canalId: string;
  conversacionId: string;
  destino: string;
  respuesta: RespuestaInbox;
  enviar?: EnviarTextoInbox;
  actualizar: () => Promise<unknown>;
  borradores: BorradoresInbox;
  scope: string;
  mediosApi?: MediosInboxApi;
  borradoresMedios?: BorradoresMedios;
  accionesExtras?: ReactNode;
}) {
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [emojis, setEmojis] = useState(false);
  const borradoresMediosLocales = useRef<BorradoresMedios>(new Map());
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
  function insertarEmoji(emoji: string) {
    if (ocupado || draft.clave || !abierta) return;
    const inicio = inputRef.current?.selectionStart ?? draft.texto.length,
      fin = inputRef.current?.selectionEnd ?? inicio;
    const texto = draft.texto.slice(0, inicio) + emoji + draft.texto.slice(fin);
    if (texto.length > 4096) return;
    guardar({ texto });
    setEmojis(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        inicio + emoji.length,
        inicio + emoji.length,
      );
    });
  }
  return (
    <InboxEnviarAdjunto
      canalId={canalId}
      conversacionId={conversacionId}
      destino={destino}
      habilitado={abierta && respuesta.habilitado}
      api={mediosApi}
      borradores={borradoresMedios ?? borradoresMediosLocales.current}
      actualizar={actualizar}
    >
      {({ adjuntar, microfono, grabacion, grabando }) => (
        <form
          className={s.composer}
          onSubmit={(e) => {
            e.preventDefault();
            void enviarTexto();
          }}
        >
          {!abierta && (
            <Alert>
              <AlertDescription>
                La ventana de atención está cerrada. Usá una plantilla aprobada
                para retomar la conversación.
              </AlertDescription>
            </Alert>
          )}
          <div className={s.compactRow}>
            {adjuntar}
            {!grabando && accionesExtras}
            {grabando ? (
              grabacion
            ) : (
              <>
                <FieldGroup className="min-w-0 flex-1">
                  <Field data-disabled={!abierta && !draft.clave}>
                    <FieldLabel htmlFor={id} className="sr-only">
                      Mensaje para {destino}
                    </FieldLabel>
                    <InputGroup className={s.inputGroup}>
                      <InputGroupTextarea
                        ref={inputRef}
                        id={id}
                        placeholder={
                          abierta
                            ? "Escribí un mensaje…"
                            : "Esperando respuesta del cliente…"
                        }
                        value={draft.texto}
                        onChange={(e) => guardar({ texto: e.target.value })}
                        rows={1}
                        maxLength={4096}
                        disabled={!abierta && !draft.clave}
                        readOnly={ocupado || Boolean(draft.clave)}
                        aria-describedby={`${id}-hint`}
                        className={s.input}
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
                      <InputGroupAddon align="inline-end">
                        <Popover open={emojis} onOpenChange={setEmojis}>
                          <PopoverTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                              />
                            }
                            aria-label="Elegir emoji"
                            title="Emojis"
                            disabled={
                              !abierta || ocupado || Boolean(draft.clave)
                            }
                          >
                            <Smile />
                          </PopoverTrigger>
                          <PopoverContent side="top" align="end">
                            <PopoverTitle>Emojis frecuentes</PopoverTitle>
                            <div className={s.emojiGrid}>
                              {[
                                "😀",
                                "😊",
                                "😂",
                                "😍",
                                "🤔",
                                "😎",
                                "👋",
                                "👍",
                                "👏",
                                "🙌",
                                "🙏",
                                "💪",
                                "❤️",
                                "🔥",
                                "🎉",
                                "✨",
                                "✅",
                                "📌",
                                "📍",
                                "📦",
                                "🖨️",
                                "🎨",
                                "💬",
                                "☕",
                              ].map((emoji) => (
                                <Button
                                  key={emoji}
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Insertar ${emoji}`}
                                  onClick={() => insertarEmoji(emoji)}
                                >
                                  {emoji}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </FieldGroup>
                {draft.texto.trim() || draft.clave ? (
                  <Button
                    type="submit"
                    className="size-10 rounded-full"
                    variant="brand"
                    size="icon"
                    disabled={
                      ocupado ||
                      (!abierta && !draft.clave) ||
                      !draft.texto.trim()
                    }
                    title={
                      draft.clave
                        ? "Comprobar el mismo envío"
                        : "Enviar · Ctrl o ⌘ + Enter"
                    }
                    aria-label={
                      ocupado
                        ? "Comprobando…"
                        : draft.clave
                          ? "Comprobar envío"
                          : "Enviar mensaje"
                    }
                  >
                    {ocupado ? (
                      <Spinner />
                    ) : draft.clave ? (
                      <RefreshCw />
                    ) : (
                      <Send />
                    )}
                    <span className="sr-only">
                      {draft.clave ? "Comprobar envío" : "Enviar mensaje"}
                    </span>
                  </Button>
                ) : (
                  microfono
                )}
              </>
            )}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {draft.texto.length > 3500 && (
            <span className={s.counter}>
              {draft.texto.length.toLocaleString("es-AR")} / 4.096
            </span>
          )}
          <span id={`${id}-hint`} className="sr-only">
            Enter para nueva línea · Ctrl o ⌘ + Enter para enviar. También podés
            arrastrar archivos o pegar imágenes.
          </span>
        </form>
      )}
    </InboxEnviarAdjunto>
  );
}
