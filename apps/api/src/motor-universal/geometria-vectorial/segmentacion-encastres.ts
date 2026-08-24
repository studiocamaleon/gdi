import * as polygonClipping from 'polygon-clipping';
import type {
  ContornoVectorial,
  PiezaVectorial,
  PuntoVectorial,
  UnionVectorial,
} from './tipos';
import {
  angulosVectoriales,
  rotarContornosVectoriales,
} from './rotacion-vectorial';

type MultiPolygon = polygonClipping.MultiPolygon;

interface Fragmento {
  piezaOrigenId: string;
  contornos: ContornoVectorial[];
  cortesInternos?: ContornoVectorial[];
  unionesIds: string[];
}

interface TransformacionRotacion {
  anguloGrados: number;
  cos: number;
  sin: number;
  minX: number;
  minY: number;
  originalMinX: number;
  originalMaxX: number;
  originalMinY: number;
  originalMaxY: number;
}

export interface ResultadoSegmentacion {
  piezas: PiezaVectorial[];
  uniones: UnionVectorial[];
}

export type TipoUnionVectorial = 'cola_milano' | 'recta';
export type ModoCantidadEncastres = 'por_distancia' | 'cantidad_fija';

export interface ConfiguracionEncastresVectoriales {
  tipoUnion: TipoUnionVectorial;
  anchoEncastreMm: number;
  profundidadEncastreMm: number;
  modoCantidad: ModoCantidadEncastres;
  distanciaMaximaMm: number;
  cantidadFija: number;
  cantidadMinima: number;
  cantidadMaxima: number;
  kerfMm: number;
}

export const CONFIGURACION_ENCASTRES_DEFAULT: ConfiguracionEncastresVectoriales =
  {
    tipoUnion: 'cola_milano',
    anchoEncastreMm: 30,
    profundidadEncastreMm: 30,
    modoCantidad: 'por_distancia',
    distanciaMaximaMm: 100,
    cantidadFija: 1,
    cantidadMinima: 1,
    cantidadMaxima: 100,
    kerfMm: 0.3,
  };
const EPSILON = 0.01;

export function resolverConfiguracionEncastresVectoriales(
  value?: Record<string, unknown> | Partial<ConfiguracionEncastresVectoriales>,
): ConfiguracionEncastresVectoriales {
  const source = (value ?? {}) as Record<string, unknown>;
  const tipoUnion =
    source.tipoUnion === 'recta' || source.tipoUnionVectorial === 'recta'
      ? 'recta'
      : 'cola_milano';
  const modoCantidad =
    source.modoCantidad === 'cantidad_fija' ||
    source.modoCantidadEncastres === 'cantidad_fija'
      ? 'cantidad_fija'
      : 'por_distancia';
  const cantidadMinima = enteroEnRango(
    source.cantidadMinima ?? source.cantidadMinimaEncastres,
    CONFIGURACION_ENCASTRES_DEFAULT.cantidadMinima,
    1,
    100,
  );
  const cantidadMaxima = enteroEnRango(
    source.cantidadMaxima ?? source.cantidadMaximaEncastres,
    CONFIGURACION_ENCASTRES_DEFAULT.cantidadMaxima,
    cantidadMinima,
    100,
  );
  return {
    tipoUnion,
    anchoEncastreMm: numeroEnRango(
      source.anchoEncastreMm,
      CONFIGURACION_ENCASTRES_DEFAULT.anchoEncastreMm,
      1,
      500,
    ),
    profundidadEncastreMm: numeroEnRango(
      source.profundidadEncastreMm,
      CONFIGURACION_ENCASTRES_DEFAULT.profundidadEncastreMm,
      1,
      500,
    ),
    modoCantidad,
    distanciaMaximaMm: numeroEnRango(
      source.distanciaMaximaMm ?? source.distanciaMaximaEncastresMm,
      CONFIGURACION_ENCASTRES_DEFAULT.distanciaMaximaMm,
      10,
      10_000,
    ),
    cantidadFija: enteroEnRango(
      source.cantidadFija ?? source.cantidadFijaEncastres,
      CONFIGURACION_ENCASTRES_DEFAULT.cantidadFija,
      1,
      100,
    ),
    cantidadMinima,
    cantidadMaxima,
    kerfMm: numeroEnRango(
      source.kerfMm ?? source.kerfEncastreMm,
      CONFIGURACION_ENCASTRES_DEFAULT.kerfMm,
      0,
      10,
    ),
  };
}

