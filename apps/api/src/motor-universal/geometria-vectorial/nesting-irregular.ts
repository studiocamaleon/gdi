import type {
  ContornoVectorial,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
  PiezaVectorial,
  PlacementVectorial,
  PuntoVectorial,
} from './tipos';
import { segmentarPiezasConEncastres } from './segmentacion-encastres';
import {
  angulosVectoriales,
  rotarContornosVectoriales,
} from './rotacion-vectorial';

interface PiezaPreparada {
  piece: PiezaVectorial;
  copyIndex: number;
  rotacion: number;
  width: number;
  height: number;
  contours: ContornoVectorial[];
}

interface Plate {
  placements: PlacementVectorial[];
}

export class NestingIrregularError extends Error {}

export function nestearGeometriaIrregular(input: {
  geometria: GeometriaVectorialCanonica;
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
}): NestingIrregularResult {
  const cantidad = Math.ceil(input.cantidad);
  const margin = input.margenMm ?? 0;
  const gap = input.separacionMm ?? 0;
  validarNumero(cantidad, 'La cantidad debe ser mayor que cero.');
  validarNumero(
    input.anchoPlacaMm,
    'El ancho de placa debe ser mayor que cero.',
  );
  validarNumero(input.altoPlacaMm, 'El alto de placa debe ser mayor que cero.');
  if (margin < 0 || gap < 0)
    throw new NestingIrregularError(
      'Los márgenes y la separación no pueden ser negativos.',
    );
  const usableWidth = input.anchoPlacaMm - margin * 2;
  const usableHeight = input.altoPlacaMm - margin * 2;
  if (usableWidth <= 0 || usableHeight <= 0)
    throw new NestingIrregularError(
      'Los márgenes consumen toda el área de la placa.',
    );

  let segmentacion: ReturnType<typeof segmentarPiezasConEncastres>;
  try {
    segmentacion = segmentarPiezasConEncastres({
      piezas: input.geometria.piezas,
      anchoUtilMm: usableWidth,
      altoUtilMm: usableHeight,
      permitirRotacion: input.permitirRotacion !== false,
    });
  } catch (error) {
    throw new NestingIrregularError(
      error instanceof Error
        ? error.message
        : 'No se pudo dividir el vector para las placas seleccionadas.',
    );
  }
  const instances: Array<{ piece: PiezaVectorial; copyIndex: number }> = [];
  const totalPuntosGeometria = input.geometria.piezas.reduce(
    (total, piece) =>
      total +
      piece.contornos.reduce((sum, contour) => sum + contour.puntos.length, 0),
    0,
  );
  const usarGrillaFina = totalPuntosGeometria <= 2_000;
  for (const piece of segmentacion.piezas) {
    for (let copyIndex = 0; copyIndex < cantidad; copyIndex++)
      instances.push({ piece, copyIndex });
  }
  instances.sort(
    (a, b) =>
      b.piece.areaMm2 - a.piece.areaMm2 || b.piece.altoMm - a.piece.altoMm,
  );

  const plates: Plate[] = [];
  for (const instance of instances) {
    const orientations = prepararOrientaciones(
      instance.piece,
      instance.copyIndex,
      input.permitirRotacion !== false,
      usableWidth,
      usableHeight,
    );
    if (
      !orientations.some(
        (o) => o.width <= usableWidth && o.height <= usableHeight,
      )
    ) {
      throw new NestingIrregularError(
        `${instance.piece.id} (${redondear(instance.piece.anchoMm)} × ${redondear(instance.piece.altoMm)} mm) no entra completa en el área útil de ${redondear(usableWidth)} × ${redondear(usableHeight)} mm.`,
      );
    }

    let placed = false;
    for (
      let plateIndex = 0;
      plateIndex < plates.length && !placed;
      plateIndex++
    ) {
      const placement = buscarUbicacion(
        orientations,
        plates[plateIndex],
        plateIndex,
        input.anchoPlacaMm,
        input.altoPlacaMm,
        margin,
        gap,
        usarGrillaFina,
      );
      if (placement) {
        plates[plateIndex].placements.push(placement);
        placed = true;
      }
    }
    if (!placed) {
      const plate: Plate = { placements: [] };
      const placement = buscarUbicacion(
        orientations,
        plate,
        plates.length,
        input.anchoPlacaMm,
        input.altoPlacaMm,
        margin,
        gap,
        usarGrillaFina,
      );
      if (!placement)
        throw new NestingIrregularError(
          `No se encontró una ubicación válida para ${instance.piece.id}.`,
        );
      plate.placements.push(placement);
      plates.push(plate);
    }
  }

  const placements = plates.flatMap((plate) => plate.placements);
  const areaPiezasMm2 = input.geometria.areaTotalMm2 * cantidad;
  const perimetroCorteMm =
    segmentacion.piezas.reduce((sum, pieza) => sum + pieza.perimetroMm, 0) *
    cantidad;
  const areaCompradaMm2 =
    input.anchoPlacaMm * input.altoPlacaMm * plates.length;
  return {
    algorithm: 'irregular-2d-bottom-left-v1',
    placas: plates.length,
    anchoPlacaMm: input.anchoPlacaMm,
    altoPlacaMm: input.altoPlacaMm,
    anchoUtilMm: usableWidth,
    altoUtilMm: usableHeight,
    placements,
    aprovechamientoPct:
      areaCompradaMm2 > 0
        ? redondear((areaPiezasMm2 / areaCompradaMm2) * 100)
        : 0,
    areaPiezasMm2: redondear(areaPiezasMm2),
    areaCompradaMm2: redondear(areaCompradaMm2),
    perimetroCorteMm: redondear(perimetroCorteMm),
    piezasOriginales: input.geometria.piezas.length * cantidad,
    segmentos: segmentacion.piezas.length * cantidad,
    unionesFisicas:
      (segmentacion.piezas.length - input.geometria.piezas.length) * cantidad,
    uniones: segmentacion.uniones,
  };
}

