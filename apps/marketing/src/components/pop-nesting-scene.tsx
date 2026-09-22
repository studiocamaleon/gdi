"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import {
  POP_PANELS,
  POP_PACKAGES,
  panelPaths,
  panelMatrices,
  type PopPanel,
} from "./pop-nesting-geometry";
import styles from "./pop-nesting-scene.module.css";

const stages = [
  {
    label: "Armado",
    title: "Un exhibidor. Siete piezas.",
    detail: "Del objeto que imaginás…",
  },
  {
    label: "Despiece",
    title: "Cada parte encuentra su forma.",
    detail: "…a las piezas que lo construyen…",
  },
  {
    label: "En placa",
    title: "Todo empieza en el material.",
    detail: "…y a su distribución sobre la placa.",
  },
];
function Panel({
  panel,
  progress,
}: {
  panel: PopPanel;
  progress: MotionValue<number>;
}) {
  const path = useTransform(progress, [0, 1, 2], panelPaths(panel));
  const matrix = useTransform(progress, [0, 1, 2], panelMatrices(panel));
  const artwork = useRef<SVGGElement>(null);
  // Mantener la matriz en coordenadas SVG: el origen CSS del grupo no debe
  // desplazar la marca respecto del contorno que se está transformando.
  useMotionValueEvent(matrix, "change", (value) => {
    artwork.current?.setAttribute("transform", value);
  });
  const thickness = useTransform(progress, [0, 1, 2], [3, 3, 0]);
  const labelOpacity = useTransform(progress, [0, 1, 1.5, 2], [0, 0, 0, 1]);
  const showBrand = panel.id === "header" || panel.id === "front";
  return (
    <g>
      <motion.path d={path} fill="#9c8065" style={{ y: thickness }} />
      <motion.path
        d={path}
        fill={panel.color}
        stroke={panel.id === "right" ? "#91b79b" : "#f5edd7"}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <g ref={artwork} transform={matrix.get()}>
        {showBrand && (
          <>
            <text
              x="75"
              y={panel.id === "header" ? 35 : 21}
              textAnchor="middle"
              fill="#21372c"
              fontSize={panel.id === "header" ? 19 : 12}
              fontWeight="600"
              letterSpacing="-1"
            >
              grafo
              <tspan fill={panel.id === "header" ? "#e6693e" : "#21372c"}>
                .
              </tspan>
            </text>
            {panel.id === "header" && (
              <text
                x="75"
                y="46"
                textAnchor="middle"
                fill="#596251"
                fontSize="4.5"
                letterSpacing="1.5"
              >
                IDEAS QUE TOMAN FORMA
              </text>
            )}
          </>
        )}
        {(panel.id === "left" || panel.id === "right") && (
          <>
            {[
              { y: 82, w: 26 },
              { y: 156, w: 46 },
              { y: 230, w: 66 },
            ].map((slot) => (
              <rect
                key={slot.y}
                x="5"
                y={slot.y}
                width={slot.w}
                height="3"
                rx="1"
                fill="#182b23"
                opacity=".45"
              />
            ))}
          </>
        )}
        {!showBrand && (
          <motion.text
            x={panel.id.startsWith("shelf") ? 75 : 18}
            y={panel.id.startsWith("shelf") ? 24 : 160}
            textAnchor="middle"
            fill={panel.id.startsWith("shelf") ? "#6d7060" : "#dbe7d4"}
            fontSize="7"
            fontFamily="monospace"
            style={{ opacity: labelOpacity }}
          >
            {panel.id === "left"
              ? "01"
              : panel.id === "right"
                ? "02"
                : panel.id === "shelf-base"
                  ? "03"
                  : panel.id === "shelf-mid"
                    ? "04"
                    : "05"}
          </motion.text>
        )}
      </g>
    </g>
  );
}

