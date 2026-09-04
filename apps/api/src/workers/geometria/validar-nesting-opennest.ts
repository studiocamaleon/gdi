import * as polygonClipping from 'polygon-clipping';
import type {
  AnilloTrabajoNesting,
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PiezaTrabajoNestingOpenNest,
  PlacementTrabajoNestingOpenNest,
  PuntoTrabajoGeometria,
} from '../colas';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../colas';

type ResultadoSinValidacion = Omit<
  NestingIrregularOpenNestResult,
  'validacion'
>;

const TOLERANCIA_MM = 0.02;
const TOLERANCIA_AREA_MM2 = 0.01;
const MAX_TIPOS_PIEZA = 500;
const MAX_INSTANCIAS = 10_000;
const MAX_PUNTOS = 250_000;

export class NestingOpenNestInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NestingOpenNestInvalidoError';
  }
}

/** Protege el límite nativo: OpenNest sólo recibe geometría ya normalizada. */
export function validarEntradaNestingOpenNest(
  input: NestingIrregularOpenNestData,
): void {
  if (input.schemaVersion !== 1)
    invalido('La versión del contrato de nesting no está soportada.');
  if (!input.tenantId?.trim() || !input.correlationId?.trim())
    invalido('El tenant y la correlación son obligatorios.');
  if (input.motor !== 'collision' && input.motor !== 'nfp')
    invalido('El motor de OpenNest no está soportado.');
  positivo(input.placa.anchoMm, 'El ancho de placa');
  positivo(input.placa.altoMm, 'El alto de placa');
  noNegativo(input.placa.margenMm, 'El margen');
  enteroEntre(input.placa.maxPlacas, 1, 1_000, 'La cantidad máxima de placas');
  noNegativo(input.separacionMm, 'La separación');
  enteroEntre(input.timeoutMs, 100, 60 * 60 * 1_000, 'El timeout');
  if (!Number.isSafeInteger(input.semilla))
    invalido('La semilla debe ser un entero seguro.');
  if (
    input.placa.margenMm * 2 >= input.placa.anchoMm ||
    input.placa.margenMm * 2 >= input.placa.altoMm
  )
    invalido('El margen consume toda el área útil de la placa.');
  if (!input.piezas.length || input.piezas.length > MAX_TIPOS_PIEZA)
    invalido(`Debe haber entre 1 y ${MAX_TIPOS_PIEZA} tipos de pieza.`);

  const ids = new Set<string>();
  let totalInstancias = 0;
  let totalPuntos = 0;
  for (const pieza of input.piezas) {
    if (!pieza.id?.trim() || ids.has(pieza.id))
      invalido('Cada pieza debe tener un id único y no vacío.');
    ids.add(pieza.id);
    enteroEntre(pieza.cantidad, 1, MAX_INSTANCIAS, 'La cantidad de pieza');
    enteroEntre(pieza.rotaciones, 1, 3_600, 'Las rotaciones de pieza');
    validarAnillo(pieza.contorno, `contorno de "${pieza.id}"`);
    for (const hueco of pieza.huecos ?? [])
      validarAnillo(hueco, `hueco de "${pieza.id}"`);
    totalInstancias += pieza.cantidad;
    totalPuntos +=
      pieza.contorno.length +
      (pieza.huecos ?? []).reduce((total, hueco) => total + hueco.length, 0);
  }
  if (totalInstancias > MAX_INSTANCIAS)
    invalido(`El trabajo supera ${MAX_INSTANCIAS} instancias.`);
  if (totalPuntos > MAX_PUNTOS)
    invalido(`El trabajo supera ${MAX_PUNTOS} puntos de geometría.`);
}

/**
 * Un resultado nativo es sólo un candidato. Esta validación independiente
 * decide si puede convertirse en una solución de costeo.
 */
