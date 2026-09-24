/** Secuencia histórica compartida por cotización y primera publicación de recetas.
 * Conserva la posición de los extras y el orden unificado propio del producto. */
type PasoSecuencial = { rutaPasoId: string; rutaPasoOrden: number };

export function insertarPasosExtrasEnSecuencia<T extends PasoSecuencial>(
  pasos: T[],
  extras: Array<{
    paso: T;
    insertarDespuesDeRutaPasoId: string | null;
    ordenInterno: number;
  }>,
): T[] {
  const porOrden = (
    a: { ordenInterno: number },
    b: { ordenInterno: number },
  ) => a.ordenInterno - b.ordenInterno;

  const alInicio = extras
    .filter((e) => e.insertarDespuesDeRutaPasoId == null)
    .sort(porOrden);
  const despuesDe = new Map<string, Array<(typeof extras)[number]>>();
  for (const e of extras) {
    if (e.insertarDespuesDeRutaPasoId == null) continue;
    const arr = despuesDe.get(e.insertarDespuesDeRutaPasoId) ?? [];
    arr.push(e);
    despuesDe.set(e.insertarDespuesDeRutaPasoId, arr);
  }

  const rutaPasoIdsPresentes = new Set(pasos.map((p) => p.rutaPasoId));
  const resultado: T[] = [];
  resultado.push(...alInicio.map((e) => e.paso));
  for (const paso of pasos) {
    resultado.push(paso);
    const extrasDelPaso = despuesDe.get(paso.rutaPasoId);
    if (extrasDelPaso) {
      resultado.push(...[...extrasDelPaso].sort(porOrden).map((e) => e.paso));
    }
  }
  // Defensa: extras que apuntan a un RutaPaso que no está en esta ruta
  // (no debería pasar con scope por ruta) se agregan al final.
  for (const e of extras) {
    const ref = e.insertarDespuesDeRutaPasoId;
    if (ref != null && !rutaPasoIdsPresentes.has(ref)) {
      resultado.push(e.paso);
    }
  }

  // Renumerar orden de display 1..N.
  resultado.forEach((paso, index) => {
    paso.rutaPasoOrden = index + 1;
  });
  return resultado;
}

export function ordenarPasosConExtras<T extends PasoSecuencial>(
  pasos: T[],
  extras: Array<{
    paso: T;
    insertarDespuesDeRutaPasoId: string | null;
    ordenInterno: number;
    ordenFlujo: number | null;
  }>,
  ordenBase: Map<string, number | null>,
): T[] {
  const usaOrdenUnificado =
    [...ordenBase.values()].some((orden) => orden != null) ||
    extras.some((extra) => extra.ordenFlujo != null);
  if (!usaOrdenUnificado) return insertarPasosExtrasEnSecuencia(pasos, extras);

  const ordenExtra = new Map(
    extras.map((extra) => [extra.paso.rutaPasoId, extra.ordenFlujo]),
  );
  const resultado = [...pasos, ...extras.map((extra) => extra.paso)].sort(
    (a, b) => {
      const ordenA =
        ordenBase.get(a.rutaPasoId) ?? ordenExtra.get(a.rutaPasoId) ?? null;
      const ordenB =
        ordenBase.get(b.rutaPasoId) ?? ordenExtra.get(b.rutaPasoId) ?? null;
      if (ordenA == null && ordenB == null)
        return a.rutaPasoOrden - b.rutaPasoOrden;
      if (ordenA == null) return 1;
      if (ordenB == null) return -1;
      return ordenA - ordenB;
    },
  );
  resultado.forEach((paso, index) => {
    paso.rutaPasoOrden = index + 1;
  });
  return resultado;
}