function buscarUbicacion(
  orientations: PiezaPreparada[],
  plate: Plate,
  plateIndex: number,
  plateWidth: number,
  plateHeight: number,
  margin: number,
  gap: number,
  usarGrillaFina: boolean,
): PlacementVectorial | null {
  let best: PlacementVectorial | null = null;
  for (const orientation of orientations) {
    const maxX = plateWidth - margin - orientation.width;
    const maxY = plateHeight - margin - orientation.height;
    const candidates = posicionesCandidatas(
      plate,
      margin,
      gap,
      maxX,
      maxY,
      usarGrillaFina,
    );
    let bestForOrientation: PlacementVectorial | null = null;
    for (const { x, y } of candidates) {
      if (
        x + orientation.width > plateWidth - margin + 0.001 ||
        y + orientation.height > plateHeight - margin + 0.001
      )
        continue;
      const nearbyPlacements = plate.placements.filter((placed) =>
        rectangulosPotencialmenteCercanos(
          x,
          y,
          orientation.width,
          orientation.height,
          placed,
          gap,
        ),
      );
      const contours = trasladar(orientation.contours, x, y);
      if (
        nearbyPlacements.some((placed) =>
          colisionan(contours[0].puntos, placed.contornos[0].puntos, gap),
        )
      )
        continue;
      bestForOrientation = {
        pieceId: orientation.piece.id,
        copyIndex: orientation.copyIndex,
        substrateIndex: plateIndex,
        xMm: x,
        yMm: y,
        rotacion: orientation.rotacion,
        anchoMm: orientation.width,
        altoMm: orientation.height,
        contornos: contours,
        segmentacion: orientation.piece.segmentacion,
      };
      break;
    }
    if (
      bestForOrientation &&
      (!best ||
        bestForOrientation.yMm + bestForOrientation.altoMm <
          best.yMm + best.altoMm ||
        (bestForOrientation.yMm + bestForOrientation.altoMm ===
          best.yMm + best.altoMm &&
          bestForOrientation.xMm < best.xMm))
    )
      best = bestForOrientation;
  }
  return best;
}

function rectangulosPotencialmenteCercanos(
  x: number,
  y: number,
  width: number,
  height: number,
  placed: PlacementVectorial,
  gap: number,
): boolean {
  return !(
    x + width + gap <= placed.xMm ||
    placed.xMm + placed.anchoMm + gap <= x ||
    y + height + gap <= placed.yMm ||
    placed.yMm + placed.altoMm + gap <= y
  );
}

