"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Maximize2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AbrirAdjuntoInbox } from "@/lib/meta-inbox-api";
import { InboxAudio } from "./inbox-audio";
import { useInboxArchivo } from "./use-inbox-archivo";
import s from "./inbox-adjunto.module.css";

type Props = {
  mensajeId: string;
  nombre: string;
  mimeType: string;
  abrir: AbrirAdjuntoInbox;
  sticker?: boolean;
};

/** Sólo descarga los medios cercanos a la vista. Conserva el audio en reproducción. */
export function InboxMedia(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [alto, setAlto] = useState(72);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting)
          setAlto(Math.max(72, entry.boundingClientRect.height));
        setVisible(entry.isIntersecting);
      },
      { rootMargin: "160px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={props.sticker ? s.sticker : s.media}
      style={{
        minHeight: props.sticker
          ? 160
          : props.mimeType.startsWith("audio/")
            ? Math.min(alto, 54)
            : alto,
      }}
    >
      {visible || ocupado ? (
        <MedioCargado {...props} mantener={setOcupado} />
      ) : (
        <div
          className={s.mediaPlaceholder}
          aria-label="Vista previa del archivo"
        />
      )}
    </div>
  );
}

function MedioCargado({
  mensajeId,
  nombre,
  mimeType,
  abrir,
  mantener,
  sticker,
}: Props & { mantener: (valor: boolean) => void }) {
  const { url, error, progreso, reintentar } = useInboxArchivo(
    mensajeId,
    abrir,
    mimeType,
  );
  const [falloFormato, setFalloFormato] = useState(false);
  const imagen = mimeType.startsWith("image/");
  const audio = mimeType.startsWith("audio/");
  const fallo = () => {
    setFalloFormato(true);
    mantener(false);
  };
  if (error)
    return (
      <Alert>
        <AlertDescription>
          No pudimos cargar el archivo.
          <Button variant="outline" size="sm" onClick={reintentar}>
            Volver a intentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!url)
    return (
      <div className={s.mediaPlaceholder} role="status">
        <Spinner /> Cargando… {progreso > 0 ? `${progreso}%` : ""}
      </div>
    );
  return (
    <>
      {falloFormato ? (
        <Alert>
          <AlertDescription>
            Este navegador no puede mostrar este formato. Podés descargar el
            original.
          </AlertDescription>
        </Alert>
      ) : sticker ? (
        // Un sticker conserva su transparencia y animación, sin marco de documento.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Sticker"
          className={s.stickerImage}
          onError={fallo}
        />
      ) : imagen ? (
        <Dialog onOpenChange={mantener}>
          <DialogTrigger
            render={<button type="button" className={s.imageButton} />}
            aria-label={`Ampliar ${nombre}`}
          >
            {/* Copia efímera: nunca pasar archivos privados por el optimizador de Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={nombre} className={s.image} onError={fallo} />
            <span className={s.expand}>
              <Maximize2 size={15} />
            </span>
          </DialogTrigger>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[1000px]">
            <DialogTitle className="truncate pr-8" title={nombre}>
              {nombre}
            </DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={nombre} className={s.expandedImage} />
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={url}
              download={nombre}
            >
              <Download data-icon="inline-start" /> Descargar original
            </a>
          </DialogContent>
        </Dialog>
      ) : audio ? (
        <InboxAudio
          url={url}
          nombre={nombre}
          mantener={mantener}
          fallo={fallo}
        />
      ) : (
        <video
          controls
          playsInline
          preload="metadata"
          src={url}
          aria-label={nombre}
          onPlay={() => mantener(true)}
          onPause={() => mantener(false)}
          onEnded={() => mantener(false)}
          onError={fallo}
        />
      )}
      {!sticker && (!audio || falloFormato) && (
        <a
          href={url}
          download={nombre}
          className={s.download}
          aria-label={`Descargar ${nombre}`}
        >
          <Download size={13} aria-hidden="true" /> Descargar original
        </a>
      )}
    </>
  );
}