/**
 * Fragmenta únicamente las piezas que no entran en el área útil. Cada línea
 * de división tiene una frontera complementaria con encastres trapezoidales:
 * los dos lados comparten exactamente el mismo perfil y quedan trazables para
 * armado.
 */
export function segmentarPiezasConEncastres(input: {
  piezas: PiezaVectorial[];
  anchoUtilMm: number;
  altoUtilMm: number;
  permitirRotacion?: boolean;
  configuracionEncastres?: Partial<ConfiguracionEncastresVectoriales>;
}): ResultadoSegmentacion {
  const configuracion = resolverConfiguracionEncastresVectoriales(
    input.configuracionEncastres,
  );
  const uniones: UnionVectorial[] = [];
  const finales: Fragmento[] = [];

  for (const pieza of input.piezas) {
    const resultado = segmentarPiezaEnMejorOrientacion({
      pieza,
      anchoUtilMm: input.anchoUtilMm,
      altoUtilMm: input.altoUtilMm,
      permitirRotacion: input.permitirRotacion !== false,
      configuracion,
    });
    finales.push(...resultado.fragmentos);
    uniones.push(...resultado.uniones);
  }

  const totalPorOrigen = new Map<string, number>();
  for (const fragmento of finales)
    totalPorOrigen.set(
      fragmento.piezaOrigenId,
      (totalPorOrigen.get(fragmento.piezaOrigenId) ?? 0) + 1,
    );
  const indicePorOrigen = new Map<string, number>();
  const piezas = finales.map((fragmento) => {
    const indice = (indicePorOrigen.get(fragmento.piezaOrigenId) ?? 0) + 1;
    indicePorOrigen.set(fragmento.piezaOrigenId, indice);
    const total = totalPorOrigen.get(fragmento.piezaOrigenId) ?? 1;
    return normalizarFragmento(fragmento, indice, total);
  });
  return { piezas, uniones };
}

function segmentarPiezaEnMejorOrientacion(input: {
  pieza: PiezaVectorial;
  anchoUtilMm: number;
  altoUtilMm: number;
  permitirRotacion: boolean;
  configuracion: ConfiguracionEncastresVectoriales;
}): { fragmentos: Fragmento[]; uniones: UnionVectorial[] } {
  if (
    fragmentoEntraCompleto(
      input.pieza.contornos,
      input.anchoUtilMm,
      input.altoUtilMm,
      input.permitirRotacion,
    )
  )
    return {
      fragmentos: [
        {
          piezaOrigenId: input.pieza.id,
          contornos: input.pieza.contornos,
          cortesInternos: input.pieza.cortesInternos,
          unionesIds: [],
        },
      ],
      uniones: [],
    };

  const angulos = input.permitirRotacion ? [0, 15, 30, 45, 60, 75] : [0];
  const candidatos = angulos.flatMap((anguloGrados) => {
    try {
      return [segmentarPiezaEnOrientacion({ ...input, anguloGrados })];
    } catch {
      return [];
    }
  });
  if (candidatos.length === 0)
    throw new Error(
      `No se encontró una división segura para ${input.pieza.id}.`,
    );
  return candidatos.sort((a, b) => {
    if (a.fragmentos.length !== b.fragmentos.length)
      return a.fragmentos.length - b.fragmentos.length;
    return a.compactacion - b.compactacion || a.angulo - b.angulo;
  })[0];
}

