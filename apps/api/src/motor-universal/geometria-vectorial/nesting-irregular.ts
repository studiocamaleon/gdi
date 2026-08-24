import type {
  ContornoVectorial,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
  PiezaVectorial,
  PlacementVectorial,
  PuntoVectorial,
} from './tipos';
import {
  segmentarPiezasConEncastres,
  type ConfiguracionEncastresVectoriales,
} from './segmentacion-encastres';
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
  internalCuts: ContornoVectorial[];
}

interface Plate {
  placements: PlacementVectorial[];
  areaPiezasMm2: number;
}

interface EstrategiaBusqueda {
  preferirRotacionesCardinales: boolean;
}

interface LayoutEvaluado {
  plates: Plate[];
  rotacionesNoCardinales: number;
  areaEnvolventeMm2: number;
  firma: string;
}

interface EstadoBusqueda {
  plates: Plate[];
  puntuacion: number;
  firma: string;
}

interface PresupuestoBusqueda {
  evaluacionesRestantes: number;
}

type OrientacionBase = Omit<PiezaPreparada, 'copyIndex'>;

/** Una mejora menor a este porcentaje del área comprada no justifica girar
 * piezas en ángulos arbitrarios: cuesta lo mismo y complica identificación,
 * armado y aprovechamiento del negativo. */
const UMBRAL_COMPACTACION_SIGNIFICATIVA = 0.03;

export class NestingIrregularError extends Error {}

