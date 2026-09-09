import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';

type Pose = Omit<
  NestingIrregularOpenNestResult['placements'][number],
  'contorno' | 'huecos'
>;
type CheckpointPoses = {
  versionCheckpoint: 1;
  resultado: Omit<NestingIrregularOpenNestResult, 'placements'>;
  poses: Pose[];
};

/** La geometría original ya viene en el problema. El checkpoint guarda su
 * pose por copia y los cortes compartidos, sin repetir miles de vértices. */
export function compactarCheckpoint(
  result: NestingIrregularOpenNestResult,
): CheckpointPoses {
  const { placements, ...resultado } = result;
  return {
    versionCheckpoint: 1,
    resultado,
    poses: placements.map(
      ({ contorno: _contorno, huecos: _huecos, ...pose }) => pose,
    ),
  };
}

/** Reconstruir no certifica fabricabilidad: el consumidor vuelve a validar
 * demanda, originales, giros, límites, separación y Common Line. */
export function restaurarCheckpoint(
  input: NestingIrregularOpenNestData,
  json: unknown,
): NestingIrregularOpenNestResult {
  const value = json as CheckpointPoses;
  // Compatibilidad con avances de la primera implementación completa.
  if (value?.versionCheckpoint !== 1)
    return json as NestingIrregularOpenNestResult;
  const piezas = new Map(input.piezas.map((p) => [p.id, p]));
  if (
    !Array.isArray(value.poses) ||
    value.poses.length !== input.piezas.reduce((s, p) => s + p.cantidad, 0)
  )
    throw new Error('El checkpoint no contiene la demanda completa.');
  return {
    ...value.resultado,
    placements: value.poses.map((pose) => {
      const pieza = piezas.get(pose.piezaId);
      if (!pieza) throw new Error('Pieza desconocida en checkpoint.');
      const rad = (pose.rotacionGrados * Math.PI) / 180,
        c = Math.cos(rad),
        s = Math.sin(rad);
      const transformar = (anillo: typeof pieza.contorno) =>
        anillo.map((p) => ({
          x: Math.round((p.x * c - p.y * s + pose.traslacion.x) * 1e6) / 1e6,
          y: Math.round((p.x * s + p.y * c + pose.traslacion.y) * 1e6) / 1e6,
        }));
      return {
        ...pose,
        contorno: transformar(pieza.contorno),
        huecos: (pieza.huecos ?? []).map(transformar),
      };
    }),
  };
}