function segmentarPiezaEnOrientacion(input: {
  pieza: PiezaVectorial;
  anchoUtilMm: number;
  altoUtilMm: number;
  permitirRotacion: boolean;
  configuracion: ConfiguracionEncastresVectoriales;
  anguloGrados: number;
}): {
  fragmentos: Fragmento[];
  uniones: UnionVectorial[];
  angulo: number;
  compactacion: number;
} {
  const rotacion = rotarParaSegmentar(
    input.pieza.contornos,
    input.anguloGrados,
  );
  const fragmentosRotados: Fragmento[] = [];
  const unionesRotadas: UnionVectorial[] = [];
  dividirRecursivo(
    {
      piezaOrigenId: input.pieza.id,
      contornos: rotacion.contornos,
      cortesInternos: rotarConTransformacion(
        input.pieza.cortesInternos ?? [],
        rotacion.transform,
      ),
      unionesIds: [],
    },
    input.anchoUtilMm,
    input.altoUtilMm,
    input.permitirRotacion,
    input.configuracion,
    unionesRotadas,
    fragmentosRotados,
    0,
  );
  const compactacion = fragmentosRotados.reduce((total, fragmento) => {
    const caja = boundsContornos(fragmento.contornos);
    return total + Math.max(caja.maxX - caja.minX, caja.maxY - caja.minY);
  }, 0);
  if (input.anguloGrados === 0)
    return {
      fragmentos: fragmentosRotados,
      uniones: unionesRotadas,
      angulo: 0,
      compactacion,
    };
  return {
    fragmentos: fragmentosRotados.map((fragmento) => ({
      ...fragmento,
      contornos: desrotarContornos(fragmento.contornos, rotacion.transform),
      cortesInternos: desrotarContornos(
        fragmento.cortesInternos ?? [],
        rotacion.transform,
      ),
    })),
    uniones: unionesRotadas.map((union) =>
      desrotarUnion(union, rotacion.transform),
    ),
    angulo: input.anguloGrados,
    compactacion,
  };
}

function rotarParaSegmentar(
  contornos: ContornoVectorial[],
  anguloGrados: number,
): { contornos: ContornoVectorial[]; transform: TransformacionRotacion } {
  if (anguloGrados === 0)
    return {
      contornos,
      transform: {
        anguloGrados: 0,
        cos: 1,
        sin: 0,
        minX: 0,
        minY: 0,
        originalMinX: 0,
        originalMaxX: 0,
        originalMinY: 0,
        originalMaxY: 0,
      },
    };
  const radians = (anguloGrados * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotados = contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((punto) => ({
      x: punto.x * cos - punto.y * sin,
      y: punto.x * sin + punto.y * cos,
    })),
  }));
  const caja = boundsContornos(rotados);
  const cajaOriginal = boundsContornos(contornos);
  return {
    contornos: rotados.map((contorno) => ({
      ...contorno,
      puntos: contorno.puntos.map((punto) => ({
        x: redondear(punto.x - caja.minX),
        y: redondear(punto.y - caja.minY),
      })),
    })),
    transform: {
      anguloGrados,
      cos,
      sin,
      minX: caja.minX,
      minY: caja.minY,
      originalMinX: cajaOriginal.minX,
      originalMaxX: cajaOriginal.maxX,
      originalMinY: cajaOriginal.minY,
      originalMaxY: cajaOriginal.maxY,
    },
  };
}

function desrotarContornos(
  contornos: ContornoVectorial[],
  transform: TransformacionRotacion,
): ContornoVectorial[] {
  return contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((punto) => desrotarPunto(punto, transform)),
  }));
}

