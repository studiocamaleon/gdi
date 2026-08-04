/**
 * Imposición de cuadernillo a CABALLETE (saddle stitch).
 *
 * Espejo arquitectónico de `talonario-grouping.ts`: un helper puro
 * post-nesting que convierte lo que dijo el grid (cuántos PARES de páginas
 * entran por cara del pliego) en el agrupamiento de producción del libro.
 *
 * Modelo de producción (docs/imposicion-cuadernillos-diseno.md):
 *  - La unidad que se apoya en el pliego es el PAR de páginas enfrentadas
 *    (ancho 2×página). Un pliego plegado una vez = 1 hoja del libro =
 *    4 páginas (par al frente + par al dorso).
 *  - `paresPorCara` (K) son COPIAS del mismo pliego, lado a lado: se imprime,
 *    se corta al medio y salen K juegos idénticos → K libros por juego de
 *    H pliegos. Es el K-up estándar del taller digital.
 *  - Las páginas se rellenan a múltiplo de 4 con blancas AL FINAL (decisión
 *    2026-08-04: estándar del rubro, con aviso — nunca error).
 *  - El caballete tiene tope físico de hojas anidadas (default 25): pasado
 *    ese límite el resultado avisa y el motor corta con diagnóstico ("usá
 *    anillado o alzado").
 *
 * Mapa de imposición (el plan que ve el operario): para la hoja `i` de `H`
 * con `N = 4H` páginas → frente [N−2i+2, 2i−1] · dorso [2i, N−2i+1].
 * Verificación con N=8: hoja 1 → [8,1]/[2,7] · hoja 2 → [6,3]/[4,5].
 */

export const MAX_HOJAS_CABALLETE_DEFAULT = 25;

/**
 * Qué hojas del cuadernillo imprime ESTE paso. Es lo que permite que la tapa
 * salga en otro papel (o a color) que el interior: dos pasos de impresión
 * sobre el mismo documento, cada uno con su subconjunto de hojas.
 *
 * En caballete se eligen HOJAS, no páginas: cada hoja lleva dos páginas del
 * principio del documento y dos del final (la hoja 1 de una revista de 32
 * lleva 1, 2, 31 y 32). Por eso el resultado devuelve `paginasDelPaso`: lo que
 * el modelador elige en hojas, el sistema lo traduce a páginas.
 */
export type SeleccionHojas =
  | { modo: 'todas' }
  | { modo: 'tapa' }
  | { modo: 'interior' }
  | { modo: 'rango'; desde: number; hasta: number };

export const SELECCION_HOJAS_TODAS: SeleccionHojas = { modo: 'todas' };

export type CuadernilloCaballeteInput = {
  /** Páginas del documento final (se rellena a múltiplo de 4). */
  paginas: number;
  /** Ejemplares pedidos (libros). */
  ejemplares: number;
  /** Pares de páginas que entran por cara del pliego (K, del grid 2D). */
  paresPorCara: number;
  /** Tope físico de hojas anidadas del caballete. */
  maxHojas?: number;
  /** Hojas que imprime este paso. Default: todas. */
  hojas?: SeleccionHojas;
};

export type HojaPlanImposicion = {
  /** 1-indexada, de afuera hacia adentro. */
  hoja: number;
  /** [página izquierda, página derecha] del frente del pliego. */
  frente: [number, number];
  /** [página izquierda, página derecha] del dorso. */
  dorso: [number, number];
};

export type CuadernilloCaballeteResult = {
  paginasSolicitadas: number;
  /** Redondeadas a múltiplo de 4 (mínimo 4). */
  paginasEfectivas: number;
  paginasBlancas: number;
  /** H = paginasEfectivas / 4. Es del LIBRO, no de este paso: el abrochado
   *  la usa para el espesor aunque el paso imprima sólo la tapa. */
  hojasPorLibro: number;
  paresPorCara: number;
  /** Libros que rinde cada juego de H pliegos (= paresPorCara). */
  librosPorJuego: number;
  /** Juegos a imprimir = ceil(ejemplares / librosPorJuego). */
  juegos: number;
  /** Pliegos que imprime ESTE paso = hojasDelPaso × juegos. */
  pliegos: number;
  ejemplares: number;
  /** El tope configurado, para diagnósticos. */
  maxHojas: number;
  /** true → no se puede abrochar a caballete: anillado o alzado. */
  excedeMaxHojas: boolean;
  /** Hojas que le tocan a este paso (las del `plan`). */
  hojasDelPaso: number;
  /** Selección aplicada. */
  seleccionHojas: SeleccionHojas;
  /** Páginas que caen en las hojas de este paso, ordenadas. La traducción
   *  hojas→páginas que el modelador necesita ver. */
  paginasDelPaso: number[];
  /** Una entrada por hoja DE ESTE PASO; las páginas > solicitadas son blancas. */
  plan: HojaPlanImposicion[];
};