export function PopNestingScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const progress = useMotionValue(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const controls = useRef<{
    stop: () => void;
    pause: () => void;
    play: () => void;
  } | null>(null);
  const playedOnce = useRef(false);
  const playRef = useRef<() => void>(() => {});
  const patternId = useId().replaceAll(":", "");
  const boardOpacity = useTransform(progress, [0, 1, 1.6, 2], [0, 0, 0.6, 1]);
  const productOpacity = useTransform(progress, [0, 0.45, 1], [1, 0, 0]);
  const floorOpacity = useTransform(progress, [0, 1, 2], [0.7, 0.3, 0]);
  useMotionValueEvent(progress, "change", (value) =>
    setStage(value < 0.55 ? 0 : value < 1.55 ? 1 : 2),
  );
  const selectStage = (index: number) => {
    controls.current?.stop();
    playedOnce.current = true;
    setPlaying(false);
    setPaused(false);
    setStarted(true);
    controls.current = animate(progress, index, {
      duration: reduced ? 0 : 1.15,
      ease: [0.22, 1, 0.36, 1],
    });
  };
  const play = () => {
    controls.current?.stop();
    playedOnce.current = true;
    setStarted(true);
    setPaused(false);
    if (reduced) {
      progress.set(2);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    progress.set(0);
    controls.current = animate(progress, [0, 0, 1, 1, 2], {
      duration: 7.2,
      times: [0, 0.16, 0.43, 0.59, 1],
      ease: "easeInOut",
      onComplete: () => setPlaying(false),
    });
  };
  useEffect(() => {
    playRef.current = play;
  });
  useEffect(() => {
    if (!inView || reduced || playedOnce.current) return;
    const timer = setTimeout(() => playRef.current(), 650);
    return () => clearTimeout(timer);
  }, [inView, reduced]);
  useEffect(() => {
    if (!inView) controls.current?.pause();
    else if (playing) controls.current?.play();
  }, [inView, playing]);
  useEffect(() => () => controls.current?.stop(), []);
  return (
    <div ref={ref} className={styles.scene}>
      <div className={styles.legend}>
        <span>EXHIBIDOR POP / MOSTRADOR</span>
        <span>07 PIEZAS</span>
      </div>
      <svg
        viewBox="0 0 600 450"
        role="img"
        aria-label={`Exhibidor Grafo: ${stages[stage].label.toLowerCase()}. Laterales, tres estantes, cabecera y frente.`}
        className={styles.canvas}
      >
        <defs>
          <pattern
            id={patternId}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M24 0H0V24"
              fill="none"
              stroke="#b9c6a8"
              strokeWidth=".45"
              opacity=".22"
            />
          </pattern>
          <radialGradient id={`${patternId}-shadow`}>
            <stop stopColor="#000" stopOpacity=".5" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.g style={{ opacity: floorOpacity }}>
          <ellipse
            cx="298"
            cy="399"
            rx="165"
            ry="30"
            fill={`url(#${patternId}-shadow)`}
          />
          <path
            d="M66 367L287 425 536 307M92 315L314 373 562 255"
            fill="none"
            stroke="#587469"
            strokeWidth=".7"
            opacity=".4"
          />
        </motion.g>
        <motion.g style={{ opacity: boardOpacity }}>
          <rect
            x="46"
            y="46"
            width="508"
            height="376"
            rx="3"
            fill="#29382e"
            stroke="#8b9b83"
            strokeWidth="1.2"
          />
          <rect
            x="46"
            y="46"
            width="508"
            height="376"
            fill={`url(#${patternId})`}
          />
          <rect
            x="54"
            y="54"
            width="492"
            height="360"
            fill="none"
            stroke="#899e80"
            strokeDasharray="3 5"
            opacity=".5"
          />
          <text
            x="300"
            y="30"
            textAnchor="middle"
            fill="#a8b89c"
            fontSize="9"
            letterSpacing="2"
          >
            UNA PLACA · LAS MISMAS PIEZAS
          </text>
        </motion.g>
        {POP_PANELS.map((panel) => (
          <g key={panel.id}>
            <Panel panel={panel} progress={progress} />
            {panel.id === "front" && (
              <motion.g style={{ opacity: productOpacity }}>
                {POP_PACKAGES.map((box) => (
                  <g key={box.id}>
                    {box.faces.map((face, i) => (
                      <path
                        key={i}
                        d={face}
                        fill={
                          i === 0 ? "#eee7d8" : i === 1 ? "#8d8d6d" : box.color
                        }
                        stroke="#f2e6cf"
                        strokeWidth=".5"
                      />
                    ))}
                  </g>
                ))}
              </motion.g>
            )}
          </g>
        ))}
      </svg>
      <div className={styles.story} aria-live="polite">
        <span>{stages[stage].detail}</span>
        <strong>{stages[stage].title}</strong>
      </div>
      <div className={styles.controls}>
        <div
          className={styles.steps}
          role="group"
          aria-label="Etapas del exhibidor"
        >
          {stages.map((item, i) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={stage === i}
              onClick={() => selectStage(i)}
            >
              <span>0{i + 1}</span>
              {item.label}
              {i < 2 && <ArrowRight size={12} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.play}
          onClick={() => {
            if (playing) {
              controls.current?.pause();
              setPlaying(false);
              setPaused(true);
            } else if (paused) {
              controls.current?.play();
              setPlaying(true);
              setPaused(false);
            } else play();
          }}
        >
          {playing ? (
            <Pause size={14} />
          ) : started && !paused ? (
            <RotateCcw size={14} />
          ) : (
            <Play size={14} />
          )}
          {playing
            ? "Pausar"
            : paused
              ? "Continuar"
              : started
                ? "Repetir"
                : "Ver transformación"}
        </button>
      </div>
      <p className={styles.caption}>
        Ejemplo ilustrativo de despiece y nesting. El acomodo real depende de
        las piezas y del formato del material.
      </p>
    </div>
  );
}