export function validarResultadoNestingOpenNest(
  input: NestingIrregularOpenNestData,
  result: ResultadoSinValidacion,
): NestingIrregularOpenNestResult {
  validarEstructuraResultado(result);
  const cantidadEsperada = input.piezas.reduce(
    (total, pieza) => total + pieza.cantidad,
    0,
  );
  if (
    result.cantidadSolicitada !== cantidadEsperada ||
    result.cantidadColocada !== cantidadEsperada ||
    result.placements.length !== cantidadEsperada
  )
    invalido(
      `OpenNest devolvió ${result.placements.length} de ${cantidadEsperada} piezas.`,
    );
  if (result.motor !== input.motor)
    invalido('El motor informado no coincide con el trabajo solicitado.');

  const piezas = new Map(input.piezas.map((pieza) => [pieza.id, pieza]));
  const copias = new Set<string>();
  const placas = new Set<number>();
  const porPlaca = new Map<number, PlacementTrabajoNestingOpenNest[]>();
  for (const placement of result.placements) {
    const pieza = piezas.get(placement.piezaId);
    if (!pieza)
      invalido(
        `OpenNest devolvió la pieza desconocida "${placement.piezaId}".`,
      );
    if (!Number.isInteger(placement.copia) || placement.copia < 0)
      invalido(`La copia de "${placement.piezaId}" no es válida.`);
    if (!Number.isInteger(placement.placa) || placement.placa < 0)
      invalido(`La placa de "${placement.piezaId}" no es válida.`);
    if (placement.placa >= input.placa.maxPlacas)
      invalido(`OpenNest excedió el máximo de placas permitido.`);
    const key = `${placement.piezaId}:${placement.copia}`;
    if (copias.has(key)) invalido(`OpenNest repitió la instancia "${key}".`);
    copias.add(key);
    placas.add(placement.placa);
    porPlaca.set(placement.placa, [
      ...(porPlaca.get(placement.placa) ?? []),
      placement,
    ]);
    validarPlacement(input, pieza, placement);
  }
  for (const pieza of input.piezas) {
    for (let copia = 0; copia < pieza.cantidad; copia += 1) {
      if (!copias.has(`${pieza.id}:${copia}`))
        invalido(`Falta la instancia "${pieza.id}:${copia}".`);
    }
  }
  if (result.placasUsadas !== placas.size)
    invalido('La cantidad de placas informada no coincide con los placements.');
  for (let placa = 0; placa < placas.size; placa += 1) {
    if (!placas.has(placa))
      invalido('OpenNest devolvió índices de placa discontinuos.');
  }

  for (const [placa, placements] of porPlaca) {
    validarSeparacionesEnPlaca(placements, input.separacionMm, placa);
  }

  return {
    ...result,
    validacion: {
      completa: true,
      dentroDePlaca: true,
      sinSolapamientos: true,
      separacionRespetada: true,
    },
  };
}

/**
 * Barrido espacial por X. Evita el O(n²) completo: sólo llegan a la validación
 * poligonal las cajas que realmente pueden estar a menos de la separación.
 */
function validarSeparacionesEnPlaca(
  placements: PlacementTrabajoNestingOpenNest[],
  separacionMm: number,
  placa: number,
): void {
  const tolerancia = separacionMm + TOLERANCIA_MM;
  const ordenados = placements
    .map((placement) => ({ placement, caja: limites(placement.contorno) }))
    .sort(
      (a, b) =>
        a.caja.minX - b.caja.minX ||
        a.caja.minY - b.caja.minY ||
        a.placement.piezaId.localeCompare(b.placement.piezaId) ||
        a.placement.copia - b.placement.copia,
    );
  for (let a = 0; a < ordenados.length; a += 1) {
    const actual = ordenados[a];
    for (let b = a + 1; b < ordenados.length; b += 1) {
      const siguiente = ordenados[b];
      if (siguiente.caja.minX > actual.caja.maxX + tolerancia) break;
      if (!cajasCercanas(actual.caja, siguiente.caja, tolerancia)) continue;
      validarSeparacion(
        actual.placement,
        siguiente.placement,
        separacionMm,
        placa,
        actual.caja,
        siguiente.caja,
      );
    }
  }
}

