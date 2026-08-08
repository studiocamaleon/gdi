/**
 * Acomodado "hoja de compra → pliego de impresión" para DIBUJARLO.
 *
 * Cuando la materia prima se compra en un tamaño distinto al pliego de
 * impresión (ej. hoja SRA3 comprada, pliego A4 en la máquina), el motor calcula
 * cuántos pliegos entran por hoja y en qué orientación. Esa cuenta vive en
 * `apps/api/.../nesting/helpers/sustrato-to-pliego.ts`
 * (`calculateSustratoToPliegoConversion`) — pero DESCARTA las filas×columnas y
 * sólo persiste `pliegosPorSustrato` + orientación.
 *
 * Este helper replica 1:1 esa lógica (mismo `floor` por eje, misma prueba de
 * rotación, mismo `max`) y ADEMÁS devuelve `cols/rows/sobrante` para poder
 * reconstruir el layout en el frontend, sin tocar el motor ni la respuesta.
 * `pliegosPorHoja` acá == `pliegosPorSustrato` del motor: si divergen, es un bug
 * de este helper. Cubierto por `nesting-compra-pliego.test.ts`.
 */

export interface LayoutPliegosEnHoja {
  /** `false` cuando hoja y pliego son ~iguales (incluida rotación): no hay que dibujar. */
  esDerivado: boolean;
  orientacion: "normal" | "rotada";
  cols: number;
  rows: number;
  /** cols × rows. Espeja `pliegosPorSustrato` del motor. */
  pliegosPorHoja: number;
  /** Ancho/alto de CADA pliego ya dibujado (contempla la rotación elegida). */
  pliegoDibujoAnchoMm: number;
  pliegoDibujoAltoMm: number;
  /** Recorte sobrante a la derecha y abajo de la grilla (mm). */
  sobranteAnchoMm: number;
  sobranteAltoMm: number;
  /** % del área de la hoja ocupado por los pliegos. */
  aprovechamientoPct: number;
}

const TOLERANCE_MM = 0.01;

function approxEqualMm(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_MM;
}

export function layoutPliegosEnHoja(
  hoja: { anchoMm: number; altoMm: number },
  pliego: { anchoMm: number; altoMm: number },
): LayoutPliegosEnHoja | null {
  if (
    !(hoja.anchoMm > 0) ||
    !(hoja.altoMm > 0) ||
    !(pliego.anchoMm > 0) ||
    !(pliego.altoMm > 0)
  ) {
    return null;
  }

  const direct =
    approxEqualMm(hoja.anchoMm, pliego.anchoMm) &&
    approxEqualMm(hoja.altoMm, pliego.altoMm);
  const rotatedDirect =
    approxEqualMm(hoja.anchoMm, pliego.altoMm) &&
    approxEqualMm(hoja.altoMm, pliego.anchoMm);

  if (direct || rotatedDirect) {
    return {
      esDerivado: false,
      orientacion: direct ? "normal" : "rotada",
      cols: 1,
      rows: 1,
      pliegosPorHoja: 1,
      pliegoDibujoAnchoMm: direct ? pliego.anchoMm : pliego.altoMm,
      pliegoDibujoAltoMm: direct ? pliego.altoMm : pliego.anchoMm,
      sobranteAnchoMm: 0,
      sobranteAltoMm: 0,
      aprovechamientoPct: 100,
    };
  }

  const normalCols = Math.max(0, Math.floor(hoja.anchoMm / pliego.anchoMm));
  const normalRows = Math.max(0, Math.floor(hoja.altoMm / pliego.altoMm));
  const normal = normalCols * normalRows;

  const rotCols = Math.max(0, Math.floor(hoja.anchoMm / pliego.altoMm));
  const rotRows = Math.max(0, Math.floor(hoja.altoMm / pliego.anchoMm));
  const rotada = rotCols * rotRows;

  const usarRotada = rotada > normal;
  const cols = usarRotada ? rotCols : normalCols;
  const rows = usarRotada ? rotRows : normalRows;
  const pliegosPorHoja = cols * rows;

  const pliegoAncho = usarRotada ? pliego.altoMm : pliego.anchoMm;
  const pliegoAlto = usarRotada ? pliego.anchoMm : pliego.altoMm;

  const areaHoja = hoja.anchoMm * hoja.altoMm;
  const areaPliego = pliego.anchoMm * pliego.altoMm;

  return {
    esDerivado: true,
    orientacion: usarRotada ? "rotada" : "normal",
    cols,
    rows,
    pliegosPorHoja,
    pliegoDibujoAnchoMm: pliegoAncho,
    pliegoDibujoAltoMm: pliegoAlto,
    sobranteAnchoMm: Math.max(0, hoja.anchoMm - cols * pliegoAncho),
    sobranteAltoMm: Math.max(0, hoja.altoMm - rows * pliegoAlto),
    aprovechamientoPct:
      areaHoja > 0 ? (pliegosPorHoja * areaPliego) / areaHoja * 100 : 0,
  };
}
