import * as polygonClipping from 'polygon-clipping';
import type {
  AnilloTrabajoNesting,
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PlacementTrabajoNestingOpenNest,
  PuntoTrabajoGeometria,
  ResultadoCommonLineTrabajo,
  TramoCommonLineTrabajo,
} from '../colas';

type ResultadoSinValidacion = Omit<
  NestingIrregularOpenNestResult,
  'validacion'
>;

type Segmento = {
  placementIndex: number;
  piezaId: string;
  copia: number;
  placa: number;
  indiceSegmento: number;
  inicio: PuntoTrabajoGeometria;
  fin: PuntoTrabajoGeometria;
  longitud: number;
};

type Candidato = {
  a: Segmento;
  b: Segmento;
  longitud: number;
};

const MAX_PLACEMENTS_COMMON_LINE = 750;
const MAX_CANDIDATOS_COMMON_LINE = 10_000;
const TOLERANCIA_AREA_MM2 = 0.01;

/**
 * Acerca grupos rígidos de piezas ya validadas. Parte siempre de un layout
 * que respeta la separación normal y sólo conserva una modificación si el
 * nuevo contacto es un par de bordes rectos completo, no hay solapamientos y
 * cualquier otro vecino mantiene la separación original.
 */
export function optimizarCommonLines(
  input: NestingIrregularOpenNestData,
  result: ResultadoSinValidacion,
): ResultadoSinValidacion {
  const config = input.commonLine;
  if (!config?.habilitado) return result;

  const resumenVacio = resultadoVacio(input);
  if (
    result.placements.length < 2 ||
    result.placements.length > MAX_PLACEMENTS_COMMON_LINE
  ) {
    return { ...result, commonLine: resumenVacio };
  }

  const placements = result.placements.map(clonarPlacement);
  const grupos = new Map<number, Set<number>>(
    placements.map((_, index) => [index, new Set([index])]),
  );
  const grupoDe = placements.map((_, index) => index);
  const usados = new Set<string>();
  const tramos: TramoCommonLineTrabajo[] = [];
  const candidatos = buscarCandidatos(input, placements).slice(
    0,
    MAX_CANDIDATOS_COMMON_LINE,
  );

  for (const candidato of candidatos) {
    const grupoA = grupoDe[candidato.a.placementIndex];
    const grupoB = grupoDe[candidato.b.placementIndex];
    if (grupoA === grupoB) continue;
    if (
      usados.has(claveSegmento(candidato.a)) ||
      usados.has(claveSegmento(candidato.b))
    )
      continue;

    const miembrosA = grupos.get(grupoA);
    const miembrosB = grupos.get(grupoB);
    if (!miembrosA || !miembrosB) continue;
    const intentos =
      miembrosB.size <= miembrosA.size
        ? [
            {
              movil: miembrosB,
              fijo: miembrosA,
              origen: candidato.b,
              destino: candidato.a,
            },
            {
              movil: miembrosA,
              fijo: miembrosB,
              origen: candidato.a,
              destino: candidato.b,
            },
          ]
        : [
            {
              movil: miembrosA,
              fijo: miembrosB,
              origen: candidato.a,
              destino: candidato.b,
            },
            {
              movil: miembrosB,
              fijo: miembrosA,
              origen: candidato.b,
              destino: candidato.a,
            },
          ];

    let aplicado:
      | {
          placements: PlacementTrabajoNestingOpenNest[];
          nuevos: TramoCommonLineTrabajo[];
          movil: Set<number>;
          fijo: Set<number>;
        }
      | undefined;
    for (const intento of intentos) {
      const segmentoOrigen = segmentoActual(
        placements,
        intento.origen.placementIndex,
        intento.origen.indiceSegmento,
      );
      const segmentoDestino = segmentoActual(
        placements,
        intento.destino.placementIndex,
        intento.destino.indiceSegmento,
      );
      if (!segmentoOrigen || !segmentoDestino) continue;
      const delta = calcularTraslacionCommonLine(
        segmentoOrigen,
        segmentoDestino,
        config.anchoCorteMm,
        config.toleranciaMm,
        input.separacionMm,
        false,
      );
      if (!delta) continue;
      const tentativa = [...placements];
      for (const index of intento.movil) {
        tentativa[index] = trasladarPlacement(placements[index], delta);
      }
      const nuevos = detectarTramosEntreGrupos({
        placements: tentativa,
        grupoA: intento.fijo,
        grupoB: intento.movil,
        input,
        usados,
        indiceInicial: tramos.length,
      });
      if (nuevos.length === 0) continue;
      if (
        !layoutCommonLineSeguro(
          tentativa,
          input,
          [...tramos, ...nuevos],
          intento.movil,
        )
      )
        continue;
      aplicado = {
        placements: tentativa,
        nuevos,
        movil: intento.movil,
        fijo: intento.fijo,
      };
      break;
    }
    if (!aplicado) continue;

    placements.splice(0, placements.length, ...aplicado.placements);
    for (const tramo of aplicado.nuevos) {
      tramos.push(tramo);
      tramo.segmentosOrigen.forEach((referencia) =>
        usados.add(claveReferencia(referencia)),
      );
    }
    const idFijo = grupoDe[[...aplicado.fijo][0]];
    const idMovil = grupoDe[[...aplicado.movil][0]];
    const combinado = new Set([...aplicado.fijo, ...aplicado.movil]);
    grupos.set(idFijo, combinado);
    grupos.delete(idMovil);
    for (const index of combinado) grupoDe[index] = idFijo;
  }

  const longitudCompartidaMm = redondear(
    tramos.reduce((total, tramo) => total + tramo.longitudMm, 0),
  );
  return {
    ...result,
    placements,
    commonLine: {
      ...resumenVacio,
      aplicado: tramos.length > 0,
      longitudCompartidaMm,
      ahorroRecorridoMm: longitudCompartidaMm,
      tramos,
    },
  };
}

