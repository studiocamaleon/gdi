import type { ContornoVectorial } from './tipos';

export const ANGULOS_ROTACION_VECTORIAL = Array.from(
  { length: 36 },
  (_, index) => index * 5,
);

export function angulosVectoriales(permitirRotacion: boolean): number[] {
  return permitirRotacion ? ANGULOS_ROTACION_VECTORIAL : [0];
}

export function rotarContornosVectoriales(
  contornos: ContornoVectorial[],
  rotacion: number,
): {
  contornos: ContornoVectorial[];
  anchoMm: number;
  altoMm: number;
} {
  if (rotacion === 0) {
    const caja = bounds(contornos.flatMap((contorno) => contorno.puntos));
    return {
      contornos,
      anchoMm: redondear(caja.maxX - caja.minX),
      altoMm: redondear(caja.maxY - caja.minY),
    };
  }

  const radians = (rotacion * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotados = contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((point) => ({
      x: point.x * cos - point.y * sin,
      y: point.x * sin + point.y * cos,
    })),
  }));
  const caja = bounds(rotados.flatMap((contorno) => contorno.puntos));
  return {
    anchoMm: redondear(caja.maxX - caja.minX),
    altoMm: redondear(caja.maxY - caja.minY),
    contornos: rotados.map((contorno) => ({
      ...contorno,
      puntos: contorno.puntos.map((point) => ({
        x: redondear(point.x - caja.minX),
        y: redondear(point.y - caja.minY),
      })),
    })),
  };
}

function bounds(points: Array<{ x: number; y: number }>) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
}

function redondear(value: number): number {
  return Math.round(value * 1000) / 1000;
}