function validarEstructuraResultado(result: ResultadoSinValidacion): void {
  if (
    result.schemaVersion !== 1 ||
    (result.algoritmo !== 'opennest-v1' &&
      result.algoritmo !== 'grafonest-baseline-v1') ||
    (result.motor !== 'collision' && result.motor !== 'nfp') ||
    !result.versionMotor?.trim() ||
    !Number.isInteger(result.cantidadSolicitada) ||
    !Number.isInteger(result.cantidadColocada) ||
    !Number.isInteger(result.placasUsadas) ||
    !Number.isFinite(result.duracionMs) ||
    result.duracionMs < 0 ||
    !Array.isArray(result.placements)
  )
    invalido('OpenNest devolvió un contrato de resultado inválido.');
  if (
    result.calidadSolucion !== undefined &&
    result.calidadSolucion !== 'BASE_SEGURA' &&
    result.calidadSolucion !== 'OPTIMIZADA'
  )
    invalido('GrafoNest devolvió una calidad de solución desconocida.');
  if (
    result.estrategiaOrientacion !== undefined &&
    result.estrategiaOrientacion !== 'uniforme' &&
    result.estrategiaOrientacion !== 'cardinal' &&
    result.estrategiaOrientacion !== 'libre'
  )
    invalido('OpenNest devolvió una estrategia de orientación inválida.');
  if (
    result.rotacionesPermitidas !== undefined &&
    (!Number.isInteger(result.rotacionesPermitidas) ||
      result.rotacionesPermitidas < 1 ||
      result.rotacionesPermitidas > 3_600)
  )
    invalido('OpenNest devolvió una cantidad de rotaciones inválida.');
  if (
    result.versionPoliticaOrientacion !== undefined &&
    result.versionPoliticaOrientacion !== VERSION_POLITICA_ORIENTACION_GRAFONEST
  )
    invalido('OpenNest devolvió una política de orientación desconocida.');
}

function validarPlacement(
  input: NestingIrregularOpenNestData,
  pieza: PiezaTrabajoNestingOpenNest,
  placement: PlacementTrabajoNestingOpenNest,
): void {
  finito(placement.rotacionGrados, 'La rotación');
  finito(placement.traslacion?.x, 'La traslación X');
  finito(placement.traslacion?.y, 'La traslación Y');
  validarAnillo(placement.contorno, `resultado de "${pieza.id}"`);
  if (!Array.isArray(placement.huecos))
    invalido(`Los huecos de "${pieza.id}" no son válidos.`);
  if (placement.huecos.length !== (pieza.huecos?.length ?? 0))
    invalido(`OpenNest alteró los huecos de "${pieza.id}".`);
  placement.huecos.forEach((hueco) =>
    validarAnillo(hueco, `hueco resultante de "${pieza.id}"`),
  );

  const pasoRotacion = 360 / pieza.rotaciones;
  const cociente = normalizarGrados(placement.rotacionGrados) / pasoRotacion;
  if (Math.abs(cociente - Math.round(cociente)) > 0.001)
    invalido(`OpenNest usó una rotación no permitida en "${pieza.id}".`);

  validarTransformacion(
    pieza.contorno,
    placement.contorno,
    placement.rotacionGrados,
    placement.traslacion,
    pieza.id,
  );
  (pieza.huecos ?? []).forEach((hueco, index) =>
    validarTransformacion(
      hueco,
      placement.huecos[index],
      placement.rotacionGrados,
      placement.traslacion,
      pieza.id,
    ),
  );

  const minX = input.placa.margenMm;
  const minY = input.placa.margenMm;
  const maxX = input.placa.anchoMm - input.placa.margenMm;
  const maxY = input.placa.altoMm - input.placa.margenMm;
  for (const punto of placement.contorno) {
    if (
      punto.x < minX - TOLERANCIA_MM ||
      punto.y < minY - TOLERANCIA_MM ||
      punto.x > maxX + TOLERANCIA_MM ||
      punto.y > maxY + TOLERANCIA_MM
    )
      invalido(
        `La instancia "${pieza.id}:${placement.copia}" quedó fuera del área útil.`,
      );
  }
}

