/**
 * Cálculos del motor Gran Formato v2 — funciones puras.
 *
 * El rollo de vinilo/lona tiene ancho FIJO (típicamente 63cm en vinilo adhesivo
 * blanco) y largo "infinito" (lo que compres). Las piezas se orientan para
 * maximizar piezas por metro lineal del rollo.
 *
 * Distinto de rigidos (placa finita). Distinto de hojas (imposición 2D).
 */

export type NestingRolloInput = {
  /** Medidas del pedido (pueden ser múltiples). */
  piezas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
  /** Ancho útil del rollo en mm (típico vinilo: 630mm). */
  rolloAnchoMm: number;
  /** Separación entre piezas consecutivas (horizontal y vertical). */
  separacionMm: number;
  /** Márgenes laterales del rollo (no se puede imprimir en los bordes). */
  margenLateralMm: number;
  /** Si true, se evalúa orientar la pieza rotada si conviene. */
  permitirRotacion: boolean;
};

export type NestingRolloResult = {
  /** Largo total del rollo que hay que consumir (redondeo al siguiente cm). */
  largoConsumidoMm: number;
  /** Área útil = suma de (ancho×alto × cantidad) de todas las piezas. */
  areaUtilM2: number;
  /** Área consumida del rollo = anchoRolloUtil × largoConsumido. */
  areaConsumidaM2: number;
  /** Aprovechamiento = areaUtil / areaConsumida × 100. */
  aprovechamientoPct: number;
  /** Por cada medida, cómo se resolvió el layout. */
  layoutsPorMedida: Array<{
    anchoMm: number;
    altoMm: number;
    cantidad: number;
    rotada: boolean;
    piezasPorFila: number;
    filas: number;
    largoRequeridoMm: number;
  }>;
  /** Piezas que NO encajan en el rollo (ancho insuficiente incluso rotadas). */
  piezasRechazadas: Array<{ anchoMm: number; altoMm: number; motivo: string }>;
};

/**
 * Layout de UNA medida específica en el rollo.
 *
 * Intenta primero orientación natural; si `permitirRotacion` es true y la
 * rotada da más piezas por fila, se usa la rotada.
 */
function layoutMedida(
  anchoMm: number,
  altoMm: number,
  cantidad: number,
  anchoUtilMm: number,
  separacionMm: number,
  permitirRotacion: boolean,
): {
  rotada: boolean;
  piezasPorFila: number;
  filas: number;
  largoRequeridoMm: number;
  encaja: boolean;
} {
  // Orientación A: ancho pieza a lo ancho del rollo
  const piezasPorFilaA = anchoMm <= anchoUtilMm
    ? Math.max(1, Math.floor((anchoUtilMm + separacionMm) / (anchoMm + separacionMm)))
    : 0;
  // Orientación B: rotada — alto pieza a lo ancho del rollo
  const piezasPorFilaB = permitirRotacion && altoMm <= anchoUtilMm
    ? Math.max(1, Math.floor((anchoUtilMm + separacionMm) / (altoMm + separacionMm)))
    : 0;

  const ganaB = piezasPorFilaB > piezasPorFilaA;
  const piezasPorFila = ganaB ? piezasPorFilaB : piezasPorFilaA;

  if (piezasPorFila === 0) {
    return { rotada: false, piezasPorFila: 0, filas: 0, largoRequeridoMm: 0, encaja: false };
  }

  const altoFila = ganaB ? anchoMm : altoMm; // si la rotamos, el "alto" de la fila es el ancho original
  const filas = Math.ceil(cantidad / piezasPorFila);
  const largoRequeridoMm = filas * altoFila + Math.max(0, filas - 1) * separacionMm;
  return {
    rotada: ganaB,
    piezasPorFila,
    filas,
    largoRequeridoMm,
    encaja: true,
  };
}

export function nestOnRoll(input: NestingRolloInput): NestingRolloResult {
  const { piezas, rolloAnchoMm, separacionMm, margenLateralMm, permitirRotacion } = input;
  const anchoUtilMm = Math.max(0, rolloAnchoMm - 2 * margenLateralMm);

  const piezasRechazadas: NestingRolloResult['piezasRechazadas'] = [];
  const layouts: NestingRolloResult['layoutsPorMedida'] = [];

  let largoAcumuladoMm = 0;
  let areaUtilMm2 = 0;

  for (const p of piezas) {
    const layout = layoutMedida(p.anchoMm, p.altoMm, p.cantidad, anchoUtilMm, separacionMm, permitirRotacion);
    if (!layout.encaja) {
      piezasRechazadas.push({
        anchoMm: p.anchoMm,
        altoMm: p.altoMm,
        motivo: `No encaja en ancho útil del rollo (${anchoUtilMm}mm). Dimensión mínima: ${Math.min(p.anchoMm, p.altoMm)}mm.`,
      });
      continue;
    }

    layouts.push({
      anchoMm: p.anchoMm,
      altoMm: p.altoMm,
      cantidad: p.cantidad,
      rotada: layout.rotada,
      piezasPorFila: layout.piezasPorFila,
      filas: layout.filas,
      largoRequeridoMm: layout.largoRequeridoMm,
    });

    largoAcumuladoMm += layout.largoRequeridoMm;
    // Si hay más medidas, sumar separación entre grupos
    if (piezas.length > 1) largoAcumuladoMm += separacionMm;

    areaUtilMm2 += p.anchoMm * p.altoMm * p.cantidad;
  }

  const areaConsumidaMm2 = anchoUtilMm * largoAcumuladoMm;
  const aprovechamientoPct = areaConsumidaMm2 > 0 ? (areaUtilMm2 / areaConsumidaMm2) * 100 : 0;

  return {
    largoConsumidoMm: Math.ceil(largoAcumuladoMm),
    areaUtilM2: Math.round((areaUtilMm2 / 1_000_000) * 10000) / 10000,
    areaConsumidaM2: Math.round((areaConsumidaMm2 / 1_000_000) * 10000) / 10000,
    aprovechamientoPct: Math.round(aprovechamientoPct * 100) / 100,
    layoutsPorMedida: layouts,
    piezasRechazadas,
  };
}
