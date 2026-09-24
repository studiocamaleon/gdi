"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, RotateCcw, ScanLine } from "lucide-react";
import styles from "./nesting-showcase.module.css";
import { PopNestingScene } from "./pop-nesting-scene";

type Mode = "pop" | "roll" | "sheet" | "irregular";
type Piece = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
const modes: { key: Mode; label: string; detail: string }[] = [
  { key: "pop", label: "Exhibidor POP", detail: "Del objeto a la placa" },
  { key: "roll", label: "Rollos", detail: "Rectangular" },
  { key: "sheet", label: "Placas", detail: "Rectangular" },
  { key: "irregular", label: "Formas irregulares", detail: "Sobre placas" },
];
const rectangles: Piece[] = [
  { x: 20, y: 20, width: 180, height: 100 },
  { x: 208, y: 20, width: 100, height: 100 },
  { x: 316, y: 20, width: 120, height: 100 },
  { x: 444, y: 20, width: 130, height: 100 },
  { x: 20, y: 128, width: 100, height: 140 },
  { x: 128, y: 128, width: 180, height: 60 },
  { x: 316, y: 128, width: 130, height: 60 },
  { x: 454, y: 128, width: 120, height: 60 },
  { x: 128, y: 196, width: 150, height: 72 },
  { x: 286, y: 196, width: 90, height: 72 },
  { x: 384, y: 196, width: 80, height: 72 },
  { x: 472, y: 196, width: 102, height: 72 },
];
const contours: Piece[] = Array.from({ length: 12 }, (_, i) => ({
  x: 22 + (Math.floor(i / 2) % 3) * 188 + (i % 2) * 40,
  y: 42 + Math.floor(i / 6) * 156,
  width: 96,
  height: 96,
  rotation: i % 2 ? 180 : 0,
}));