/** Índices de hoja (1..H) que le tocan a la selección. */
function hojasSeleccionadas(
  seleccion: SeleccionHojas,
  hojasPorLibro: number,
): number[] {
  const todas = Array.from({ length: hojasPorLibro }, (_, i) => i + 1);
  switch (seleccion.modo) {
    case 'tapa':
      return todas.slice(0, 1);
    case 'interior':
      return todas.slice(1);
    case 'rango': {
      const desde = Math.max(1, Math.floor(seleccion.desde));
      const hasta = Math.min(hojasPorLibro, Math.floor(seleccion.hasta));
      return todas.filter((h) => h >= desde && h <= hasta);
    }
    default:
      return todas;
  }
}

export function calcularCuadernilloCaballete(
  input: CuadernilloCaballeteInput,
): CuadernilloCaballeteResult {
  const paginasSolicitadas = Math.max(1, Math.floor(input.paginas));
  const ejemplares = Math.max(0, Math.floor(input.ejemplares));
  const paresPorCara = Math.max(1, Math.floor(input.paresPorCara));
  const maxHojas = input.maxHojas ?? MAX_HOJAS_CABALLETE_DEFAULT;

  const paginasEfectivas = Math.max(4, Math.ceil(paginasSolicitadas / 4) * 4);
  const paginasBlancas = paginasEfectivas - paginasSolicitadas;
  const hojasPorLibro = paginasEfectivas / 4;

  const librosPorJuego = paresPorCara;
  const juegos = ejemplares > 0 ? Math.ceil(ejemplares / librosPorJuego) : 0;

  const seleccionHojas = input.hojas ?? SELECCION_HOJAS_TODAS;
  const indices = hojasSeleccionadas(seleccionHojas, hojasPorLibro);

  const N = paginasEfectivas;
  const plan: HojaPlanImposicion[] = indices.map((i) => ({
    hoja: i,
    frente: [N - 2 * i + 2, 2 * i - 1],
    dorso: [2 * i, N - 2 * i + 1],
  }));

  const paginasDelPaso = plan
    .flatMap((h) => [...h.frente, ...h.dorso])
    .sort((a, b) => a - b);

  return {
    paginasSolicitadas,
    paginasEfectivas,
    paginasBlancas,
    hojasPorLibro,
    paresPorCara,
    librosPorJuego,
    juegos,
    pliegos: plan.length * juegos,
    ejemplares,
    maxHojas,
    excedeMaxHojas: hojasPorLibro > maxHojas,
    hojasDelPaso: plan.length,
    seleccionHojas,
    paginasDelPaso,
    plan,
  };
}

/**
 * "Hojas 1 a 4" → "páginas 1-8 y 25-32". Colapsa la lista en rangos legibles:
 * es el aviso que evita que el comercial prometa "las primeras 8 en color".
 */
export function resumirPaginas(paginas: number[]): string {
  if (paginas.length === 0) return '—';
  const orden = [...new Set(paginas)].sort((a, b) => a - b);
  const rangos: string[] = [];
  let inicio = orden[0];
  let previo = orden[0];
  for (const p of orden.slice(1)) {
    if (p === previo + 1) {
      previo = p;
      continue;
    }
    rangos.push(inicio === previo ? `${inicio}` : `${inicio}-${previo}`);
    inicio = p;
    previo = p;
  }
  rangos.push(inicio === previo ? `${inicio}` : `${inicio}-${previo}`);
  return rangos.join(', ');
}
