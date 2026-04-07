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

/**
 * Costeo basado en resultado real del multi-nesting.
 * Usa el área útil real y la cantidad de placas del nesting, no aproximaciones.
 */
export function calcularCosteoFromNesting(
  estrategia: string,
  precioPlaca: number,
  placaAnchoMm: number,
  placaAltoMm: number,
  nesting: MultiMedidaNestingResult,
  segmentos: number[],
): CosteoPreview {
  if (nesting.placas <= 0) {
    return { estrategia, costoTotal: 0, placasCompletas: 0, ultimaPlacaPct: null, segmentoAplicado: null };
  }

  const areaPlacaM2 = (placaAnchoMm * placaAltoMm) / 1_000_000;
  const precioM2 = areaPlacaM2 > 0 ? precioPlaca / areaPlacaM2 : 0;
  const areaUtilM2 = nesting.areaUtilMm2 / 1_000_000;

  if (estrategia === "m2_exacto") {
    return {
      estrategia,
      costoTotal: r2(areaUtilM2 * precioM2),
      placasCompletas: nesting.placas,
      ultimaPlacaPct: null,
      segmentoAplicado: null,
    };
  }

  if (estrategia === "largo_consumido") {
    let total = 0;
    let placasCompletas = 0;
    for (const layout of nesting.placaLayouts) {
      const fraccion = layout.largoConsumidoMm / placaAltoMm;
      if (fraccion >= 0.99) {
        total += precioPlaca;
        placasCompletas++;
      } else {
        total += r2(precioPlaca * fraccion);
      }
    }
    const ultimaLayout = nesting.placaLayouts[nesting.placaLayouts.length - 1];
    const ultimaPct = ultimaLayout ? r2((ultimaLayout.largoConsumidoMm / placaAltoMm) * 100) : null;
    return {
      estrategia,
      costoTotal: r2(total),
      placasCompletas,
      ultimaPlacaPct: ultimaPct !== null && ultimaPct < 99 ? ultimaPct : null,
      segmentoAplicado: null,
    };
  }

  // segmentos_placa
  const escalones = segmentos.length > 0 ? [...segmentos].sort((a, b) => a - b) : [25, 50, 75, 100];
  let total = 0;
  let placasCompletas = 0;
  let ultimaOcupPct: number | null = null;
  let ultimoSeg: number | null = null;

  for (const layout of nesting.placaLayouts) {
    const ocupacion = areaPlacaM2 > 0 ? (layout.areaUtilMm2 / 1_000_000 / areaPlacaM2) * 100 : 100;
    const seg = escalones.find((s) => s >= ocupacion) ?? 100;
    const costo = r2(precioPlaca * (seg / 100));
    total += costo;
    if (seg >= 100) {
      placasCompletas++;
    } else {
      ultimaOcupPct = r2(ocupacion);
      ultimoSeg = seg;
    }
  }

  return {
    estrategia,
    costoTotal: r2(total),
    placasCompletas,
    ultimaPlacaPct: ultimaOcupPct,
    segmentoAplicado: ultimoSeg,
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
 * Nesting multi-medida con bin-packing 2D (skyline / bottom-left).
 *
 * Mantiene un "skyline" (perfil superior del área ocupada) y coloca
 * cada pieza en la posición más baja y más a la izquierda posible.
 * Las piezas se pegan unas a otras sin huecos innecesarios.
 *
 * Ordena piezas de mayor a menor área para mejor aprovechamiento.
 */
export function nestMultiMedida(
  medidas: MedidaInput[],
  placaAnchoMm: number,
  placaAltoMm: number,
  sepH: number,
  sepV: number,
  margen: number,
  permitirRotacion: boolean,
  orientacionPlaca: 'usar_lado_corto' | 'usar_lado_largo' = 'usar_lado_corto',
): MultiMedidaNestingResult {
  type PiezaPendiente = { mi: number; origW: number; origH: number };
  const areaW = placaAnchoMm - 2 * margen;
  const areaH = placaAltoMm - 2 * margen;
  const pendientes: PiezaPendiente[] = [];

  for (let mi = 0; mi < medidas.length; mi++) {
    const m = medidas[mi];
    if (m.anchoMm <= 0 || m.altoMm <= 0 || m.cantidad <= 0) continue;
    for (let i = 0; i < m.cantidad; i++) {
      pendientes.push({ mi, origW: m.anchoMm, origH: m.altoMm });
    }
  }

  if (pendientes.length === 0) {
    return { posiciones: [], placas: 0, placaLayouts: [], totalPiezas: 0, aprovechamientoPct: 0, areaTotalMm2: 0, areaUtilMm2: 0 };
  }

  // Ordenar: piezas más grandes primero → mejor bin-packing
  pendientes.sort((a, b) => (b.origW * b.origH) - (a.origW * a.origH));

  const placaLayouts: MultiMedidaNestingResult["placaLayouts"] = [];
  let totalPiezas = 0;
  let totalAreaUtil = 0;

  // ── Bin-packing 2D con free rectangles (Maximal Rectangles) ─────
  function packPlaca(piezas: PiezaPendiente[]): {
    colocadas: MultiMedidaPiece[];
    noColocadas: PiezaPendiente[];
    maxY: number;
  } {
    // Free rectangles: lista de rectángulos libres disponibles
    type FreeRect = { x: number; y: number; w: number; h: number };
    let freeRects: FreeRect[] = [{ x: 0, y: 0, w: areaW, h: areaH }];
    const colocadas: MultiMedidaPiece[] = [];
    const noColocadas: PiezaPendiente[] = [];

    // Best Area Fit: coloca en el rectángulo libre más chico donde entra
    // Tiebreaker: Best Short Side Fit (menor lado residual corto)
    function findBestPosition(pw: number, ph: number): { x: number; y: number } | null {
      let bestArea = Infinity;
      let bestShortSide = Infinity;
      let bestX = -1;
      let bestY = -1;

      for (const r of freeRects) {
        if (pw <= r.w + 0.01 && ph <= r.h + 0.01) {
          const area = r.w * r.h;
          const leftoverW = r.w - pw;
          const leftoverH = r.h - ph;
          const shortSide = Math.min(leftoverW, leftoverH);

          if (area < bestArea || (area === bestArea && shortSide < bestShortSide)) {
            bestArea = area;
            bestShortSide = shortSide;
            bestX = r.x;
            bestY = r.y;
          }
        }
      }

      return bestX >= 0 ? { x: bestX, y: bestY } : null;
    }

    function splitFreeRects(px: number, py: number, pw: number, ph: number) {
      // Añadir separación a la pieza colocada
      const occX = px;
      const occY = py;
      const occW = pw + sepH;
      const occH = ph + sepV;

      const newFree: FreeRect[] = [];

      for (const r of freeRects) {
        // Si no intersecta, mantener
        if (occX >= r.x + r.w - 0.01 || occX + occW <= r.x + 0.01 ||
            occY >= r.y + r.h - 0.01 || occY + occH <= r.y + 0.01) {
          newFree.push(r);
          continue;
        }

        // Generar hasta 4 rectángulos libres alrededor de la pieza

        // Derecha
        if (occX + occW < r.x + r.w - 0.01) {
          newFree.push({ x: occX + occW, y: r.y, w: r.x + r.w - (occX + occW), h: r.h });
        }
        // Izquierda
        if (occX > r.x + 0.01) {
          newFree.push({ x: r.x, y: r.y, w: occX - r.x, h: r.h });
        }
        // Abajo
        if (occY + occH < r.y + r.h - 0.01) {
          newFree.push({ x: r.x, y: occY + occH, w: r.w, h: r.y + r.h - (occY + occH) });
        }
        // Arriba (raro para bottom-left pero necesario)
        if (occY > r.y + 0.01) {
          newFree.push({ x: r.x, y: r.y, w: r.w, h: occY - r.y });
        }
      }

      // Eliminar rectángulos contenidos en otros (maximizar)
      freeRects = [];
      for (let i = 0; i < newFree.length; i++) {
        let contained = false;
        for (let j = 0; j < newFree.length; j++) {
          if (i === j) continue;
          const a = newFree[i];
          const b = newFree[j];
          if (a.x >= b.x - 0.01 && a.y >= b.y - 0.01 &&
              a.x + a.w <= b.x + b.w + 0.01 && a.y + a.h <= b.y + b.h + 0.01) {
            contained = true;
            break;
          }
        }
        if (!contained && newFree[i].w > 1 && newFree[i].h > 1) {
          freeRects.push(newFree[i]);
        }
      }
    }

    for (const pieza of piezas) {
      type Orient = { w: number; h: number; rotada: boolean };
      const orients: Orient[] = [{ w: pieza.origW, h: pieza.origH, rotada: false }];
      if (permitirRotacion && pieza.origW !== pieza.origH) {
        orients.push({ w: pieza.origH, h: pieza.origW, rotada: true });
      }

      let placed = false;

      // Probar AMBAS orientaciones y elegir la que produce el mejor BAF score
      // (se coloca en el rectángulo libre más ajustado)
      let bestPos: { x: number; y: number; orient: Orient; score: number } | null = null;

      for (const orient of orients) {
        const pos = findBestPosition(orient.w, orient.h);
        if (pos) {
          // Score = área del rectángulo libre donde entra (menor = mejor fit)
          // findBestPosition ya devuelve el mejor, así que comparamos entre orientaciones
          // usando la Y más baja como desempate (aprovecha largo)
          const score = pos.y * 10000 + pos.x; // priorizar posición más arriba-izquierda
          if (!bestPos || score < bestPos.score) {
            bestPos = { x: pos.x, y: pos.y, orient, score };
          }
        }
      }

      if (bestPos) {
        colocadas.push({
          x: margen + bestPos.x,
          y: margen + bestPos.y,
          anchoMm: bestPos.orient.w,
          altoMm: bestPos.orient.h,
          medidaIndex: pieza.mi,
          rotada: bestPos.orient.rotada,
        });
        splitFreeRects(bestPos.x, bestPos.y, bestPos.orient.w, bestPos.orient.h);
        placed = true;
      }

      if (!placed) {
        noColocadas.push(pieza);
      }
    }

    const maxY = colocadas.length > 0
      ? Math.max(...colocadas.map((p) => p.y + p.altoMm))
      : 0;

    return { colocadas, noColocadas, maxY };
  }

  // ── Empaquetar en múltiples placas ──────────────────────────────
  let restantes = [...pendientes];

  while (restantes.length > 0) {
    const result = packPlaca(restantes);

    if (result.colocadas.length === 0) {
      // Ninguna pieza entra → terminar
      break;
    }

    const areaUtil = result.colocadas.reduce((s, p) => s + p.anchoMm * p.altoMm, 0);
    placaLayouts.push({
      posiciones: result.colocadas,
      largoConsumidoMm: result.maxY,
      areaUtilMm2: areaUtil,
    });
    totalPiezas += result.colocadas.length;
    totalAreaUtil += areaUtil;

    restantes = result.noColocadas;
  }

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
