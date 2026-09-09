import { nestGrid2DMulti } from '../../productos-servicios/nesting/algorithms/grid-2d-multi';
import { nestearPatronRepetido } from '../../motor-universal/geometria-vectorial/nesting-patron-repetido';
import type {
  Placement,
  SheetSubstrate,
} from '../../productos-servicios/nesting/types';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PuntoTrabajoGeometria,
  ResultadoCommonLineTrabajo,
} from '../colas';

export type Patron = {
  counts: number[];
  origen: string;
  placements: Placement[];
  commonLine?: ResultadoCommonLineTrabajo;
};
export type SeleccionPatrones = {
  seleccion: Array<{ patron: number; repeticiones: number }>;
  optimoPlacasDentroCartera: boolean;
  optimoPatronesDentroCartera: boolean;
};
const area = (ps: PuntoTrabajoGeometria[]) =>
  Math.abs(
    ps.reduce((s, p, i) => {
      const q = ps[(i + 1) % ps.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0),
  ) / 2;

/** Cartera determinista: lotes mixtos, filas entrelazadas y variantes sin
 * excedentes. El selector entero recibe sólo cantidades, nunca geometría. */
export async function generarCarteraPatrones(
  input: NestingIrregularOpenNestData,
  options: {
    plazo: number;
    signal?: AbortSignal;
    semillas?: Patron[];
    maxIteraciones?: number;
  },
) {
  options.signal?.throwIfAborted();
  const piezas = input.piezas.map((p) => ({
    ...p,
    anchoMm:
      Math.max(...p.contorno.map((q) => q.x)) -
      Math.min(...p.contorno.map((q) => q.x)),
    altoMm:
      Math.max(...p.contorno.map((q) => q.y)) -
      Math.min(...p.contorno.map((q) => q.y)),
    areaMm2:
      area(p.contorno) - (p.huecos ?? []).reduce((s, h) => s + area(h), 0),
    perimetroMm: 0,
    contornos: [
      { puntos: p.contorno, esHueco: false },
      ...(p.huecos ?? []).map((puntos) => ({ puntos, esHueco: true })),
    ],
  }));
  const m = input.placa.margenMm;
  const sustrato: SheetSubstrate = {
    kind: 'sheet',
    widthMm: input.placa.anchoMm,
    heightMm: input.placa.altoMm,
    margins: { leftMm: m, rightMm: m, topMm: m, bottomMm: m },
  };
  const allowRotation = piezas.every((p) => p.rotaciones % 4 === 0);
  const util = (sustrato.widthMm - 2 * m) * (sustrato.heightMm - 2 * m);
  const pool = new Map<string, Patron>();
  function add(
    ps: Placement[],
    origen: string,
    commonLine?: ResultadoCommonLineTrabajo,
  ) {
    const counts = piezas.map(
      (p) => ps.filter((x) => x.pieceId === p.id).length,
    );
    if (!ps.length || counts.some((v, i) => v > piezas[i].cantidad)) return;
    const key = counts.join(',');
    if (!pool.has(key))
      pool.set(key, {
        counts,
        origen,
        placements: ps,
        ...(commonLine ? { commonLine } : {}),
      });
  }
  // Primero los patrones ya fabricables. Nunca se los desplaza por otra
  // distribución con iguales cantidades pero sin sus recorridos compartidos.
  for (const patron of options.semillas ?? [])
    add(patron.placements, patron.origen, patron.commonLine);
  function grid(q: number[]) {
    return nestGrid2DMulti(
      piezas.map((p, i) => ({
        id: p.id,
        widthMm: p.anchoMm,
        heightMm: p.altoMm,
        quantity: q[i],
      })),
      sustrato,
      {
        allowRotation,
        separationHMm: input.separacionMm,
        separationVMm: input.separacionMm,
      },
    );
  }
  function harvest(r: ReturnType<typeof grid>, origen: string) {
    const placas = new Map<number, Placement[]>();
    for (const p of r.placements) {
      const indice = p.substrateIndex ?? 0;
      const ps = placas.get(indice) ?? [];
      ps.push(p);
      placas.set(indice, ps);
    }
    for (const ps of placas.values()) add(ps, origen);
  }
  harvest(grid(piezas.map((p) => p.cantidad)), 'lote-mixto');
  for (const p of piezas) {
    options.signal?.throwIfAborted();
    const r = nestearPatronRepetido({
      pieza: p,
      // Sólo se cosecha la primera placa. No expandir toda la tirada para
      // descartarla luego: el área neta da una cota segura de su capacidad.
      cantidad: Math.min(p.cantidad, Math.max(1, Math.floor(util / p.areaMm2))),
      sustrato,
      angulosPermitidos: [0, 90, 180, 270].filter((a) =>
        Number.isInteger((a * p.rotaciones) / 360),
      ),
      separacionMm: input.separacionMm,
    });
    if (!r) continue;
    const ps = r.placements.filter((x) => x.substrateIndex === 0);
    for (let n = 1; n <= ps.length; n++)
      add(ps.slice(0, n), 'filas-alternadas');
  }
  let seed = 71241;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const maxima = piezas.map((p) =>
    Math.min(
      p.cantidad,
      Math.max(1, Math.floor(util / (p.anchoMm * p.altoMm))),
    ),
  );
  const mayor = piezas.reduce(
    (best, p, i) => (p.areaMm2 > piezas[best].areaMm2 ? i : best),
    0,
  );
  for (
    let iter = 0;
    iter < (options.maxIteraciones ?? 9000) && Date.now() < options.plazo;
    iter++
  ) {
    if (iter % 100 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      options.signal?.throwIfAborted();
    }
    const q = piezas.map((p, i) =>
      random() < 0.18 ? 0 : Math.floor(random() * (maxima[i] + 1)),
    );
    if (iter % 2 === 0) q[mayor] = maxima[mayor];
    harvest(grid(q), 'lote-mixto');
  }
  for (const t of [...pool.values()]) {
    // Recortar piezas requiere recortar también las referencias Common Line.
    // Los patrones con operaciones se reutilizan completos en esta generación.
    if (t.commonLine?.aplicado) continue;
    const indices = piezas.map((_, i) => i).filter((i) => t.counts[i] > 0);
    const grande = indices.reduce(
      (best, i) => (piezas[i].areaMm2 > piezas[best].areaMm2 ? i : best),
      indices[0],
    );
    const rep = Math.floor(piezas[grande].cantidad / t.counts[grande]);
    if (rep < 2) continue;
    const left = piezas.map((p, i) =>
      Math.min(t.counts[i], Math.floor(p.cantidad / rep)),
    );
    add(
      t.placements.filter(
        (p) => left[piezas.findIndex((x) => x.id === p.pieceId)]-- > 0,
      ),
      'equilibrio-demanda',
    );
  }
  return [...pool.values()];
}

export function materializarPatrones(
  input: NestingIrregularOpenNestData,
  cartera: Patron[],
  plan: SeleccionPatrones,
): Omit<NestingIrregularOpenNestResult, 'validacion'> {
  const placements: NestingIrregularOpenNestResult['placements'] = [];
  const tramos: ResultadoCommonLineTrabajo['tramos'] = [];
  const copias = new Map<string, number>();
  const piezas = new Map(input.piezas.map((p) => [p.id, p]));
  const geometriaGirada = new Map<
    string,
    {
      contorno: PuntoTrabajoGeometria[];
      huecos: PuntoTrabajoGeometria[][];
      minX: number;
      minY: number;
    }
  >();
  let puntosGuardados = 0;
  const preparar = (p: Placement) => {
    const pieza = piezas.get(p.pieceId);
    if (!pieza) throw new Error('El patrón contiene una pieza desconocida.');
    const meta = p.meta as
      | {
          rotacionGrados?: number;
          traslacion?: PuntoTrabajoGeometria;
          copia?: number;
        }
      | undefined;
    const rotacionGrados = meta?.rotacionGrados ?? (p.rotated ? 90 : 0);
    const clave = JSON.stringify([pieza.id, rotacionGrados]);
    let rot = geometriaGirada.get(clave);
    if (!rot) {
      const rad = (rotacionGrados * Math.PI) / 180,
        cos = Math.cos(rad),
        sin = Math.sin(rad);
      const girar = (ps: PuntoTrabajoGeometria[]) =>
        ps.map((q) => ({ x: q.x * cos - q.y * sin, y: q.x * sin + q.y * cos }));
      const contorno = girar(pieza.contorno);
      rot = {
        contorno,
        huecos: (pieza.huecos ?? []).map(girar),
        minX: Math.min(...contorno.map((q) => q.x)),
        minY: Math.min(...contorno.map((q) => q.y)),
      };
      const puntos =
        rot.contorno.length + rot.huecos.reduce((n, h) => n + h.length, 0);
      if (puntosGuardados + puntos <= 100_000) {
        geometriaGirada.set(clave, rot);
        puntosGuardados += puntos;
      }
    }
    const traslacion = meta?.traslacion ?? {
      x: p.xMm - rot.minX,
      y: p.yMm - rot.minY,
    };
    // Misma precisión del runner y las exportaciones. Preparar una vez por
    // posición del patrón; las copias conservan sus propios objetos editables.
    const mover = (ps: PuntoTrabajoGeometria[]) =>
      ps.map((q) => ({
        x: Math.round((q.x + traslacion.x) * 1e6) / 1e6,
        y: Math.round((q.y + traslacion.y) * 1e6) / 1e6,
      }));
    return {
      piezaId: p.pieceId,
      rotacionGrados,
      traslacion,
      contorno: mover(rot.contorno),
      huecos: rot.huecos.map(mover),
      copiaOriginal: meta?.copia,
    };
  };
  const clonar = (ps: PuntoTrabajoGeometria[]) => ps.map((p) => ({ ...p }));
  let placa = 0;
  if (!plan.seleccion.length)
    throw new Error('La selección no contiene patrones.');
  for (const t of [...plan.seleccion].sort(
    (a, b) => b.repeticiones - a.repeticiones,
  )) {
    if (
      !Number.isSafeInteger(t.repeticiones) ||
      t.repeticiones < 1 ||
      !cartera[t.patron] ||
      placa + t.repeticiones > input.placa.maxPlacas
    )
      throw new Error('Repeticiones inválidas.');
    const preparados = cartera[t.patron].placements.map(preparar);
    for (let j = 0; j < t.repeticiones; j++, placa++) {
      const copiasLocales = new Map<string, number>();
      for (const p of preparados) {
        const copia = copias.get(p.piezaId) ?? 0;
        copias.set(p.piezaId, copia + 1);
        copiasLocales.set(`${p.piezaId}:${p.copiaOriginal ?? copia}`, copia);
        placements.push({
          piezaId: p.piezaId,
          copia,
          placa,
          rotacionGrados: p.rotacionGrados,
          traslacion: { ...p.traslacion },
          contorno: t.repeticiones === 1 ? p.contorno : clonar(p.contorno),
          huecos: t.repeticiones === 1 ? p.huecos : p.huecos.map(clonar),
        });
      }
      for (const tramo of cartera[t.patron].commonLine?.tramos ?? []) {
        const segmentosOrigen = tramo.segmentosOrigen.map((s) => {
          const copia = copiasLocales.get(`${s.piezaId}:${s.copia}`);
          if (copia === undefined)
            throw new Error('Referencia de corte compartido desconocida.');
          return { ...s, copia };
        }) as typeof tramo.segmentosOrigen;
        tramos.push({
          ...tramo,
          id: `cl-${placa}-${tramos.length}`,
          placa,
          segmentosOrigen,
        });
      }
    }
  }
  const cantidad = input.piezas.reduce((s, p) => s + p.cantidad, 0);
  if (
    placements.length !== cantidad ||
    input.piezas.some((p) => copias.get(p.id) !== p.cantidad)
  )
    throw new Error('El plan no respeta la demanda exacta.');
  return {
    schemaVersion: 1,
    algoritmo: 'grafonest-baseline-v1',
    versionMotor: 'grafonest-patrones-1',
    motor: input.motor,
    cantidadSolicitada: cantidad,
    cantidadColocada: placements.length,
    placasUsadas: placa,
    duracionMs: 0,
    calidadSolucion: 'OPTIMIZADA',
    placements,
    ...(input.commonLine?.habilitado && tramos.length
      ? {
          commonLine: {
            ...input.commonLine,
            habilitado: true as const,
            aplicado: true,
            longitudCompartidaMm: tramos.reduce((s, t) => s + t.longitudMm, 0),
            ahorroRecorridoMm: tramos.reduce((s, t) => s + t.longitudMm, 0),
            tramos,
          },
        }
      : {}),
    planPatrones: {
      version: 1,
      patronesEvaluados: cartera.length,
      patronesElegidos: plan.seleccion.length,
      minimoPlacasEnCartera: plan.optimoPlacasDentroCartera,
      minimoPatronesEnCartera: plan.optimoPatronesDentroCartera,
      minimoGeometricoDemostrado: false,
    },
  };
}
