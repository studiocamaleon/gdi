import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import type { Patron, SeleccionPatrones } from './cartera-patrones';

/** Representa un resultado validado dentro de la cartera actual. No se
 * presupone que todas sus placas estén disponibles en una cartera parcial. */
export function seleccionInicialDeResultado(
  input: NestingIrregularOpenNestData,
  cartera: Patron[],
  resultado?: NestingIrregularOpenNestResult,
): SeleccionPatrones['seleccion'] | undefined {
  if (!resultado) return undefined;
  const tipos = new Map(input.piezas.map((p, i) => [p.id, i]));
  const indices = new Map<string, number>();
  cartera.forEach((p, i) => {
    const clave = p.counts.join(',');
    if (!indices.has(clave)) indices.set(clave, i);
  });
  const placas = new Map<number, number[]>();
  const demanda = input.piezas.map(() => 0);
  for (const placement of resultado.placements) {
    const tipo = tipos.get(placement.piezaId);
    if (tipo === undefined) return undefined;
    const counts = placas.get(placement.placa) ?? input.piezas.map(() => 0);
    counts[tipo]++;
    demanda[tipo]++;
    placas.set(placement.placa, counts);
  }
  if (
    placas.size !== resultado.placasUsadas ||
    demanda.some((n, i) => n !== input.piezas[i].cantidad)
  )
    return undefined;
  const repeticiones = new Map<number, number>();
  for (const counts of placas.values()) {
    const indice = indices.get(counts.join(','));
    if (indice === undefined) return undefined;
    repeticiones.set(indice, (repeticiones.get(indice) ?? 0) + 1);
  }
  return [...repeticiones].map(([patron, repeticiones]) => ({
    patron,
    repeticiones,
  }));
}
