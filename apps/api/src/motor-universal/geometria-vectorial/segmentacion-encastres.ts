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
  unionesIds: string[];
}

export interface ResultadoSegmentacion {
  piezas: PiezaVectorial[];
  uniones: UnionVectorial[];
}

const ANCHO_ENCASTRE_MM = 30;
const PROFUNDIDAD_ENCASTRE_MM = 30;
const DISTANCIA_MAX_ENCASTRES_MM = 100;
const KERF_MM = 0.3;
const EPSILON = 0.01;

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
}): ResultadoSegmentacion {
  const uniones: UnionVectorial[] = [];
  const finales: Fragmento[] = [];

  for (const pieza of input.piezas) {
    const inicial: Fragmento = {
      piezaOrigenId: pieza.id,
      contornos: pieza.contornos,
      unionesIds: [],
    };
    dividirRecursivo(
      inicial,
      input.anchoUtilMm,
      input.altoUtilMm,
      input.permitirRotacion !== false,
      uniones,
      finales,
      0,
    );
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

function dividirRecursivo(
  fragmento: Fragmento,
  anchoUtilMm: number,
  altoUtilMm: number,
  permitirRotacion: boolean,
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
    PROFUNDIDAD_ENCASTRE_MM,
    Math.max(2, capacidad / 4),
  );
  // El macho necesita espacio para su cuerpo y para los 30 mm de cabeza. Si
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
  const posicion = inicioEje + corteDesdeInicio;
  const cantidadEncastres = Math.max(
    1,
    Math.ceil(largo / DISTANCIA_MAX_ENCASTRES_MM),
  );
  const union: UnionVectorial = {
    id: `${fragmento.piezaOrigenId}-U${uniones.length + 1}`,
    piezaOrigenId: fragmento.piezaOrigenId,
    tipoEncastre: 'cola_milano',
    eje,
    posicionMm: redondear(posicion),
    largoMm: redondear(largo),
    cantidadEncastres,
    anchoEncastreMm: ANCHO_ENCASTRE_MM,
    profundidadEncastreMm: redondear(profundidadEncastre),
    kerfMm: KERF_MM,
  };
  const [mascaraA, mascaraB] = crearMascarasEncastre(
    caja,
    eje,
    posicion,
    cantidadEncastres,
    profundidadEncastre,
  );
  const geometria = aMultiPolygon(fragmento.contornos);
  const ladoA = polygonClipping.intersection(geometria, mascaraA);
  const ladoB = polygonClipping.intersection(geometria, mascaraB);
  const fragmentosA = desdeMultiPolygon(ladoA, fragmento, union.id);
  const fragmentosB = desdeMultiPolygon(ladoB, fragmento, union.id);
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
      uniones,
      finales,
      profundidad + 1,
    );
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
  const tramo = (perfilFin - perfilInicio) / cantidad;
  // Cola de milano verdadera: el cuello junto a la línea de unión es angosto
  // y la cabeza exterior es más ancha. El perfil anterior era el inverso
  // (base ancha y punta angosta) y, al muestrearlo como una curva, se percibía
  // redondeado en la vista previa.
  for (let index = 0; index < cantidad; index++) {
    const centro = perfilInicio + tramo * (index + 0.5);
    const anchoCabeza = Math.min(ANCHO_ENCASTRE_MM, tramo * 0.6);
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
        unionesIds: [...new Set([...padre.unionesIds, unionId])],
      },
    ];
  });
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
  const segmentada = total > 1;
  return {
    id: segmentada
      ? `${fragmento.piezaOrigenId}-S${String(indice).padStart(2, '0')}`
      : fragmento.piezaOrigenId,
    contornos,
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