function rotarConTransformacion(
  contornos: ContornoVectorial[],
  transform: TransformacionRotacion,
): ContornoVectorial[] {
  if (transform.anguloGrados === 0) return contornos;
  return contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((punto) => ({
      x: redondear(
        punto.x * transform.cos - punto.y * transform.sin - transform.minX,
      ),
      y: redondear(
        punto.x * transform.sin + punto.y * transform.cos - transform.minY,
      ),
    })),
  }));
}

function desrotarPunto(
  punto: PuntoVectorial,
  transform: TransformacionRotacion,
): PuntoVectorial {
  const x = punto.x + transform.minX;
  const y = punto.y + transform.minY;
  return {
    x: redondear(x * transform.cos + y * transform.sin),
    y: redondear(-x * transform.sin + y * transform.cos),
  };
}

function desrotarUnion(
  union: UnionVectorial,
  transform: TransformacionRotacion,
): UnionVectorial {
  const inicioRotado =
    union.eje === 'vertical'
      ? { x: union.posicionMm, y: 0 }
      : { x: 0, y: union.posicionMm };
  const finRotado =
    union.eje === 'vertical'
      ? { x: union.posicionMm, y: union.largoMm }
      : { x: union.largoMm, y: union.posicionMm };
  const [inicio, fin] = recortarLineaAOriginal(
    desrotarPunto(inicioRotado, transform),
    desrotarPunto(finRotado, transform),
    transform,
  );
  return {
    ...union,
    anguloGrados: transform.anguloGrados,
    inicio,
    fin,
  };
}

function recortarLineaAOriginal(
  inicio: PuntoVectorial,
  fin: PuntoVectorial,
  transform: TransformacionRotacion,
): [PuntoVectorial, PuntoVectorial] {
  const dx = fin.x - inicio.x;
  const dy = fin.y - inicio.y;
  let desde = 0;
  let hasta = 1;
  const limites: Array<[number, number]> = [
    [-dx, inicio.x - transform.originalMinX],
    [dx, transform.originalMaxX - inicio.x],
    [-dy, inicio.y - transform.originalMinY],
    [dy, transform.originalMaxY - inicio.y],
  ];
  for (const [p, q] of limites) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return [inicio, fin];
      continue;
    }
    const ratio = q / p;
    if (p < 0) desde = Math.max(desde, ratio);
    else hasta = Math.min(hasta, ratio);
  }
  if (desde > hasta) return [inicio, fin];
  return [
    {
      x: redondear(inicio.x + dx * desde),
      y: redondear(inicio.y + dy * desde),
    },
    {
      x: redondear(inicio.x + dx * hasta),
      y: redondear(inicio.y + dy * hasta),
    },
  ];
}

