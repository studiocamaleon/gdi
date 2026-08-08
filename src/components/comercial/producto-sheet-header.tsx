"use client";

import * as React from "react";

import s from "./producto-sheet-header.module.css";

interface ProductoSheetHeaderProps {
  /** Nombre del producto (título grande). */
  name: string;
  /** Descripción bajo el título. */
  desc: string;
  /** Línea mono en mayúsculas: familia · unidad de cobro. */
  eyebrow: string;
  onBack: () => void;
  /** Cierra el sheet (X arriba a la derecha). */
  onClose?: () => void;
}

/**
 * Encabezado del sheet "Agregar producto" — modelo D "Constelación del login".
 * La malla 3D es una esfera de Fibonacci que rota; los pulsos naranja recorren
 * las aristas. Portado del prototipo de claude.ai/design a un canvas manejado
 * por React (rAF con cleanup, ResizeObserver, respeta `prefers-reduced-motion`).
 */
export function ProductoSheetHeaderConstelacion({
  name,
  desc,
  eyebrow,
  onBack,
  onClose,
}: ProductoSheetHeaderProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const ACC = "255,106,43";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = 46;

    // Nodos sobre una esfera de Fibonacci.
    const nodes: Array<{ x: number; y: number; z: number; sc: number }> = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * 2.39996;
      nodes.push({
        x: Math.cos(th) * r,
        y,
        z: Math.sin(th) * r,
        sc: 0.6 + Math.random() * 0.7,
      });
    }

    // Aristas: cada nodo con sus 3 vecinos más cercanos (sin duplicar).
    const edges: Array<[number, number]> = [];
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({
          j,
          d:
            (a.x - b.x) * (a.x - b.x) +
            (a.y - b.y) * (a.y - b.y) +
            (a.z - b.z) * (a.z - b.z),
        }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .forEach((o) => {
          if (i < o.j) edges.push([i, o.j]);
        });
    });

    const pulses: Array<{ e: number; t: number; v: number }> = [];
    for (let k = 0; k < 4; k++) {
      pulses.push({
        e: (Math.random() * edges.length) | 0,
        t: Math.random(),
        v: 0.006 + Math.random() * 0.008,
      });
    }

    let W = 0;
    let H = 0;
    let ry = 0;
    let raf = 0;

    function size() {
      const b = cv!.getBoundingClientRect();
      if (!b.width) return;
      W = b.width;
      H = b.height;
      cv!.width = W * dpr;
      cv!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!W) {
        size();
        if (!W) return;
      }
      ctx!.clearRect(0, 0, W, H);
      const cx = W * 0.74;
      const cy = H / 2;
      const rad = Math.min(W * 0.5, H) * 0.92;
      const cos = Math.cos(ry);
      const sin = Math.sin(ry);
      const p = nodes.map((n) => {
        const x = n.x * cos - n.z * sin;
        const z = n.x * sin + n.z * cos;
        const pr = 1 / (2.6 - z * 0.85);
        return {
          X: cx + x * rad * pr * 1.9,
          Y: cy + n.y * rad * pr * 1.9,
          z,
          sc: n.sc,
          pr,
        };
      });
      edges.forEach((e) => {
        const a = p[e[0]];
        const b = p[e[1]];
        const dp = (a.z + b.z) / 2;
        ctx!.strokeStyle =
          "rgba(20,20,26," + (0.05 + Math.max(0, dp + 1) * 0.075).toFixed(3) + ")";
        ctx!.lineWidth = dp > 0 ? 1 : 0.7;
        ctx!.beginPath();
        ctx!.moveTo(a.X, a.Y);
        ctx!.lineTo(b.X, b.Y);
        ctx!.stroke();
      });
      p.forEach((n) => {
        ctx!.fillStyle =
          "rgba(20,20,26," + (0.16 + Math.max(0, n.z + 1) * 0.2).toFixed(3) + ")";
        ctx!.beginPath();
        ctx!.arc(n.X, n.Y, 1.9 * n.sc * n.pr * 1.6, 0, 6.2832);
        ctx!.fill();
      });
      pulses.forEach((u) => {
        const e = edges[u.e];
        if (!e) return;
        const a = p[e[0]];
        const b = p[e[1]];
        const X = a.X + (b.X - a.X) * u.t;
        const Y = a.Y + (b.Y - a.Y) * u.t;
        const g = ctx!.createRadialGradient(X, Y, 0, X, Y, 10);
        g.addColorStop(0, "rgba(" + ACC + ",.5)");
        g.addColorStop(1, "rgba(" + ACC + ",0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(X, Y, 10, 0, 6.2832);
        ctx!.fill();
        ctx!.fillStyle = "rgba(" + ACC + ",.85)";
        ctx!.beginPath();
        ctx!.arc(X, Y, 1.7, 0, 6.2832);
        ctx!.fill();
      });
    }

    function loop() {
      ry += 0.0026;
      pulses.forEach((u) => {
        u.t += u.v;
        if (u.t > 1) {
          u.t = 0;
          u.e = (Math.random() * edges.length) | 0;
        }
      });
      draw();
      raf = requestAnimationFrame(loop);
    }

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ro = new ResizeObserver(() => {
      size();
      if (reduce) draw();
    });
    ro.observe(cv);

    size();
    if (reduce) {
      // Un solo cuadro estático, sin loop ni pulsos animándose.
      ry = 0.6;
      draw();
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={s.header}>
      <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />
      <span className={s.veil} aria-hidden="true" />
      <div className={s.inner}>
        <button type="button" className={s.back} onClick={onBack}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Cambiar
        </button>
        <span className={s.nm}>
          <span className={s.eyebrow}>{eyebrow}</span>
          <h2 className={s.title}>{name}</h2>
          <span className={s.desc}>{desc}</span>
        </span>
        {onClose ? (
          <button
            type="button"
            className={s.close}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
