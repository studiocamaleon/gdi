/**
 * Helpers de nesting + costeo para rígidos impresos (client-side).
 * Mirror del backend para feedback instantáneo.
 */

// ── Nesting ──────────────────────────────────────────────────────

export type NestingPiecePosition = {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  rotada: boolean;
};

export type NestingResult = {
  piezasPorPlaca: number;
  columnas: number;
  filas: number;
  rotada: boolean;
  posiciones: NestingPiecePosition[];
  aprovechamientoPct: number;
  largoConsumidoMm: number;
};

function calcGrid(
  pW: number, pH: number, aW: number, aH: number, sH: number, sV: number,
) {
  if (aW < pW || aH < pH) return { columnas: 0, filas: 0 };
  return {
    columnas: Math.max(0, Math.floor((aW + sH) / (pW + sH))),
    filas: Math.max(0, Math.floor((aH + sV) / (pH + sV))),
  };
}

export function nestRectangularGrid(
  piezaAnchoMm: number,
  piezaAltoMm: number,
  placaAnchoMm: number,
  placaAltoMm: number,
  sepH: number,
  sepV: number,
  margen: number,
  permitirRotacion: boolean,
): NestingResult {
  const aW = placaAnchoMm - 2 * margen;
  const aH = placaAltoMm - 2 * margen;

  const orig = calcGrid(piezaAnchoMm, piezaAltoMm, aW, aH, sepH, sepV);
  const origCount = orig.columnas * orig.filas;

  let rot = { columnas: 0, filas: 0 };
  let rotCount = 0;
  if (permitirRotacion && piezaAnchoMm !== piezaAltoMm) {
    rot = calcGrid(piezaAltoMm, piezaAnchoMm, aW, aH, sepH, sepV);
    rotCount = rot.columnas * rot.filas;
  }

  const useRot = rotCount > origCount;
  const best = useRot ? rot : orig;
  const pW = useRot ? piezaAltoMm : piezaAnchoMm;
  const pH = useRot ? piezaAnchoMm : piezaAltoMm;
  const count = best.columnas * best.filas;

  const posiciones: NestingPiecePosition[] = [];
  for (let row = 0; row < best.filas; row++) {
    for (let col = 0; col < best.columnas; col++) {
      posiciones.push({
        x: margen + col * (pW + sepH),
        y: margen + row * (pH + sepV),
        anchoMm: pW,
        altoMm: pH,
        rotada: useRot,
      });
    }
  }

  const areaTotal = placaAnchoMm * placaAltoMm;
  const areaUtil = count * piezaAnchoMm * piezaAltoMm;
  const aprovechamientoPct = areaTotal > 0
    ? Math.round((areaUtil / areaTotal) * 10000) / 100
    : 0;

  const largoConsumidoMm = best.filas > 0
    ? margen + best.filas * pH + (best.filas - 1) * sepV + margen
    : 0;

  return {
    piezasPorPlaca: count,
    columnas: best.columnas,
    filas: best.filas,
    rotada: useRot,
    posiciones,
    aprovechamientoPct,
    largoConsumidoMm,
  };
}

/**
 * Calcula el largo consumido en la placa para una cantidad específica de piezas.
 * Solo cuenta las filas necesarias para las piezas pedidas (no toda la placa).
 */
export function calcularLargoConsumido(
  cantidadPiezas: number,
  columnas: number,
  piezaAltoMm: number,
  separacionV: number,
  margen: number,
): number {
  if (columnas <= 0 || cantidadPiezas <= 0) return 0;
  const filasNecesarias = Math.ceil(cantidadPiezas / columnas);
  return margen + filasNecesarias * piezaAltoMm + (filasNecesarias - 1) * separacionV + margen;
}

export function calculatePlatesNeeded(totalPiezas: number, piezasPorPlaca: number) {
  if (piezasPorPlaca <= 0) return { placas: 0, sobrantes: 0 };
  const placas = Math.ceil(totalPiezas / piezasPorPlaca);
  return { placas, sobrantes: placas * piezasPorPlaca - totalPiezas };
}

