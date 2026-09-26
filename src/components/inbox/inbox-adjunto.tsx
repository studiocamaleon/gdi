"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  abrirAdjuntoInbox,
  type AbrirAdjuntoInbox,
  type ArchivoInbox,
  type MetaInbox,
} from "@/lib/meta-inbox-api";
import { formatBytes } from "@/lib/archivos";
import s from "./inbox-adjunto.module.css";

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
  const [archivo, setArchivo] = useState<ArchivoInbox | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  const pendiente = useRef<AbortController | null>(null);
  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
      pendiente.current?.abort();
    };
  }, []);
  async function cargar() {
    if (pendiente.current || adjunto.estado !== "LISTO") return;
    const controller = new AbortController();
    pendiente.current = controller;
    setOcupado(true);
    setError(false);
    setArchivo(null);
    try {
      const result = await abrir(
        mensajeId,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      );
      if (vigente.current && !controller.signal.aborted) setArchivo(result);
    } catch {
      if (vigente.current && !controller.signal.aborted) setError(true);
    } finally {
      if (vigente.current && !controller.signal.aborted) setOcupado(false);
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
      <div className={s.identity}>
        <FileText size={20} aria-hidden="true" />
        <div>
          <strong>{adjunto.nombre || "Archivo de WhatsApp"}</strong>
          {adjunto.bytes !== null && (
            <small>{formatBytes(adjunto.bytes)} · Archivo privado</small>
          )}
        </div>
      </div>
      {adjunto.estado !== "LISTO" ? (
        <p role="status">
          {mensajes[adjunto.estado] ?? "Archivo no disponible."}
        </p>
      ) : (
        <>
          {!archivo && (
            <Button
              size="sm"
              variant="outline"
              disabled={ocupado}
              onClick={() => void cargar()}
            >
              {ocupado ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Eye data-icon="inline-start" />
              )}
              {ocupado ? "Abriendo…" : "Abrir archivo"}
            </Button>
          )}
          {error && (
            <Alert>
              <AlertDescription>
                No pudimos abrir el archivo. Volvé a intentarlo para renovar el
                acceso.
              </AlertDescription>
            </Alert>
          )}
          {archivo && (
            <>
              {["image", "sticker"].includes(tipo) && (
                // Archivo privado: evitar la caché del optimizador de Next.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={archivo.url}
                  alt={archivo.nombre}
                  className={s.image}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setArchivo(null);
                    setError(true);
                  }}
                />
              )}
              {tipo === "audio" && (
                <audio
                  controls
                  preload="none"
                  src={archivo.url}
                  aria-label={archivo.nombre}
                  onError={() => {
                    setArchivo(null);
                    setError(true);
                  }}
                />
              )}
              {tipo === "video" && (
                <video
                  controls
                  preload="none"
                  src={archivo.url}
                  aria-label={archivo.nombre}
                  onError={() => {
                    setArchivo(null);
                    setError(true);
                  }}
                />
              )}
              <div className={s.actions}>
                <a
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download data-icon="inline-start" />
                  {tipo === "document"
                    ? "Descargar documento"
                    : "Abrir original"}
                </a>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Renovar acceso al archivo"
                  onClick={() => void cargar()}
                >
                  <RefreshCw />
                </Button>
              </div>
              <small>El enlace es temporal. Si vence, renová el acceso.</small>
            </>
          )}
        </>
      )}
    </div>
  );
}
