"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import s from "./registro-premium.module.css";

export function RegistroAmbient() {
  const video = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    function sync() {
      if (!element) return;
      if (
        visible &&
        !document.hidden &&
        !reduced.matches &&
        !pausedByUser.current
      ) {
        if (!element.getAttribute("src"))
          element.src = "/registro/media/plant-tour.mp4";
        void element.play().catch(() => {});
      } else element.pause();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element.pause();
    };
  }, []);
  function toggle() {
    const element = video.current;
    if (!element) return;
    if (playing) {
      pausedByUser.current = true;
      element.pause();
    } else {
      pausedByUser.current = false;
      if (!element.getAttribute("src"))
        element.src = "/registro/media/plant-tour.mp4";
      void element.play().catch(() => {});
    }
  }
  return (
    <div className={s.ambient}>
      <Image
        src="/registro/media/plant.png"
        alt="Planta gráfica con impresión, corte y cartelería"
        fill
        sizes="(max-width: 900px) 100vw, 44vw"
        priority
      />
      <video
        ref={video}
        muted
        playsInline
        loop
        preload="none"
        aria-hidden="true"
        data-ready={ready}
        onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setReady(false);
        }}
      />
      <div className={s.ambientShade} />
      {!failed && (
        <button
          className={s.filmControl}
          type="button"
          onClick={toggle}
          aria-label={
            playing
              ? "Pausar recorrido de planta"
              : "Reproducir recorrido de planta"
          }
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}
    </div>
  );
}