/** Valida el contrato agregado por el postprocesador antes de costearlo. */
export function validarDeclaracionCommonLine(
  input: NestingIrregularOpenNestData,
  result: ResultadoSinValidacion,
): Set<string> {
  if (!result.commonLine) return new Set();
  const config = input.commonLine;
  if (!config?.habilitado)
    throw new Error('El resultado declaró Common Line sin estar habilitado.');
  const resumen = result.commonLine;
  if (
    resumen.habilitado !== true ||
    resumen.anchoCorteMm !== config.anchoCorteMm ||
    resumen.longitudMinimaMm !== config.longitudMinimaMm ||
    resumen.toleranciaMm !== config.toleranciaMm ||
    resumen.aplicado !== resumen.tramos.length > 0
  ) {
    throw new Error('La política Common Line del resultado no coincide.');
  }
  const porInstancia = new Map(
    result.placements.map((placement, index) => [
      claveInstancia(placement),
      { placement, index },
    ]),
  );
  const usados = new Set<string>();
  const pares = new Set<string>();
  let longitud = 0;
  for (const tramo of resumen.tramos) {
    if (!(tramo.longitudMm >= config.longitudMinimaMm - config.toleranciaMm))
      throw new Error('Common Line declaró un tramo demasiado corto.');
    const [refA, refB] = tramo.segmentosOrigen;
    const a = porInstancia.get(`${refA.piezaId}:${refA.copia}`);
    const b = porInstancia.get(`${refB.piezaId}:${refB.copia}`);
    if (
      !a ||
      !b ||
      a.index === b.index ||
      a.placement.placa !== b.placement.placa
    )
      throw new Error('Common Line referencia piezas incompatibles.');
    if (a.placement.placa !== tramo.placa)
      throw new Error('La placa del tramo Common Line no coincide.');
    const keyA = claveReferencia(refA);
    const keyB = claveReferencia(refB);
    if (usados.has(keyA) || usados.has(keyB))
      throw new Error('Un borde participa en más de una línea compartida.');
    usados.add(keyA);
    usados.add(keyB);
    const segmentoA = segmentoActual(
      result.placements,
      a.index,
      refA.indiceSegmento,
    );
    const segmentoB = segmentoActual(
      result.placements,
      b.index,
      refB.indiceSegmento,
    );
    if (!segmentoA || !segmentoB)
      throw new Error('Common Line referencia un segmento inexistente.');
    const esperado = tramoDesdeSegmentos(
      segmentoA,
      segmentoB,
      config,
      tramo.id,
    );
    if (
      !esperado ||
      distancia(esperado.inicio, tramo.inicio) > config.toleranciaMm ||
      distancia(esperado.fin, tramo.fin) > config.toleranciaMm ||
      Math.abs(esperado.longitudMm - tramo.longitudMm) > config.toleranciaMm
    ) {
      throw new Error('La geometría de una línea compartida no coincide.');
    }
    longitud += tramo.longitudMm;
    pares.add(clavePar(a.placement, b.placement));
  }
  if (
    Math.abs(redondear(longitud) - resumen.longitudCompartidaMm) >
      config.toleranciaMm ||
    Math.abs(resumen.ahorroRecorridoMm - resumen.longitudCompartidaMm) >
      config.toleranciaMm
  ) {
    throw new Error('El ahorro Common Line informado no coincide.');
  }
  return pares;
}

