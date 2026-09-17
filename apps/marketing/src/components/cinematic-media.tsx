"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function CinematicMedia({
  priority = false,
  className = "",
  controllable = true,
}: {
  priority?: boolean;
  className?: string;
  controllable?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false),
    [playing, setPlaying] = useState(false),
    [failed, setFailed] = useState(false);
  const userPaused = useRef(false);
  useEffect(() => {
    const element = video.current,
      container = root.current;
    if (!element || !container) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (
        visible &&
        !document.hidden &&
        !reduced.matches &&
        !userPaused.current
      ) {
        if (!element.getAttribute("src")) element.src = "/media/plant-tour.mp4";
        element.play().catch(() => {});
      } else element.pause();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.1 },
    );
    io.observe(container);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      element.pause();
    };
  }, []);
  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (playing) {
      userPaused.current = true;
      element.pause();
    } else {
      userPaused.current = false;
      if (!element.getAttribute("src")) element.src = "/media/plant-tour.mp4";
      element.play().catch(() => {});
    }
  };
  return (
    <div ref={root} className={`cinematic-media ${className}`}>
      <Image
        src="/media/plant.png"
        alt="Interior de una planta gráfica con impresión de gran formato, corte y ensamblaje de cartelería"
        fill
        sizes={priority ? "100vw" : "(max-width: 800px) 100vw, 85vw"}
        priority={priority}
        quality={85}
      />
      <video
        ref={video}
        muted
        playsInline
        loop
        preload="none"
        aria-hidden="true"
        className={loaded ? "film-ready" : ""}
        onLoadedData={() => setLoaded(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setLoaded(false);
        }}
      />
      {controllable && !failed && (
        <button
          className="film-control"
          type="button"
          onClick={toggle}
          aria-label={
            playing
              ? "Pausar recorrido de planta"
              : "Reproducir recorrido de planta"
          }
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          <span>{playing ? "Pausar" : "Reproducir"}</span>
        </button>
      )}
    </div>
  );
}
