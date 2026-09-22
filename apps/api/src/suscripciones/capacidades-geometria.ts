import type { ClaveCapacidad } from './evaluador-capacidades';

/** La fuente elegida al cotizar es una herramienta avanzada. Los cálculos
 * que el motor deriva de una receta publicada no pasan por este input. */
export function capacidadesJobGeometria(job: unknown): ClaveCapacidad[] {
  if (!job || typeof job !== 'object') return [];
  const tieneContenido = (v: unknown) =>
    Array.isArray(v)
      ? v.length > 0
      : v && typeof v === 'object'
        ? Object.keys(v).length > 0
        : Boolean(v);
  const claves = new Set([
    'disenoVectorialFuente',
    'disenosVectoriales',
    'coleccionesVectoriales',
    'disenoVectorialCacheKey',
    'geometriaVectorial',
    'geometriasVectoriales',
  ]);
  // Los overrides de componentes y ocurrencias también son entrada del cliente.
  // Se examinan antes de que el motor derive sus cálculos internos.
  const pendientes: object[] = [job];
  const visitados = new WeakSet<object>();
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    const registro = actual as Record<string, unknown>;
    if (
      registro.tipo === 'REFERENCIA_GEOMETRIA' ||
      (registro.svg && registro.procedencia)
    )
      return ['analisis_vectorial', 'aprovechamiento_cotizacion', 'nesting_irregular'];
    for (const [clave, valor] of Object.entries(registro)) {
      if (claves.has(clave) && tieneContenido(valor))
        return ['analisis_vectorial', 'aprovechamiento_cotizacion', 'nesting_irregular'];
      if (valor && typeof valor === 'object') pendientes.push(valor);
    }
  }
  return [];
}