function resultadoVacio(
  input: NestingIrregularOpenNestData,
): ResultadoCommonLineTrabajo {
  const config = input.commonLine!;
  return {
    habilitado: true,
    aplicado: false,
    anchoCorteMm: config.anchoCorteMm,
    longitudMinimaMm: config.longitudMinimaMm,
    toleranciaMm: config.toleranciaMm,
    longitudCompartidaMm: 0,
    ahorroRecorridoMm: 0,
    tramos: [],
  };
}

function buscarCandidatos(
  input: NestingIrregularOpenNestData,
  placements: PlacementTrabajoNestingOpenNest[],
): Candidato[] {
  const config = input.commonLine!;
  const reach =
    Math.max(input.separacionMm, config.anchoCorteMm) + config.toleranciaMm;
  const cajas = placements.map((placement, index) => ({
    index,
    caja: limites(placement.contorno),
  }));
  const ordenadas = [...cajas].sort((a, b) => a.caja.minX - b.caja.minX);
  const candidatos: Candidato[] = [];
  for (let a = 0; a < ordenadas.length; a += 1) {
    const actual = ordenadas[a];
    for (let b = a + 1; b < ordenadas.length; b += 1) {
      const siguiente = ordenadas[b];
      if (siguiente.caja.minX > actual.caja.maxX + reach) break;
      if (!cajasCercanas(actual.caja, siguiente.caja, reach)) continue;
      const placementA = placements[actual.index];
      const placementB = placements[siguiente.index];
      if (placementA.placa !== placementB.placa) continue;
      const segmentosA = segmentosPlacement(
        placementA,
        actual.index,
        config.longitudMinimaMm,
      );
      const segmentosB = segmentosPlacement(
        placementB,
        siguiente.index,
        config.longitudMinimaMm,
      );
      for (const segmentoA of segmentosA) {
        for (const segmentoB of segmentosB) {
          if (
            calcularTraslacionCommonLine(
              segmentoB,
              segmentoA,
              config.anchoCorteMm,
              config.toleranciaMm,
              input.separacionMm,
            )
          ) {
            candidatos.push({
              a: segmentoA,
              b: segmentoB,
              longitud: Math.min(segmentoA.longitud, segmentoB.longitud),
            });
            if (candidatos.length >= MAX_CANDIDATOS_COMMON_LINE)
              return ordenarCandidatos(candidatos);
          }
        }
      }
    }
  }
  return ordenarCandidatos(candidatos);
}

function ordenarCandidatos(candidatos: Candidato[]) {
  return candidatos.sort(
    (a, b) =>
      b.longitud - a.longitud ||
      a.a.placa - b.a.placa ||
      a.a.placementIndex - b.a.placementIndex ||
      a.b.placementIndex - b.b.placementIndex,
  );
}

function detectarTramosEntreGrupos(input: {
  placements: PlacementTrabajoNestingOpenNest[];
  grupoA: Set<number>;
  grupoB: Set<number>;
  input: NestingIrregularOpenNestData;
  usados: Set<string>;
  indiceInicial: number;
}): TramoCommonLineTrabajo[] {
  const config = input.input.commonLine!;
  const tramos: TramoCommonLineTrabajo[] = [];
  // Una misma arista tampoco puede aparecer dos veces dentro del conjunto
  // candidato que todavía no fue incorporado a `usados`.
  const usadosEnIntento = new Set(input.usados);
  for (const indexA of input.grupoA) {
    for (const indexB of input.grupoB) {
      const placementA = input.placements[indexA];
      const placementB = input.placements[indexB];
      if (placementA.placa !== placementB.placa) continue;
      for (const segmentoA of segmentosPlacement(
        placementA,
        indexA,
        config.longitudMinimaMm,
      )) {
        if (usadosEnIntento.has(claveSegmento(segmentoA))) continue;
        for (const segmentoB of segmentosPlacement(
          placementB,
          indexB,
          config.longitudMinimaMm,
        )) {
          if (usadosEnIntento.has(claveSegmento(segmentoB))) continue;
          const tramo = tramoDesdeSegmentos(
            segmentoA,
            segmentoB,
            config,
            `common-line-${input.indiceInicial + tramos.length + 1}`,
          );
          if (!tramo) continue;
          tramos.push(tramo);
          usadosEnIntento.add(claveSegmento(segmentoA));
          usadosEnIntento.add(claveSegmento(segmentoB));
          break;
        }
      }
    }
  }
  return tramos;
}

