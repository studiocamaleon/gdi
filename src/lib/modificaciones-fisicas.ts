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

const ORDEN_LADOS = ["superior", "inferior", "izquierdo", "derecho"];

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