function dividirRecursivo(
  fragmento: Fragmento,
  anchoUtilMm: number,
  altoUtilMm: number,
  permitirRotacion: boolean,
  configuracion: ConfiguracionEncastresVectoriales,
  uniones: UnionVectorial[],
  finales: Fragmento[],
  profundidad: number,
): void {
  if (profundidad > 24)
    throw new Error('No se pudo estabilizar la segmentación del vector.');
  const caja = boundsContornos(fragmento.contornos);
  const ancho = caja.maxX - caja.minX;
  const alto = caja.maxY - caja.minY;
  // No se segmenta por la orientación en la que llegó el SVG. Antes de cortar
  // se comprueban los mismos ángulos que luego podrá usar el nesting.
  if (
    fragmentoEntraCompleto(
      fragmento.contornos,
      anchoUtilMm,
      altoUtilMm,
      permitirRotacion,
    )
  ) {
    finales.push(fragmento);
    return;
  }

  const excesoX = ancho / anchoUtilMm;
  const excesoY = alto / altoUtilMm;
  const eje: 'vertical' | 'horizontal' =
    excesoX >= excesoY ? 'vertical' : 'horizontal';
  const dimension = eje === 'vertical' ? ancho : alto;
  const inicioEje = eje === 'vertical' ? caja.minX : caja.minY;
  const largo = eje === 'vertical' ? alto : ancho;
  const capacidad = eje === 'vertical' ? anchoUtilMm : altoUtilMm;
  const profundidadEncastre = Math.min(
    configuracion.tipoUnion === 'recta'
      ? 0
      : configuracion.profundidadEncastreMm,
    Math.max(2, capacidad / 4),
  );
  // El macho necesita espacio para su cuerpo y para la cabeza configurada. Si
  // cortar al medio no deja ese espacio, se desplaza la línea de división. La
  // pieza restante se vuelve a segmentar si todavía supera la placa: nunca se
  // achica el encastre sólo para forzar dos mitades.
  const corteMinimo = Math.max(1, dimension - capacidad);
  const corteMaximo = Math.min(dimension - 1, capacidad - profundidadEncastre);
  const corteIdeal = dimension / 2;
  const corteDesdeInicio =
    corteMinimo <= corteMaximo
      ? Math.max(corteMinimo, Math.min(corteIdeal, corteMaximo))
      : Math.max(1, corteMaximo);
  const cantidadEncastres =
    configuracion.tipoUnion === 'recta'
      ? 0
      : configuracion.modoCantidad === 'cantidad_fija'
        ? configuracion.cantidadFija
        : Math.max(
            configuracion.cantidadMinima,
            Math.min(
              configuracion.cantidadMaxima,
              Math.ceil(largo / configuracion.distanciaMaximaMm),
            ),
          );
  const anchoEncastreEfectivo =
    cantidadEncastres > 0
      ? Math.min(
          configuracion.anchoEncastreMm,
          (largo / cantidadEncastres) * 0.6,
        )
      : 0;
  const geometria = aMultiPolygon(fragmento.contornos);
  const division = seleccionarDivisionSegura({
    fragmento,
    geometria,
    caja,
    eje,
    inicioEje,
    corteMinimo,
    corteMaximo,
    corteIdeal: corteDesdeInicio,
    largo,
    cantidadEncastres,
    anchoEncastreEfectivo,
    profundidadEncastre,
    configuracion,
    unionId: `${fragmento.piezaOrigenId}-U${uniones.length + 1}`,
    anchoUtilMm,
    altoUtilMm,
    permitirRotacion,
  });
  const { union, fragmentosA, fragmentosB } = division;
  if (!fragmentosA.length || !fragmentosB.length)
    throw new Error(
      `No se encontró una división segura para ${fragmento.piezaOrigenId}.`,
    );
  uniones.push(union);
  for (const hijo of [...fragmentosA, ...fragmentosB])
    dividirRecursivo(
      hijo,
      anchoUtilMm,
      altoUtilMm,
      permitirRotacion,
      configuracion,
      uniones,
      finales,
      profundidad + 1,
    );
}