function tramoDesdeSegmentos(
  a: Segmento,
  b: Segmento,
  config: NonNullable<NestingIrregularOpenNestData['commonLine']>,
  id: string,
): TramoCommonLineTrabajo | null {
  if (Math.abs(a.longitud - b.longitud) > config.toleranciaMm) return null;
  const ua = unitario(a.inicio, a.fin);
  const ub = unitario(b.inicio, b.fin);
  if (!ua || !ub || Math.abs(Math.abs(productoPunto(ua, ub)) - 1) > 0.0001)
    return null;
  const medioA = puntoMedio(a.inicio, a.fin);
  const medioB = puntoMedio(b.inicio, b.fin);
  const normal = { x: -ua.y, y: ua.x };
  const gap = Math.abs(productoPunto(restar(medioB, medioA), normal));
  const offsetParalelo = Math.abs(productoPunto(restar(medioB, medioA), ua));
  if (
    Math.abs(gap - config.anchoCorteMm) > config.toleranciaMm ||
    offsetParalelo > config.toleranciaMm
  )
    return null;
  const linea = alinearOrientacion(a, b, config.toleranciaMm);
  if (!linea) return null;
  const inicio = puntoMedio(linea.aInicio, linea.bInicio);
  const fin = puntoMedio(linea.aFin, linea.bFin);
  const longitudMm = redondear(distancia(inicio, fin));
  if (longitudMm < config.longitudMinimaMm - config.toleranciaMm) return null;
  return {
    id,
    placa: a.placa,
    inicio: redondearPunto(inicio),
    fin: redondearPunto(fin),
    longitudMm,
    segmentosOrigen: [
      {
        piezaId: a.piezaId,
        copia: a.copia,
        indiceSegmento: a.indiceSegmento,
      },
      {
        piezaId: b.piezaId,
        copia: b.copia,
        indiceSegmento: b.indiceSegmento,
      },
    ],
  };
}

function calcularTraslacionCommonLine(
  origen: Segmento,
  destino: Segmento,
  anchoCorteMm: number,
  toleranciaMm: number,
  separacionMm: number,
  limitarAlcance = true,
): PuntoTrabajoGeometria | null {
  if (
    origen.longitud < Number.EPSILON ||
    Math.abs(origen.longitud - destino.longitud) > toleranciaMm
  )
    return null;
  const ud = unitario(destino.inicio, destino.fin);
  const uo = unitario(origen.inicio, origen.fin);
  if (!ud || !uo || Math.abs(Math.abs(productoPunto(ud, uo)) - 1) > 0.0001)
    return null;
  const medioDestino = puntoMedio(destino.inicio, destino.fin);
  const medioOrigen = puntoMedio(origen.inicio, origen.fin);
  const normal = { x: -ud.y, y: ud.x };
  const relativo = restar(medioOrigen, medioDestino);
  const gapFirmado = productoPunto(relativo, normal);
  const gap = Math.abs(gapFirmado);
  const offsetParalelo = productoPunto(relativo, ud);
  const maximo = Math.max(separacionMm, anchoCorteMm) + toleranciaMm;
  if (
    gap < anchoCorteMm - toleranciaMm ||
    (limitarAlcance && gap > maximo) ||
    Math.abs(offsetParalelo) > toleranciaMm
  )
    return null;
  const signo = gapFirmado >= 0 ? 1 : -1;
  return {
    x: redondear(
      -offsetParalelo * ud.x + (signo * anchoCorteMm - gapFirmado) * normal.x,
    ),
    y: redondear(
      -offsetParalelo * ud.y + (signo * anchoCorteMm - gapFirmado) * normal.y,
    ),
  };
}

