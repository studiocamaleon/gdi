"use client";

import { useEffect, useState } from "react";
import { Download, FileText, LockKeyhole, RefreshCw, X } from "lucide-react";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { AbrirAdjuntoInbox, ArchivoInbox } from "@/lib/meta-inbox-api";
import { formatBytes } from "@/lib/archivos";
import s from "./inbox-pdf.module.css";

/** Se monta al abrir y se destruye al cerrar: nunca reutiliza una firma vencida. */
export function InboxPdf({
  mensajeId,
  nombre,
  abrir,
}: {
  mensajeId: string;
  nombre: string;
  abrir: AbrirAdjuntoInbox;
}) {
  const [archivo, setArchivo] = useState<ArchivoInbox | null>(null);
  const [error, setError] = useState(false);
  const [vencido, setVencido] = useState(false);
  const [intento, setIntento] = useState(0);
  const [soportaVisor] = useState(() => navigator.pdfViewerEnabled !== false);
  const cargando = !archivo && !error;

  useEffect(() => {
    const controller = new AbortController();
    let vencimiento: ReturnType<typeof setTimeout> | undefined;
    const cargar = async () => {
      const solicitadoEl = Date.now();
      try {
        const resultado = await abrir(
          mensajeId,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        );
        if (controller.signal.aborted) return;
        if (resultado.mimeType !== "application/pdf")
          throw new Error("Formato");
        setArchivo(resultado);
        vencimiento = setTimeout(
          () => setVencido(true),
          Math.max(
            0,
            (resultado.expiraEn - 5) * 1000 - (Date.now() - solicitadoEl),
          ),
        );
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    };
    void cargar();
    return () => {
      controller.abort();
      clearTimeout(vencimiento);
    };
  }, [mensajeId, abrir, intento]);

  function renovar() {
    setArchivo(null);
    setError(false);
    setVencido(false);
    setIntento((valor) => valor + 1);
  }

  return (
    <DialogContent
      showCloseButton={false}
      className="flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]"
    >
      <header className={s.header}>
        <div className={s.icon}>
          <FileText size={24} aria-hidden="true" />
        </div>
        <div className={s.identity}>
          <span className={s.eyebrow}>GRAFO INBOX / DOCUMENTO</span>
          <DialogTitle className="truncate" title={nombre}>
            {nombre}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Vista previa privada del PDF. Podés leerlo sin guardarlo en tu
            equipo.
          </DialogDescription>
          <span className={s.details}>
            <LockKeyhole size={12} aria-hidden="true" />
            Archivo privado{archivo ? ` · ${formatBytes(archivo.bytes)}` : ""}
          </span>
        </div>
        <div className={s.actions}>
          {archivo && !vencido ? (
            <a
              href={archivo.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "brand", size: "sm" })}
            >
              <Download data-icon="inline-start" /> Descargar
            </a>
          ) : (
            <Button size="sm" variant="brand" disabled>
              <Download data-icon="inline-start" /> Descargar
            </Button>
          )}
          <DialogClose
            render={<Button variant="sidebar" size="icon" />}
            aria-label="Cerrar visor PDF"
            title="Cerrar visor PDF"
          >
            <X />
          </DialogClose>
        </div>
      </header>
      <div className={s.canvas}>
        {cargando ? (
          <div className={s.loading} role="status">
            <Spinner /> Abriendo PDF…
          </div>
        ) : error ? (
          <div className={s.notice}>
            <Alert>
              <AlertDescription>
                No pudimos abrir el PDF. Volvé a intentar; Grafo comprobará
                nuevamente tu acceso.
              </AlertDescription>
            </Alert>
          </div>
        ) : !soportaVisor || !archivo?.vistaPreviaUrl ? (
          <div className={s.notice}>
            <Alert>
              <AlertDescription>
                {!soportaVisor
                  ? "Este navegador tiene desactivado el visor PDF o no lo admite. Podés descargar el documento o abrir Grafo en un navegador con visor PDF."
                  : "La vista previa de este PDF todavía no está disponible. Podés descargarlo desde el botón superior."}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <iframe
            key={intento}
            title={`Vista previa de ${nombre}`}
            src={`${archivo.vistaPreviaUrl}#view=FitH&navpanes=0`}
            className={s.viewer}
            referrerPolicy="no-referrer"
            onError={() => setError(true)}
          />
        )}
      </div>
      <footer className={s.footer}>
        <p>
          {vencido
            ? "Para volver a cargar o descargar el archivo, renová el acceso."
            : "Páginas y zoom desde el visor. Si no carga, renová el acceso."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={renovar}
          disabled={cargando}
        >
          <RefreshCw data-icon="inline-start" />
          {error ? "Reintentar" : "Renovar acceso"}
        </Button>
      </footer>
    </DialogContent>
  );
}
