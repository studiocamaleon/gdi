import type { PuntoRecorridoCorte } from "@/lib/recorridos-vectoriales-api";

export function distanciasAcumuladasRecorrido(
  recorrido: PuntoRecorridoCorte[],
): number[] {
  if (recorrido.length === 0) return [];
  const distancias = [0];
  for (let index = 1; index < recorrido.length; index += 1) {
    distancias.push(
      distancias[index - 1] +
        Math.hypot(
          recorrido[index].x - recorrido[index - 1].x,
          recorrido[index].y - recorrido[index - 1].y,
        ),
    );
  }
  return distancias;
}

/**
 * Devuelve únicamente el tramo efectivamente recorrido. El último punto se
 * interpola dentro del segmento actual para que la animación siempre avance
 * desde el origen y nunca dependa del wrapping visual de un trazo cerrado.
 */
export function tramoVisibleRecorrido(
  recorrido: PuntoRecorridoCorte[],
  distancias: number[],
  distanciaVisible: number,
): PuntoRecorridoCorte[] {
  if (
    recorrido.length < 2 ||
    distancias.length !== recorrido.length ||
    !(distanciaVisible > 0)
  ) {
    return [];
  }

  const total = distancias[distancias.length - 1] ?? 0;
  if (distanciaVisible >= total) return recorrido;

  for (let index = 1; index < recorrido.length; index += 1) {
    const inicioDistancia = distancias[index - 1];
    const finDistancia = distancias[index];
    if (
      distanciaVisible > finDistancia ||
      finDistancia <= inicioDistancia
    ) {
      continue;
    }

    const proporcion = Math.max(
      0,
      Math.min(
        1,
        (distanciaVisible - inicioDistancia) /
          (finDistancia - inicioDistancia),
      ),
    );
    const inicio = recorrido[index - 1];
    const fin = recorrido[index];
    return [
      ...recorrido.slice(0, index),
      {
        ...fin,
        x: inicio.x + (fin.x - inicio.x) * proporcion,
        y: inicio.y + (fin.y - inicio.y) * proporcion,
      },
    ];
  }

  return recorrido;
}