export function nestearGeometriaIrregular(input: {
  geometria: GeometriaVectorialCanonica;
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  configuracionEncastres?: ConfiguracionEncastresVectoriales;
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

  if (
    input.preservarComposicionOriginalSiEntra === true &&
    input.geometria.anchoMm <= usableWidth + 0.001 &&
    input.geometria.altoMm <= usableHeight + 0.001 &&
    input.geometria.piezas.every(
      (pieza) =>
        Number.isFinite(pieza.origenXmm) && Number.isFinite(pieza.origenYmm),
    )
  ) {
    return componerSinNestear({
      geometria: input.geometria,
      cantidad,
      anchoPlacaMm: input.anchoPlacaMm,
      altoPlacaMm: input.altoPlacaMm,
      anchoUtilMm: usableWidth,
      altoUtilMm: usableHeight,
      margenMm: margin,
    });
  }

  let segmentacion: ReturnType<typeof segmentarPiezasConEncastres>;
  try {
    segmentacion = segmentarPiezasConEncastres({
      piezas: input.geometria.piezas,
      anchoUtilMm: usableWidth,
      altoUtilMm: usableHeight,
      permitirRotacion: input.permitirRotacion !== false,
      configuracionEncastres: input.configuracionEncastres,
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
  const ordenes = generarOrdenesCandidatos(instances);
  const orientationCache = new Map<string, OrientacionBase[]>();
  const layouts = ordenes.flatMap((orden, index) =>
    // Para vectores chicos se exploran más órdenes con sesgo cardinal. El
    // modo libre completo se repite sólo cuando la cantidad de instancias lo
    // permite; así una cotización grande no multiplica exponencialmente la
    // grilla de colisiones.
    (index === 0 ? [true, false] : [true]).map((preferirRotacionesCardinales) =>
      evaluarLayout(
        empacarInstancias({
          instances: orden,
          plateWidth: input.anchoPlacaMm,
          plateHeight: input.altoPlacaMm,
          usableWidth,
          usableHeight,
          margin,
          gap,
          usarGrillaFina,
          allowRotation: input.permitirRotacion !== false,
          estrategia: { preferirRotacionesCardinales },
          orientationCache,
        }),
        margin,
      ),
    ),
  );
  const mejorLayout = layouts.sort((a, b) =>
    compararLayouts(
      a,
      b,
      usableWidth * usableHeight * Math.max(a.plates.length, b.plates.length),
    ),
  )[0];
  const plates =
    intentarReducirUnaPlaca({
      instances,
      layoutInicial: mejorLayout.plates,
      plateWidth: input.anchoPlacaMm,
      plateHeight: input.altoPlacaMm,
      usableWidth,
      usableHeight,
      margin,
      gap,
      allowRotation: input.permitirRotacion !== false,
      orientationCache,
    }) ?? mejorLayout.plates;

  const placements = plates.flatMap((plate) => plate.placements);
  const areaPiezasMm2 = input.geometria.areaTotalMm2 * cantidad;
  const perimetroCorteMm =
    (segmentacion.piezas.reduce((sum, pieza) => sum + pieza.perimetroMm, 0) +
      input.geometria.piezas.reduce(
        (sum, pieza) => sum + perimetroContornos(pieza.cortesInternos ?? []),
        0,
      )) *
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
    estrategiaDisposicion: 'nesting_optimizado',
  };
}

/** Conserva posiciones y orientación del SVG completo. Cada copia usa una
 * placa propia: el material negativo que queda alrededor de las piezas es el
 * molde físico de colocación, por lo que no puede compartirse entre carteles. */
function componerSinNestear(input: {
  geometria: GeometriaVectorialCanonica;
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  anchoUtilMm: number;
  altoUtilMm: number;
  margenMm: number;
}): NestingIrregularResult {
  const offsetX =
    input.margenMm + (input.anchoUtilMm - input.geometria.anchoMm) / 2;
  const offsetY =
    input.margenMm + (input.altoUtilMm - input.geometria.altoMm) / 2;
  const placements: PlacementVectorial[] = [];
  for (let copyIndex = 0; copyIndex < input.cantidad; copyIndex += 1) {
    for (const pieza of input.geometria.piezas) {
      const x = offsetX + (pieza.origenXmm ?? 0);
      const y = offsetY + (pieza.origenYmm ?? 0);
      placements.push({
        pieceId: pieza.id,
        copyIndex,
        substrateIndex: copyIndex,
        xMm: redondear(x),
        yMm: redondear(y),
        rotacion: 0,
        anchoMm: pieza.anchoMm,
        altoMm: pieza.altoMm,
        contornos: trasladar(pieza.contornos, x, y),
        cortesInternos: trasladar(pieza.cortesInternos ?? [], x, y),
      });
    }
  }
  const areaPiezasMm2 = input.geometria.areaTotalMm2 * input.cantidad;
  const areaCompradaMm2 =
    input.anchoPlacaMm * input.altoPlacaMm * input.cantidad;
  return {
    algorithm: 'irregular-2d-bottom-left-v1',
    placas: input.cantidad,
    anchoPlacaMm: input.anchoPlacaMm,
    altoPlacaMm: input.altoPlacaMm,
    anchoUtilMm: input.anchoUtilMm,
    altoUtilMm: input.altoUtilMm,
    placements,
    aprovechamientoPct:
      areaCompradaMm2 > 0
        ? redondear((areaPiezasMm2 / areaCompradaMm2) * 100)
        : 0,
    areaPiezasMm2: redondear(areaPiezasMm2),
    areaCompradaMm2: redondear(areaCompradaMm2),
    perimetroCorteMm: redondear(
      input.geometria.perimetroTotalMm * input.cantidad,
    ),
    piezasOriginales: input.geometria.piezas.length * input.cantidad,
    segmentos: input.geometria.piezas.length * input.cantidad,
    unionesFisicas: 0,
    uniones: [],
    estrategiaDisposicion: 'composicion_original',
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
  estrategia: EstrategiaBusqueda,
): PlacementVectorial | null {
  let best: PlacementVectorial | null = null;
  for (const orientation of orientations) {
    const maxX = plateWidth - margin - orientation.width;
    const maxY = plateHeight - margin - orientation.height;
    const candidates = posicionesCandidatas(
      plate,
      orientation.contours,
      margin,
      gap,
      maxX,
      maxY,
      usarGrillaFina,
      orientation.piece.segmentacion != null,
      false,
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
          colisionanContornos(contours, placed.contornos, gap),
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
        cortesInternos: trasladar(orientation.internalCuts, x, y),
        segmentacion: orientation.piece.segmentacion,
      };
      break;
    }
    if (
      bestForOrientation &&
      (!best || esMejorUbicacion(bestForOrientation, best, estrategia))
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
  contornosPieza: ContornoVectorial[],
  margin: number,
  gap: number,
  maxX: number,
  maxY: number,
  usarGrillaFina: boolean,
  esSegmento: boolean,
  incluirContactos: boolean,
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

  // Las cajas exteriores alcanzan para rectángulos, pero no encuentran
  // acomodos como una letra debajo de una silueta curva o una pieza dentro de
  // un hueco. Se agregan traslaciones que acercan vértices representativos de
  // ambos contornos. La validación posterior sigue usando la geometría real y
  // la separación configurada, por lo que estos puntos sólo amplían la
  // búsqueda: nunca permiten una superposición inválida.
  if (incluirContactos && plate.placements.length > 0) {
    for (const placed of plate.placements) {
      agregarCandidatosContacto({
        add,
        contornosPieza,
        contornosColocados: placed.contornos,
        gap,
      });
    }
  }
  const contactKeys = new Set(candidates.keys());

  if (
    plate.placements.length > 0 &&
    (usarGrillaFina ? plate.placements.length <= 12 : true)
  ) {
    const maxGridCandidates = esSegmento
      ? 300
      : usarGrillaFina
        ? plate.placements.length <= 4
          ? 1_600
          : 900
        : 600;
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
    .filter(([key]) => !contactKeys.has(key))
    .map(([, value]) => value)
    .sort(bottomLeft);
  const contacts = [...candidates.entries()]
    .filter(([key]) => contactKeys.has(key) && !primaryKeys.has(key))
    .map(([, value]) => value)
    .sort(bottomLeft);
  return [...primary, ...contacts, ...fallbackGrid];
}

function agregarCandidatosContacto(input: {
  add: (x: number, y: number) => void;
  contornosPieza: ContornoVectorial[];
  contornosColocados: ContornoVectorial[];
  gap: number;
}) {
  const pieza = muestrearPuntosContacto(input.contornosPieza, 28);
  const colocados = muestrearPuntosContacto(input.contornosColocados, 28);
  const distanciaDiagonal = input.gap / Math.SQRT2;
  const offsets =
    input.gap > 0
      ? [
          { x: -input.gap, y: 0 },
          { x: input.gap, y: 0 },
          { x: 0, y: -input.gap },
          { x: 0, y: input.gap },
          { x: -distanciaDiagonal, y: -distanciaDiagonal },
          { x: distanciaDiagonal, y: -distanciaDiagonal },
          { x: -distanciaDiagonal, y: distanciaDiagonal },
          { x: distanciaDiagonal, y: distanciaDiagonal },
        ]
      : [{ x: 0, y: 0 }];
  for (const fijo of colocados)
    for (const movil of pieza)
      for (const offset of offsets)
        input.add(fijo.x - movil.x + offset.x, fijo.y - movil.y + offset.y);
}

function muestrearPuntosContacto(
  contornos: ContornoVectorial[],
  limite: number,
): PuntoVectorial[] {
  const puntos = contornos.flatMap((contorno) => contorno.puntos);
  if (puntos.length <= limite) return puntos;
  const result: PuntoVectorial[] = [];
  for (let index = 0; index < limite; index += 1)
    result.push(puntos[Math.floor((index * puntos.length) / limite)]);
  return result;
}

function prepararOrientaciones(
  piece: PiezaVectorial,
  copyIndex: number,
  allowRotation: boolean,
  usableWidth: number,
  usableHeight: number,
  cache?: Map<string, OrientacionBase[]>,
): PiezaPreparada[] {
  const cacheKey = `${piece.id}:${allowRotation}:${usableWidth}:${usableHeight}`;
  const cached = cache?.get(cacheKey);
  if (cached)
    return cached.map((orientation) => ({ ...orientation, copyIndex }));
  const angulos = angulosVectoriales(allowRotation);
  const orientaciones = angulos.map((rotacion) =>
    rotarPieza(piece, copyIndex, rotacion),
  );
  if (!allowRotation) {
    cache?.set(cacheKey, orientaciones.map(aOrientacionBase));
    return orientaciones;
  }
  const cardinales = orientaciones.filter((orientation) =>
    esRotacionCardinal(orientation.rotacion),
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
  const limite = 8;
  const elegidas = new Map<string, PiezaPreparada>();
  // La primera orientación que realmente entra no puede perderse por el
  // recorte de candidatos usado para mantener acotado el tiempo de nesting.
  for (const orientation of [...cardinales, ...queEntran, ...porCaja]) {
    // No deduplicar por ancho/alto: 0° y 180° comparten caja exterior, pero
    // una silueta asimétrica puede encajar de una sola de esas maneras.
    const key = `${orientation.rotacion}`;
    if (!elegidas.has(key)) elegidas.set(key, orientation);
    if (elegidas.size >= limite) break;
  }
  const result = [...elegidas.values()];
  cache?.set(cacheKey, result.map(aOrientacionBase));
  return result;
}

function empacarInstancias(input: {
  instances: Array<{ piece: PiezaVectorial; copyIndex: number }>;
  plateWidth: number;
  plateHeight: number;
  usableWidth: number;
  usableHeight: number;
  margin: number;
  gap: number;
  usarGrillaFina: boolean;
  allowRotation: boolean;
  estrategia: EstrategiaBusqueda;
  orientationCache: Map<string, OrientacionBase[]>;
}): Plate[] {
  const plates: Plate[] = [];
  for (const instance of input.instances) {
    const orientations = prepararOrientaciones(
      instance.piece,
      instance.copyIndex,
      input.allowRotation,
      input.usableWidth,
      input.usableHeight,
      input.orientationCache,
    );
    if (
      !orientations.some(
        (orientation) =>
          orientation.width <= input.usableWidth + 0.001 &&
          orientation.height <= input.usableHeight + 0.001,
      )
    ) {
      throw new NestingIrregularError(
        `${instance.piece.id} (${redondear(instance.piece.anchoMm)} × ${redondear(instance.piece.altoMm)} mm) no entra completa en el área útil de ${redondear(input.usableWidth)} × ${redondear(input.usableHeight)} mm.`,
      );
    }

    let placement: PlacementVectorial | null = null;
    for (let plateIndex = 0; plateIndex < plates.length; plateIndex += 1) {
      // Condición necesaria barata: si ni siquiera entra por área real, no
      // recorrer cientos de posiciones y colisiones vectoriales en esa placa.
      if (
        plates[plateIndex].areaPiezasMm2 + instance.piece.areaMm2 >
        input.usableWidth * input.usableHeight + 0.001
      )
        continue;
      placement = buscarUbicacion(
        orientations,
        plates[plateIndex],
        plateIndex,
        input.plateWidth,
        input.plateHeight,
        input.margin,
        input.gap,
        input.usarGrillaFina,
        input.estrategia,
      );
      if (placement) {
        plates[plateIndex].placements.push(placement);
        plates[plateIndex].areaPiezasMm2 += instance.piece.areaMm2;
        break;
      }
    }
    if (placement) continue;

    const plate: Plate = { placements: [], areaPiezasMm2: 0 };
    placement = buscarUbicacion(
      orientations,
      plate,
      plates.length,
      input.plateWidth,
      input.plateHeight,
      input.margin,
      input.gap,
      input.usarGrillaFina,
      input.estrategia,
    );
    if (!placement)
      throw new NestingIrregularError(
        `No se encontró una ubicación válida para ${instance.piece.id}.`,
      );
    plate.placements.push(placement);
    plate.areaPiezasMm2 = instance.piece.areaMm2;
    plates.push(plate);
  }
  return plates;
}

/** Segunda oportunidad acotada para evitar una placa residual. El greedy
 * normal es rápido, pero una decisión temprana puede dejar una única pieza en
 * la última placa. Para vectores chicos se reconstruye el layout con varias
 * alternativas simultáneas, usando contactos entre contornos reales y
 * permitiendo volver atrás sin convertir la cotización en una búsqueda sin
 * límite. */
function intentarReducirUnaPlaca(input: {
  instances: Array<{ piece: PiezaVectorial; copyIndex: number }>;
  layoutInicial: Plate[];
  plateWidth: number;
  plateHeight: number;
  usableWidth: number;
  usableHeight: number;
  margin: number;
  gap: number;
  allowRotation: boolean;
  orientationCache: Map<string, OrientacionBase[]>;
}): Plate[] | null {
  if (
    input.layoutInicial.length <= 1 ||
    input.instances.length < 3 ||
    input.instances.length > 12
  )
    return null;
  const objetivo = input.layoutInicial.length - 1;
  const areaUtil = input.usableWidth * input.usableHeight;
  const ultimaPlaca = input.layoutInicial.at(-1);
  if (!ultimaPlaca || ultimaPlaca.areaPiezasMm2 / areaUtil > 0.35) return null;
  const areaTotal = input.instances.reduce(
    (total, instance) => total + instance.piece.areaMm2,
    0,
  );
  if (areaTotal > areaUtil * objetivo + 0.001) return null;

  const presupuestoRapido: PresupuestoBusqueda = {
    evaluacionesRestantes: 45_000,
  };
  const ordenes = generarOrdenesRescate(input.instances);
  for (const orden of ordenes) {
    const result = buscarLayoutConRetroceso({
      ...input,
      instances: orden,
      maxPlates: objetivo,
      incluirContactos: false,
      presupuesto: presupuestoRapido,
    });
    if (result) return result;
    if (presupuestoRapido.evaluacionesRestantes <= 0) break;
  }

  // Si la grilla y los contactos rectangulares no alcanzaron, reservar un
  // segundo presupuesto breve para concavidades reales. Esta fase es más cara
  // y por eso sólo corre cuando todavía existe una placa que podría eliminarse.
  const presupuestoContactos: PresupuestoBusqueda = {
    evaluacionesRestantes: 8_000,
  };
  for (const orden of ordenes) {
    const result = buscarLayoutConRetroceso({
      ...input,
      instances: orden,
      maxPlates: objetivo,
      incluirContactos: true,
      presupuesto: presupuestoContactos,
    });
    if (result) return result;
    if (presupuestoContactos.evaluacionesRestantes <= 0) break;
  }
  return null;
}

function buscarLayoutConRetroceso(input: {
  instances: Array<{ piece: PiezaVectorial; copyIndex: number }>;
  maxPlates: number;
  plateWidth: number;
  plateHeight: number;
  usableWidth: number;
  usableHeight: number;
  margin: number;
  gap: number;
  allowRotation: boolean;
  orientationCache: Map<string, OrientacionBase[]>;
  incluirContactos: boolean;
  presupuesto: PresupuestoBusqueda;
}): Plate[] | null {
  const anchoArea = input.usableWidth * input.usableHeight;
  let estados: EstadoBusqueda[] = [{ plates: [], puntuacion: 0, firma: '' }];
  for (const instance of input.instances) {
    if (input.presupuesto.evaluacionesRestantes <= 0) return null;
    const orientations = prepararOrientaciones(
      instance.piece,
      instance.copyIndex,
      input.allowRotation,
      input.usableWidth,
      input.usableHeight,
      input.orientationCache,
    );
    const siguientes = new Map<string, EstadoBusqueda>();
    for (const estado of estados) {
      const cantidadPlacasCandidatas = Math.min(
        input.maxPlates,
        estado.plates.length + 1,
      );
      for (
        let plateIndex = 0;
        plateIndex < cantidadPlacasCandidatas;
        plateIndex += 1
      ) {
        const plate = estado.plates[plateIndex] ?? {
          placements: [],
          areaPiezasMm2: 0,
        };
        if (plate.areaPiezasMm2 + instance.piece.areaMm2 > anchoArea + 0.001)
          continue;
        const placements = enumerarUbicacionesRescate({
          orientations,
          plate,
          plateIndex,
          plateWidth: input.plateWidth,
          plateHeight: input.plateHeight,
          margin: input.margin,
          gap: input.gap,
          incluirContactos: input.incluirContactos,
          presupuesto: input.presupuesto,
        });
        for (const placement of placements) {
          const plates = estado.plates.map((item) => ({
            placements: [...item.placements],
            areaPiezasMm2: item.areaPiezasMm2,
          }));
          if (!plates[plateIndex])
            plates.push({ placements: [], areaPiezasMm2: 0 });
          plates[plateIndex].placements.push(placement);
          plates[plateIndex].areaPiezasMm2 += instance.piece.areaMm2;
          const firma = firmaEstado(plates);
          if (siguientes.has(firma)) continue;
          siguientes.set(firma, {
            plates,
            puntuacion: puntuarEstado(plates, input.margin, input.maxPlates),
            firma,
          });
        }
      }
    }
    estados = seleccionarEstadosDiversos([...siguientes.values()], 72, 3);
    if (estados.length === 0) return null;
  }
  return (
    estados
      .filter((estado) => estado.plates.length <= input.maxPlates)
      .sort(
        (a, b) => a.puntuacion - b.puntuacion || a.firma.localeCompare(b.firma),
      )[0]?.plates ?? null
  );
}

function seleccionarEstadosDiversos(
  estados: EstadoBusqueda[],
  limite: number,
  porDistribucion: number,
) {
  const comparar = (a: EstadoBusqueda, b: EstadoBusqueda) =>
    a.puntuacion - b.puntuacion || a.firma.localeCompare(b.firma);
  const grupos = new Map<string, EstadoBusqueda[]>();
  for (const estado of estados.sort(comparar)) {
    const key = firmaDistribucion(estado.plates);
    const grupo = grupos.get(key) ?? [];
    if (grupo.length >= porDistribucion) continue;
    grupo.push(estado);
    grupos.set(key, grupo);
  }
  const result: EstadoBusqueda[] = [];
  for (let ronda = 0; ronda < porDistribucion; ronda += 1) {
    const candidatos = [...grupos.values()]
      .map((grupo) => grupo[ronda])
      .filter((estado): estado is EstadoBusqueda => estado != null)
      .sort(comparar);
    for (const estado of candidatos) {
      result.push(estado);
      if (result.length >= limite) return result;
    }
  }
  return result;
}

function firmaDistribucion(plates: Plate[]) {
  return plates
    .map((plate) =>
      plate.placements
        .map((item) => `${item.pieceId}:${item.copyIndex}`)
        .sort()
        .join(','),
    )
    .join('|');
}

function enumerarUbicacionesRescate(input: {
  orientations: PiezaPreparada[];
  plate: Plate;
  plateIndex: number;
  plateWidth: number;
  plateHeight: number;
  margin: number;
  gap: number;
  incluirContactos: boolean;
  presupuesto: PresupuestoBusqueda;
}): PlacementVectorial[] {
  const result: PlacementVectorial[] = [];
  const orientacionesCardinales = input.orientations.filter((orientation) =>
    esRotacionCardinal(orientation.rotacion),
  );
  const orientations =
    orientacionesCardinales.length > 0
      ? orientacionesCardinales
      : input.orientations;
  for (const orientation of orientations) {
    if (input.presupuesto.evaluacionesRestantes <= 0) break;
    const maxX = input.plateWidth - input.margin - orientation.width;
    const maxY = input.plateHeight - input.margin - orientation.height;
    if (maxX < input.margin - 0.001 || maxY < input.margin - 0.001) continue;
    const candidates = posicionesCandidatas(
      input.plate,
      orientation.contours,
      input.margin,
      input.gap,
      maxX,
      maxY,
      false,
      orientation.piece.segmentacion != null,
      input.incluirContactos,
    );
    let encontradasOrientacion = 0;
    for (const { x, y } of candidates) {
      input.presupuesto.evaluacionesRestantes -= 1;
      if (input.presupuesto.evaluacionesRestantes < 0) break;
      const nearbyPlacements = input.plate.placements.filter((placed) =>
        rectangulosPotencialmenteCercanos(
          x,
          y,
          orientation.width,
          orientation.height,
          placed,
          input.gap,
        ),
      );
      const contours = trasladar(orientation.contours, x, y);
      if (
        nearbyPlacements.some((placed) =>
          colisionanContornos(contours, placed.contornos, input.gap),
        )
      )
        continue;
      result.push({
        pieceId: orientation.piece.id,
        copyIndex: orientation.copyIndex,
        substrateIndex: input.plateIndex,
        xMm: x,
        yMm: y,
        rotacion: orientation.rotacion,
        anchoMm: orientation.width,
        altoMm: orientation.height,
        contornos: contours,
        cortesInternos: trasladar(orientation.internalCuts, x, y),
        segmentacion: orientation.piece.segmentacion,
      });
      encontradasOrientacion += 1;
      if (encontradasOrientacion >= 3 || result.length >= 18) break;
    }
    if (result.length >= 18) break;
  }
  return result;
}

function generarOrdenesRescate(
  instances: Array<{ piece: PiezaVectorial; copyIndex: number }>,
) {
  const comparadores = [
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      Number(a.piece.segmentacion != null) -
        Number(b.piece.segmentacion != null) ||
      b.piece.altoMm - a.piece.altoMm ||
      a.piece.id.localeCompare(b.piece.id),
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      b.piece.altoMm - a.piece.altoMm || b.piece.anchoMm - a.piece.anchoMm,
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      b.piece.areaMm2 - a.piece.areaMm2 || b.piece.altoMm - a.piece.altoMm,
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      Math.max(b.piece.anchoMm, b.piece.altoMm) -
        Math.max(a.piece.anchoMm, a.piece.altoMm) ||
      b.piece.areaMm2 - a.piece.areaMm2,
  ];
  const unique = new Map<string, typeof instances>();
  for (const comparar of comparadores) {
    const orden = [...instances].sort(
      (a, b) =>
        comparar(a, b) ||
        a.piece.id.localeCompare(b.piece.id) ||
        a.copyIndex - b.copyIndex,
    );
    unique.set(
      orden.map(({ piece, copyIndex }) => `${piece.id}:${copyIndex}`).join('|'),
      orden,
    );
  }
  return [...unique.values()];
}

function puntuarEstado(plates: Plate[], margin: number, maxPlates: number) {
  const areaEnvolvente = plates.reduce((total, plate) => {
    const right = Math.max(
      margin,
      ...plate.placements.map((item) => item.xMm + item.anchoMm),
    );
    const bottom = Math.max(
      margin,
      ...plate.placements.map((item) => item.yMm + item.altoMm),
    );
    return total + (right - margin) * (bottom - margin);
  }, 0);
  // Conservar alternativas que ya abrieron la cantidad objetivo evita que el
  // beam descarte demasiado pronto una distribución equilibrada entre placas.
  const placasFaltantes = maxPlates - plates.length;
  return areaEnvolvente + placasFaltantes * areaEnvolvente * 0.04;
}

function firmaEstado(plates: Plate[]) {
  return plates
    .flatMap((plate, plateIndex) =>
      plate.placements.map(
        (item) =>
          `${plateIndex}:${item.pieceId}:${item.copyIndex}:${item.rotacion}:${Math.round(item.xMm)}:${Math.round(item.yMm)}`,
      ),
    )
    .join('|');
}

function generarOrdenesCandidatos(
  instances: Array<{ piece: PiezaVectorial; copyIndex: number }>,
): Array<Array<{ piece: PiezaVectorial; copyIndex: number }>> {
  const comparadores = [
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      b.piece.areaMm2 - a.piece.areaMm2 || b.piece.altoMm - a.piece.altoMm,
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      Math.max(b.piece.anchoMm, b.piece.altoMm) -
        Math.max(a.piece.anchoMm, a.piece.altoMm) ||
      b.piece.areaMm2 - a.piece.areaMm2,
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      b.piece.altoMm - a.piece.altoMm || b.piece.anchoMm - a.piece.anchoMm,
    (a: (typeof instances)[number], b: (typeof instances)[number]) =>
      b.piece.anchoMm - a.piece.anchoMm || b.piece.altoMm - a.piece.altoMm,
  ];
  const todasSegmentadas = instances.every(
    (instance) => instance.piece.segmentacion != null,
  );
  const maxOrdenes = todasSegmentadas
    ? 1
    : instances.length <= 10
      ? 4
      : instances.length <= 24
        ? 2
        : 1;
  const unique = new Map<string, Array<(typeof instances)[number]>>();
  for (const comparar of comparadores.slice(0, maxOrdenes)) {
    const orden = [...instances].sort(
      (a, b) =>
        comparar(a, b) ||
        a.piece.id.localeCompare(b.piece.id) ||
        a.copyIndex - b.copyIndex,
    );
    const key = orden
      .map(({ piece, copyIndex }) => `${piece.id}:${copyIndex}`)
      .join('|');
    unique.set(key, orden);
  }
  return [...unique.values()];
}

function evaluarLayout(plates: Plate[], margin: number): LayoutEvaluado {
  const placements = plates.flatMap((plate) => plate.placements);
  const areaEnvolventeMm2 = plates.reduce((total, plate) => {
    const right = Math.max(
      margin,
      ...plate.placements.map((item) => item.xMm + item.anchoMm),
    );
    const bottom = Math.max(
      margin,
      ...plate.placements.map((item) => item.yMm + item.altoMm),
    );
    return total + (right - margin) * (bottom - margin);
  }, 0);
  return {
    plates,
    rotacionesNoCardinales: placements.filter(
      (item) => !esRotacionCardinal(item.rotacion),
    ).length,
    areaEnvolventeMm2,
    firma: placements
      .map(
        (item) =>
          `${item.substrateIndex}:${item.pieceId}:${item.copyIndex}:${item.rotacion}:${item.xMm}:${item.yMm}`,
      )
      .join('|'),
  };
}

function compararLayouts(
  a: LayoutEvaluado,
  b: LayoutEvaluado,
  areaCompradaMm2: number,
): number {
  if (a.plates.length !== b.plates.length)
    return a.plates.length - b.plates.length;
  const diferenciaEnvolvente = a.areaEnvolventeMm2 - b.areaEnvolventeMm2;
  if (
    Math.abs(diferenciaEnvolvente) >
    areaCompradaMm2 * UMBRAL_COMPACTACION_SIGNIFICATIVA
  )
    return diferenciaEnvolvente;
  if (a.rotacionesNoCardinales !== b.rotacionesNoCardinales)
    return a.rotacionesNoCardinales - b.rotacionesNoCardinales;
  if (diferenciaEnvolvente !== 0) return diferenciaEnvolvente;
  return a.firma.localeCompare(b.firma);
}

function esRotacionCardinal(rotacion: number): boolean {
  const normalizada = ((rotacion % 360) + 360) % 360;
  return Math.abs(normalizada % 90) < 0.001;
}

function esMejorUbicacion(
  candidate: PlacementVectorial,
  current: PlacementVectorial,
  estrategia: EstrategiaBusqueda,
): boolean {
  if (estrategia.preferirRotacionesCardinales) {
    const candidateCardinal = esRotacionCardinal(candidate.rotacion);
    const currentCardinal = esRotacionCardinal(current.rotacion);
    if (candidateCardinal !== currentCardinal) return candidateCardinal;
  }
  const candidateBottom = candidate.yMm + candidate.altoMm;
  const currentBottom = current.yMm + current.altoMm;
  return (
    candidateBottom < currentBottom ||
    (candidateBottom === currentBottom && candidate.xMm < current.xMm)
  );
}

function rotarPieza(
  piece: PiezaVectorial,
  copyIndex: number,
  rotacion: number,
): PiezaPreparada {
  const cantidadContornos = piece.contornos.length;
  const rotated = rotarContornosVectoriales(
    [...piece.contornos, ...(piece.cortesInternos ?? [])],
    rotacion,
  );
  return {
    piece,
    copyIndex,
    rotacion,
    width: rotated.anchoMm,
    height: rotated.altoMm,
    contours: rotated.contornos.slice(0, cantidadContornos),
    internalCuts: rotated.contornos.slice(cantidadContornos),
  };
}

function aOrientacionBase(orientation: PiezaPreparada): OrientacionBase {
  return {
    piece: orientation.piece,
    rotacion: orientation.rotacion,
    width: orientation.width,
    height: orientation.height,
    contours: orientation.contours,
    internalCuts: orientation.internalCuts,
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

/** @internal Exportada para regresiones geométricas del motor. */
export function colisionanContornos(
  a: ContornoVectorial[],
  b: ContornoVectorial[],
  gap: number,
): boolean {
  const puntosA = a.flatMap((contorno) => contorno.puntos);
  const puntosB = b.flatMap((contorno) => contorno.puntos);
  const ba = bounds(puntosA);
  const bb = bounds(puntosB);
  if (
    ba.maxX + gap <= bb.minX ||
    bb.maxX + gap <= ba.minX ||
    ba.maxY + gap <= bb.minY ||
    bb.maxY + gap <= ba.minY
  )
    return false;
  if (
    a.some((contornoA) =>
      b.some((contornoB) =>
        segmentosSeCruzan(contornoA.puntos, contornoB.puntos),
      ),
    )
  )
    return true;
  const exterioresA = a.filter((contorno) => !contorno.esHueco);
  const exterioresB = b.filter((contorno) => !contorno.esHueco);
  if (
    exterioresA.some((contorno) =>
      puntosInteriores(contorno.puntos, a).some((point) =>
        puntoEnSolido(point, b),
      ),
    ) ||
    exterioresB.some((contorno) =>
      puntosInteriores(contorno.puntos, b).some((point) =>
        puntoEnSolido(point, a),
      ),
    )
  )
    return true;
  if (gap <= 0) return false;
  return a.some((contornoA) =>
    b.some((contornoB) =>
      poligonosMasCercaQue(contornoA.puntos, contornoB.puntos, gap - 0.001),
    ),
  );
}

function puntosInteriores(
  points: PuntoVectorial[],
  contours: ContornoVectorial[],
): PuntoVectorial[] {
  const centro = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  // Si no hubo cruces de bordes, un único punto interior alcanza para decidir
  // contención. Evitar devolver todos los nodos es crítico para SVG complejos:
  // comparar cada punto contra cada contorno volvía cuadrática cada colisión.
  const candidates = [
    centro,
    ...points.map((point) => ({
      x: point.x + (centro.x - point.x) * 0.01,
      y: point.y + (centro.y - point.y) * 0.01,
    })),
  ];
  const interior = candidates.find((point) => puntoEnSolido(point, contours));
  return interior ? [interior] : [];
}

function puntoEnSolido(
  point: PuntoVectorial,
  contours: ContornoVectorial[],
): boolean {
  // Tocar el borde no implica superposición cuando gap=0. Con separación
  // positiva la distancia entre contornos se valida después.
  if (
    contours.some((contorno) => puntoSobreBorde(point, contorno.puntos, 0.0001))
  )
    return false;
  const dentroExterior = contours.some(
    (contorno) => !contorno.esHueco && puntoEnPoligono(point, contorno.puntos),
  );
  if (!dentroExterior) return false;
  return !contours.some(
    (contorno) => contorno.esHueco && puntoEnPoligono(point, contorno.puntos),
  );
}

function puntoSobreBorde(
  point: PuntoVectorial,
  polygon: PuntoVectorial[],
  tolerancia: number,
): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    if (
      distanciaPuntoSegmento(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length],
      ) <= tolerancia
    )
      return true;
  }
  return false;
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

function perimetroContornos(contornos: ContornoVectorial[]): number {
  return contornos.reduce(
    (total, contorno) =>
      total +
      contorno.puntos.reduce((sum, punto, index) => {
        const siguiente = contorno.puntos[(index + 1) % contorno.puntos.length];
        return sum + Math.hypot(siguiente.x - punto.x, siguiente.y - punto.y);
      }, 0),
    0,
  );
}

function validarNumero(value: number, message: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new NestingIrregularError(message);
}

function redondear(value: number): number {
  return Math.round(value * 1000) / 1000;
}