/** Candidatos bottom-left acotados. Antes se cruzaba cada X con cada Y y un
 * vector de muchas piezas terminaba evaluando millones de posiciones. Los
 * contactos relevantes se prueban primero; una grilla fina sólo se usa en las
 * primeras piezas, donde todavía aporta encastre irregular a costo razonable. */
function posicionesCandidatas(
  plate: Plate,
  margin: number,
  gap: number,
  maxX: number,
  maxY: number,
  usarGrillaFina: boolean,
): Array<{ x: number; y: number }> {
  const candidates = new Map<string, { x: number; y: number }>();
  const add = (x: number, y: number) => {
    if (x < margin - 0.001 || y < margin - 0.001) return;
    if (x > maxX + 0.001 || y > maxY + 0.001) return;
    const point = { x: redondear(x), y: redondear(y) };
    candidates.set(`${point.x}:${point.y}`, point);
  };
  add(margin, margin);
  for (const placed of plate.placements) {
    const right = placed.xMm + placed.anchoMm + gap;
    const bottom = placed.yMm + placed.altoMm + gap;
    add(right, placed.yMm);
    add(placed.xMm, bottom);
    add(right, margin);
    add(margin, bottom);
  }
  const primaryKeys = new Set(candidates.keys());

  if (
    plate.placements.length > 0 &&
    (usarGrillaFina ? plate.placements.length <= 12 : true)
  ) {
    const maxGridCandidates = usarGrillaFina ? 4_000 : 900;
    const area = Math.max(0, maxX - margin) * Math.max(0, maxY - margin);
    const gridStep = Math.max(2, gap || 5, Math.sqrt(area / maxGridCandidates));
    for (let y = margin; y <= maxY + 0.001; y += gridStep) {
      for (let x = margin; x <= maxX + 0.001; x += gridStep) add(x, y);
    }
  }

  const bottomLeft = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => a.y - b.y || a.x - b.x;
  const primary = [...candidates.entries()]
    .filter(([key]) => primaryKeys.has(key))
    .map(([, value]) => value)
    .sort(bottomLeft);
  const fallbackGrid = [...candidates.entries()]
    .filter(([key]) => !primaryKeys.has(key))
    .map(([, value]) => value)
    .sort(bottomLeft);
  return [...primary, ...fallbackGrid];
}

function prepararOrientaciones(
  piece: PiezaVectorial,
  copyIndex: number,
  allowRotation: boolean,
  usableWidth: number,
  usableHeight: number,
): PiezaPreparada[] {
  const angulos = angulosVectoriales(allowRotation);
  const orientaciones = angulos.map((rotacion) =>
    rotarPieza(piece, copyIndex, rotacion),
  );
  if (!allowRotation) return orientaciones;
  const cardinales = orientaciones.filter(
    (orientation) => orientation.rotacion === 0 || orientation.rotacion === 90,
  );
  const porCaja = [...orientaciones].sort(
    (a, b) =>
      a.width * a.height - b.width * b.height ||
      Math.min(a.width, a.height) - Math.min(b.width, b.height),
  );
  const queEntran = porCaja.filter(
    (orientation) =>
      orientation.width <= usableWidth + 0.001 &&
      orientation.height <= usableHeight + 0.001,
  );
  const limite = piece.segmentacion ? 6 : 4;
  const elegidas = new Map<string, PiezaPreparada>();
  // La primera orientación que realmente entra no puede perderse por el
  // recorte de candidatos usado para mantener acotado el tiempo de nesting.
  for (const orientation of [
    ...queEntran.slice(0, 1),
    ...cardinales,
    ...porCaja,
  ]) {
    const key = `${Math.round(orientation.width * 10)}:${Math.round(orientation.height * 10)}`;
    if (!elegidas.has(key)) elegidas.set(key, orientation);
    if (elegidas.size >= limite) break;
  }
  return [...elegidas.values()];
}

function rotarPieza(
  piece: PiezaVectorial,
  copyIndex: number,
  rotacion: number,
): PiezaPreparada {
  const rotated = rotarContornosVectoriales(piece.contornos, rotacion);
  return {
    piece,
    copyIndex,
    rotacion,
    width: rotated.anchoMm,
    height: rotated.altoMm,
    contours: rotated.contornos,
  };
}

