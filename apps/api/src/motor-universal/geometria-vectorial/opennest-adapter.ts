import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PiezaTrabajoNestingOpenNest,
  PuntoTrabajoGeometria,
} from '../../workers/colas';
import { aplicarCapasAGeometria } from './capas-vectoriales';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  crearSolucionNestingIrregular,
  piezaDesdeDemanda,
  resolverProblemaNestingIrregular,
  type ProblemaNesting,
  type SolucionNesting,
} from './contrato-nesting';
import { NestingIrregularError } from './nesting-irregular';
import {
  resolverConfiguracionEncastresVectoriales,
  segmentarPiezasConEncastres,
  type ResultadoSegmentacion,
} from './segmentacion-encastres';
import { analizarSvgFabricacion } from './svg-parser';
import type {
  ContornoVectorial,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
  PiezaVectorial,
} from './tipos';
import type {
  EntradaGeometriaVectorialCache,
  ParametrosNestingVectorialCache,
} from './geometria-vectorial-cache.service';

type AnalisisSvgResultado = ReturnType<typeof analizarSvgFabricacion>;

export interface PreparacionAnalisisOpenNest {
  schemaVersion: 1;
  tenantId: string;
  nombreArchivo: string;
  cacheKey: string;
  sourceHash: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  configuracionCapas?: EntradaGeometriaVectorialCache['configuracionCapas'];
  parametros: ParametrosNestingVectorialCache;
  analisis: AnalisisSvgResultado;
  geometriaFabricacion: GeometriaVectorialCanonica;
  problema: ProblemaNesting;
  segmentacion: ResultadoSegmentacion;
}

export type PreparacionOpenNest = {
  contexto: PreparacionAnalisisOpenNest;
  trabajo?: Omit<
    NestingIrregularOpenNestData,
    'tenantId' | 'correlationId' | 'solicitadoEl'
  >;
  solucionInmediata?: SolucionNesting;
};

type TrabajoOpenNestPreparado = Omit<
  NestingIrregularOpenNestData,
  'tenantId' | 'correlationId' | 'solicitadoEl'
>;

export interface PreparacionProblemaOpenNest {
  problema: ProblemaNesting;
  geometriaFabricacion: GeometriaVectorialCanonica;
  segmentacion: ResultadoSegmentacion;
  trabajo?: TrabajoOpenNestPreparado;
  solucionInmediata?: SolucionNesting;
}

/**
 * Adapta el contrato neutral de nesting al worker. Esto permite que una
 * consolidación de componentes use el mismo motor que el análisis de un SVG,
 * sin reconstruir ni concatenar archivos fuente.
 */
