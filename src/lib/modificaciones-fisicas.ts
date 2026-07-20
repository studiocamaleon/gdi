/**
 * Presentación de las modificaciones físicas PRE (bolsillos y refuerzos en
 * lona) en el desglose de la cotización y en la OT.
 *
 * El dato lo produce el motor como `PasoEjecutado.mutacionAplicada`.
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */

export interface MutacionAplicadaView {
  subTipo: string;
  lados: string[];
  demasiaMm: number;
  deltaAnchoMm: number;
  deltaAltoMm: number;
  metrosLinealesUnion: number;
  piezas: Array<{
    antes: { anchoMm: number; altoMm: number };
    despues: { anchoMm: number; altoMm: number };
  }>;
}

const ETIQUETA_SUBTIPO: Record<string, string> = {
  bolsillo: "Bolsillo",
  refuerzo: "Refuerzo",
};

const ETIQUETA_LADO: Record<string, string> = {
  superior: "arriba",
  inferior: "abajo",
  izquierdo: "izquierda",
  derecho: "derecha",
};

const ORDEN_LADOS = ["superior", "inferior", "izquierdo", "derecho"] as const;

export type LadoPieza = (typeof ORDEN_LADOS)[number];

export type DemasiaPorLado = Record<LadoPieza, number>;

export interface PosicionOjalView {
  xMm: number;
  yMm: number;
  lado: LadoPieza;
}

export interface LayoutOjalesView {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
  posiciones: PosicionOjalView[];
}

export function etiquetaSubTipoModificacion(subTipo: string): string {
  return ETIQUETA_SUBTIPO[subTipo] ?? subTipo;
}

/**
 * Frase para los lados afectados. Usa los atajos que dice la gente del taller
 * ("los 4 lados", "arriba y abajo") en vez de enumerar siempre.
 */
export function describirLados(lados: string[]): string {
  const ordenados = ORDEN_LADOS.filter((lado) => lados.includes(lado));
  if (ordenados.length === 0) return "sin lados";
  if (ordenados.length === 4) return "los 4 lados";

  const set = new Set(ordenados);
  if (set.size === 2 && set.has("superior") && set.has("inferior")) {
    return "arriba y abajo";
  }
  if (set.size === 2 && set.has("izquierdo") && set.has("derecho")) {
    return "los laterales";
  }

  const etiquetas = ordenados.map((lado) => ETIQUETA_LADO[lado] ?? lado);
  if (etiquetas.length === 1) return etiquetas[0];
  return `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`;
}

/** "Refuerzo en los 4 lados · +40 mm por lado" */
export function resumenModificacion(mutacion: MutacionAplicadaView): string {
  return `${etiquetaSubTipoModificacion(mutacion.subTipo)} en ${describirLados(
    mutacion.lados,
  )} · +${mutacion.demasiaMm} mm por lado`;
}

/**
 * Cuánto material extra costó la modificación, en porcentaje sobre el área
 * pedida. Es el número que explica por qué la lona salió más cara de lo que
 * sugiere la medida que pidió el cliente.
 *
 * Devuelve null si no hay piezas o el área pedida es cero.
 */
export function porcentajeMaterialExtra(
  mutacion: MutacionAplicadaView,
): number | null {
  let areaAntes = 0;
  let areaDespues = 0;
  for (const pieza of mutacion.piezas) {
    areaAntes += pieza.antes.anchoMm * pieza.antes.altoMm;
    areaDespues += pieza.despues.anchoMm * pieza.despues.altoMm;
  }
  if (areaAntes <= 0) return null;
  return ((areaDespues - areaAntes) / areaAntes) * 100;
}

/**
 * Medida antes y después de la PRIMERA pieza — el caso típico de lona es una
 * sola pieza. Devuelve null si el paso no mutó nada.
 */
export function medidaAntesDespues(mutacion: MutacionAplicadaView) {
  const pieza = mutacion.piezas[0];
  if (!pieza) return null;
  return { antes: pieza.antes, despues: pieza.despues };
}

export interface OjalesConfigView {
  separacionMaxMm: number;
  lados: string[];
  esquinasSiempre: boolean;
}

export interface ResumenOjales {
  /** Ojales de TODO el ítem: por pieza × cantidad de piezas. */
  total: number;
  /** Ojales de UNA pieza. Igual al total cuando hay una sola. */
  porPieza: number;
  /** Cuántas piezas llevan ojales. */
  piezas: number;
  separacionMaxMm: number | null;
  lados: string[];
}

/**
 * Resumen de los ojales del ítem, para la ficha y la OT.
 *
 * Lo primero que necesita saber el taller es CUÁNTOS ojales lleva el trabajo
 * —no cuántos por lona—, así que el total manda y el "por pieza" se muestra
 * sólo cuando hay más de una.
 */
