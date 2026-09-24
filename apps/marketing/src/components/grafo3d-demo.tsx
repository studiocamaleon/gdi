"use client";

import dynamic from "next/dynamic";
import { Box, Layers, Play, Pause } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./grafo3d-section.module.css";

const Scene = dynamic(() => import("./grafo3d-demo-scene"), { ssr: false });

export function Grafo3DDemo() {
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const autoPlayed = useRef(false);
  const animation = useRef(0);
  const reduced = useReducedMotion();
  const onReady = useCallback(() => setReady(true), []);
  const onUnavailable = useCallback(() => { setUnavailable(true); setPlaying(false); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setMounted(true);
      else setPlaying(false);
    }, { threshold: 0.2 });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(animation.current);
    setPlaying(true);
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = (now - start) / 4600;
      // Una demostración breve: abre, permite ver las piezas y vuelve a montar.
      const phase = elapsed < 0.4 ? elapsed / 0.4 : elapsed < 0.6 ? 1 : (1 - elapsed) / 0.4;
      const value = Math.max(0, Math.min(1, phase));
      setProgress(value * value * (3 - 2 * value));
      if (elapsed < 1) animation.current = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    animation.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!visible || unavailable || reduced) {
      cancelAnimationFrame(animation.current);
      return;
    }
    if (ready && !autoPlayed.current) {
      autoPlayed.current = true;
      animation.current = requestAnimationFrame(play);
    }
    return () => cancelAnimationFrame(animation.current);
  }, [ready, visible, reduced, unavailable, play]);

  const change = (value: number) => {
    autoPlayed.current = true;
    cancelAnimationFrame(animation.current);
    setPlaying(false);
    setProgress(value);
  };

  return (
    <div className={styles.preview} ref={host}>
      <div className={styles.previewHeader}>
        <Box size={17} /><span>ISOLOGO GRAFOPRINT</span><span>3D INTERACTIVO</span>
      </div>
      <div className={styles.stage} aria-busy={!ready && !unavailable}>
        {mounted && <Scene progress={progress} onReady={onReady} onUnavailable={onUnavailable} />}
        {!ready && !unavailable && <div className={styles.loading}><Box size={28} /><span>Preparando el modelo 3D</span></div>}
        {ready && !unavailable && <span className={styles.hint}>Arrastrá para girar</span>}
      </div>
      <div className={styles.assembly}>
        <div className={styles.assemblyHeading}>
          <label htmlFor="grafo3d-explode"><Layers size={15} /> Vista de montaje</label>
          <output htmlFor="grafo3d-explode" aria-live="off">{Math.round(progress * 100)}%</output>
        </div>
        <input id="grafo3d-explode" type="range" min="0" max="100" step="1"
          value={Math.round(progress * 100)}
          disabled={!ready || unavailable}
          aria-label="Separar las piezas del isologo"
          aria-valuetext={`${Math.round(progress * 100)}% de despiece`}
          onChange={(event) => change(Number(event.target.value) / 100)} />
        <div className={styles.rangeLabels}><span>Ensamblado</span><span>Despiece</span></div>
      </div>
      <div className={styles.previewFooter}>
        <span><i className={styles.bodyDot} />Cuerpo <i className={styles.faceDot} />Acrílico <i className={styles.backDot} />Base</span>
        <button type="button" disabled={!ready || unavailable}
          onClick={() => reduced ? change(progress > 0.5 ? 0 : 1) : playing ? change(progress) : play()}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {reduced ? (progress > 0.5 ? "Ensamblar" : "Ver despiece") : playing ? "Detener" : "Ver animación"}
        </button>
      </div>
    </div>
  );
}