function validarTransformacion(
  original: AnilloTrabajoNesting,
  transformed: AnilloTrabajoNesting,
  grados: number,
  traslacion: PuntoTrabajoGeometria,
  piezaId: string,
): void {
  if (original.length !== transformed.length)
    invalido(`OpenNest alteró la cantidad de puntos de "${piezaId}".`);
  const radians = (grados * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  for (let index = 0; index < original.length; index += 1) {
    const esperado = {
      x: original[index].x * cos - original[index].y * sin + traslacion.x,
      y: original[index].x * sin + original[index].y * cos + traslacion.y,
    };
    if (
      Math.hypot(
        esperado.x - transformed[index].x,
        esperado.y - transformed[index].y,
      ) > TOLERANCIA_MM
    )
      invalido(`La transformación geométrica de "${piezaId}" no coincide.`);
  }
}

function validarSeparacion(
  a: PlacementTrabajoNestingOpenNest,
  b: PlacementTrabajoNestingOpenNest,
  separacionMm: number,
  placa: number,
  cajaA = limites(a.contorno),
  cajaB = limites(b.contorno),
): void {
  if (!cajasCercanas(cajaA, cajaB, separacionMm + TOLERANCIA_MM)) return;
  let interseccion: polygonClipping.MultiPolygon;
  try {
    interseccion = polygonClipping.intersection(aPoligono(a), aPoligono(b));
  } catch {
    invalido('No se pudo validar la intersección del resultado de OpenNest.');
  }
  if (areaMultiPolygon(interseccion) > TOLERANCIA_AREA_MM2)
    invalido(
      `Hay solapamiento entre "${a.piezaId}:${a.copia}" y "${b.piezaId}:${b.copia}" en la placa ${placa + 1}.`,
    );
  if (separacionMm <= TOLERANCIA_MM) return;
  const distancia = distanciaEntreAnillos(
    [a.contorno, ...a.huecos],
    [b.contorno, ...b.huecos],
  );
  if (distancia < separacionMm - TOLERANCIA_MM)
    invalido(
      `No se respeta la separación entre "${a.piezaId}:${a.copia}" y "${b.piezaId}:${b.copia}" en la placa ${placa + 1}.`,
    );
}

function aPoligono(
  placement: PlacementTrabajoNestingOpenNest,
): polygonClipping.Polygon {
  return [cerrar(placement.contorno), ...placement.huecos.map(cerrar)];
}

function cerrar(anillo: AnilloTrabajoNesting): polygonClipping.Ring {
  const result = anillo.map(({ x, y }) => [x, y] as [number, number]);
  const first = result[0];
  const last = result.at(-1);
  if (last?.[0] !== first[0] || last?.[1] !== first[1])
    result.push([first[0], first[1]]);
  return result;
}

function areaMultiPolygon(polygons: polygonClipping.MultiPolygon): number {
  return polygons.reduce(
    (total, polygon) =>
      total +
      polygon.reduce(
        (subtotal, ring, index) =>
          subtotal + Math.abs(areaFirmadaPares(ring)) * (index ? -1 : 1),
        0,
      ),
    0,
  );
}

function distanciaEntreAnillos(
  ringsA: AnilloTrabajoNesting[],
  ringsB: AnilloTrabajoNesting[],
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const ringA of ringsA) {
    for (const ringB of ringsB) {
      for (let a = 0; a < ringA.length; a += 1) {
        const a1 = ringA[a];
        const a2 = ringA[(a + 1) % ringA.length];
        for (let b = 0; b < ringB.length; b += 1) {
          const b1 = ringB[b];
          const b2 = ringB[(b + 1) % ringB.length];
          best = Math.min(best, distanciaSegmentos(a1, a2, b1, b2));
          if (best <= TOLERANCIA_MM) return best;
        }
      }
    }
  }
  return best;
}