function layoutCommonLineSeguro(
  placements: PlacementTrabajoNestingOpenNest[],
  input: NestingIrregularOpenNestData,
  tramos: TramoCommonLineTrabajo[],
  movidos: Set<number>,
): boolean {
  const tolerancia = input.commonLine?.toleranciaMm ?? 0.1;
  const pares = new Set(
    tramos.map((tramo) => {
      const [a, b] = tramo.segmentosOrigen;
      return [`${a.piezaId}:${a.copia}`, `${b.piezaId}:${b.copia}`]
        .sort()
        .join('|');
    }),
  );
  const minX = input.placa.margenMm;
  const minY = input.placa.margenMm;
  const maxX = input.placa.anchoMm - input.placa.margenMm;
  const maxY = input.placa.altoMm - input.placa.margenMm;
  for (const index of movidos) {
    const placement = placements[index];
    if (
      placement.contorno.some(
        (punto) =>
          punto.x < minX - tolerancia ||
          punto.y < minY - tolerancia ||
          punto.x > maxX + tolerancia ||
          punto.y > maxY + tolerancia,
      )
    )
      return false;
  }
  for (const a of movidos) {
    for (let b = 0; b < placements.length; b += 1) {
      if (a === b || movidos.has(b)) continue;
      const pa = placements[a];
      const pb = placements[b];
      if (pa.placa !== pb.placa) continue;
      const cajaA = limites(pa.contorno);
      const cajaB = limites(pb.contorno);
      if (!cajasCercanas(cajaA, cajaB, input.separacionMm + tolerancia))
        continue;
      if (areaInterseccion(pa, pb) > TOLERANCIA_AREA_MM2) return false;
      const distanciaMinima = distanciaPlacements(pa, pb);
      if (distanciaMinima >= input.separacionMm - tolerancia) continue;
      if (!pares.has(clavePar(pa, pb))) return false;
      if (
        distanciaMinima <
        (input.commonLine?.anchoCorteMm ?? input.separacionMm) - tolerancia
      )
        return false;
    }
  }
  return true;
}

function segmentosPlacement(
  placement: PlacementTrabajoNestingOpenNest,
  placementIndex: number,
  longitudMinimaMm: number,
): Segmento[] {
  return placement.contorno.flatMap((inicio, indiceSegmento) => {
    const fin =
      placement.contorno[(indiceSegmento + 1) % placement.contorno.length];
    const longitud = distancia(inicio, fin);
    return longitud >= longitudMinimaMm
      ? [
          {
            placementIndex,
            piezaId: placement.piezaId,
            copia: placement.copia,
            placa: placement.placa,
            indiceSegmento,
            inicio,
            fin,
            longitud,
          },
        ]
      : [];
  });
}

function segmentoActual(
  placements: PlacementTrabajoNestingOpenNest[],
  placementIndex: number,
  indiceSegmento: number,
): Segmento | null {
  const placement = placements[placementIndex];
  if (
    !placement ||
    indiceSegmento < 0 ||
    indiceSegmento >= placement.contorno.length
  )
    return null;
  const inicio = placement.contorno[indiceSegmento];
  const fin =
    placement.contorno[(indiceSegmento + 1) % placement.contorno.length];
  return {
    placementIndex,
    piezaId: placement.piezaId,
    copia: placement.copia,
    placa: placement.placa,
    indiceSegmento,
    inicio,
    fin,
    longitud: distancia(inicio, fin),
  };
}

function alinearOrientacion(a: Segmento, b: Segmento, tolerancia: number) {
  const directa = distancia(a.inicio, b.inicio) + distancia(a.fin, b.fin);
  const inversa = distancia(a.inicio, b.fin) + distancia(a.fin, b.inicio);
  const elegida =
    directa <= inversa
      ? { aInicio: a.inicio, aFin: a.fin, bInicio: b.inicio, bFin: b.fin }
      : { aInicio: a.inicio, aFin: a.fin, bInicio: b.fin, bFin: b.inicio };
  const d1 = distancia(elegida.aInicio, elegida.bInicio);
  const d2 = distancia(elegida.aFin, elegida.bFin);
  return Math.abs(d1 - d2) <= tolerancia ? elegida : null;
}

function trasladarPlacement(
  placement: PlacementTrabajoNestingOpenNest,
  delta: PuntoTrabajoGeometria,
): PlacementTrabajoNestingOpenNest {
  const trasladar = (anillo: AnilloTrabajoNesting) =>
    anillo.map((punto) => ({
      x: redondear(punto.x + delta.x),
      y: redondear(punto.y + delta.y),
    }));
  return {
    ...placement,
    traslacion: {
      x: redondear(placement.traslacion.x + delta.x),
      y: redondear(placement.traslacion.y + delta.y),
    },
    contorno: trasladar(placement.contorno),
    huecos: placement.huecos.map(trasladar),
  };
}

