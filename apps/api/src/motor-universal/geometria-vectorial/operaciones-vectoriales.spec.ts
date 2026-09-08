import { analizarSvgFabricacion } from './svg-parser';
import {
  adjuntarOperacionesGuardadas,
  longitudOperacion,
  transformarOperaciones,
  type OperacionVectorial,
} from './operaciones-vectoriales';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  crearSolucionNestingIrregular,
} from './contrato-nesting';
import type { NestingIrregularResult } from './tipos';

const hendido: OperacionVectorial = {
  entidadId: 'h1',
  capa: 'HENDIDO',
  tipo: 'HENDIDO',
  cerrada: false,
  puntos: [
    { x: 10, y: 10 },
    { x: 10, y: 90 },
  ],
};
const corte: OperacionVectorial = {
  ...hendido,
  entidadId: 'c1',
  tipo: 'CORTE_INTERIOR',
  puntos: [
    { x: 20, y: 20 },
    { x: 60, y: 20 },
  ],
};
describe('operaciones conservadas junto al layout', () => {
  it('cuenta una línea abierta una vez, separa hendido de corte y no altera la ocupación ni la geometría cacheada', () => {
    const g = analizarSvgFabricacion({
      svg: '<svg viewBox="0 0 100 100"><path d="M0 0H100V100H0Z"/></svg>',
      anchoFinalMm: 100,
    }).geometria;
    const conOps = adjuntarOperacionesGuardadas(g, {
      procedencia: {},
      operaciones: [hendido, corte],
    });
    expect(longitudOperacion(hendido)).toBe(80);
    expect(conOps.perimetroTotalMm).toBe(440);
    expect(g.perimetroTotalMm).toBe(400);
    expect(conOps.areaTotalMm2).toBe(10000);
    expect(conOps.piezas[0].contornos).toEqual(g.piezas[0].contornos);
    expect(conOps.hashFuente).not.toBe(g.hashFuente);
  });
  it('aplica el giro y la traslación de la pieza a sus operaciones sin cerrar el trazo', () => {
    const [h] = transformarOperaciones([hendido], 90, { x: 150, y: 5 });
    expect(h.puntos[0].x).toBeCloseTo(140);
    expect(h.puntos[0].y).toBeCloseTo(15);
    expect(h.puntos[1].x).toBeCloseTo(60);
    expect(h.puntos[1].y).toBeCloseTo(15);
    expect(h.cerrada).toBe(false);
    expect(hendido.puntos[0]).toEqual({ x: 10, y: 10 });
  });
  it('enriquece el plan neutral una vez y rechaza dividir una pieza con operaciones', () => {
    const g = adjuntarOperacionesGuardadas(
      analizarSvgFabricacion({
        svg: '<svg viewBox="0 0 100 100"><path d="M0 0H100V100H0Z"/></svg>',
        anchoFinalMm: 100,
      }).geometria,
      { procedencia: {}, operaciones: [hendido, corte] },
    );
    const problema = crearProblemaNestingIrregular({
      anchoPlacaMm: 300,
      altoPlacaMm: 300,
      demandas: crearDemandasDesdeGeometriaVectorial({
        geometria: g,
        cantidad: 1,
      }),
    });
    const p = {
      pieceId: g.piezas[0].id,
      copyIndex: 0,
      substrateIndex: 0,
      xMm: 50,
      yMm: 5,
      rotacion: 90,
      anchoMm: 100,
      altoMm: 100,
      contornos: [],
    };
    const r = {
      algorithm: 'irregular-2d-bottom-left-v1',
      placements: [p],
      perimetroCorteMm: 400,
    } as NestingIrregularResult;
    const s = crearSolucionNestingIrregular(problema, r);
    expect(s.resultado.placements[0].operaciones?.[0].puntos[0].x).toBeCloseTo(
      140,
    );
    expect(s.resultado.perimetroCorteMm).toBe(440);
    expect(
      crearSolucionNestingIrregular(problema, s.resultado).resultado
        .perimetroCorteMm,
    ).toBe(440);
    const segmentacion = {
      piezaOrigenId: p.pieceId,
      indice: 0,
      total: 2,
      origenXmm: 0,
      origenYmm: 0,
      unionesIds: [],
    };
    expect(() =>
      crearSolucionNestingIrregular(problema, {
        ...s.resultado,
        placements: [{ ...s.resultado.placements[0], segmentacion }],
      }),
    ).toThrow(/división/);
  });
});
