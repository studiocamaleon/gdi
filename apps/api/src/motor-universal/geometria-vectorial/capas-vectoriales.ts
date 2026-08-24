import * as polygonClipping from 'polygon-clipping';
import type {
  ConfiguracionCapasVectoriales,
  ContornoVectorial,
  GeometriaVectorialCanonica,
  PiezaVectorial,
  PuntoVectorial,
} from './tipos';

type MultiPolygon = polygonClipping.MultiPolygon;

/**
 * Convierte los niveles visuales en geometría de fabricación.
 *
 * - Objetos en niveles distintos conservan todas sus siluetas: se apilan.
 * - Un objeto contenido por otro del mismo nivel se obtiene del corte interno
 *   de la pieza exterior. Comparten ubicación y línea de corte, por lo que el
 *   inserto no vuelve a ocupar material en el nesting.
 */
export function aplicarCapasAGeometria(
  geometria: GeometriaVectorialCanonica,
  configuracion?: ConfiguracionCapasVectoriales,
): GeometriaVectorialCanonica {
  if (!configuracion) return geometria;
  const asignaciones = new Map(
    configuracion.asignaciones.map((item) => [item.objetoId, item]),
  );
  let piezas = geometria.piezas.map((pieza) => ({
    ...pieza,
    cortesInternos: pieza.cortesInternos
      ? [...pieza.cortesInternos]
      : undefined,
  }));
  const objetos = [
    ...new Set(configuracion.asignaciones.map((item) => item.objetoId)),
  ]
    .map((objetoId) => ({
      objetoId,
      orden: Math.min(
        ...geometria.piezas
          .filter((pieza) => idObjeto(pieza) === objetoId)
          .map((pieza) => pieza.objetoFuente?.orden ?? Number.MAX_SAFE_INTEGER),
      ),
    }))
    .sort((a, b) => a.orden - b.orden);

  for (const objeto of objetos) {
    const asignacion = asignaciones.get(objeto.objetoId);
    if (!asignacion) continue;
    const insertos = piezas.filter(
      (pieza) => idObjeto(pieza) === objeto.objetoId,
    );
    const bases = piezas.filter((pieza) => {
      const baseId = idObjeto(pieza);
      const baseAsignacion = asignaciones.get(baseId);
      return (
        baseId !== objeto.objetoId &&
        baseAsignacion?.nivelId === asignacion.nivelId &&
        (pieza.objetoFuente?.orden ?? Number.MAX_SAFE_INTEGER) < objeto.orden
      );
    });
    if (!insertos.length || !bases.length) continue;

    const consumidos = new Set<string>();
    for (const inserto of insertos) {
      const cortesPorBase = new Map<string, ContornoVectorial[]>();
      let areaCubierta = 0;
      for (const base of bases) {
        const interseccion = polygonClipping.intersection(
          aMultiPolygonGlobal(base),
          aMultiPolygonGlobal(inserto),
        );
        const area = areaMultiPolygon(interseccion);
        if (area < 0.001) continue;
        areaCubierta += area;
        cortesPorBase.set(base.id, cortesLocales(interseccion, base));
      }
      // El parser redondea los puntos antes de calcular el área. En piezas
      // grandes esa diferencia crece con la escala, por eso la cobertura se
      // compara proporcionalmente y no con una tolerancia fija en mm².
      if (areaCubierta < inserto.areaMm2 * 0.999) continue;
      consumidos.add(inserto.id);
      piezas = piezas.map((pieza) => {
        const cortes = cortesPorBase.get(pieza.id);
        return cortes?.length
          ? {
              ...pieza,
              cortesInternos: [...(pieza.cortesInternos ?? []), ...cortes],
            }
          : pieza;
      });
    }
    piezas = piezas.filter((pieza) => !consumidos.has(pieza.id));
  }

  return {
    ...geometria,
    piezas,
    areaTotalMm2: redondear(
      piezas.reduce((total, pieza) => total + pieza.areaMm2, 0),
    ),
    perimetroTotalMm: redondear(
      piezas.reduce(
        (total, pieza) =>
          total +
          pieza.perimetroMm +
          perimetroContornos(pieza.cortesInternos ?? []),
        0,
      ),
    ),
  };
}

function idObjeto(pieza: PiezaVectorial): string {
  return pieza.objetoFuente?.id ?? pieza.id;
}

function cortesLocales(
  geometria: MultiPolygon,
  base: PiezaVectorial,
): ContornoVectorial[] {
  const offsetX = base.origenXmm ?? 0;
  const offsetY = base.origenYmm ?? 0;
  return geometria.flatMap((polygon) =>
    polygon.map((ring) => ({
      esHueco: false,
      puntos: ring.slice(0, -1).map(([x, y]) => ({
        x: redondear(x - offsetX),
        y: redondear(y - offsetY),
      })),
    })),
  );
}

function areaMultiPolygon(geometria: MultiPolygon): number {
  return geometria.reduce(
    (total, polygon) =>
      total +
      polygon.reduce((subtotal, ring, index) => {
        const puntos = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
        return (
          subtotal + Math.abs(areaFirmada(puntos)) * (index === 0 ? 1 : -1)
        );
      }, 0),
    0,
  );
}

function aMultiPolygonGlobal(pieza: PiezaVectorial): MultiPolygon {
  const offsetX = pieza.origenXmm ?? 0;
  const offsetY = pieza.origenYmm ?? 0;
  const exteriores = pieza.contornos.filter((contorno) => !contorno.esHueco);
  const huecos = pieza.contornos.filter((contorno) => contorno.esHueco);
  return exteriores.map((exterior) => [
    cerrar(exterior.puntos, offsetX, offsetY),
    ...huecos
      .filter((hueco) => puntoEnPoligono(hueco.puntos[0], exterior.puntos))
      .map((hueco) => cerrar(hueco.puntos, offsetX, offsetY)),
  ]);
}

function cerrar(
  points: PuntoVectorial[],
  offsetX: number,
  offsetY: number,
): polygonClipping.Ring {
  const ring = points.map(
    (point) => [point.x + offsetX, point.y + offsetY] as [number, number],
  );
  if (
    ring.length &&
    (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1])
  ) {
    ring.push([...ring[0]]);
  }
  return ring;
}

function perimetroContornos(contornos: ContornoVectorial[]): number {
  return contornos.reduce(
    (total, contorno) =>
      total +
      contorno.puntos.reduce((sum, point, index) => {
        const next = contorno.puntos[(index + 1) % contorno.puntos.length];
        return sum + Math.hypot(next.x - point.x, next.y - point.y);
      }, 0),
    0,
  );
}

function areaFirmada(points: PuntoVectorial[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
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
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function redondear(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
