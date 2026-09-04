"use client";

import * as React from "react";
import styles from "./opennest-loading.module.css";

const ESTADOS = [
  { hasta: 3, texto: "Preparando las geometrías" },
  { hasta: 8, texto: "Evaluando rotaciones y encastres" },
  { hasta: 15, texto: "Comparando alternativas de material" },
] as const;

function formatearTiempo(segundosTotales: number) {
  const minutos = Math.floor(segundosTotales / 60);
  const segundos = segundosTotales % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

type OpenNestLoadingProps = {
  compact?: boolean;
  status?: string | null;
  progress?: number | null;
};

export function OpenNestLoading({
  compact = false,
  status,
  progress,
}: OpenNestLoadingProps) {
  const inicioRef = React.useRef<number | null>(null);
  const [segundos, setSegundos] = React.useState(0);

  React.useEffect(() => {
    inicioRef.current = Date.now();
    const actualizar = () => {
      if (inicioRef.current === null) return;
      setSegundos(Math.floor((Date.now() - inicioRef.current) / 1_000));
    };

    const intervalo = window.setInterval(actualizar, 250);
    return () => window.clearInterval(intervalo);
  }, []);

  const estado =
    status ??
    ESTADOS.find((item) => segundos < item.hasta)?.texto ??
    "Afinando el mejor aprovechamiento";
  const progresoDeterminado = Number.isFinite(progress);
  const porcentaje = progresoDeterminado
    ? Math.max(0, Math.min(100, Number(progress)))
    : null;

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ""}`}>
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.sheet}>
          <span className={`${styles.piece} ${styles.pieceA}`} />
          <span className={`${styles.piece} ${styles.pieceB}`} />
          <span className={`${styles.piece} ${styles.pieceC}`} />
          <span className={styles.scan} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>GRAFONEST</span>
            <div className={styles.title}>Optimizando el material</div>
          </div>
          <span
            className={styles.timer}
            aria-hidden="true"
            title="Tiempo transcurrido"
          >
            {formatearTiempo(segundos)}
          </span>
        </div>

        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Progreso del nesting"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje ?? undefined}
        >
          <span
            className={`${styles.progressBar} ${progresoDeterminado ? styles.progressBarDeterminate : ""}`}
            style={porcentaje == null ? undefined : { width: `${porcentaje}%` }}
          />
        </div>

        <div className={styles.status}>{estado}</div>
        <p className={styles.hint}>
          GrafoNest está buscando el acomodo con menor consumo posible.
        </p>
      </div>
    </div>
  );
}
