import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PuntoTrabajoGeometria,
} from '../colas';

export type CertificadoPackingSolver = {
  certificado: {
    bins: Array<{
      copies: number;
      items: Array<{
        id: number;
        x: number;
        y: number;
        angle: number;
        mirror?: boolean;
      }>;
    }>;
  };
  duracionMs: number;
};
let binarioVersionado: { firma: string; version: string } | undefined;

/** Los lotes grandes necesitan cubrir la preparación antes de aportar un
 * candidato. Con plazos cortos reservamos el tiempo al selector existente. */
export function presupuestoPackingSolver(
  input: NestingIrregularOpenNestData,
  restanteMs: number,
): number {
  const cantidad = input.piezas.reduce((s, p) => s + p.cantidad, 0);
  const presupuesto = Math.min(40_000, Math.floor(restanteMs * 0.35));
  return presupuesto >= (cantidad >= 100 ? 10_000 : 4_000) ? presupuesto : 0;
}

export function configuracionPackingSolver() {
  if (process.env.GRAFONEST_PACKINGSOLVER_ENABLED !== '1') return undefined;
  const ejecutable = process.env.PACKINGSOLVER_BIN?.trim();
  if (!ejecutable) throw new Error('Falta PACKINGSOLVER_BIN.');
  const stat = statSync(ejecutable);
  const firma = `${ejecutable}:${stat.size}:${stat.mtimeMs}`;
  if (binarioVersionado?.firma !== firma)
    binarioVersionado = {
      firma,
      version: `packingsolver:sha256:${createHash('sha256').update(readFileSync(ejecutable)).digest('hex')}`,
    };
  const memoriaMb = Number(
    process.env.GRAFONEST_PACKINGSOLVER_MEMORY_MB ?? 1024,
  );
  if (!Number.isInteger(memoriaMb) || memoriaMb < 64 || memoriaMb > 8192)
    throw new Error(
      'GRAFONEST_PACKINGSOLVER_MEMORY_MB debe estar entre 64 y 8192.',
    );
  return { ejecutable, version: binarioVersionado.version, memoriaMb };
}

export function instanciaPackingSolver(input: NestingIrregularOpenNestData) {
  const polygon = (vertices: PuntoTrabajoGeometria[]) => {
    const area = vertices.reduce((s, p, i) => {
      const q = vertices[(i + 1) % vertices.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0);
    return {
      type: 'polygon',
      vertices: area < 0 ? [...vertices].reverse() : vertices,
    };
  };
  return {
    objective: 'bin-packing',
    parameters: { item_item_minimum_spacing: input.separacionMm },
    bin_types: [
      {
        type: 'rectangle',
        width: input.placa.anchoMm,
        height: input.placa.altoMm,
        copies: input.placa.maxPlacas,
        item_bin_minimum_spacing: input.placa.margenMm,
      },
    ],
    item_types: input.piezas.map((p) => ({
      ...polygon(p.contorno),
      holes: (p.huecos ?? []).map(polygon),
      copies: p.cantidad,
      allow_mirroring: false,
      allowed_rotations: Array.from({ length: p.rotaciones }, (_, i) => ({
        start: (i * 360) / p.rotaciones,
        end: (i * 360) / p.rotaciones,
        mirror: false,
      })),
    })),
  };
}

/** El certificado sólo contiene poses. Reconstruye los originales; no otorga
 * validez geométrica ni convierte la cota del motor en un óptimo global. */
export function convertirPackingSolver(
  input: NestingIrregularOpenNestData,
  candidato: CertificadoPackingSolver,
  version: string,
): Omit<NestingIrregularOpenNestResult, 'validacion'> {
  const raw = candidato?.certificado;
  if (
    !raw ||
    !Array.isArray(raw.bins) ||
    !raw.bins.length ||
    raw.bins.length > input.placa.maxPlacas
  )
    throw new Error('El certificado no contiene placas válidas.');
  const demanda = input.piezas.reduce((s, p) => s + p.cantidad, 0);
  const placements: NestingIrregularOpenNestResult['placements'] = [];
  const copias = input.piezas.map(() => 0);
  let placa = 0;
  for (const bin of raw.bins) {
    if (
      !Number.isSafeInteger(bin.copies) ||
      bin.copies < 1 ||
      bin.copies > input.placa.maxPlacas - placa ||
      !Array.isArray(bin.items) ||
      !bin.items.length ||
      bin.items.length * bin.copies > demanda - placements.length
    )
      throw new Error(
        'El certificado excede las placas o las piezas solicitadas.',
      );
    for (let copy = 0; copy < bin.copies; copy++, placa++)
      for (const pose of bin.items) {
        if (
          !Number.isSafeInteger(pose.id) ||
          !input.piezas[pose.id] ||
          pose.mirror ||
          ![pose.x, pose.y, pose.angle].every(Number.isFinite)
        )
          throw new Error('Pose nativa inválida.');
        const p = input.piezas[pose.id];
        if (copias[pose.id] >= p.cantidad)
          throw new Error('El certificado duplica piezas.');
        const rad = (pose.angle * Math.PI) / 180,
          c = Math.cos(rad),
          s = Math.sin(rad);
        const transformar = (anillo: PuntoTrabajoGeometria[]) =>
          anillo.map((q) => ({
            x: Math.round((q.x * c - q.y * s + pose.x) * 1e6) / 1e6,
            y: Math.round((q.x * s + q.y * c + pose.y) * 1e6) / 1e6,
          }));
        placements.push({
          piezaId: p.id,
          copia: copias[pose.id]++,
          placa,
          rotacionGrados: pose.angle,
          traslacion: { x: pose.x, y: pose.y },
          contorno: transformar(p.contorno),
          huecos: (p.huecos ?? []).map(transformar),
        });
      }
  }
  if (placements.length !== demanda)
    throw new Error('El certificado está incompleto.');
  return {
    schemaVersion: 1,
    algoritmo: 'grafonest-packingsolver-v1',
    motor: input.motor,
    motorEjecutor: 'packingsolver',
    versionMotor: version,
    cantidadSolicitada: demanda,
    cantidadColocada: placements.length,
    placasUsadas: placa,
    placements,
    duracionMs: candidato.duracionMs,
    calidadSolucion: 'OPTIMIZADA',
  };
}