function seleccionarDivisionSegura(input: {
  fragmento: Fragmento;
  geometria: MultiPolygon;
  caja: ReturnType<typeof boundsContornos>;
  eje: 'vertical' | 'horizontal';
  inicioEje: number;
  corteMinimo: number;
  corteMaximo: number;
  corteIdeal: number;
  largo: number;
  cantidadEncastres: number;
  anchoEncastreEfectivo: number;
  profundidadEncastre: number;
  configuracion: ConfiguracionEncastresVectoriales;
  unionId: string;
  anchoUtilMm: number;
  altoUtilMm: number;
  permitirRotacion: boolean;
}): {
  union: UnionVectorial;
  fragmentosA: Fragmento[];
  fragmentosB: Fragmento[];
} {
  const candidatos = posicionesCorteCandidatas(
    input.corteIdeal,
    input.corteMinimo,
    input.corteMaximo,
  );
  let mejor:
    | {
        union: UnionVectorial;
        fragmentosA: Fragmento[];
        fragmentosB: Fragmento[];
        score: number;
      }
    | undefined;
  for (const corte of candidatos) {
    const posicion = input.inicioEje + corte;
    const union: UnionVectorial = {
      id: input.unionId,
      piezaOrigenId: input.fragmento.piezaOrigenId,
      tipoEncastre: input.configuracion.tipoUnion,
      eje: input.eje,
      posicionMm: redondear(posicion),
      largoMm: redondear(input.largo),
      cantidadEncastres: input.cantidadEncastres,
      anchoEncastreMm: redondear(input.anchoEncastreEfectivo),
      profundidadEncastreMm: redondear(input.profundidadEncastre),
      kerfMm: input.configuracion.kerfMm,
    };
    const [mascaraA, mascaraB] = crearMascarasEncastre(
      input.caja,
      input.eje,
      posicion,
      input.cantidadEncastres,
      input.profundidadEncastre,
      input.anchoEncastreEfectivo,
    );
    const fragmentosA = desdeMultiPolygon(
      polygonClipping.intersection(input.geometria, mascaraA),
      input.fragmento,
      union.id,
    );
    const fragmentosB = desdeMultiPolygon(
      polygonClipping.intersection(input.geometria, mascaraB),
      input.fragmento,
      union.id,
    );
    if (!fragmentosA.length || !fragmentosB.length) continue;
    const fragmentos = [...fragmentosA, ...fragmentosB];
    const fragmentosDiminutos = fragmentos.filter((item) => {
      const area = areaContornos(item.contornos);
      return area < 100;
    }).length;
    const pendientes = fragmentos.filter(
      (item) =>
        !fragmentoEntraCompleto(
          item.contornos,
          input.anchoUtilMm,
          input.altoUtilMm,
          input.permitirRotacion,
        ),
    ).length;
    const areaCajas = fragmentos.reduce((total, item) => {
      const bounds = boundsContornos(item.contornos);
      return total + (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    }, 0);
    const score =
      fragmentosDiminutos * 1_000_000_000 +
      Math.abs(fragmentos.length - 2) * 10_000_000 +
      pendientes * 100_000 +
      Math.abs(corte - input.corteIdeal) * 100 +
      areaCajas / 1_000_000;
    if (!mejor || score < mejor.score)
      mejor = { union, fragmentosA, fragmentosB, score };
  }
  if (!mejor)
    throw new Error(
      `No se encontró una división segura para ${input.fragmento.piezaOrigenId}.`,
    );
  return mejor;
}

function posicionesCorteCandidatas(
  ideal: number,
  minimo: number,
  maximo: number,
): number[] {
  // Cuando ninguna división puede producir dos hijos que entren de inmediato,
  // se conserva el corte desplazado calculado por el algoritmo y la pieza
  // restante se vuelve a dividir recursivamente.
  if (minimo > maximo) return [redondear(ideal)];
  const posiciones = new Set<number>();
  const add = (value: number) => {
    if (value < minimo - EPSILON || value > maximo + EPSILON) return;
    posiciones.add(redondear(value));
  };
  add(ideal);
  for (let distancia = 5; distancia <= maximo - minimo; distancia += 5) {
    add(ideal - distancia);
    add(ideal + distancia);
  }
  add(minimo);
  add(maximo);
  return [...posiciones];
}

function fragmentoEntraCompleto(
  contornos: ContornoVectorial[],
  anchoUtilMm: number,
  altoUtilMm: number,
  permitirRotacion: boolean,
): boolean {
  return angulosVectoriales(permitirRotacion).some((rotacion) => {
    const caja = rotarContornosVectoriales(contornos, rotacion);
    return (
      caja.anchoMm <= anchoUtilMm + EPSILON &&
      caja.altoMm <= altoUtilMm + EPSILON
    );
  });
}

function crearMascarasEncastre(
  caja: ReturnType<typeof boundsContornos>,
  eje: 'vertical' | 'horizontal',
  posicion: number,
  cantidad: number,
  profundidadEncastre: number,
  anchoEncastreMm: number,
): [MultiPolygon, MultiPolygon] {
  const pad = profundidadEncastre + 10;
  const perfilInicio = eje === 'vertical' ? caja.minY : caja.minX;
  const perfilFin = eje === 'vertical' ? caja.maxY : caja.maxX;
  const inicio = perfilInicio - pad;
  const fin = perfilFin + pad;
  const puntoFrontera = (
    desplazamiento: number,
    longitudinal: number,
  ): [number, number] =>
    eje === 'vertical'
      ? [posicion + desplazamiento, longitudinal]
      : [longitudinal, posicion + desplazamiento];
  const frontera: Array<[number, number]> = [puntoFrontera(0, inicio)];
  const tramo = cantidad > 0 ? (perfilFin - perfilInicio) / cantidad : 0;
  // Cola de milano verdadera: el cuello junto a la línea de unión es angosto
  // y la cabeza exterior es más ancha. El perfil anterior era el inverso
  // (base ancha y punta angosta) y, al muestrearlo como una curva, se percibía
  // redondeado en la vista previa.
  for (let index = 0; index < cantidad; index++) {
    const centro = perfilInicio + tramo * (index + 0.5);
    const anchoCabeza = Math.min(anchoEncastreMm, tramo * 0.6);
    const anchoCuello = anchoCabeza / 2;
    frontera.push(
      puntoFrontera(0, centro - anchoCuello / 2),
      puntoFrontera(profundidadEncastre, centro - anchoCabeza / 2),
      puntoFrontera(profundidadEncastre, centro + anchoCabeza / 2),
      puntoFrontera(0, centro + anchoCuello / 2),
    );
  }
  frontera.push(puntoFrontera(0, fin));
  const izquierda = caja.minX - pad;
  const derecha = caja.maxX + pad;
  const arriba = caja.minY - pad;
  const abajo = caja.maxY + pad;
  const ringA: polygonClipping.Ring =
    eje === 'vertical'
      ? [
          [izquierda, arriba],
          ...frontera,
          [izquierda, abajo],
          [izquierda, arriba],
        ]
      : [
          [izquierda, arriba],
          [derecha, arriba],
          ...[...frontera].reverse(),
          [izquierda, arriba],
        ];
  const ringB: polygonClipping.Ring =
    eje === 'vertical'
      ? [...frontera, [derecha, abajo], [derecha, arriba], frontera[0]]
      : [...frontera, [derecha, abajo], [izquierda, abajo], frontera[0]];
  const mascaraA: MultiPolygon = [[ringA]];
  const mascaraB: MultiPolygon = [[ringB]];
  return [mascaraA, mascaraB];
}

function aMultiPolygon(contornos: ContornoVectorial[]): MultiPolygon {
  const exteriores = contornos.filter((c) => !c.esHueco);
  const huecos = contornos.filter((c) => c.esHueco);
  return exteriores.map((exterior) => [
    cerrar(exterior.puntos),
    ...huecos
      .filter((hueco) => puntoEnPoligono(hueco.puntos[0], exterior.puntos))
      .map((hueco) => cerrar(hueco.puntos)),
  ]);
}

function desdeMultiPolygon(
  geometria: MultiPolygon,
  padre: Fragmento,
  unionId: string,
): Fragmento[] {
  return geometria.flatMap((polygon) => {
    if (!polygon[0] || polygon[0].length < 4) return [];
    const contornos = polygon.map((ring, index) => ({
      esHueco: index > 0,
      puntos: ring.slice(0, -1).map(([x, y]) => ({
        x: redondear(x),
        y: redondear(y),
      })),
    }));
    const area = areaContornos(contornos);
    if (area < 1) return [];
    return [
      {
        piezaOrigenId: padre.piezaOrigenId,
        contornos,
        cortesInternos: recortarCortesInternos(
          padre.cortesInternos ?? [],
          polygon,
        ),
        unionesIds: [...new Set([...padre.unionesIds, unionId])],
      },
    ];
  });
}

function recortarCortesInternos(
  cortes: ContornoVectorial[],
  fragmento: polygonClipping.Polygon,
): ContornoVectorial[] {
  if (!cortes.length) return [];
  const geometriaCortes: MultiPolygon = cortes.map((contorno) => [
    cerrar(contorno.puntos),
  ]);
  return polygonClipping
    .intersection(geometriaCortes, [fragmento])
    .flatMap((polygon) =>
      polygon.map((ring) => ({
        esHueco: false,
        puntos: ring.slice(0, -1).map(([x, y]) => ({
          x: redondear(x),
          y: redondear(y),
        })),
      })),
    );
}

function normalizarFragmento(
  fragmento: Fragmento,
  indice: number,
  total: number,
): PiezaVectorial {
  const caja = boundsContornos(fragmento.contornos);
  const contornos = fragmento.contornos.map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((p) => ({
      x: redondear(p.x - caja.minX),
      y: redondear(p.y - caja.minY),
    })),
  }));
  const cortesInternos = (fragmento.cortesInternos ?? []).map((contorno) => ({
    ...contorno,
    puntos: contorno.puntos.map((p) => ({
      x: redondear(p.x - caja.minX),
      y: redondear(p.y - caja.minY),
    })),
  }));
  const segmentada = total > 1;
  return {
    id: segmentada
      ? `${fragmento.piezaOrigenId}-S${String(indice).padStart(2, '0')}`
      : fragmento.piezaOrigenId,
    contornos,
    ...(cortesInternos.length ? { cortesInternos } : {}),
    anchoMm: redondear(caja.maxX - caja.minX),
    altoMm: redondear(caja.maxY - caja.minY),
    areaMm2: redondear(areaContornos(contornos)),
    perimetroMm: redondear(perimetroContornos(contornos)),
    ...(segmentada
      ? {
          segmentacion: {
            piezaOrigenId: fragmento.piezaOrigenId,
            indice,
            total,
            origenXmm: redondear(caja.minX),
            origenYmm: redondear(caja.minY),
            unionesIds: fragmento.unionesIds,
          },
        }
      : {}),
  };
}

