"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Layers3,
  Lightbulb,
  RotateCcw,
  MoveUpRight,
  Box,
  Zap,
  ScanLine,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
const SignScene = dynamic(() => import("./sign-scene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <Layers3 size={28} />
      <span>Preparando el modelo 3D</span>
    </div>
  ),
});
const layers = [
  {
    title: "El frente",
    detail:
      "El material que lleva tu diseño. Medidas, terminación y consumo conectados con la cotización.",
    tag: "MATERIAL + TERMINACIÓN",
    icon: ScanLine,
  },
  {
    title: "La iluminación",
    detail:
      "Módulos LED, fuente y distribución. Cada componente cuenta antes de empezar a fabricar.",
    tag: "COMPONENTES + COSTOS",
    icon: Zap,
  },
  {
    title: "La estructura",
    detail:
      "Perfiles, refuerzos y fondo. La construcción del cartel forma parte de la orden de trabajo.",
    tag: "ESTRUCTURA + PRODUCCIÓN",
    icon: Box,
  },
];
export function SignExperience() {
  const section = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false),
    [progress, setProgress] = useState(0),
    [illuminated, setIlluminated] = useState(true),
    [active, setActive] = useState(0);
  const manual = useRef(false),
    reduced = useReducedMotion();
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "350px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const scroll = () => {
      if (manual.current || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = section.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const next = Math.min(
          1,
          Math.max(
            0,
            (window.innerHeight * 0.45 - rect.top) / (window.innerHeight * 0.6),
          ),
        );
        setProgress(next);
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);
  const selectLayer = (index: number) => {
    manual.current = true;
    setActive(index);
    setProgress(1);
  };
  const Icon = layers[active].icon;
  return (
    <section
      id="carteleria"
      className="sign-section section-shell"
      ref={section}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow dark-eyebrow">02 / CARTELERÍA</span>
          <h2>
            Lo que ves es un cartel.
            <br />
            <span>Grafo ve cada detalle.</span>
          </h2>
        </div>
        <p>
          Descubrí todo lo que hay detrás de un trabajo.
          <br />Y todo lo que podés tener bajo control.
        </p>
      </div>
      <div className="sign-stage">
        <div className="stage-top">
          <span className="technical-label">GRAFO / BACKLIGHT</span>
          <span className="scene-type">
            <Box size={14} /> Modelo 3D interactivo
          </span>
        </div>
        {mounted ? (
          <SignScene progress={progress} illuminated={illuminated} />
        ) : (
          <div className="scene-loading">
            <Layers3 size={28} />
            <span>Explorá la construcción del cartel</span>
          </div>
        )}
        <div className="stage-hint">
          <MoveUpRight size={15} />
          <span>Arrastrá para cambiar la perspectiva</span>
        </div>
        <div className="stage-controls">
          <button
            type="button"
            className={
              progress > 0.5 ? "scene-button selected" : "scene-button"
            }
            aria-pressed={progress > 0.5}
            onClick={() => {
              manual.current = true;
              setProgress(progress > 0.5 ? 0 : 1);
            }}
          >
            <Layers3 size={17} />
            {progress > 0.5 ? "Cerrar cartel" : "Abrir cartel"}
          </button>
          <button
            type="button"
            className="scene-button"
            aria-pressed={illuminated}
            onClick={() => setIlluminated(!illuminated)}
          >
            <Lightbulb size={17} />
            {illuminated ? "Apagar luz" : "Encender luz"}
          </button>
          <button
            type="button"
            className="scene-button reset-scene"
            aria-label="Reiniciar apertura del cartel"
            onClick={() => {
              manual.current = true;
              setProgress(0);
              setActive(0);
              setIlluminated(true);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="scene-progress">
          <label htmlFor="sign-explode">
            Apertura <span>{Math.round(progress * 100)}%</span>
          </label>
          <input
            id="sign-explode"
            type="range"
            min="0"
            max="100"
            value={Math.round(progress * 100)}
            onChange={(e) => {
              manual.current = true;
              setProgress(Number(e.target.value) / 100);
            }}
            aria-label="Separación de las capas del cartel"
          />
        </div>
      </div>
      <div className="layer-details">
        <div
          className="layer-tabs"
          role="tablist"
          aria-label="Capas del cartel"
        >
          {layers.map((layer, i) => (
            <button
              key={layer.title}
              id={`layer-tab-${i}`}
              aria-controls="layer-panel"
              role="tab"
              aria-selected={active === i}
              tabIndex={active === i ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 2
                        : (active + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                  selectLayer(next);
                  document.getElementById(`layer-tab-${next}`)?.focus();
                }
              }}
              onClick={() => selectLayer(i)}
            >
              <span>0{i + 1}</span>
              {layer.title}
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
        <div
          id="layer-panel"
          role="tabpanel"
          aria-labelledby={`layer-tab-${active}`}
          className="layer-panel"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduced ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <span className="layer-tag">
                <Icon size={15} />
                {layers[active].tag}
              </span>
              <p>{layers[active].detail}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