export function resumenOjales(
  pasos: Array<{
    ojalesLayout?: Array<{ cantidad: number; posiciones: unknown[] }> | null;
    ojalesConfig?: OjalesConfigView | null;
  }>,
): ResumenOjales | null {
  let total = 0;
  let porPieza = 0;
  let piezas = 0;
  let config: OjalesConfigView | null = null;

  for (const paso of pasos) {
    for (const layout of paso.ojalesLayout ?? []) {
      total += layout.posiciones.length * layout.cantidad;
      porPieza = Math.max(porPieza, layout.posiciones.length);
      piezas += layout.cantidad;
    }
    if (paso.ojalesConfig) config = paso.ojalesConfig;
  }

  if (total === 0) return null;
  return {
    total,
    porPieza,
    piezas,
    separacionMaxMm: config?.separacionMaxMm ?? null,
    lados: config?.lados ?? [],
  };
}

/** "20 ojales (10 por pieza) · cada 50 cm · los 4 lados" */
export function describirOjales(resumen: ResumenOjales): string {
  const partes: string[] = [];
  partes.push(
    resumen.piezas > 1
      ? `${resumen.total} ojales (${resumen.porPieza} por pieza)`
      : `${resumen.total} ojales`,
  );
  if (resumen.separacionMaxMm) {
    partes.push(`cada ${formatMmComoCm(resumen.separacionMaxMm)} cm`);
  }
  if (resumen.lados.length > 0) partes.push(describirLados(resumen.lados));
  return partes.join(" · ");
}

function formatMmComoCm(mm: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(
    mm / 10,
  );
}

/**
 * Descripción de las modificaciones físicas del ítem, una por paso PRE.
 * Ej: ["Refuerzo en los 4 lados · +40 mm por lado"].
 */
export function describirModificaciones(
  pasos: Array<{ mutacionAplicada?: MutacionAplicadaView | null }>,
): string[] {
  return pasos
    .map((paso) => paso.mutacionAplicada)
    .filter((m): m is MutacionAplicadaView => Boolean(m))
    .map(resumenModificacion);
}

/**
 * Demasía TOTAL de cada lado, acumulando todos los pasos PRE de la ruta.
 *
 * Un bolsillo arriba/abajo y un refuerzo lateral suman en ejes distintos; dos
 * pasos sobre el mismo lado se suman. Es lo que el dibujo necesita para saber
 * qué franja de la pieza es demasía y cuál es el área visible — no alcanza con
 * `deltaAnchoMm`/`deltaAltoMm`, porque un bolsillo sólo arriba no es lo mismo
 * que uno repartido arriba y abajo.
 */
export function demasiaPorLado(
  pasos: Array<{ mutacionAplicada?: MutacionAplicadaView | null }>,
): DemasiaPorLado {
  const total: DemasiaPorLado = {
    superior: 0,
    inferior: 0,
    izquierdo: 0,
    derecho: 0,
  };
  for (const paso of pasos) {
    const mutacion = paso.mutacionAplicada;
    if (!mutacion) continue;
    for (const lado of mutacion.lados) {
      if (lado in total) total[lado as LadoPieza] += mutacion.demasiaMm;
    }
  }
  return total;
}

/** true si algún lado recibió demasía. */
export function tieneDemasia(demasia: DemasiaPorLado): boolean {
  return ORDEN_LADOS.some((lado) => demasia[lado] > 0);
}

/**
 * Medida final de CORTE de cada pieza, atravesando todos los pasos PRE de la
 * ruta: el `antes` del primero y el `despues` del último.
 *
 * Es lo que el operario tiene que cortar. Con varios pasos encadenados
 * (refuerzo + bolsillo) la medida intermedia no le sirve a nadie: sólo importan
 * la que pidió el cliente y la que hay que cortar.
 *
 * Todos los pasos PRE mutan el mismo array de piezas en el mismo orden, así
 * que el índice alinea. Devuelve [] si ningún paso modificó medidas.
 */
export function medidasDeCorte(
  pasos: Array<{ mutacionAplicada?: MutacionAplicadaView | null }>,
): Array<{
  antes: { anchoMm: number; altoMm: number };
  despues: { anchoMm: number; altoMm: number };
}> {
  const mutaciones = pasos
    .map((paso) => paso.mutacionAplicada)
    .filter((m): m is MutacionAplicadaView => Boolean(m));
  if (mutaciones.length === 0) return [];

  const primera = mutaciones[0];
  const ultima = mutaciones[mutaciones.length - 1];

  return primera.piezas
    .map((pieza, i) => ({
      antes: pieza.antes,
      despues: ultima.piezas[i]?.despues ?? pieza.despues,
    }))
    // Si una pieza terminó igual que empezó, no aporta nada al operario.
    .filter(
      (m) =>
        m.antes.anchoMm !== m.despues.anchoMm ||
        m.antes.altoMm !== m.despues.altoMm,
    );
}
