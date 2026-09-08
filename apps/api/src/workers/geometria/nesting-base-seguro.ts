import { nestGrid2DMulti } from '../../productos-servicios/nesting/algorithms/grid-2d-multi';
import { nestearPatronRepetido } from '../../motor-universal/geometria-vectorial/nesting-patron-repetido';
import type {
  AnilloTrabajoNesting,
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PiezaTrabajoNestingOpenNest,
  PuntoTrabajoGeometria,
} from '../colas';

type Limites = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ancho: number;
  alto: number;
};

type PiezaBase = {
  pieza: PiezaTrabajoNestingOpenNest;
  rotacionGrados: number;
  limites: Limites;
};

/**
 * Construye una solución conservadora usando las cajas envolventes reales.
 * Compara las cajas con patrones alternados cuando hay una sola silueta.
 * El optimizador nativo conserva este candidato si no consigue mejorarlo.
 */
export function resolverNestingBaseSeguro(
  input: NestingIrregularOpenNestData,
): NestingIrregularOpenNestResult {
  const startedAt = Date.now();
  const anchoUtil = input.placa.anchoMm - input.placa.margenMm * 2;
  const altoUtil = input.placa.altoMm - input.placa.margenMm * 2;
  const piezas = input.piezas.map((pieza) =>
    orientarPiezaParaAreaUtil(pieza, anchoUtil, altoUtil),
  );
  const porId = new Map(piezas.map((pieza) => [pieza.pieza.id, pieza]));
  const packing = nestGrid2DMulti(
    piezas.map(({ pieza, limites, rotacionGrados }) => ({
      id: pieza.id,
      widthMm: limites.ancho,
      heightMm: limites.alto,
      quantity: pieza.cantidad,
      meta: { piezaId: pieza.id, rotacionGrados },
    })),
    {
      kind: 'sheet',
      widthMm: input.placa.anchoMm,
      heightMm: input.placa.altoMm,
      margins: {
        leftMm: input.placa.margenMm,
        rightMm: input.placa.margenMm,
        topMm: input.placa.margenMm,
        bottomMm: input.placa.margenMm,
      },
    },
    {
      separationHMm: input.separacionMm,
      separationVMm: input.separacionMm,
      allowRotation: false,
    },
  );
  const esperadas = input.piezas.reduce(
    (total, pieza) => total + pieza.cantidad,
    0,
  );
  const patron = resolverPatron(input);
  if (
    patron &&
    patron.placasUsadas <= input.placa.maxPlacas &&
    (packing.placements.length !== esperadas ||
      patron.placasUsadas < packing.substrates.length)
  ) {
    return { ...patron, duracionMs: Date.now() - startedAt };
  }
  if (
    packing.placements.length !== esperadas ||
    packing.substrates.length > input.placa.maxPlacas
  ) {
    throw new Error(
      'No se pudo construir una solución base dentro de las placas permitidas.',
    );
  }

  const copias = new Map<string, number>();
  const placements = packing.placements.map((placement) => {
    const orientada = porId.get(placement.pieceId);
    if (!orientada)
      throw new Error(
        `La solución base perdió la pieza "${placement.pieceId}".`,
      );
    const copia = copias.get(placement.pieceId) ?? 0;
    copias.set(placement.pieceId, copia + 1);
    const traslacion = {
      x: placement.xMm - orientada.limites.minX,
      y: placement.yMm - orientada.limites.minY,
    };
    return {
      piezaId: placement.pieceId,
      copia,
      placa: placement.substrateIndex ?? 0,
      rotacionGrados: orientada.rotacionGrados,
      traslacion,
      contorno: transformar(
        orientada.pieza.contorno,
        orientada.rotacionGrados,
        traslacion,
      ),
      huecos: (orientada.pieza.huecos ?? []).map((hueco) =>
        transformar(hueco, orientada.rotacionGrados, traslacion),
      ),
    };
  });

  return {
    schemaVersion: 1,
    algoritmo: 'grafonest-baseline-v1',
    motor: input.motor,
    versionMotor: 'grafonest-baseline-1',
    cantidadSolicitada: esperadas,
    cantidadColocada: placements.length,
    placasUsadas: packing.substrates.length,
    duracionMs: Date.now() - startedAt,
    calidadSolucion: 'BASE_SEGURA',
    optimizacionAgotada: false,
    placements,
    validacion: {
      completa: true,
      dentroDePlaca: true,
      sinSolapamientos: true,
      separacionRespetada: true,
    },
  };
}