function clonarPlacement(
  placement: PlacementTrabajoNestingOpenNest,
): PlacementTrabajoNestingOpenNest {
  return {
    ...placement,
    traslacion: { ...placement.traslacion },
    contorno: placement.contorno.map((punto) => ({ ...punto })),
    huecos: placement.huecos.map((hueco) =>
      hueco.map((punto) => ({ ...punto })),
    ),
  };
}

function areaInterseccion(
  a: PlacementTrabajoNestingOpenNest,
  b: PlacementTrabajoNestingOpenNest,
) {
  try {
    const intersection = polygonClipping.intersection(
      aPoligono(a),
      aPoligono(b),
    );
    return intersection.reduce(
      (total, polygon) =>
        total +
        polygon.reduce(
          (subtotal, ring, index) =>
            subtotal + Math.abs(areaFirmadaPares(ring)) * (index ? -1 : 1),
          0,
        ),
      0,
    );
  } catch {
    return Number.POSITIVE_INFINITY;
  }
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

function distanciaPlacements(
  a: PlacementTrabajoNestingOpenNest,
  b: PlacementTrabajoNestingOpenNest,
) {
  let best = Number.POSITIVE_INFINITY;
  for (const ringA of [a.contorno, ...a.huecos]) {
    for (const ringB of [b.contorno, ...b.huecos]) {
      for (let ia = 0; ia < ringA.length; ia += 1) {
        const a1 = ringA[ia];
        const a2 = ringA[(ia + 1) % ringA.length];
        for (let ib = 0; ib < ringB.length; ib += 1) {
          const b1 = ringB[ib];
          const b2 = ringB[(ib + 1) % ringB.length];
          best = Math.min(best, distanciaSegmentos(a1, a2, b1, b2));
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
) {
  return Math.min(
    distanciaPuntoSegmento(a, c, d),
    distanciaPuntoSegmento(b, c, d),
    distanciaPuntoSegmento(c, a, b),
    distanciaPuntoSegmento(d, a, b),
  );
}

function distanciaPuntoSegmento(
  p: PuntoTrabajoGeometria,
  a: PuntoTrabajoGeometria,
  b: PuntoTrabajoGeometria,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const divisor = dx * dx + dy * dy;
  if (divisor <= Number.EPSILON) return distancia(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / divisor),
  );
  return distancia(p, { x: a.x + t * dx, y: a.y + t * dy });
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
  reach: number,
) {
  return !(
    a.maxX + reach < b.minX ||
    b.maxX + reach < a.minX ||
    a.maxY + reach < b.minY ||
    b.maxY + reach < a.minY
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

function unitario(a: PuntoTrabajoGeometria, b: PuntoTrabajoGeometria) {
  const length = distancia(a, b);
  return length > Number.EPSILON
    ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length }
    : null;
}

function puntoMedio(a: PuntoTrabajoGeometria, b: PuntoTrabajoGeometria) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function restar(a: PuntoTrabajoGeometria, b: PuntoTrabajoGeometria) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function productoPunto(a: PuntoTrabajoGeometria, b: PuntoTrabajoGeometria) {
  return a.x * b.x + a.y * b.y;
}

function distancia(a: PuntoTrabajoGeometria, b: PuntoTrabajoGeometria) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function redondearPunto(punto: PuntoTrabajoGeometria) {
  return { x: redondear(punto.x), y: redondear(punto.y) };
}

function redondear(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function claveInstancia(placement: PlacementTrabajoNestingOpenNest) {
  return `${placement.piezaId}:${placement.copia}`;
}

function clavePar(
  a: PlacementTrabajoNestingOpenNest,
  b: PlacementTrabajoNestingOpenNest,
) {
  return [claveInstancia(a), claveInstancia(b)].sort().join('|');
}

function claveReferencia(referencia: {
  piezaId: string;
  copia: number;
  indiceSegmento: number;
}) {
  return `${referencia.piezaId}:${referencia.copia}:${referencia.indiceSegmento}`;
}

function claveSegmento(segmento: Segmento) {
  return claveReferencia(segmento);
}