export function prepararProblemaOpenNest(input: {
  problema: ProblemaNesting;
  claveSemilla: string;
}): PreparacionProblemaOpenNest {
  const { problema } = input;
  if (problema.superficie.tipo !== 'PLACA') {
    throw new NestingIrregularError(
      'GrafoNest requiere una superficie de placa finita.',
    );
  }
  if (problema.demandas.length === 0) {
    throw new NestingIrregularError(
      'El problema de nesting no contiene piezas.',
    );
  }
  const piezas = problema.demandas.map(piezaDesdeDemanda);
  const geometriaFabricacion: GeometriaVectorialCanonica = {
    schemaVersion: 1,
    anchoMm: Math.max(
      ...piezas.map((pieza) => (pieza.origenXmm ?? 0) + pieza.anchoMm),
    ),
    altoMm: Math.max(
      ...piezas.map((pieza) => (pieza.origenYmm ?? 0) + pieza.altoMm),
    ),
    piezas,
    areaTotalMm2: piezas.reduce((total, pieza) => total + pieza.areaMm2, 0),
    perimetroTotalMm: piezas.reduce(
      (total, pieza) => total + pieza.perimetroMm,
      0,
    ),
    hashFuente: input.claveSemilla,
  };
  const parametros = parametrosDesdeProblema(problema);
  const anchoUtilMm = problema.superficie.anchoMm - parametros.margenMm * 2;
  const altoUtilMm = problema.superficie.altoMm - parametros.margenMm * 2;
  if (anchoUtilMm <= 0 || altoUtilMm <= 0) {
    throw new NestingIrregularError(
      'Los márgenes consumen toda el área de la placa.',
    );
  }
  const composicionOriginal =
    parametros.preservarComposicionOriginalSiEntra &&
    geometriaFabricacion.anchoMm <= anchoUtilMm + 0.001 &&
    geometriaFabricacion.altoMm <= altoUtilMm + 0.001 &&
    piezas.every(
      (pieza) =>
        Number.isFinite(pieza.origenXmm) && Number.isFinite(pieza.origenYmm),
    );
  const segmentacion = segmentarGeometria({
    geometria: geometriaFabricacion,
    anchoUtilMm,
    altoUtilMm,
    parametros,
  });
  const contexto = { problema, geometriaFabricacion, segmentacion };
  if (composicionOriginal) {
    return {
      ...contexto,
      solucionInmediata: resolverProblemaNestingIrregular(problema),
    };
  }

  const cantidades = new Map(
    problema.demandas.map((demanda) => [demanda.id, demanda.cantidad]),
  );
  const piezasWorker = segmentacion.piezas.map((pieza) =>
    piezaParaOpenNest(
      pieza,
      cantidades.get(pieza.segmentacion?.piezaOrigenId ?? pieza.id) ?? 0,
      parametros.permitirRotacion,
    ),
  );
  const instancias = piezasWorker.reduce(
    (total, pieza) => total + pieza.cantidad,
    0,
  );
  if (instancias > 10_000) {
    throw new NestingIrregularError(
      'El cálculo supera 10.000 piezas. Dividí la cotización en tiradas más pequeñas.',
    );
  }
  return {
    ...contexto,
    trabajo: {
      schemaVersion: 1,
      motor: 'collision',
      placa: {
        anchoMm: problema.superficie.anchoMm,
        altoMm: problema.superficie.altoMm,
        margenMm: parametros.margenMm,
        maxPlacas: Math.min(1_000, Math.max(1, instancias)),
      },
      separacionMm: parametros.separacionMm,
      timeoutMs: timeoutOpenNestMs(),
      semilla: semillaDesdeHash(input.claveSemilla),
      piezas: piezasWorker,
    },
  };
}

export function prepararAnalisisOpenNest(input: {
  tenantId: string;
  nombreArchivo: string;
  cacheKey: string;
  sourceHash: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  configuracionCapas?: EntradaGeometriaVectorialCache['configuracionCapas'];
  parametros: ParametrosNestingVectorialCache;
}): PreparacionOpenNest {
  const analisis = analizarSvgFabricacion({
    svg: input.svg,
    anchoFinalMm: input.anchoFinalMm,
    altoFinalMm: input.altoFinalMm,
  });
  const geometriaFabricacion = aplicarCapasAGeometria(
    analisis.geometria,
    input.configuracionCapas,
  );
  if (geometriaFabricacion.piezas.length === 0) {
    throw new NestingIrregularError(
      'El diseño no tiene piezas configuradas para cortar. Marcá al menos un objeto como pieza o encastre.',
    );
  }
  const problema = crearProblemaNestingIrregular({
    demandas: crearDemandasDesdeGeometriaVectorial({
      geometria: geometriaFabricacion,
      cantidad: input.parametros.cantidad,
    }),
    anchoPlacaMm: input.parametros.anchoPlacaMm,
    altoPlacaMm: input.parametros.altoPlacaMm,
    margenMm: input.parametros.margenMm,
    separacionMm: input.parametros.separacionMm,
    permitirRotacion: input.parametros.permitirRotacion,
    permitirSegmentacion: input.parametros.permitirSegmentacion,
    preservarComposicionOriginalSiEntra:
      input.parametros.preservarComposicionOriginalSiEntra,
    configuracionEncastres: input.parametros.configuracionEncastres,
  });
  const anchoUtilMm =
    input.parametros.anchoPlacaMm - input.parametros.margenMm * 2;
  const altoUtilMm =
    input.parametros.altoPlacaMm - input.parametros.margenMm * 2;
  if (anchoUtilMm <= 0 || altoUtilMm <= 0) {
    throw new NestingIrregularError(
      'Los márgenes consumen toda el área de la placa.',
    );
  }

  const cantidades = new Map(
    problema.demandas.map((demanda) => [demanda.id, demanda.cantidad]),
  );
  const composicionOriginal =
    input.parametros.preservarComposicionOriginalSiEntra &&
    geometriaFabricacion.anchoMm <= anchoUtilMm + 0.001 &&
    geometriaFabricacion.altoMm <= altoUtilMm + 0.001 &&
    geometriaFabricacion.piezas.every(
      (pieza) =>
        Number.isFinite(pieza.origenXmm) && Number.isFinite(pieza.origenYmm),
    );
  const segmentacion = segmentarGeometria({
    geometria: geometriaFabricacion,
    anchoUtilMm,
    altoUtilMm,
    parametros: input.parametros,
  });
  const contexto: PreparacionAnalisisOpenNest = {
    schemaVersion: 1,
    tenantId: input.tenantId,
    nombreArchivo: input.nombreArchivo,
    cacheKey: input.cacheKey,
    sourceHash: input.sourceHash,
    svg: input.svg,
    anchoFinalMm: input.anchoFinalMm,
    altoFinalMm: input.altoFinalMm,
    configuracionCapas: input.configuracionCapas,
    parametros: input.parametros,
    analisis,
    geometriaFabricacion,
    problema,
    segmentacion,
  };
  if (composicionOriginal) {
    return {
      contexto,
      // Conservar la composición no es una búsqueda de nesting: respeta las
      // coordenadas originales del archivo y por eso no necesita OpenNest.
      solucionInmediata: resolverProblemaNestingIrregular(problema),
    };
  }

  const piezas = segmentacion.piezas.map((pieza) =>
    piezaParaOpenNest(
      pieza,
      cantidades.get(pieza.segmentacion?.piezaOrigenId ?? pieza.id) ?? 0,
      input.parametros.permitirRotacion,
    ),
  );
  const instancias = piezas.reduce((total, pieza) => total + pieza.cantidad, 0);
  if (instancias > 10_000) {
    throw new NestingIrregularError(
      'El cálculo supera 10.000 piezas. Dividí la cotización en tiradas más pequeñas.',
    );
  }
  return {
    contexto,
    trabajo: {
      schemaVersion: 1,
      motor: 'collision',
      placa: {
        anchoMm: input.parametros.anchoPlacaMm,
        altoMm: input.parametros.altoPlacaMm,
        margenMm: input.parametros.margenMm,
        maxPlacas: Math.min(1_000, Math.max(1, instancias)),
      },
      separacionMm: input.parametros.separacionMm,
      timeoutMs: timeoutOpenNestMs(),
      semilla: semillaDesdeHash(input.cacheKey),
      piezas,
    },
  };
}