function cerrar(points: PuntoVectorial[]): polygonClipping.Ring {
  const ring = points.map((p) => [p.x, p.y] as [number, number]);
  if (
    ring.length &&
    (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1])
  )
    ring.push([...ring[0]] as [number, number]);
  return ring;
}

function boundsContornos(contornos: ContornoVectorial[]) {
  const puntos = contornos.flatMap((c) => c.puntos);
  return {
    minX: Math.min(...puntos.map((p) => p.x)),
    maxX: Math.max(...puntos.map((p) => p.x)),
    minY: Math.min(...puntos.map((p) => p.y)),
    maxY: Math.max(...puntos.map((p) => p.y)),
  };
}

function areaContornos(contornos: ContornoVectorial[]): number {
  return contornos.reduce(
    (sum, c) => sum + (c.esHueco ? -1 : 1) * Math.abs(areaPoligono(c.puntos)),
    0,
  );
}

function areaPoligono(points: PuntoVectorial[]): number {
  return (
    points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0) / 2
  );
}

function perimetroContornos(contornos: ContornoVectorial[]): number {
  return contornos.reduce(
    (sum, c) =>
      sum +
      c.puntos.reduce((subtotal, p, i) => {
        const next = c.puntos[(i + 1) % c.puntos.length];
        return subtotal + Math.hypot(next.x - p.x, next.y - p.y);
      }, 0),
    0,
  );
}

function puntoEnPoligono(point: PuntoVectorial, polygon: PuntoVectorial[]) {
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

function redondear(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function numeroEnRango(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function enteroEnRango(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return Math.round(numeroEnRango(value, fallback, min, max));
}
