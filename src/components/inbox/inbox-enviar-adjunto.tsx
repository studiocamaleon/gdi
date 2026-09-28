"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Mic,
  Plus,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  Image,
  Video,
  Music2,
  Sticker,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/archivos";
import { mediosInboxApi, type MediosInboxApi } from "@/lib/inbox-enviar-medios";
import {
  ACCEPT_INBOX,
  FORMATOS_INBOX,
  type TipoMedioInbox,
  formatoArchivoInbox,
} from "../../../apps/api/src/common/inbox/medios";
import s from "./inbox-enviar-adjunto.module.css";
const categorias = [
  {
    tipo: "image",
    nombre: "Fotos",
    detalle: "JPG, PNG · hasta 5 MB",
    Icono: Image,
  },
  {
    tipo: "video",
    nombre: "Videos",
    detalle: "MP4, 3GP · hasta 16 MB",
    Icono: Video,
  },
  {
    tipo: "audio",
    nombre: "Audios",
    detalle: "AAC, AMR, MP3, M4A, OGG · 16 MB",
    Icono: Music2,
  },
  {
    tipo: "document",
    nombre: "Documentos",
    detalle: "PDF, TXT, Office · hasta 100 MB",
    Icono: FileText,
  },
  {
    tipo: "sticker",
    nombre: "Stickers",
    detalle: "WebP · 100 KB / animados 500 KB",
    Icono: Sticker,
  },
] as const;
function filtroArchivos(tipo: TipoMedioInbox) {
  return [
    ...Object.entries(FORMATOS_INBOX)
      .filter(([, f]) => f.tipo === tipo)
      .flatMap(([mime, f]) => [mime, `.${f.ext}`]),
    ...(tipo === "image" ? [".jpeg"] : tipo === "audio" ? [".opus"] : []),
  ].join(",");
}
export type BorradorMedio = {
  file: File;
  voz: boolean;
  texto: string;
  archivoId?: string;
  clave?: string;
};
export type BorradoresMedios = Map<string, BorradorMedio>;
export function InboxEnviarAdjunto({
  children,
  conversacionId,
  canalId,
  destino,
  habilitado,
  api = mediosInboxApi,
  borradores,
  actualizar,
}: {
  children:
    | ReactNode
    | ((controles: {
        adjuntar: ReactNode;
        microfono: ReactNode;
        grabacion: ReactNode;
        grabando: boolean;
      }) => ReactNode);
  conversacionId: string;
  canalId: string;
  destino: string;
  habilitado: boolean;
  api?: MediosInboxApi;
  borradores: BorradoresMedios;
  actualizar: () => Promise<unknown>;
}) {
  const tema = useLegacyDesignScope();
  const categoriaElegida = useRef<TipoMedioInbox | null>(null);
  const scope = `${canalId}:${conversacionId}`,
    id = useId();
  const [draft, setDraft] = useState<BorradorMedio | null>(
    () => borradores.get(scope) ?? null,
  );
  const [abierto, setAbierto] = useState(() =>
    Boolean(borradores.get(scope) && !borradores.get(scope)?.voz),
  );
  const [fase, setFase] = useState<"reposo" | "subiendo" | "enviando">(
    "reposo",
  );
  const [progreso, setProgreso] = useState(0),
    [error, setError] = useState(""),
    [arrastrando, setArrastrando] = useState(false);
  const [grabando, setGrabando] = useState(false),
    [segundos, setSegundos] = useState(0),
    [pidiendoMicrofono, setPidiendoMicrofono] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    peticion = useRef<AbortController | null>(null),
    vivo = useRef(true),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    descartar = useRef(false),
    enviarAlTerminar = useRef(false),
    contador = useRef<ReturnType<typeof setInterval> | null>(null);
  const ocupado = fase !== "reposo",
    bloqueado = Boolean(draft?.clave),
    formato = draft
      ? formatoArchivoInbox(draft.file.name, draft.file.type)
      : null;
  const admiteTexto = Boolean(
    formato &&
    ["image", "video", "document"].includes(formato.tipo) &&
    !draft?.voz,
  );
  const [vista, setVista] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!draft?.file) return;
    const file = draft.file,
      url = URL.createObjectURL(file),
      timer = setTimeout(() => setVista({ file, url }), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [draft?.file]);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      peticion.current?.abort();
      descartar.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (contador.current) clearInterval(contador.current);
    };
  }, []);
  const url = vista?.file === draft?.file ? vista?.url : undefined;
  function guardar(d: BorradorMedio | null) {
    setDraft(d);
    if (d) borradores.set(scope, d);
    else borradores.delete(scope);
  }
  function elegir(file: File, voz = false) {
    if (!habilitado || ocupado || bloqueado || (grabando && !voz)) return;
    const f = formatoArchivoInbox(file.name, file.type);
    if (
      !file.size ||
      file.size > (voz ? 16_000_000 : (f?.max ?? 0)) ||
      (!voz && !f)
    ) {
      setError(
        "Ese formato o tamaño no es compatible. Imágenes: hasta 5 MB; audio/video: 16 MB; documentos: 100 MB; stickers WebP: 100 KB estáticos o 500 KB animados.",
      );
      return;
    }
    if (draft?.archivoId)
      void api
        .cancelar(conversacionId, canalId, draft.archivoId)
        .catch(() => {});
    guardar({ file, voz, texto: "" });
    setError("");
    setProgreso(0);
    setAbierto(true);
  }
  function cancelar() {
    if (bloqueado) return;
    peticion.current?.abort();
    peticion.current = null;
    if (draft?.archivoId)
      void api
        .cancelar(conversacionId, canalId, draft.archivoId)
        .catch(() => {});
    guardar(null);
    setFase("reposo");
    setAbierto(false);
    setError("");
  }
  async function enviar(preparado: BorradorMedio | null = draft) {
    const draft = preparado;
    if (!draft || peticion.current || (!habilitado && !draft.clave)) return;
    const control = new AbortController();
    peticion.current = control;
    setError("");
    try {
      let archivoId = draft.archivoId;
      if (!archivoId) {
        setFase("subiendo");
        archivoId = await api.cargar(
          conversacionId,
          canalId,
          draft.file,
          draft.voz,
          control.signal,
          (n) => {
            if (vivo.current) setProgreso(n);
          },
        );
      }
      if (control.signal.aborted || !vivo.current) return;
      const next = {
        ...draft,
        archivoId,
        clave: draft.clave ?? crypto.randomUUID(),
      };
      guardar(next);
      setFase("enviando");
      const r = await api.enviar(
        conversacionId,
        { archivoId, clave: next.clave, canalId, texto: next.texto },
        AbortSignal.any([control.signal, AbortSignal.timeout(120000)]),
      );
      if (
        !r?.id ||
        !["ENVIANDO", "ACEPTADO", "INCIERTO", "RECHAZADO"].includes(r.estado)
      )
        throw new Error();
      if (!vivo.current || control.signal.aborted) return;
      guardar(null);
      setAbierto(false);
      await actualizar();
    } catch {
      if (vivo.current && !control.signal.aborted)
        setError(
          borradores.get(scope)?.clave
            ? "No pudimos confirmar el resultado. Usá «Comprobar envío» para consultarlo sin duplicar el mensaje."
            : "No se completó la carga. Podés volver a intentarlo.",
        );
    } finally {
      if (vivo.current && !control.signal.aborted) setFase("reposo");
      if (peticion.current === control) peticion.current = null;
    }
  }
  function detener(omitir = false, limite = false) {
    descartar.current = omitir;
    enviarAlTerminar.current = !omitir && !limite;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (contador.current) clearInterval(contador.current);
    setGrabando(false);
  }
  async function grabar() {
    if (!habilitado || ocupado || bloqueado || pidiendoMicrofono) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Este navegador no permite grabar. Podés adjuntar un audio desde tu equipo.",
      );
      return;
    }
    setPidiendoMicrofono(true);
    setError("");
    try {
      const mime = [
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error();
      const st = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      if (!vivo.current) {
        st.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = st;
      descartar.current = false;
      const rec = new MediaRecorder(st, {
        mimeType: mime,
        audioBitsPerSecond: 32000,
      });
      recorder.current = rec;
      const chunks: Blob[] = [];
      let bytes = 0;
      rec.ondataavailable = (e) => {
        if (e.data.size) {
          bytes += e.data.size;
          chunks.push(e.data);
          if (bytes > 15_000_000) detener(false, true);
        }
      };
      rec.onerror = () => {
        detener(true);
        setError("No pudimos grabar el audio. Revisá el micrófono.");
      };
      rec.onstop = () => {
        st.getTracks().forEach((t) => t.stop());
        if (contador.current) clearInterval(contador.current);
        if (!vivo.current) return;
        setGrabando(false);
        if (descartar.current) return;
        const base = mime.split(";")[0],
          ext =
            base === "audio/mp4"
              ? "m4a"
              : base === "audio/ogg"
                ? "ogg"
                : "webm";
        const file = new File(chunks, `Nota-de-voz.${ext}`, { type: base });
        if (!file.size || file.size > 16_000_000) {
          setError("No pudimos guardar la grabación. Volvé a intentarlo.");
          return;
        }
        const nuevo: BorradorMedio = { file, voz: true, texto: "" };
        guardar(nuevo);
        setAbierto(false);
        if (enviarAlTerminar.current) void enviar(nuevo);
        else
          setError(
            "Alcanzaste el límite de la nota de voz. Podés enviarla o descartarla.",
          );
      };
      rec.start(1000);
      setGrabando(true);
      setSegundos(0);
      const inicio = performance.now();
      contador.current = setInterval(() => {
        const n = Math.floor((performance.now() - inicio) / 1000);
        setSegundos(n);
        if (n >= 299) detener(false, true);
      }, 1000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (vivo.current)
        setError(
          "No se pudo acceder al micrófono. Revisá el permiso del navegador.",
        );
    } finally {
      if (vivo.current) setPidiendoMicrofono(false);
    }
  }
  const adjuntar = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
          />
        }
        aria-label="Adjuntar"
        title="Adjuntar · también podés arrastrar o pegar"
        disabled={
          !habilitado || ocupado || grabando || pidiendoMicrofono || bloqueado
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        {...tema}
        side="top"
        className={`${tema.className ?? ""} w-72`}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Adjuntar a la conversación</DropdownMenuLabel>
          {categorias.map(({ tipo, nombre, detalle, Icono }) => (
            <DropdownMenuItem
              key={tipo}
              className="gap-3 p-2.5"
              onClick={() => {
                if (!input.current) return;
                categoriaElegida.current = tipo;
                input.current.accept = filtroArchivos(tipo);
                input.current.click();
              }}
            >
              <Icono />
              <span className="flex flex-col gap-0.5">
                <span>{nombre}</span>
                <span className="text-xs text-muted-foreground">{detalle}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const microfono = (
    <Button
      type="button"
      variant="brand"
      size="icon"
      className="size-10 rounded-full"
      aria-label="Nota de voz"
      title="Grabar una nota de voz"
      disabled={!habilitado || ocupado || bloqueado || pidiendoMicrofono}
      onClick={() => void grabar()}
    >
      {pidiendoMicrofono ? <Spinner /> : <Mic />}
    </Button>
  );
  const grabacion = (
    <div className={s.recordingBar}>
      <span className={s.recording} role="status">
        <Mic size={14} /> {Math.floor(segundos / 60)}:
        {String(segundos % 60).padStart(2, "0")}
      </span>
      <span className={s.recordingHint}>Grabando nota de voz</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Descartar grabación"
        onClick={() => detener(true)}
      >
        <Trash2 />
      </Button>
      <Button
        type="button"
        variant="brand"
        size="icon"
        aria-label="Enviar audio"
        title="Terminar y enviar audio"
        className="rounded-full"
        onClick={() => detener()}
      >
        <Send />
      </Button>
    </div>
  );
  return (
    <div
      className={s.wrapper}
      data-dragging={arrastrando}
      onDragOver={(e) => {
        if (habilitado && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setArrastrando(true);
        }
      }}
      onDragLeave={(e) => {
        if (
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        )
          setArrastrando(false);
      }}
      onDrop={(e) => {
        setArrastrando(false);
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          if (e.dataTransfer.files.length !== 1)
            setError("Elegí un archivo por mensaje.");
          else elegir(e.dataTransfer.files[0]);
        }
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length) {
          e.preventDefault();
          if (files.length !== 1) setError("Pegá una imagen por mensaje.");
          else elegir(files[0]);
        }
      }}
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT_INBOX}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const tipo = formatoArchivoInbox(file.name, file.type)?.tipo;
            if (categoriaElegida.current && tipo !== categoriaElegida.current)
              setError(
                "Ese archivo no corresponde a la opción elegida. Elegí un formato de la lista o cambiá el tipo de adjunto.",
              );
            else elegir(file);
          }
          e.target.value = "";
        }}
      />
      {typeof children === "function" ? (
        children({ adjuntar, microfono, grabacion, grabando })
      ) : (
        <>
          {children}
          <div className={s.toolbar}>
            {adjuntar}
            {grabando ? grabacion : microfono}
          </div>
        </>
      )}
      {draft &&
        !abierto &&
        (draft.voz ? (
          <div className={s.audioPending} role="status">
            <Mic size={15} />
            <span>
              {ocupado
                ? fase === "subiendo"
                  ? `Enviando audio… ${progreso}%`
                  : "Confirmando envío…"
                : "Nota de voz"}
            </span>
            {ocupado ? (
              <Spinner />
            ) : (
              <>
                {!bloqueado && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Descartar audio"
                    onClick={cancelar}
                  >
                    <Trash2 />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void enviar()}
                >
                  {bloqueado ? "Comprobar envío" : "Enviar audio"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAbierto(true)}
          >
            {bloqueado ? "Comprobar adjunto" : "Ver adjunto"}
          </Button>
        ))}
      {arrastrando && (
        <span className={s.tip}>
          Soltá el archivo para revisarlo antes de enviar
        </span>
      )}
      {error && !abierto && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Dialog
        open={abierto}
        onOpenChange={(value) => {
          if (ocupado) return;
          if (!value && !bloqueado) cancelar();
          else setAbierto(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.voz ? "Nota de voz" : "Enviar un archivo"}
            </DialogTitle>
            <DialogDescription>
              Para {destino}. Revisalo antes de enviarlo.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <>
              <div className={s.preview}>
                {url && (draft.voz || formato?.tipo === "audio") ? (
                  <audio
                    controls
                    src={url}
                    aria-label="Escuchar antes de enviar"
                  />
                ) : url && formato?.tipo === "video" ? (
                  <video
                    controls
                    playsInline
                    src={url}
                    aria-label="Vista previa del video"
                  />
                ) : url &&
                  ["image", "sticker"].includes(formato?.tipo ?? "") ? (
                  // URL local efímera: no debe enviarse al optimizador de imágenes.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="Vista previa del adjunto" />
                ) : (
                  <FileText size={40} />
                )}
                <strong>{draft.file.name}</strong>
                <span>
                  {formatBytes(draft.file.size)}
                  {draft.voz ? " · Se enviará como nota de voz" : ""}
                </span>
              </div>
              {admiteTexto && (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={id}>Comentario (opcional)</FieldLabel>
                    <Textarea
                      id={id}
                      value={draft.texto}
                      maxLength={1024}
                      disabled={ocupado || bloqueado}
                      onChange={(e) =>
                        guardar({ ...draft, texto: e.target.value })
                      }
                    />
                  </Field>
                </FieldGroup>
              )}
              {fase === "subiendo" && (
                <Progress
                  value={progreso}
                  aria-label={`Subiendo archivo: ${progreso}%`}
                />
              )}
              {fase === "enviando" && (
                <p className={s.tip} role="status">
                  Preparando y comprobando el envío…
                </p>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className={s.buttons}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={bloqueado}
                  onClick={cancelar}
                >
                  {fase === "subiendo" ? "Cancelar carga" : "Descartar"}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  disabled={ocupado || (!habilitado && !bloqueado)}
                  onClick={() => void enviar()}
                >
                  {ocupado ? (
                    <Spinner data-icon="inline-start" />
                  ) : bloqueado ? (
                    <RefreshCw data-icon="inline-start" />
                  ) : (
                    <Send data-icon="inline-start" />
                  )}
                  {bloqueado ? "Comprobar envío" : "Enviar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
