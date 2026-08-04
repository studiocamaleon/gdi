/**
 * Logo de la marca como textura de canvas para la lona del cartel 3D.
 * Port de signage/signage-logo.jsx (sólo el lockup plano; el tracer de
 * contornos para corpóreas queda para F3).
 *
 * A futuro: reemplazar por el arte del cliente (SVG subido) — F4.
 */
import * as THREE from "three";

function grafoLogoCanvas({ ink = "#17171d", scale = 1 } = {}): HTMLCanvasElement & {
  _aspect?: number;
} {
  const markPx = 150 * scale;
  const pad = 44 * scale;
  const gap = 40 * scale;
  const fontSize = 118 * scale;
  const fontSpec = `700 ${fontSize}px Geist, "Geist", Inter, system-ui, -apple-system, sans-serif`;
  const word = "grafoprint";

  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = fontSpec;
  const tw = meas.measureText(word).width;

  const W = Math.ceil(pad + markPx + gap + tw + pad);
  const H = Math.ceil(pad * 2 + markPx);
  const c = document.createElement("canvas") as HTMLCanvasElement & {
    _aspect?: number;
  };
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, W, H);

  // Isotipo (grafo de nodos, viewBox 24×24)
  const mx = pad;
  const my = pad;
  const s = markPx / 24;
  const P = (vx: number, vy: number): [number, number] => [
    mx + vx * s,
    my + vy * s,
  ];
  x.strokeStyle = ink;
  x.fillStyle = ink;
  x.lineCap = "round";
  x.lineJoin = "round";
  x.lineWidth = 1.4 * s;
  const edge = (a: [number, number], b: [number, number], op = 1) => {
    x.globalAlpha = op;
    x.beginPath();
    const [ax, ay] = P(a[0], a[1]);
    const [bx, by] = P(b[0], b[1]);
    x.moveTo(ax, ay);
    x.lineTo(bx, by);
    x.stroke();
  };
  edge([5.5, 6.5], [18, 6.5]);
  edge([5.5, 6.5], [12, 17.5]);
  edge([18, 6.5], [12, 17.5]);
  edge([18, 6.5], [18, 14.5], 0.55);
  const node = (vx: number, vy: number, r: number, op = 1) => {
    x.globalAlpha = op;
    x.beginPath();
    const [cx, cy] = P(vx, vy);
    x.arc(cx, cy, r * s, 0, Math.PI * 2);
    x.fill();
  };
  node(5.5, 6.5, 2.2);
  node(18, 6.5, 2.2);
  node(12, 17.5, 2.2);
  node(18, 14.5, 1.4, 0.55);
  x.globalAlpha = 1;

  // Wordmark
  x.font = fontSpec;
  x.fillStyle = ink;
  x.textBaseline = "middle";
  x.textAlign = "left";
  x.fillText(word, mx + markPx + gap, my + markPx * 0.52);

  c._aspect = W / H;
  return c;
}

const texCache: Record<string, THREE.CanvasTexture> = {};

export function grafoLogoTexture(ink = "#17171d"): THREE.CanvasTexture {
  if (texCache[ink]) return texCache[ink];
  const canvas = grafoLogoCanvas({ ink });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.userData = { aspect: canvas._aspect };
  texCache[ink] = tex;
  // Redibujar con métricas correctas una vez cargada la tipografía.
  if (document.fonts?.ready) {
    document.fonts.ready
      .then(() => {
        const c2 = grafoLogoCanvas({ ink });
        const ctx = canvas.getContext("2d")!;
        canvas.width = c2.width;
        canvas.height = c2.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(c2, 0, 0);
        tex.userData.aspect = c2._aspect;
        tex.needsUpdate = true;
      })
      .catch(() => {});
  }
  return tex;
}
