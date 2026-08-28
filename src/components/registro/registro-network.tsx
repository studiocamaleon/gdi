"use client";

import * as React from "react";
import s from "./registro.module.css";

export function RegistroNetwork() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const target = canvas;
    const ctx = context;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nodes = Array.from({ length: 58 }, (_, index) => {
      const y = 1 - (index / 57) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * 2.39996;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, size: 0.6 + Math.random() * 0.7 };
    });
    const edges: [number, number][] = [];
    nodes.forEach((node, index) => {
      nodes.map((other, otherIndex) => ({ otherIndex, distance: (node.x - other.x) ** 2 + (node.y - other.y) ** 2 + (node.z - other.z) ** 2 }))
        .filter(({ otherIndex }) => otherIndex !== index).sort((a, b) => a.distance - b.distance).slice(0, 3)
        .forEach(({ otherIndex }) => { if (index < otherIndex) edges.push([index, otherIndex]); });
    });
    const pulses = Array.from({ length: 4 }, () => ({ edge: Math.floor(Math.random() * edges.length), progress: Math.random(), speed: 0.005 + Math.random() * 0.007 }));
    let width = 0, height = 0, rotation = 0, frameId = 0;
    function resize() {
      const bounds = target.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      target.width = width * dpr; target.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw() {
      rotation += 0.0022;
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2, centerY = height / 2, radius = Math.min(width * 0.5, height) * 0.9;
      const cosine = Math.cos(rotation), sine = Math.sin(rotation);
      const projected = nodes.map((node) => {
        const x = node.x * cosine - node.z * sine, z = node.x * sine + node.z * cosine, perspective = 1 / (2.6 - z * 0.85);
        return { x: centerX + x * radius * perspective * 1.7, y: centerY + node.y * radius * perspective * 1.7, z, size: node.size, perspective };
      });
      edges.forEach(([from, to]) => {
        const a = projected[from], b = projected[to], depth = (a.z + b.z) / 2;
        ctx.strokeStyle = `rgba(20,20,26,${0.05 + Math.max(0, depth + 1) * 0.075})`;
        ctx.lineWidth = depth > 0 ? 1 : 0.7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      projected.forEach((node) => {
        ctx.fillStyle = `rgba(20,20,26,${0.16 + Math.max(0, node.z + 1) * 0.2})`;
        ctx.beginPath(); ctx.arc(node.x, node.y, 1.9 * node.size * node.perspective * 1.5, 0, Math.PI * 2); ctx.fill();
      });
      pulses.forEach((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) { pulse.progress = 0; pulse.edge = Math.floor(Math.random() * edges.length); }
        const edge = edges[pulse.edge]; if (!edge) return;
        const a = projected[edge[0]], b = projected[edge[1]], x = a.x + (b.x - a.x) * pulse.progress, y = a.y + (b.y - a.y) * pulse.progress;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 11);
        gradient.addColorStop(0, "rgba(255,106,43,.5)"); gradient.addColorStop(1, "rgba(255,106,43,0)");
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,106,43,.9)"; ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill();
      });
      frameId = window.requestAnimationFrame(draw);
    }
    resize(); draw(); window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.cancelAnimationFrame(frameId); };
  }, []);

  return <canvas ref={canvasRef} className={s.networkCanvas} aria-hidden="true" />;
}
