"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Mic, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import s from "./inbox-audio.module.css";
const tiempo = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
/** Controles propios sobre un audio privado ya autorizado. Nunca reproduce al abrir. */
export function InboxAudio({
  url,
  nombre,
  mantener,
  fallo,
}: {
  url: string;
  nombre: string;
  mantener: (activo: boolean) => void;
  fallo: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false),
    [posicion, setPosicion] = useState(0),
    [duracion, setDuracion] = useState(0),
    [velocidad, setVelocidad] = useState(1);
  const actualizar = () => {
    const a = audio.current;
    if (!a) return;
    setPosicion(Number.isFinite(a.currentTime) ? a.currentTime : 0);
    if (Number.isFinite(a.duration) && a.duration > 0) setDuracion(a.duration);
  };
  useEffect(() => {
    const element = audio.current;
    return () => {
      if (element && !element.paused) element.pause();
    };
  }, []);
  async function alternar() {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    try {
      await a.play();
    } catch {
      fallo();
    }
  }
  return (
    <div className={s.player}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        aria-label={nombre}
        onLoadedMetadata={actualizar}
        onDurationChange={actualizar}
        onTimeUpdate={actualizar}
        onPlay={() => {
          setReproduciendo(true);
          mantener(true);
        }}
        onPause={() => {
          setReproduciendo(false);
          mantener(false);
        }}
        onEnded={() => {
          setReproduciendo(false);
          mantener(false);
          actualizar();
        }}
        onError={fallo}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={s.play}
        aria-label={reproduciendo ? "Pausar audio" : "Reproducir audio"}
        onClick={() => void alternar()}
      >
        {reproduciendo ? <Pause /> : <Play />}
      </Button>
      <div className={s.timeline}>
        <input
          className={s.seek}
          type="range"
          aria-label="Posición del audio"
          aria-valuetext={`${tiempo(posicion)} de ${tiempo(duracion)}`}
          min={0}
          max={duracion || 1}
          step={0.1}
          value={Math.min(posicion, duracion || 1)}
          disabled={!duracion}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (audio.current) audio.current.currentTime = n;
            setPosicion(n);
          }}
          style={{
            background: `linear-gradient(to right, var(--accent) ${duracion ? (posicion / duracion) * 100 : 0}%, currentColor 0%)`,
          }}
        />
        <span className={s.duration}>
          {tiempo(posicion > 0 ? posicion : duracion)}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={s.speed}
        aria-label={`Velocidad ${velocidad}. Cambiar velocidad`}
        title="Cambiar velocidad"
        onClick={() => {
          const n = velocidad === 1 ? 1.5 : velocidad === 1.5 ? 2 : 1;
          setVelocidad(n);
          if (audio.current) audio.current.playbackRate = n;
        }}
      >
        {velocidad}×
      </Button>
      <span className={s.voice} aria-hidden="true">
        <Mic size={19} />
      </span>
      <a
        className={s.download}
        href={url}
        download={nombre}
        aria-label={`Descargar ${nombre}`}
        title="Descargar audio"
      >
        <Download size={14} />
      </a>
    </div>
  );
}