export function entradaDesdeSolucion(input: {
  contexto: PreparacionAnalisisOpenNest;
  solucion: SolucionNesting;
}): EntradaGeometriaVectorialCache {
  return {
    cacheKey: input.contexto.cacheKey,
    tenantId: input.contexto.tenantId,
    sourceHash: input.contexto.sourceHash,
    anchoFinalMm: input.contexto.anchoFinalMm,
    altoFinalMm: input.contexto.analisis.geometria.altoMm,
    analisis: input.contexto.analisis,
    geometriaFabricacion: input.contexto.geometriaFabricacion,
    nesting: input.solucion.resultado,
    solucionNesting: input.solucion,
    configuracionCapas: input.contexto.configuracionCapas,
    parametros: input.contexto.parametros,
    expiresAt: Date.now() + 15 * 60 * 1_000,
  };
}

export function finalizarAnalisisOpenNest(input: {
  contexto: PreparacionAnalisisOpenNest;
  resultado: NestingIrregularOpenNestResult;
}): EntradaGeometriaVectorialCache {
  return entradaDesdeSolucion({
    contexto: input.contexto,
    solucion: finalizarProblemaOpenNest({
      contexto: {
        problema: input.contexto.problema,
        geometriaFabricacion: input.contexto.geometriaFabricacion,
        segmentacion: input.contexto.segmentacion,
      },
      resultado: input.resultado,
    }),
  });
}

