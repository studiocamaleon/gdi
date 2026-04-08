/**
 * Helpers de nesting + costeo para rígidos impresos (client-side).
 * Usa maxrects-packer para bin-packing 2D óptimo.
 */
import { MaxRectsPacker } from "maxrects-packer";

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
 * Grid óptimo para piezas de una sola medida.
 * Prueba ambas orientaciones y elige la que cabe más piezas.
 */
function nestSingleSizeGrid(
  pendientes: Array<{ mi: number; origW: number; origH: number }>,
  areaW: number,
  areaH: number,
  sepH: number,
  sepV: number,
  margen: number,
  permitirRotacion: boolean,
  _orientacionPlaca: 'usar_lado_corto' | 'usar_lado_largo',
): MultiMedidaNestingResult {
  const pW = pendientes[0].origW;
  const pH = pendientes[0].origH;
  const mi = pendientes[0].mi;
  const total = pendientes.length;

  type GridOption = { cols: number; rows: number; w: number; h: number; rotada: boolean };
  const options: GridOption[] = [];

  const tryGrid = (w: number, h: number, rotada: boolean) => {
    const cols = Math.max(0, Math.floor((areaW + sepH) / (w + sepH)));
    const rows = Math.max(0, Math.floor((areaH + sepV) / (h + sepV)));
    if (cols > 0 && rows > 0) options.push({ cols, rows, w, h, rotada });
  };

  tryGrid(pW, pH, false);
  if (permitirRotacion && pW !== pH) tryGrid(pH, pW, true);

  if (options.length === 0) {
    return { posiciones: [], placas: 0, placaLayouts: [], totalPiezas: 0, aprovechamientoPct: 0, areaTotalMm2: 0, areaUtilMm2: 0 };
  }

  // Elegir orientación: preferir la que usa más columnas (aprovecha ancho)
  // y minimiza filas necesarias para la cantidad pedida
  options.sort((a, b) => {
    const filasA = Math.ceil(total / a.cols);
    const filasB = Math.ceil(total / b.cols);
    // Menos filas primero (minimiza largo consumido)
    if (filasA !== filasB) return filasA - filasB;
    // Empate: más columnas primero (aprovecha ancho)
    return b.cols - a.cols;
  });
  const best = options[0];

  const piezasPorPlaca = best.cols * best.rows;
  const placasNeeded = Math.ceil(total / piezasPorPlaca);
  const placaLayouts: MultiMedidaNestingResult["placaLayouts"] = [];
  let totalPiezas = 0;
  let totalAreaUtil = 0;

  let restantes = total;
  for (let pi = 0; pi < placasNeeded; pi++) {
    const piezasEstaPlaca = Math.min(restantes, piezasPorPlaca);
    const posiciones: MultiMedidaPiece[] = [];
    let placed = 0;
    for (let row = 0; row < best.rows && placed < piezasEstaPlaca; row++) {
      for (let col = 0; col < best.cols && placed < piezasEstaPlaca; col++) {
        posiciones.push({
          x: margen + col * (best.w + sepH),
          y: margen + row * (best.h + sepV),
          anchoMm: best.w,
          altoMm: best.h,
          medidaIndex: mi,
          rotada: best.rotada,
        });
        placed++;
      }
    }
    const filasUsadas = Math.ceil(piezasEstaPlaca / best.cols);
    const areaUtil = piezasEstaPlaca * pW * pH;
    placaLayouts.push({
      posiciones,
      largoConsumidoMm: margen + filasUsadas * best.h + (filasUsadas - 1) * sepV + margen,
      areaUtilMm2: areaUtil,
    });
    totalPiezas += piezasEstaPlaca;
    totalAreaUtil += areaUtil;
    restantes -= piezasEstaPlaca;
  }

  const areaTotalMm2 = (areaW + 2 * margen) * (areaH + 2 * margen) * placaLayouts.length;
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

/**
 * Nesting multi-medida con bin-packing 2D usando maxrects-packer.
 *
 * Para piezas de una sola medida usa un grid óptimo (fast-path).
 * Para múltiples medidas delega a maxrects-packer (Maximal Rectangles)
 * que distribuye piezas en múltiples bins (placas) automáticamente.
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

  // ── Bin-packing 2D con maxrects-packer ──────────────────────────
  // Cada pieza incluye la separación en sus dimensiones para que el
  // packer los coloque con gap correcto. Luego al leer los resultados
  // restamos la separación para obtener la posición real.

  const packer = new MaxRectsPacker(
    areaW + sepH,   // +sep porque cada pieza incluye sep en su tamaño
    areaH + sepV,
    0, // padding = 0 (la separación va incluida en el tamaño de pieza)
    {
      smart: false,  // tamaño fijo de placa, no auto-crecer
      pot: false,
      square: false,
      allowRotation: permitirRotacion,
    },
  );

  // Ordenar piezas de mayor a menor área para mejor aprovechamiento
  pendientes.sort((a, b) => (b.origW * b.origH) - (a.origW * a.origH));

  for (const p of pendientes) {
    // add(width, height, data) crea un Rectangle internamente
    packer.add(p.origW + sepH, p.origH + sepV, { mi: p.mi, origW: p.origW, origH: p.origH });
  }

  const placaLayouts: MultiMedidaNestingResult["placaLayouts"] = [];
  let totalPiezas = 0;
  let totalAreaUtil = 0;

  for (const bin of packer.bins) {
    const posiciones: MultiMedidaPiece[] = [];
    let maxY = 0;
    let areaUtil = 0;

    for (const rect of bin.rects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (rect as any).data as { mi: number; origW: number; origH: number };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rotada: boolean = (rect as any).rot ?? false;
      // El packer coloca con dimensiones incluyendo separación,
      // la pieza real es origW × origH
      const pieceW = rotada ? d.origH : d.origW;
      const pieceH = rotada ? d.origW : d.origH;

      posiciones.push({
        x: margen + rect.x,
        y: margen + rect.y,
        anchoMm: pieceW,
        altoMm: pieceH,
        medidaIndex: d.mi,
        rotada,
      });

      const bottom = rect.y + pieceH;
      if (bottom > maxY) maxY = bottom;
      areaUtil += d.origW * d.origH;
    }

    placaLayouts.push({
      posiciones,
      largoConsumidoMm: maxY > 0 ? margen + maxY + margen : 0,
      areaUtilMm2: areaUtil,
    });
    totalPiezas += posiciones.length;
    totalAreaUtil += areaUtil;
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

// ── Nesting de rollo flexible (shelf-packing) ────────────────────

export type RollNestingPiece = {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  medidaIndex: number;
  rotada: boolean;
};

export type RollNestingResult = {
  posiciones: RollNestingPiece[];
  rolloAnchoMm: number;
  largoConsumidoMm: number;
  areaUtilMm2: number;
  areaConsumidaM2: number;
  desperdicioPct: number;
  totalPiezas: number;
};

/**
 * Nesting en rollo flexible (ancho fijo, largo infinito).
 * Shelf-packing: acomoda piezas en filas horizontales, aprovechando el ancho.
 * Cada fila tiene la altura de la pieza más alta en esa fila.
 */
export function nestRollo(
  medidas: MedidaInput[],
  rolloAnchoMm: number,
  sepH: number,
  sepV: number,
  margenIzq: number,
  margenDer: number,
  margenInicio: number,
  permitirRotacion: boolean,
): RollNestingResult {
  const printableW = rolloAnchoMm - margenIzq - margenDer;
  const posiciones: RollNestingPiece[] = [];

  // Crear lista de piezas ordenadas por área (mayor primero)
  type Pieza = { mi: number; w: number; h: number };
  const piezas: Pieza[] = [];
  for (let mi = 0; mi < medidas.length; mi++) {
    const m = medidas[mi];
    if (m.anchoMm <= 0 || m.altoMm <= 0 || m.cantidad <= 0) continue;
    for (let i = 0; i < m.cantidad; i++) {
      piezas.push({ mi, w: m.anchoMm, h: m.altoMm });
    }
  }
  piezas.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  // Shelf packing
  let cursorX = margenIzq;
  let cursorY = margenInicio;
  let filaAlto = 0;

  for (const pieza of piezas) {
    // Probar orientaciones
    type Orient = { w: number; h: number; rotada: boolean };
    const orients: Orient[] = [{ w: pieza.w, h: pieza.h, rotada: false }];
    if (permitirRotacion && pieza.w !== pieza.h) {
      orients.push({ w: pieza.h, h: pieza.w, rotada: true });
    }
    // Preferir orientación que aprovecha más el ancho
    orients.sort((a, b) => b.w - a.w);

    let placed = false;
    for (const o of orients) {
      if (o.w <= printableW - (cursorX - margenIzq) + 0.01) {
        // Cabe en la fila actual
        posiciones.push({
          x: cursorX, y: cursorY,
          anchoMm: o.w, altoMm: o.h,
          medidaIndex: pieza.mi, rotada: o.rotada,
        });
        cursorX += o.w + sepH;
        filaAlto = Math.max(filaAlto, o.h);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Nueva fila
      cursorY += filaAlto + sepV;
      cursorX = margenIzq;
      filaAlto = 0;

      // Reintentar
      for (const o of orients) {
        if (o.w <= printableW + 0.01) {
          posiciones.push({
            x: cursorX, y: cursorY,
            anchoMm: o.w, altoMm: o.h,
            medidaIndex: pieza.mi, rotada: o.rotada,
          });
          cursorX += o.w + sepH;
          filaAlto = Math.max(filaAlto, o.h);
          break;
        }
      }
    }
  }

  // Largo consumido
  const largoConsumidoMm = posiciones.length > 0
    ? Math.max(...posiciones.map((p) => p.y + p.altoMm)) + margenInicio
    : 0;

  const areaUtilMm2 = posiciones.reduce((s, p) => s + p.anchoMm * p.altoMm, 0);
  const areaConsumidaMm2 = rolloAnchoMm * largoConsumidoMm;
  const desperdicioPct = areaConsumidaMm2 > 0 ? r2(((areaConsumidaMm2 - areaUtilMm2) / areaConsumidaMm2) * 100) : 0;

  return {
    posiciones,
    rolloAnchoMm,
    largoConsumidoMm,
    areaUtilMm2,
    areaConsumidaM2: r2(areaConsumidaMm2 / 1_000_000),
    desperdicioPct,
    totalPiezas: posiciones.length,
  };
}
