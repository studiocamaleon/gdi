"use client";

import * as React from "react";

type NodePoint = {
  x: number;
  y: number;
  z: number;
  size: number;
  major: boolean;
};

type Edge = {
  a: number;
  b: number;
};

type Pulse = {
  edge: Edge;
  t: number;
  speed: number;
  forward: boolean;
};

export function LoginConstellation() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let frameId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      cx = w / 2;
      cy = h / 2;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const nodeCount = 90;
    const nodes: NodePoint[] = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const t = (i + 0.5) / nodeCount;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      nodes.push({
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
        size: 0.7 + Math.random() * 1.4,
        major: Math.random() < 0.14,
      });
    }

    const edgeSet = new Set<string>();
    const edges: Edge[] = [];
    nodes.forEach((node, i) => {
      const dists: Array<{ j: number; d: number }> = [];
      for (let j = 0; j < nodes.length; j += 1) {
        if (j === i) continue;
        const other = nodes[j]!;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dz = node.z - other.z;
        dists.push({ j, d: dx * dx + dy * dy + dz * dz });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < 3; k += 1) {
        const j = dists[k]!.j;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ a: Math.min(i, j), b: Math.max(i, j) });
        }
      }
    });

    const adjacency = nodes.map<Array<{ edgeIdx: number; neighbor: number }>>(() => []);
    edges.forEach((edge, edgeIdx) => {
      adjacency[edge.a]!.push({ edgeIdx, neighbor: edge.b });
      adjacency[edge.b]!.push({ edgeIdx, neighbor: edge.a });
    });

    const newPulse = (startEdge?: Edge): Pulse => {
      const edge = startEdge ?? edges[Math.floor(Math.random() * edges.length)]!;
      return {
        edge,
        t: 0,
        speed: 0.004 + Math.random() * 0.006,
        forward: Math.random() < 0.5,
      };
    };

    const pulses = Array.from({ length: 7 }, () => {
      const pulse = newPulse();
      pulse.t = Math.random();
      return pulse;
    });

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let ingressBoost = 1;
    let angle = 0;
    let lastT = performance.now();
    let running = !document.hidden;

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetMouseY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onMouseLeave = () => {
      targetMouseX = 0;
      targetMouseY = 0;
    };
    const onVisibilityChange = () => {
      running = !document.hidden;
      if (running) {
        lastT = performance.now();
        frameId = requestAnimationFrame(render);
      }
    };

    canvas.parentElement?.addEventListener("mousemove", onMouseMove);
    canvas.parentElement?.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);

    function render(now: number) {
      const dt = Math.min(50, now - lastT) / 1000;
      lastT = now;
      if (!running) return;

      const isIngressing = canvasRef.current?.closest(".gp-login")?.classList.contains("ingressing") ?? false;
      const targetIngressBoost = isIngressing ? 8 : 1;
      ingressBoost += (targetIngressBoost - ingressBoost) * Math.min(1, dt * 4);

      angle += dt * 0.08 * ingressBoost;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      const ry = angle + mouseX * 0.4;
      const rx = -0.25 + mouseY * 0.25;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const zoom = Math.min(0.42 + (ingressBoost - 1) * 0.06, 0.85);
      const radius = Math.min(w, h) * zoom;
      const persp = 3.2;

      const projected = nodes.map((node) => {
        const x = node.x * cosY - node.z * sinY;
        const z = node.x * sinY + node.z * cosY;
        const y2 = node.y * cosX - z * sinX;
        const z2 = node.y * sinX + z * cosX;
        const scale = persp / (persp - z2);
        return {
          px: cx + x * radius * scale,
          py: cy + y2 * radius * scale,
          depth: (z2 + 1) / 2,
          scale,
        };
      });

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i]!;
        const a = projected[edge.a]!;
        const b = projected[edge.b]!;
        const avgDepth = (a.depth + b.depth) / 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + avgDepth * 0.25})`;
        ctx.lineWidth = 0.4 + avgDepth * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
      }

      pulses.forEach((pulse) => {
        pulse.t += pulse.speed * (60 * dt) * ingressBoost;
        if (pulse.t >= 1) {
          const endNode = pulse.forward ? pulse.edge.b : pulse.edge.a;
          const options = adjacency[endNode]!;
          const next = options[Math.floor(Math.random() * options.length)];
          if (next) {
            pulse.edge = edges[next.edgeIdx]!;
            pulse.forward = pulse.edge.a === endNode;
          }
          pulse.t = 0;
        }
        const a = projected[pulse.edge.a]!;
        const b = projected[pulse.edge.b]!;
        const t = pulse.forward ? pulse.t : 1 - pulse.t;
        const px = a.px + (b.px - a.px) * t;
        const py = a.py + (b.py - a.py) * t;
        const depth = a.depth + (b.depth - a.depth) * t;
        const r = 1.5 + depth * 2.2;
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
        gradient.addColorStop(0, `rgba(255,255,255,${0.6 + depth * 0.4})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.85 + depth * 0.15})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      });

      const order = projected.map((_, i) => i).sort((a, b) => projected[a]!.depth - projected[b]!.depth);
      for (const i of order) {
        const point = projected[i]!;
        const node = nodes[i]!;
        const baseSize = node.size * (0.5 + point.scale * 0.7);
        const alpha = 0.15 + point.depth * 0.85;
        if (node.major) {
          const r = baseSize * 3.5;
          const gradient = ctx.createRadialGradient(point.px, point.py, 0, point.px, point.py, r);
          gradient.addColorStop(0, `rgba(255,255,255,${0.35 * alpha})`);
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.px, point.py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(point.px, point.py, baseSize * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(point.px, point.py, baseSize * 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(point.px, point.py, baseSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      frameId = requestAnimationFrame(render);
    }

    frameId = requestAnimationFrame((now) => {
      lastT = now;
      render(now);
    });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mousemove", onMouseMove);
      canvas.parentElement?.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation" aria-hidden="true" />;
}