/** Convierte una respuesta validada del worker al contrato neutral del motor. */
export function finalizarProblemaOpenNest(input: {
  contexto: Pick<
    PreparacionProblemaOpenNest,
    'problema' | 'geometriaFabricacion' | 'segmentacion'
  >;
  resultado: NestingIrregularOpenNestResult;
}): SolucionNesting {
  const { contexto, resultado } = input;
  if (contexto.problema.superficie.tipo !== 'PLACA') {
    throw new NestingIrregularError(
      'GrafoNest devolvió una solución para una superficie no compatible.',
    );
  }
  const piezasPorId = new Map(
    contexto.segmentacion.piezas.map((pieza) => [pieza.id, pieza]),
  );
  const placements = resultado.placements.map((placement) => {
    const pieza = piezasPorId.get(placement.piezaId);
    if (!pieza) {
      throw new NestingIrregularError(
        `GrafoNest devolvió una pieza desconocida: ${placement.piezaId}.`,
      );
    }
    const contornos: ContornoVectorial[] = [
      { esHueco: false, puntos: placement.contorno },
      ...placement.huecos.map((puntos) => ({ esHueco: true, puntos })),
    ];
    const cortesInternos = transformarContornos(
      pieza.cortesInternos ?? [],
      placement.rotacionGrados,
      placement.traslacion,
    );
    const caja = limites(contornos.flatMap((contorno) => contorno.puntos));
    return {
      pieceId: pieza.id,
      copyIndex: placement.copia,
      substrateIndex: placement.placa,
      xMm: redondear(caja.minX),
      yMm: redondear(caja.minY),
      rotacion: redondear(normalizarGrados(placement.rotacionGrados)),
      anchoMm: redondear(caja.maxX - caja.minX),
      altoMm: redondear(caja.maxY - caja.minY),
      contornos,
      ...(cortesInternos.length ? { cortesInternos } : {}),
      ...(pieza.segmentacion ? { segmentacion: pieza.segmentacion } : {}),
    };
  });
  const cantidadPorPieza = new Map(
    contexto.problema.demandas.map((demanda) => [demanda.id, demanda.cantidad]),
  );
  const cantidadOrigen = (pieza: PiezaVectorial) =>
    cantidadPorPieza.get(pieza.segmentacion?.piezaOrigenId ?? pieza.id) ?? 0;
  const areaPiezasMm2 = contexto.geometriaFabricacion.piezas.reduce(
    (total, pieza) =>
      total + pieza.areaMm2 * (cantidadPorPieza.get(pieza.id) ?? 0),
    0,
  );
  const perimetroCorteMm =
    contexto.segmentacion.piezas.reduce(
      (total, pieza) => total + pieza.perimetroMm * cantidadOrigen(pieza),
      0,
    ) +
    contexto.geometriaFabricacion.piezas.reduce(
      (total, pieza) =>
        total +
        perimetroContornos(pieza.cortesInternos ?? []) *
          (cantidadPorPieza.get(pieza.id) ?? 0),
      0,
    );
  const areaCompradaMm2 =
    contexto.problema.superficie.anchoMm *
    contexto.problema.superficie.altoMm *
    resultado.placasUsadas;
  const margenMm = contexto.problema.configuracion.margenMm;
  const nesting: NestingIrregularResult = {
    // Se conserva el discriminante público para compatibilidad con snapshots
    // y consolidación; motorNesting identifica el solver que produjo el dato.
    algorithm: 'irregular-2d-bottom-left-v1',
    motorNesting: resultado.algoritmo,
    versionMotor: resultado.versionMotor,
    duracionMs: resultado.duracionMs,
    estrategiaOrientacion: resultado.estrategiaOrientacion,
    rotacionesPermitidas: resultado.rotacionesPermitidas,
    versionPoliticaOrientacion: resultado.versionPoliticaOrientacion,
    calidadSolucion: resultado.calidadSolucion,
    optimizacionAgotada: resultado.optimizacionAgotada,
    placas: resultado.placasUsadas,
    anchoPlacaMm: contexto.problema.superficie.anchoMm,
    altoPlacaMm: contexto.problema.superficie.altoMm,
    anchoUtilMm: contexto.problema.superficie.anchoMm - margenMm * 2,
    altoUtilMm: contexto.problema.superficie.altoMm - margenMm * 2,
    placements,
    aprovechamientoPct:
      areaCompradaMm2 > 0
        ? redondear((areaPiezasMm2 / areaCompradaMm2) * 100)
        : 0,
    areaPiezasMm2: redondear(areaPiezasMm2),
    areaCompradaMm2: redondear(areaCompradaMm2),
    perimetroCorteMm: redondear(perimetroCorteMm),
    piezasOriginales: contexto.problema.demandas.reduce(
      (total, demanda) => total + demanda.cantidad,
      0,
    ),
    segmentos: contexto.segmentacion.piezas.reduce(
      (total, pieza) => total + cantidadOrigen(pieza),
      0,
    ),
    unionesFisicas: contexto.geometriaFabricacion.piezas.reduce(
      (total, pieza) => {
        const segmentos = contexto.segmentacion.piezas.filter(
          (segmento) =>
            (segmento.segmentacion?.piezaOrigenId ?? segmento.id) === pieza.id,
        ).length;
        return (
          total +
          Math.max(0, segmentos - 1) * (cantidadPorPieza.get(pieza.id) ?? 0)
        );
      },
      0,
    ),
    uniones: contexto.segmentacion.uniones,
    estrategiaDisposicion: 'nesting_optimizado',
  };
  return crearSolucionNestingIrregular(contexto.problema, nesting);
}

