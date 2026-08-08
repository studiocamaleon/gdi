"use client";

import * as React from "react";

interface ConstelacionCanvasProps {
  /** Nodos de la esfera de Fibonacci. */
  nodes?: number;
  /** Pulsos naranja simultáneos recorriendo aristas. */
  pulses?: number;
  /** Centro X/Y como fracción del canvas (0..1). */
  cx?: number;
  cy?: number;
  /** Radio como fracción de min(W, H). */
  radius?: number;
  className?: string;
}

const ACC = "255,106,43";

/**
 * Malla 3D "constelación" (misma metáfora del encabezado del sheet): esfera de
 * Fibonacci que rota, con pulsos naranja por las aristas. Canvas manejado por
 * React — rAF con cleanup, ResizeObserver, respeta `prefers-reduced-motion`.
 * Parametrizable para reusar en el encabezado, el sidebar, etc.
 */
export function ConstelacionCanvas({
  nodes: N = 40,
  pulses: P = 3,
  cx: cxF = 0.5,
  cy: cyF = 0.5,
  radius: rF = 0.7,
  className,
}: ConstelacionCanvasProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
        .sort((u, v) => u.d - v.d)
        .slice(0, 3)
        .forEach((o) => {
          if (i < o.j) edges.push([i, o.j]);
        });
    });

    const pulses: Array<{ e: number; t: number; v: number }> = [];
    for (let k = 0; k < P; k++) {
      pulses.push({
        e: (Math.random() * edges.length) | 0,
        t: Math.random(),
        v: 0.005 + Math.random() * 0.007,
      });
    }

    let W = 0;
    let H = 0;
    let ry = 0.3;
    let raf = 0;

    function size() {
      const b = cv!.getBoundingClientRect();
      if (!b.width || !b.height) return;
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
      const cx = W * cxF;
      const cy = H * cyF;
      const rad = Math.min(W, H) * rF;
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
      ry += 0.0024;
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
      ry = 0.6;
      draw();
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [N, P, cxF, cyF, rF]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
