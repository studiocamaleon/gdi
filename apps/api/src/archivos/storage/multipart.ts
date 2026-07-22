/**
 * Reglas de la subida en partes, compartidas por los dos drivers.
 *
 * S3 (y R2, que copia su API) impone dos límites: cada parte tiene que pesar
 * al menos 5 MB —salvo la última— y no puede haber más de 10.000 partes. Con
 * partes de 8 MB el techo queda en 80 GB, de sobra para cualquier arte de
 * imprenta; el cálculo crece el tamaño de parte si hiciera falta para no
 * pasarse de 10.000.
 */

export const MIN_BYTES_PARTE = 5 * 1024 * 1024;
export const MAX_PARTES = 10_000;

/** Por debajo de esto no vale la pena partir: va en un solo PUT firmado. */
export const UMBRAL_MULTIPART = Number(
  process.env.ARCHIVOS_UMBRAL_MULTIPART ?? 64 * 1024 * 1024,
);

const PARTE_PREFERIDA = 8 * 1024 * 1024;

export function calcularTamanioParte(bytes: number): number {
  const minimoPorCantidad = Math.ceil(bytes / MAX_PARTES);
  return Math.max(PARTE_PREFERIDA, MIN_BYTES_PARTE, minimoPorCantidad);
}

export function cantidadDePartes(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / calcularTamanioParte(bytes)));
}

/**
 * El pedido más grande que puede llegar: o un archivo entero que no alcanzó
 * el umbral, o una parte del más grande que aceptamos.
 *
 * Los dos números son independientes y hay que tomar el mayor. Atar el tope
 * sólo al umbral parece razonable —"por arriba viene partido, y las partes son
 * más chicas"— pero es falso cuando el umbral se baja por debajo del tamaño de
 * parte: ahí las partes de 8 MB se rechazan y la subida muere con un broken
 * pipe, sin error interpretable del lado del cliente.
 */
export function topeDeRequest(maxArchivo: number): number {
  return Math.max(UMBRAL_MULTIPART, calcularTamanioParte(maxArchivo));
}