function parametrosDesdeProblema(
  problema: ProblemaNesting,
): ParametrosNestingVectorialCache {
  if (problema.superficie.tipo !== 'PLACA') {
    throw new NestingIrregularError(
      'GrafoNest requiere una superficie de placa finita.',
    );
  }
  return {
    cantidad: 1,
    anchoPlacaMm: problema.superficie.anchoMm,
    altoPlacaMm: problema.superficie.altoMm,
    margenMm: problema.configuracion.margenMm,
    separacionMm: problema.configuracion.separacionMm,
    permitirRotacion: problema.configuracion.permitirRotacion,
    permitirSegmentacion: problema.configuracion.permitirSegmentacion,
    preservarComposicionOriginalSiEntra:
      problema.configuracion.preservarComposicionOriginalSiEntra,
    configuracionEncastres: resolverConfiguracionEncastresVectoriales(
      problema.configuracion.configuracionEncastres,
    ),
  };
}

function segmentarGeometria(input: {
  geometria: GeometriaVectorialCanonica;
  anchoUtilMm: number;
  altoUtilMm: number;
  parametros: ParametrosNestingVectorialCache;
}): ResultadoSegmentacion {
  if (input.parametros.permitirSegmentacion === false) {
    return { piezas: input.geometria.piezas, uniones: [] };
  }
  try {
    return segmentarPiezasConEncastres({
      piezas: input.geometria.piezas,
      anchoUtilMm: input.anchoUtilMm,
      altoUtilMm: input.altoUtilMm,
      permitirRotacion: input.parametros.permitirRotacion,
      configuracionEncastres: input.parametros.configuracionEncastres,
    });
  } catch (error) {
    throw new NestingIrregularError(
      error instanceof Error
        ? error.message
        : 'No se pudo dividir el vector para las placas seleccionadas.',
    );
  }
}

function piezaParaOpenNest(
  pieza: PiezaVectorial,
  cantidad: number,
  permitirRotacion: boolean,
): PiezaTrabajoNestingOpenNest {
  const exteriores = pieza.contornos.filter((contorno) => !contorno.esHueco);
  if (exteriores.length !== 1) {
    throw new NestingIrregularError(
      `La pieza "${pieza.id}" debe tener un único contorno exterior para usar OpenNest.`,
    );
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new NestingIrregularError(
      `La cantidad de la pieza "${pieza.id}" no es válida.`,
    );
  }
  return {
    id: pieza.id,
    cantidad,
    rotaciones: permitirRotacion ? 72 : 1,
    contorno: exteriores[0].puntos,
    huecos: pieza.contornos
      .filter((contorno) => contorno.esHueco)
      .map((contorno) => contorno.puntos),
  };
}

function transformarContornos(
  contornos: ContornoVectorial[],
  rotacionGrados: number,
  traslacion: PuntoTrabajoGeometria,
): ContornoVectorial[] {
  const radians = (rotacionGrados * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((punto) => ({
      x: redondear(punto.x * cos - punto.y * sin + traslacion.x),
      y: redondear(punto.x * sin + punto.y * cos + traslacion.y),
    })),
  }));
}

function limites(points: PuntoTrabajoGeometria[]) {
  return points.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x),
      minY: Math.min(result.minY, point.y),
      maxX: Math.max(result.maxX, point.x),
      maxY: Math.max(result.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
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

function timeoutOpenNestMs(): number {
  const value = Number(process.env.OPENNEST_JOB_TIMEOUT_MS ?? 30_000);
  return Number.isInteger(value) && value >= 100 && value <= 60 * 60 * 1_000
    ? value
    : 30_000;
}

function semillaDesdeHash(value: string): number {
  // El binding nativo recibe un int32 con signo aunque el contrato JSON use
  // number. Enmascarar evita errores dependientes del hash de la solicitud.
  return Number.parseInt(value.slice(0, 8), 16) & 0x7fffffff || 30;
}

function normalizarGrados(value: number): number {
  return ((value % 360) + 360) % 360;
}

function redondear(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