function distanciaSegmentos(
  a: PuntoTrabajoGeometria,
  b: PuntoTrabajoGeometria,
  c: PuntoTrabajoGeometria,
  d: PuntoTrabajoGeometria,
): number {
  if (segmentosIntersectan(a, b, c, d)) return 0;
  return Math.min(
    distanciaPuntoSegmento(a, c, d),
    distanciaPuntoSegmento(b, c, d),
    distanciaPuntoSegmento(c, a, b),
    distanciaPuntoSegmento(d, a, b),
  );
}

function segmentosIntersectan(
  a: PuntoTrabajoGeometria,
  b: PuntoTrabajoGeometria,
  c: PuntoTrabajoGeometria,
  d: PuntoTrabajoGeometria,
): boolean {
  const o1 = orientacion(a, b, c);
  const o2 = orientacion(a, b, d);
  const o3 = orientacion(c, d, a);
  const o4 = orientacion(c, d, b);
  return (
    ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
    ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))
  );
}

function orientacion(
  a: PuntoTrabajoGeometria,
  b: PuntoTrabajoGeometria,
  c: PuntoTrabajoGeometria,
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function distanciaPuntoSegmento(
  p: PuntoTrabajoGeometria,
  a: PuntoTrabajoGeometria,
  b: PuntoTrabajoGeometria,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const divisor = dx * dx + dy * dy;
  if (divisor <= Number.EPSILON) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / divisor),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function validarAnillo(anillo: AnilloTrabajoNesting, nombre: string): void {
  if (!Array.isArray(anillo) || anillo.length < 3)
    invalido(`El ${nombre} debe tener al menos tres puntos.`);
  anillo.forEach((punto) => {
    finito(punto?.x, `La coordenada X del ${nombre}`);
    finito(punto?.y, `La coordenada Y del ${nombre}`);
  });
  if (Math.abs(areaFirmada(anillo)) <= TOLERANCIA_AREA_MM2)
    invalido(`El ${nombre} no tiene área útil.`);
}

function limites(anillo: AnilloTrabajoNesting) {
  return anillo.reduce(
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

function cajasCercanas(
  a: ReturnType<typeof limites>,
  b: ReturnType<typeof limites>,
  distancia: number,
): boolean {
  return !(
    a.maxX + distancia < b.minX ||
    b.maxX + distancia < a.minX ||
    a.maxY + distancia < b.minY ||
    b.maxY + distancia < a.minY
  );
}

function areaFirmada(anillo: AnilloTrabajoNesting): number {
  return (
    anillo.reduce((sum, point, index) => {
      const next = anillo[(index + 1) % anillo.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function areaFirmadaPares(anillo: polygonClipping.Ring): number {
  return (
    anillo.slice(0, -1).reduce((sum, point, index, points) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}

function normalizarGrados(value: number): number {
  return ((value % 360) + 360) % 360;
}

function enteroEntre(
  value: number,
  min: number,
  max: number,
  nombre: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max)
    invalido(`${nombre} debe ser un entero entre ${min} y ${max}.`);
}

function positivo(value: number, nombre: string): void {
  finito(value, nombre);
  if (value <= 0) invalido(`${nombre} debe ser mayor que cero.`);
}

function noNegativo(value: number, nombre: string): void {
  finito(value, nombre);
  if (value < 0) invalido(`${nombre} no puede ser negativo.`);
}

function finito(value: number, nombre: string): void {
  if (!Number.isFinite(value)) invalido(`${nombre} debe ser un número finito.`);
}

function invalido(message: string): never {
  throw new NestingOpenNestInvalidoError(message);
}