export function NestingShowcase({
  isLive,
  rectangularPlans,
  irregularPlans,
}: {
  isLive: boolean;
  rectangularPlans: string[];
  irregularPlans: string[];
}) {
  const [mode, setMode] = useState<Mode>("pop");
  const [run, setRun] = useState(0);
  const reducedMotion = useReducedMotion();
  const patternId = useId().replaceAll(":", "");
  const irregular = mode === "irregular" || mode === "pop";
  const pieces = irregular ? contours : rectangles;
  const plans = irregular ? irregularPlans : rectangularPlans;
  const descriptions = {
    pop: "Laterales, estantes y cabecera: cada parte del exhibidor se separa, gira y encuentra su posición en la placa. El nesting conecta el diseño con el material que vas a usar.",
    roll: "Distribuí piezas rectangulares sobre el ancho útil del rollo y calculá el largo de material que necesita el trabajo.",
    sheet:
      "Acomodá las piezas dentro de cada placa o pliego, respetando el formato, los márgenes y la separación configurada.",
    irregular:
      "Aprovechá la forma real de las piezas. Grafo acomoda contornos vectoriales sobre placas, considerando sus giros y la separación entre ellos.",
  };

  return (
    <section
      className={`${styles.section} section-shell`}
      id="nesting"
      aria-labelledby="nesting-title"
    >
      <div className={styles.copy}>
        <span className="eyebrow dark-eyebrow">
          GRAFONEST · APROVECHAMIENTO DE MATERIAL
        </span>
        <h2 id="nesting-title">
          Cada forma <br />
          encuentra <br />
          <span>su lugar.</span>
        </h2>
        <p>
          El material también se planifica. Visualizá cómo se distribuyen tus
          piezas y llevá ese aprovechamiento a la cotización.
        </p>
        <div className={styles.detail} aria-live="polite">
          <span className={styles.index}>
            {String(modes.findIndex((m) => m.key === mode) + 1).padStart(
              2,
              "0",
            )}{" "}
            / {irregular ? "POR CONTORNO" : "POR MEDIDAS"}
          </span>
          <h3>
            {mode === "pop"
              ? "Del exhibidor a la placa."
              : mode === "roll"
                ? "Del ancho al largo necesario."
                : irregular
                  ? "Más allá del rectángulo."
                  : "La placa, bien distribuida."}
          </h3>
          <p>{descriptions[mode]}</p>
          <span className={styles.availability}>
            {!isLive
              ? "Planes y disponibilidad: próximamente"
              : plans.length
                ? `Incluido en ${plans.join(" · ")}`
                : "Consultá la disponibilidad por plan"}
          </span>
        </div>
        <a className="text-link dark-link" href="#comparar-planes">
          {isLive ? "Compará las funciones" : "Conocé el próximo lanzamiento"}{" "}
          <ArrowUpRight size={16} />
        </a>
      </div>
      <div className={styles.demo}>
        <div className={styles.top}>
          <span>
            <ScanLine size={18} aria-hidden="true" /> GrafoNest
          </span>
          <span>VISTA DE APROVECHAMIENTO</span>
        </div>
        <div className={styles.modes} role="group" aria-label="Tipo de nesting">
          {modes.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={mode === item.key}
              onClick={() => setMode(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
        {mode === "pop" ? (
          <PopNestingScene />
        ) : (
          <>
            <div className={styles.canvas}>
              <div className={styles.dimension}>
                <span />
                {mode === "roll" ? "ANCHO ÚTIL DEL ROLLO" : "ANCHO DE LA PLACA"}
                <span />
              </div>
              <svg
                viewBox="0 0 600 390"
                role="img"
                aria-label={`Ejemplo ilustrativo: nesting ${irregular ? "irregular" : "rectangular"} en ${mode === "roll" ? "rollo" : "placa"}`}
              >
                <defs>
                  <pattern
                    id={patternId}
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="#343c3e"
                      strokeWidth=".55"
                    />
                  </pattern>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="598"
                  height="375"
                  rx="3"
                  fill={`url(#${patternId})`}
                  stroke="#647073"
                  strokeDasharray={mode === "roll" ? "0" : "5 4"}
                />
                <rect
                  x="12"
                  y="12"
                  width="576"
                  height="352"
                  rx="2"
                  fill="none"
                  stroke="#616b69"
                  strokeDasharray="3 5"
                  opacity=".55"
                />
                <g key={`${mode}-${run}`}>
                  {pieces.map((piece, i) => (
                    <motion.g
                      key={i}
                      initial={
                        reducedMotion ? false : { x: 300, y: -110, opacity: 0 }
                      }
                      animate={{ x: piece.x, y: piece.y, opacity: 1 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.65,
                        delay: reducedMotion ? 0 : i * 0.055,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {irregular ? (
                        <path
                          d="M0 0H96V36H36V96H0Z"
                          transform={`rotate(${piece.rotation} 48 48)`}
                          fill={i % 2 ? "#82452e" : "#c46b42"}
                          stroke="#ffad7e"
                          strokeWidth="1.2"
                        />
                      ) : (
                        <>
                          <rect
                            width={piece.width}
                            height={piece.height}
                            rx="2"
                            fill={
                              i % 3 === 0
                                ? "#c46b42"
                                : i % 3 === 1
                                  ? "#82452e"
                                  : "#505f57"
                            }
                            stroke={i % 3 === 2 ? "#91ad9d" : "#ffad7e"}
                            strokeWidth="1.2"
                          />
                          <text
                            x={piece.width / 2}
                            y={piece.height / 2 + 4}
                            textAnchor="middle"
                            fill="#fff0e4"
                            fontSize="11"
                            fontFamily="monospace"
                          >
                            {String(i + 1).padStart(2, "0")}
                          </text>
                        </>
                      )}
                    </motion.g>
                  ))}
                </g>
                <path
                  d={`M12 ${irregular ? 310 : 284}H588`}
                  stroke="#a7b4ac"
                  strokeDasharray="5 5"
                  opacity=".65"
                />
                <text
                  x="300"
                  y="344"
                  textAnchor="middle"
                  fill="#9ba9a2"
                  fontSize="10"
                  fontFamily="monospace"
                  letterSpacing="2"
                >
                  {mode === "roll"
                    ? "CONTINUIDAD DEL ROLLO ↓"
                    : "MATERIAL SIN OCUPAR"}
                </text>
                {mode === "roll" && (
                  <path
                    d="M1 376q25-12 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t49 0"
                    fill="none"
                    stroke="#8c9990"
                  />
                )}
              </svg>
            </div>
            <div className={styles.bottom}>
              <div>
                <strong>12</strong>
                <span>Piezas</span>
              </div>
              <div>
                <strong>{irregular ? "Contornos" : "Rectángulos"}</strong>
                <span>
                  {mode === "roll" ? "Material en rollo" : "Material en placa"}
                </span>
              </div>
              <button type="button" onClick={() => setRun((n) => n + 1)}>
                <RotateCcw size={14} aria-hidden="true" /> Repetir acomodo
              </button>
            </div>
            <p className={styles.caption}>
              Ejemplo ilustrativo. El resultado depende de las piezas, el
              material y la configuración del trabajo.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