// ── Costeo client-side ───────────────────────────────────────────

export type CosteoPreview = {
  estrategia: string;
  costoTotal: number;
  placasCompletas: number;
  ultimaPlacaPct: number | null;
  segmentoAplicado: number | null;
};

export function calcularCosteoPreview(
  estrategia: string,
  precioPlaca: number,
  placaAnchoMm: number,
  placaAltoMm: number,
  piezaAnchoMm: number,
  piezaAltoMm: number,
  cantidad: number,
  piezasPorPlaca: number,
  segmentos: number[],
  largoConsumidoMm?: number,
  columnas?: number,
): CosteoPreview {
  if (piezasPorPlaca <= 0) {
    return { estrategia, costoTotal: 0, placasCompletas: 0, ultimaPlacaPct: null, segmentoAplicado: null };
  }

  const placas = Math.ceil(cantidad / piezasPorPlaca);
  const piezasUltima = cantidad % piezasPorPlaca || piezasPorPlaca;
  const ocupacionUltima = (piezasUltima / piezasPorPlaca) * 100;
  const areaPlacaM2 = (placaAnchoMm * placaAltoMm) / 1_000_000;
  const precioM2 = areaPlacaM2 > 0 ? precioPlaca / areaPlacaM2 : 0;

  if (estrategia === "m2_exacto") {
    const areaPiezasM2 = (piezaAnchoMm * piezaAltoMm * cantidad) / 1_000_000;
    return {
      estrategia, costoTotal: r2(areaPiezasM2 * precioM2),
      placasCompletas: placas, ultimaPlacaPct: null, segmentoAplicado: null,
    };
  }

  if (estrategia === "largo_consumido") {
    const placasLlenas = Math.floor(cantidad / piezasPorPlaca);
    const costoLlenas = placasLlenas * precioPlaca;
    const piezasRest = cantidad - placasLlenas * piezasPorPlaca;

    let costoUltima = 0;
    if (piezasRest > 0 && largoConsumidoMm && placaAltoMm > 0) {
      // Se cobra proporción del largo consumido sobre el largo total de la placa
      costoUltima = r2(precioPlaca * (largoConsumidoMm / placaAltoMm));
    } else if (piezasRest > 0) {
      // Fallback: proporción por piezas
      costoUltima = r2(precioPlaca * (piezasRest / piezasPorPlaca));
    }

    return {
      estrategia, costoTotal: r2(costoLlenas + costoUltima),
      placasCompletas: placasLlenas,
      ultimaPlacaPct: piezasRest > 0 ? r2((largoConsumidoMm ?? 0) / placaAltoMm * 100) : null,
      segmentoAplicado: null,
    };
  }

  // segmentos_placa
  const escalones = segmentos.length > 0 ? [...segmentos].sort((a, b) => a - b) : [25, 50, 75, 100];
  let total = 0;
  let piezasRest = cantidad;
  let placasCompletas = 0;

  for (let i = 0; i < placas; i++) {
    const piezasEsta = Math.min(piezasRest, piezasPorPlaca);
    piezasRest -= piezasEsta;
    const ocup = (piezasEsta / piezasPorPlaca) * 100;
    const seg = escalones.find((s) => s >= ocup) ?? 100;
    total += precioPlaca * (seg / 100);
    if (piezasEsta === piezasPorPlaca) placasCompletas++;
  }

  const segUltima = escalones.find((s) => s >= ocupacionUltima) ?? 100;

  return {
    estrategia, costoTotal: r2(total), placasCompletas,
    ultimaPlacaPct: placas > placasCompletas ? r2(ocupacionUltima) : null,
    segmentoAplicado: placas > placasCompletas ? segUltima : null,
  };
}

function r2(n: number) { return Math.round(n * 100) / 100; }
