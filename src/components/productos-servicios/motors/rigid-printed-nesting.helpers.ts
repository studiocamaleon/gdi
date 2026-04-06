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

// ── Nesting multi-medida ─────────────────────────────────────────

export type MedidaInput = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
  color?: string;
};

export type MultiMedidaPiece = {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  medidaIndex: number;
  rotada: boolean;
};

export type MultiMedidaNestingResult = {
  posiciones: MultiMedidaPiece[];
  placas: number;
  placaLayouts: Array<{
    posiciones: MultiMedidaPiece[];
    largoConsumidoMm: number;
    areaUtilMm2: number;
  }>;
  totalPiezas: number;
  aprovechamientoPct: number;
  areaTotalMm2: number;
  areaUtilMm2: number;
};

/**
 * Nesting multi-medida por bandas horizontales.
 * Cada medida se acomoda en filas consecutivas en la placa.
 * Si no cabe más, abre nueva placa.
 */
export function nestMultiMedida(
  medidas: MedidaInput[],
  placaAnchoMm: number,
  placaAltoMm: number,
  sepH: number,
  sepV: number,
  margen: number,
  permitirRotacion: boolean,
): MultiMedidaNestingResult {
  const placaLayouts: MultiMedidaNestingResult["placaLayouts"] = [];
  let currentPlaca: MultiMedidaPiece[] = [];
  let currentY = margen;
  let totalPiezas = 0;
  let totalAreaUtil = 0;
  const areaW = placaAnchoMm - 2 * margen;

  function flushPlaca() {
    if (currentPlaca.length > 0) {
      const areaUtil = currentPlaca.reduce((s, p) => s + p.anchoMm * p.altoMm, 0);
      placaLayouts.push({
        posiciones: currentPlaca,
        largoConsumidoMm: currentY,
        areaUtilMm2: areaUtil,
      });
      totalAreaUtil += areaUtil;
    }
    currentPlaca = [];
    currentY = margen;
  }

  for (let mi = 0; mi < medidas.length; mi++) {
    const m = medidas[mi];
    if (m.anchoMm <= 0 || m.altoMm <= 0 || m.cantidad <= 0) continue;

    // Decidir si rotar la pieza
    let pW = m.anchoMm;
    let pH = m.altoMm;
    let rotada = false;

    if (permitirRotacion && pW !== pH) {
      const colsNormal = Math.floor((areaW + sepH) / (pW + sepH));
      const colsRotada = Math.floor((areaW + sepH) / (pH + sepH));
      if (colsRotada > colsNormal) {
        const tmp = pW; pW = pH; pH = tmp;
        rotada = true;
      }
    }

    const columnas = Math.max(0, Math.floor((areaW + sepH) / (pW + sepH)));
    if (columnas <= 0) continue;

    let piezasRestantes = m.cantidad;

    while (piezasRestantes > 0) {
      const altoDisponible = placaAltoMm - currentY - margen;

      if (altoDisponible < pH) {
        // No cabe otra fila en esta placa → nueva placa
        flushPlaca();
        continue;
      }

      // Cuántas filas caben en el espacio restante
      const filasQueCaben = Math.floor((altoDisponible + sepV) / (pH + sepV));
      const piezasQueCaben = filasQueCaben * columnas;
      const piezasEnEstaPlaca = Math.min(piezasRestantes, piezasQueCaben);
      const filasUsadas = Math.ceil(piezasEnEstaPlaca / columnas);

      for (let row = 0; row < filasUsadas; row++) {
        const piezasEnFila = Math.min(columnas, piezasRestantes);
        for (let col = 0; col < piezasEnFila; col++) {
          currentPlaca.push({
            x: margen + col * (pW + sepH),
            y: currentY + row * (pH + sepV),
            anchoMm: pW,
            altoMm: pH,
            medidaIndex: mi,
            rotada,
          });
          piezasRestantes--;
          totalPiezas++;
        }
      }

      currentY += filasUsadas * pH + (filasUsadas - 1) * sepV + sepV;

      if (piezasRestantes > 0) {
        flushPlaca();
      }
    }
  }

  // Flush última placa
  flushPlaca();

  const areaTotalMm2 = placaAnchoMm * placaAltoMm * placaLayouts.length;

  return {
    posiciones: placaLayouts.flatMap((pl) => pl.posiciones),
    placas: placaLayouts.length,
    placaLayouts,
    totalPiezas,
    aprovechamientoPct: areaTotalMm2 > 0 ? r2((totalAreaUtil / areaTotalMm2) * 100) : 0,
    areaTotalMm2,
    areaUtilMm2: totalAreaUtil,
  };
}

// Colores por medida para el SVG
export const MEDIDA_COLORS = [
  "#3b82f6", // azul
  "#10b981", // verde
  "#f59e0b", // ámbar
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#06b6d4", // cyan
  "#f97316", // naranja
  "#6366f1", // indigo
];