function trasladar(
  contours: ContornoVectorial[],
  x: number,
  y: number,
): ContornoVectorial[] {
  return contours.map((contour) => ({
    ...contour,
    puntos: contour.puntos.map((p) => ({
      x: redondear(p.x + x),
      y: redondear(p.y + y),
    })),
  }));
}

function colisionan(
  a: PuntoVectorial[],
  b: PuntoVectorial[],
  gap: number,
): boolean {
  const ba = bounds(a);
  const bb = bounds(b);
  if (
    ba.maxX + gap <= bb.minX ||
    bb.maxX + gap <= ba.minX ||
    ba.maxY + gap <= bb.minY ||
    bb.maxY + gap <= ba.minY
  )
    return false;
  if (segmentosSeCruzan(a, b)) return true;
  if (puntoEnPoligono(a[0], b) || puntoEnPoligono(b[0], a)) return true;
  if (
    puntoEnPoligono(centroideVertices(a), b) ||
    puntoEnPoligono(centroideVertices(b), a)
  )
    return true;
  if (gap <= 0) return false;
  return poligonosMasCercaQue(a, b, gap - 0.001);
}

function centroideVertices(points: PuntoVectorial[]): PuntoVectorial {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function segmentosSeCruzan(a: PuntoVectorial[], b: PuntoVectorial[]): boolean {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const a1 = a[i];
      const a2 = a[(i + 1) % a.length];
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (!cajasSegmentosSeSuperponen(a1, a2, b1, b2)) continue;
      if (segmentosIntersectan(a1, a2, b1, b2)) return true;
    }
  return false;
}

function cajasSegmentosSeSuperponen(
  a: PuntoVectorial,
  b: PuntoVectorial,
  c: PuntoVectorial,
  d: PuntoVectorial,
  expansion = 0,
): boolean {
  return !(
    Math.max(a.x, b.x) + expansion < Math.min(c.x, d.x) ||
    Math.max(c.x, d.x) + expansion < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) + expansion < Math.min(c.y, d.y) ||
    Math.max(c.y, d.y) + expansion < Math.min(a.y, b.y)
  );
}

function segmentosIntersectan(
  a: PuntoVectorial,
  b: PuntoVectorial,
  c: PuntoVectorial,
  d: PuntoVectorial,
): boolean {
  const cross = (p: PuntoVectorial, q: PuntoVectorial, r: PuntoVectorial) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < -1e-6 && cdA * cdB < -1e-6;
}

function poligonosMasCercaQue(
  a: PuntoVectorial[],
  b: PuntoVectorial[],
  limite: number,
): boolean {
  if (limite <= 0) return false;
  for (const point of a)
    for (let index = 0; index < b.length; index++) {
      const start = b[index];
      const end = b[(index + 1) % b.length];
      if (!puntoCercaDeCajaSegmento(point, start, end, limite)) continue;
      if (distanciaPuntoSegmento(point, start, end) < limite) return true;
    }
  for (const point of b)
    for (let index = 0; index < a.length; index++) {
      const start = a[index];
      const end = a[(index + 1) % a.length];
      if (!puntoCercaDeCajaSegmento(point, start, end, limite)) continue;
      if (distanciaPuntoSegmento(point, start, end) < limite) return true;
    }
  return false;
}

function puntoCercaDeCajaSegmento(
  point: PuntoVectorial,
  a: PuntoVectorial,
  b: PuntoVectorial,
  limite: number,
): boolean {
  return !(
    point.x < Math.min(a.x, b.x) - limite ||
    point.x > Math.max(a.x, b.x) + limite ||
    point.y < Math.min(a.y, b.y) - limite ||
    point.y > Math.max(a.y, b.y) + limite
  );
}

function distanciaPuntoSegmento(
  p: PuntoVectorial,
  a: PuntoVectorial,
  b: PuntoVectorial,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function puntoEnPoligono(
  point: PuntoVectorial,
  polygon: PuntoVectorial[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function bounds(points: PuntoVectorial[]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, maxX, minY, maxY };
}

function validarNumero(value: number, message: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new NestingIrregularError(message);
}

function redondear(value: number): number {
  return Math.round(value * 1000) / 1000;
}
