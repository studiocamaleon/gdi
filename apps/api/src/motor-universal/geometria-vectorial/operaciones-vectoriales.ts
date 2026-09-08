import { createHash } from 'node:crypto';
import type { FuenteGuardada } from '../../productos-servicios/geometrias/interpretar-vector';
import type { GeometriaVectorialCanonica, PuntoVectorial } from './tipos';

export type OperacionVectorial = FuenteGuardada['operaciones'][number];
export function longitudOperacion(op: OperacionVectorial): number {
  return op.puntos.reduce((s, p, i, ps) => {
    if (i === ps.length - 1 && !op.cerrada) return s;
    const q = ps[(i + 1) % ps.length];
    return s + Math.hypot(q.x - p.x, q.y - p.y);
  }, 0);
}
export function transformarOperaciones(
  ops: OperacionVectorial[],
  angulo: number,
  traslacion: PuntoVectorial,
): OperacionVectorial[] {
  const rad = (angulo * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad);
  return ops.map((op) => ({
    ...op,
    puntos: op.puntos.map((p) => ({
      x: p.x * c - p.y * s + traslacion.x,
      y: p.x * s + p.y * c + traslacion.y,
    })),
  }));
}
export function adjuntarOperacionesGuardadas(
  geometria: GeometriaVectorialCanonica,
  fuente: {
    procedencia?: unknown;
    operaciones?: OperacionVectorial[];
    fabricacion?: FuenteGuardada['fabricacion'];
  },
): GeometriaVectorialCanonica {
  if (
    !fuente.procedencia ||
    (!fuente.operaciones?.length && !fuente.fabricacion)
  )
    return geometria;
  if (geometria.piezas.length !== 1)
    throw new Error(
      'Las operaciones del archivo requieren una sola silueta de producto.',
    );
  const operaciones = fuente.operaciones ?? [];
  const corte = operaciones
    .filter((o) => o.tipo === 'CORTE_INTERIOR')
    .reduce((s, o) => s + longitudOperacion(o), 0);
  return {
    ...geometria,
    hashFuente: createHash('sha256')
      .update(
        geometria.hashFuente +
          JSON.stringify({ operaciones, fabricacion: fuente.fabricacion }),
      )
      .digest('hex'),
    perimetroTotalMm: geometria.perimetroTotalMm + corte,
    piezas: geometria.piezas.map((p) => ({
      ...p,
      operaciones,
      fabricacion: fuente.fabricacion,
      perimetroMm: p.perimetroMm + corte,
    })),
  };
}
