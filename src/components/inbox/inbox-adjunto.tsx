"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  Music2,
  Sticker,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { InboxPdf } from "./inbox-pdf";
import { InboxMedia } from "./inbox-media";
import {
  abrirAdjuntoInbox,
  type AbrirAdjuntoInbox,
  type MetaInbox,
} from "@/lib/meta-inbox-api";
import { formatBytes } from "@/lib/archivos";
import s from "./inbox-adjunto.module.css";

const tipos = {
  document: { nombre: "Documento", icono: FileText },
  image: { nombre: "Imagen", icono: ImageIcon },
  audio: { nombre: "Audio", icono: Music2 },
  video: { nombre: "Video", icono: Video },
  sticker: { nombre: "Sticker", icono: Sticker },
};
const medios = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "video/mp4",
  "video/3gpp",
]);

export function InboxAdjunto({
  mensajeId,
  tipo,
  adjunto,
  abrir = abrirAdjuntoInbox,
}: {
  mensajeId: string;
  tipo: string;
  adjunto: NonNullable<MetaInbox["mensajes"][number]["adjunto"]>;
  abrir?: AbrirAdjuntoInbox;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const pendiente = useRef<AbortController | null>(null);
  const formato = tipos[tipo as keyof typeof tipos] ?? tipos.document;
  const mime = adjunto.mimeType ?? "";
  const esMedio = medios.has(mime);
  const Icono = mime.startsWith("image/") ? ImageIcon : formato.icono;
  const esPdf = mime === "application/pdf";
  const nombre = adjunto.nombre || `${formato.nombre} de WhatsApp`;
  const extension = adjunto.nombre
    ?.match(/\.([a-z0-9]{1,5})$/i)?.[1]
    ?.toUpperCase();
  useEffect(() => () => pendiente.current?.abort(), []);
  async function descargar() {
    if (pendiente.current || adjunto.estado !== "LISTO") return;
    const controller = new AbortController();
    pendiente.current = controller;
    setOcupado(true);
    setError(false);
    try {
      // Cada clic obtiene una firma nueva; no se conserva un enlace que pueda vencer.
      const archivo = await abrir(
        mensajeId,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (controller.signal.aborted) return;
      const a = document.createElement("a");
      a.href = archivo.url;
      a.download = archivo.nombre;
      a.rel = "noopener noreferrer";
      // El servidor firma Content-Disposition: attachment para documentos.
      document.body.append(a);
      a.click();
      a.remove();
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setOcupado(false);
      if (pendiente.current === controller) pendiente.current = null;
    }
  }
  const mensajes: Record<string, string> = {
    PENDIENTE: "Grafo está preparando el archivo.",
    DESCARGANDO: "Guardando una copia privada…",
    SIN_ARCHIVO:
      "Meta compartió la referencia, pero todavía no entregó el archivo.",
    NO_DISPONIBLE: "No pudimos recuperar este archivo de Meta.",
    RETIRADO: "Este archivo ya no está disponible.",
    REVISION:
      adjunto.motivo === "ESPACIO_O_PLAN"
        ? "Revisá el espacio disponible y el plan de tu empresa."
        : "Este archivo necesita una revisión antes de abrirse.",
    DESHABILITADO:
      "La apertura de archivos todavía no está habilitada en esta conexión.",
  };
  return (
    <div className={s.attachment}>
      <div className={s.fileHeader}>
        <div className={s.fileIcon} aria-hidden="true">
          <Icono size={20} strokeWidth={1.5} />
        </div>
        <div className={s.identity}>
          <strong title={nombre}>{nombre}</strong>
          <div className={s.fileDetails}>
            <span>{extension || formato.nombre}</span>
            {adjunto.bytes !== null && (
              <span>{formatBytes(adjunto.bytes)}</span>
            )}
            <LockKeyhole size={11} aria-label="Archivo privado" role="img" />
          </div>
        </div>
        {adjunto.estado === "LISTO" && !esMedio && (
          <div className={s.actions}>
            {esPdf ? (
              <Dialog open={pdfAbierto} onOpenChange={setPdfAbierto}>
                <DialogTrigger
                  render={<Button size="icon" variant="brand" />}
                  aria-label="Ver PDF"
                  title="Ver PDF"
                >
                  <Eye />
                </DialogTrigger>
                {pdfAbierto && (
                  <InboxPdf
                    mensajeId={mensajeId}
                    nombre={nombre}
                    abrir={abrir}
                  />
                )}
              </Dialog>
            ) : (
              <Button
                size="icon"
                variant="brand"
                disabled={ocupado}
                aria-label={
                  ocupado ? "Preparando descarga" : "Descargar archivo"
                }
                title="Descargar archivo"
                onClick={() => void descargar()}
              >
                {ocupado ? <Spinner /> : <Download />}
              </Button>
            )}
          </div>
        )}
      </div>
      {(adjunto.estado !== "LISTO" || error || esMedio) && (
        <div className={s.fileBody}>
          {adjunto.estado !== "LISTO" ? (
            <p role="status" className={s.status}>
              {mensajes[adjunto.estado] ?? "Archivo no disponible."}
            </p>
          ) : esMedio ? (
            <InboxMedia
              key={`${mensajeId}:${adjunto.version}`}
              mensajeId={mensajeId}
              nombre={nombre}
              mimeType={mime}
              abrir={abrir}
            />
          ) : error ? (
            <Alert>
              <AlertDescription>
                No pudimos preparar la descarga. Volvé a intentarlo desde el
                botón de descarga.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    </div>
  );
}
