"use client";

import { useState } from "react";
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
import type { AbrirAdjuntoInbox } from "@/lib/meta-inbox-api";
import { formatBytes } from "@/lib/archivos";
import s from "./inbox-pdf.module.css";
import { useInboxArchivo } from "./use-inbox-archivo";

/** La copia temporal vive sólo mientras el visor está abierto. */
export function InboxPdf({
  mensajeId,
  nombre,
  abrir,
}: {
  mensajeId: string;
  nombre: string;
  abrir: AbrirAdjuntoInbox;
}) {
  const { archivo, url, error, progreso, reintentar } = useInboxArchivo(
    mensajeId,
    abrir,
    "application/pdf",
  );
  const [falloVisor, setFalloVisor] = useState(false);
  const [soportaVisor] = useState(() => navigator.pdfViewerEnabled !== false);
  const cargando = !url && !error;

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
          {archivo && url ? (
            <a
              href={url}
              download={archivo.nombre}
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
            <Spinner /> Abriendo PDF… {progreso > 0 ? `${progreso}%` : ""}
          </div>
        ) : error || falloVisor ? (
          <div className={s.notice}>
            <Alert>
              <AlertDescription>
                No pudimos abrir el PDF. Comprobá tu conexión y volvé a
                intentarlo.
              </AlertDescription>
            </Alert>
          </div>
        ) : !soportaVisor ? (
          <div className={s.notice}>
            <Alert>
              <AlertDescription>
                Este navegador no admite la vista previa de PDF. Podés descargar
                el documento desde el botón superior.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <iframe
            title={`Vista previa de ${nombre}`}
            src={`${url}#view=FitH&navpanes=0`}
            className={s.viewer}
            referrerPolicy="no-referrer"
            onError={() => setFalloVisor(true)}
          />
        )}
      </div>
      <footer className={s.footer}>
        <p>
          Usá los controles del visor para cambiar de página o ampliar el
          documento.
        </p>
        {(error || falloVisor) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFalloVisor(false);
              reintentar();
            }}
          >
            <RefreshCw data-icon="inline-start" /> Volver a intentar
          </Button>
        )}
      </footer>
    </DialogContent>
  );
}
