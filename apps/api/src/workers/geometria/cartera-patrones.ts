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
} from '../colas';

type Patron = { counts: number[]; origen: string; placements: Placement[] };
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
  options: { plazo: number; signal?: AbortSignal },
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
  const pool = new Map<string, Patron>();
  function add(ps: Placement[], origen: string) {
    const counts = piezas.map(
      (p) => ps.filter((x) => x.pieceId === p.id).length,
    );
    if (!ps.length || counts.some((v, i) => v > piezas[i].cantidad)) return;
    const key = counts.join(',');
    if (!pool.has(key)) pool.set(key, { counts, origen, placements: ps });
  }
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
    for (let b = 0; b < r.substrates.length; b++)
      add(
        r.placements.filter((p) => p.substrateIndex === b),
        origen,
      );
  }
  harvest(grid(piezas.map((p) => p.cantidad)), 'lote-mixto');
  for (const p of piezas) {
    options.signal?.throwIfAborted();
    const r = nestearPatronRepetido({
      pieza: p,
      cantidad: p.cantidad,
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
  const util = (sustrato.widthMm - 2 * m) * (sustrato.heightMm - 2 * m);
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
  for (let iter = 0; iter < 9000 && Date.now() < options.plazo; iter++) {
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
  const copias = new Map<string, number>();
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
    for (let j = 0; j < t.repeticiones; j++, placa++)
      for (const p of cartera[t.patron].placements) {
        const pieza = input.piezas.find((x) => x.id === p.pieceId)!;
        const meta = p.meta as
          | { rotacionGrados?: number; traslacion?: PuntoTrabajoGeometria }
          | undefined;
        const rotacionGrados = meta?.rotacionGrados ?? (p.rotated ? 90 : 0),
          rad = (rotacionGrados * Math.PI) / 180;
        const rotate = (ps: PuntoTrabajoGeometria[]) =>
          ps.map((q) => ({
            x: q.x * Math.cos(rad) - q.y * Math.sin(rad),
            y: q.x * Math.sin(rad) + q.y * Math.cos(rad),
          }));
        const rot = rotate(pieza.contorno);
        const traslacion = meta?.traslacion ?? {
          x: p.xMm - Math.min(...rot.map((q) => q.x)),
          y: p.yMm - Math.min(...rot.map((q) => q.y)),
        };
        const move = (ps: PuntoTrabajoGeometria[]) =>
          ps.map((q) => ({ x: q.x + traslacion.x, y: q.y + traslacion.y }));
        const copia = copias.get(p.pieceId) ?? 0;
        copias.set(p.pieceId, copia + 1);
        placements.push({
          piezaId: p.pieceId,
          copia,
          placa,
          rotacionGrados,
          traslacion,
          contorno: move(rot),
          huecos: (pieza.huecos ?? []).map((h) => move(rotate(h))),
        });
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
