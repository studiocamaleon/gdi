import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';

/** Un único patrón repetido P veces exige que cada demanda sea divisible por P.
 * Si no lo es, hacen falta al menos dos. Es una cota, no una promesa geométrica.
 */
export function minimoTeoricoPatrones(
  input: NestingIrregularOpenNestData,
  placas: number,
): number {
  return input.piezas.every((p) => p.cantidad % placas === 0) ? 1 : 2;
}

export function esMejorResultado(
  candidato: NestingIrregularOpenNestResult,
  actual: NestingIrregularOpenNestResult,
): boolean {
  if (candidato.placasUsadas !== actual.placasUsadas)
    return candidato.placasUsadas < actual.placasUsadas;
  const patrones =
    contarPatronesResultado(candidato) - contarPatronesResultado(actual);
  if (patrones !== 0) return patrones < 0;
  const ahorro =
    (candidato.commonLine?.longitudCompartidaMm ?? 0) -
    (actual.commonLine?.longitudCompartidaMm ?? 0);
  if (Math.abs(ahorro) > 0.01) return ahorro > 0;
  const area = areaEnvolvente(candidato) - areaEnvolvente(actual);
  if (Math.abs(area) > 0.01) return area < 0;
  return actual.calidadSolucion === 'BASE_SEGURA';
}

/** Resultados ya validados del mismo problema. La pose y el ID determinan
 * contornos, capas y operaciones de cada copia; no basta con sus cantidades.
 * Se usa la precisión de seis decimales de las exportaciones, sin mover piezas.
 */
export function contarPatronesResultado(
  result: NestingIrregularOpenNestResult,
): number {
  const redondear = (n: number) => Math.round(n * 1e6) / 1e6;
  const placas = new Map<number, string[]>();
  const poses = new Map<string, string>();
  for (const p of result.placements) {
    const pose = JSON.stringify([
      p.piezaId,
      redondear(p.rotacionGrados),
      redondear(p.traslacion.x),
      redondear(p.traslacion.y),
    ]);
    poses.set(`${p.piezaId}:${p.copia}`, pose);
    const piezas = placas.get(p.placa) ?? [];
    piezas.push(pose);
    placas.set(p.placa, piezas);
  }
  const cortes = new Map<number, string[]>();
  for (const tramo of result.commonLine?.tramos ?? []) {
    const valores = cortes.get(tramo.placa) ?? [];
    valores.push(
      JSON.stringify([
        redondear(tramo.inicio.x),
        redondear(tramo.inicio.y),
        redondear(tramo.fin.x),
        redondear(tramo.fin.y),
        tramo.segmentosOrigen
          .map((s) => [poses.get(`${s.piezaId}:${s.copia}`), s.indiceSegmento])
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ]),
    );
    cortes.set(tramo.placa, valores);
  }
  return new Set(
    [...placas].map(([indice, piezas]) =>
      JSON.stringify([piezas.sort(), (cortes.get(indice) ?? []).sort()]),
    ),
  ).size;
}

function areaEnvolvente(result: NestingIrregularOpenNestResult): number {
  const placas = new Map<
    number,
    { minX: number; minY: number; maxX: number; maxY: number }
  >();
  for (const p of result.placements) {
    const caja = placas.get(p.placa) ?? {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    for (const punto of p.contorno) {
      caja.minX = Math.min(caja.minX, punto.x);
      caja.maxX = Math.max(caja.maxX, punto.x);
      caja.minY = Math.min(caja.minY, punto.y);
      caja.maxY = Math.max(caja.maxY, punto.y);
    }
    placas.set(p.placa, caja);
  }
  return [...placas.values()].reduce(
    (area, c) => area + (c.maxX - c.minX) * (c.maxY - c.minY),
    0,
  );
}