function resolverPatron(
  input: NestingIrregularOpenNestData,
): NestingIrregularOpenNestResult | null {
  if (input.piezas.length !== 1) return null;
  const pieza = input.piezas[0];
  const limites = calcularLimites(pieza.contorno);
  const area = (anillo: AnilloTrabajoNesting) =>
    Math.abs(
      anillo.reduce((s, p, i) => {
        const q = anillo[(i + 1) % anillo.length];
        return s + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2;
  const resultado = nestearPatronRepetido({
    pieza: {
      id: pieza.id,
      anchoMm: limites.ancho,
      altoMm: limites.alto,
      contornos: [
        { puntos: pieza.contorno, esHueco: false },
        ...(pieza.huecos ?? []).map((puntos) => ({ puntos, esHueco: true })),
      ],
      areaMm2:
        area(pieza.contorno) -
        (pieza.huecos ?? []).reduce((s, h) => s + area(h), 0),
      perimetroMm: 0,
    },
    cantidad: pieza.cantidad,
    sustrato: {
      kind: 'sheet',
      widthMm: input.placa.anchoMm,
      heightMm: input.placa.altoMm,
      margins: {
        leftMm: input.placa.margenMm,
        rightMm: input.placa.margenMm,
        topMm: input.placa.margenMm,
        bottomMm: input.placa.margenMm,
      },
    },
    angulosPermitidos: [0, 90, 180, 270].filter((a) =>
      Number.isInteger((a * pieza.rotaciones) / 360),
    ),
    separacionMm: input.separacionMm,
  });
  if (!resultado) return null;
  return {
    schemaVersion: 1,
    algoritmo: 'grafonest-baseline-v1',
    motor: input.motor,
    versionMotor: 'grafonest-patron-repetido-1',
    cantidadSolicitada: pieza.cantidad,
    cantidadColocada: resultado.placements.length,
    placasUsadas: resultado.substrates.length,
    duracionMs: 0,
    calidadSolucion: 'BASE_SEGURA',
    optimizacionAgotada: false,
    placements: resultado.placements.map((p) => ({
      piezaId: p.pieceId,
      copia: p.meta!.copyIndex,
      placa: p.substrateIndex!,
      rotacionGrados: p.meta!.rotacionGrados,
      traslacion: p.meta!.traslacion,
      contorno: p.meta!.contornos.find((c) => !c.esHueco)!.puntos,
      huecos: p.meta!.contornos.filter((c) => c.esHueco).map((c) => c.puntos),
    })),
    validacion: {
      completa: true,
      dentroDePlaca: true,
      sinSolapamientos: true,
      separacionRespetada: true,
    },
  };
}

function orientarPiezaParaAreaUtil(
  pieza: PiezaTrabajoNestingOpenNest,
  anchoUtil: number,
  altoUtil: number,
): PiezaBase {
  const inicial = crearPiezaOrientada(pieza, 0);
  if (entra(inicial.limites, anchoUtil, altoUtil)) return inicial;

  for (let indice = 1; indice < pieza.rotaciones; indice += 1) {
    const candidata = crearPiezaOrientada(
      pieza,
      (indice * 360) / pieza.rotaciones,
    );
    if (entra(candidata.limites, anchoUtil, altoUtil)) return candidata;
  }
  throw new Error(
    `La pieza "${pieza.id}" no entra en el área útil con ninguna rotación permitida.`,
  );
}

function crearPiezaOrientada(
  pieza: PiezaTrabajoNestingOpenNest,
  rotacionGrados: number,
): PiezaBase {
  const puntos = rotar(pieza.contorno, rotacionGrados);
  return {
    pieza,
    rotacionGrados,
    limites: calcularLimites(puntos),
  };
}

function entra(limites: Limites, ancho: number, alto: number): boolean {
  return limites.ancho <= ancho + 0.001 && limites.alto <= alto + 0.001;
}

function rotar(
  puntos: AnilloTrabajoNesting,
  grados: number,
): PuntoTrabajoGeometria[] {
  const radians = (grados * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return puntos.map((punto) => ({
    x: punto.x * cos - punto.y * sin,
    y: punto.x * sin + punto.y * cos,
  }));
}

function transformar(
  puntos: AnilloTrabajoNesting,
  grados: number,
  traslacion: PuntoTrabajoGeometria,
): PuntoTrabajoGeometria[] {
  return rotar(puntos, grados).map((punto) => ({
    x: redondear(punto.x + traslacion.x),
    y: redondear(punto.y + traslacion.y),
  }));
}

function calcularLimites(puntos: PuntoTrabajoGeometria[]): Limites {
  const limites = puntos.reduce(
    (actual, punto) => ({
      minX: Math.min(actual.minX, punto.x),
      minY: Math.min(actual.minY, punto.y),
      maxX: Math.max(actual.maxX, punto.x),
      maxY: Math.max(actual.maxY, punto.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  return {
    ...limites,
    ancho: limites.maxX - limites.minX,
    alto: limites.maxY - limites.minY,
  };
}

function redondear(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
