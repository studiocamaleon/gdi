import {
  simularRollo,
  type EntradaSimulacionRollo,
  type PiezaSimulacion,
} from './simulacion-rollo';
import {
  extraerPiezasRollo,
  identidadMaterialRollo,
} from './simulacion-nesting.service';
import { prepararDatosSnapshot } from '../../prisma/snapshots.extension';
import { evaluateRollLayoutForConfiguredAlgorithm } from '../../motor-universal/nesting-dispatcher';
import { evaluateGranFormatoSequentialRollLayout } from '../../productos-servicios/nesting/algorithms/secuencial-rollo';

const pieza = (
  id: string,
  anchoMm: number,
  altoMm: number,
  permiteRotar = true,
): PiezaSimulacion => ({
  id,
  trabajo: 0,
  etiqueta: id,
  anchoMm,
  altoMm,
  permiteRotar,
  panel: null,
  paneles: null,
  solapeInicioMm: 0,
  solapeFinMm: 0,
});
const entrada = (piezas: PiezaSimulacion[]): EntradaSimulacionRollo => ({
  piezas,
  anchos: [1060, 1370, 1520],
  margenes: { izquierda: 10, derecha: 10, inicio: 100, fin: 100 },
  separacionMm: 5,
});

it.each(['auto', 'shelf-rollo', 'maxrects-rollo', 'secuencial-rollo'] as const)(
  'reproduce posiciones y consumo de la OT con el motor %s',
  (algoritmo) => {
    const input = entrada([
      pieza('OT-A-1', 280, 280),
      pieza('OT-A-2', 280, 280),
      pieza('OT-B', 180, 430, false),
      pieza('OT-C', 650, 120),
    ]);
    input.anchos = [600];
    input.algoritmo = algoritmo;
    const medidas = input.piezas.map((p) => ({
      anchoMm: p.anchoMm,
      altoMm: p.altoMm,
      cantidad: 1,
      allowRotation: p.permiteRotar,
    }));
    const cotizacion = {
      medidas,
      printableWidthMm: 580,
      marginLeftMm: 10,
      marginStartMm: 100,
      marginEndMm: 100,
      separacionHorizontalMm: 5,
      separacionVerticalMm: 5,
      permitirRotacion: true,
    };
    const ot =
      algoritmo === 'secuencial-rollo'
        ? evaluateGranFormatoSequentialRollLayout(cotizacion)
        : evaluateRollLayoutForConfiguredAlgorithm(cotizacion, algoritmo)
            ?.result;
    expect(ot).toBeTruthy();
    const cola = simularRollo(input).alternativas[0];
    expect(cola.largoMm).toBe(ot!.consumedLengthMm);
    expect(
      cola.ubicaciones.map((p) => [
        p.xMm,
        p.yMm,
        p.anchoMm,
        p.altoMm,
        p.rotada,
      ]),
    ).toEqual(
      ot!.placements.map((p) => [
        p.centerXMm - p.widthMm / 2,
        p.centerYMm - p.heightMm / 2,
        p.widthMm,
        p.heightMm,
        p.rotated,
      ]),
    );
    expect(cola.ubicaciones.find((p) => p.piezaId === 'OT-B')?.rotada).toBe(
      false,
    );
    expect(cola.ubicaciones.find((p) => p.piezaId === 'OT-C')?.rotada).toBe(
      true,
    );
  },
);

it('consolida 200 piezas como en cotización, sin repetir cabeceras, pies ni demasías por OT', () => {
  const input = entrada(
    Array.from({ length: 200 }, (_, i) =>
      pieza(`OT-${i < 100 ? 'A' : 'B'}-${i}`, 280, 280),
    ),
  );
  input.anchos = [600];
  input.margenes = {
    izquierda: 17.5,
    derecha: 17.5,
    inicio: 102.5,
    fin: 102.5,
  };
  input.algoritmo = 'maxrects-rollo';
  const juntas = simularRollo(input).alternativas[0];
  expect(juntas.ubicaciones).toHaveLength(200);
  expect(juntas.largoMm).toBe(28700);
  expect(
    [...new Set(juntas.ubicaciones.map((p) => p.xMm))].sort((a, b) => a - b),
  ).toEqual([17.5, 302.5]);
});

it('distingue la separación horizontal de la vertical', () => {
  const input = entrada(
    Array.from({ length: 4 }, (_, i) => pieza(String(i), 280, 280, false)),
  );
  input.anchos = [600];
  input.algoritmo = 'shelf-rollo';
  input.separacionMm = 5;
  input.separacionVerticalMm = 30;
  const r = simularRollo(input).alternativas[0];
  expect(r.largoMm).toBe(790); // 100 + 280 + 30 + 280 + 100
  expect(
    [...new Set(r.ubicaciones.map((p) => p.xMm))].sort((a, b) => a - b),
  ).toEqual([10, 295]);
});

it('conserva todas las piezas, márgenes, separaciones y no solapa rectángulos', () => {
  const input = entrada(
    Array.from({ length: 30 }, (_, i) =>
      pieza(String(i), 200 + i * 10, 350 + i * 15, i % 2 === 0),
    ),
  );
  const r = simularRollo(input);
  expect(r.alternativas).toHaveLength(3);
  for (const a of r.alternativas) {
    expect(new Set(a.ubicaciones.map((p) => p.piezaId)).size).toBe(
      input.piezas.length,
    );
    expect(a.aprovechamientoPct).toBeLessThanOrEqual(100);
    for (const p of a.ubicaciones) {
      expect(p.xMm).toBeGreaterThanOrEqual(10);
      expect(p.yMm).toBeGreaterThanOrEqual(100);
      expect(p.xMm + p.anchoMm).toBeLessThanOrEqual(a.anchoMm - 10 + 0.001);
      expect(p.yMm + p.altoMm).toBeLessThanOrEqual(a.largoMm - 100 + 0.001);
      const original = input.piezas.find((i) => i.id === p.piezaId)!;
      if (!original.permiteRotar) expect(p.rotada).toBe(false);
      for (const q of a.ubicaciones.filter((q) => q.piezaId !== p.piezaId)) {
        expect(
          p.xMm + p.anchoMm + 4.999 <= q.xMm ||
            q.xMm + q.anchoMm + 4.999 <= p.xMm ||
            p.yMm + p.altoMm + 4.999 <= q.yMm ||
            q.yMm + q.altoMm + 4.999 <= p.yMm,
        ).toBe(true);
      }
    }
  }
  expect(r.alternativas.map((a) => a.superficieM2)).toEqual(
    r.alternativas.map((a) => a.superficieM2).sort((a, b) => a - b),
  );
  expect(simularRollo(input)).toEqual(r);
});

it('rota sólo la pieza autorizada y descarta anchos imposibles sin recortar ni panelizar', () => {
  const input = entrada([
    pieza('fija', 1200, 600, false),
    pieza('giratoria', 1800, 450),
  ]);
  const r = simularRollo(input);
  expect(r.descartados.map((a) => a.anchoMm)).toEqual([1060]);
  for (const a of r.alternativas) {
    expect(a.ubicaciones.find((p) => p.piezaId === 'fija')?.rotada).toBe(false);
    expect(a.ubicaciones.find((p) => p.piezaId === 'giratoria')?.rotada).toBe(
      true,
    );
  }
});

it('reporta selección que no cabe y limita el trabajo máximo sin devolver resultados parciales', () => {
  expect(
    simularRollo(entrada([pieza('enorme', 2000, 3000, false)])).alternativas,
  ).toHaveLength(0);
  expect(() =>
    simularRollo(
      entrada(Array.from({ length: 1001 }, (_, i) => pieza(String(i), 1, 1))),
    ),
  ).toThrow('1000');
  expect(() => simularRollo(entrada([pieza('mal', NaN, 1)]))).toThrow(
    'válidas',
  );
});

const geometria = () => ({
  nestingResult: {
    algorithm: 'maxrects-rollo',
    visualConfig: {
      allowRotation: false,
      margins: { leftMm: 10 },
      pieceBleedMm: 2,
      spacing: { horizontalMm: 4, verticalMm: 5 },
    },
    placements: [
      {
        pieceId: 'p',
        widthMm: 1170,
        heightMm: 1600,
        rotated: false,
        panelIndex: 1,
        panelCount: 2,
        overlapStartMm: 0,
        overlapEndMm: 20,
      },
      {
        pieceId: 'p',
        widthMm: 1600,
        heightMm: 1170,
        rotated: true,
        panelIndex: 2,
        panelCount: 2,
        overlapStartMm: 20,
        overlapEndMm: 0,
      },
    ],
  },
});
it('lee paneles, deshace sólo la rotación del acomodo previo y mantiene solapes', () => {
  const r = extraerPiezasRollo(geometria(), 0, 'OT-0050');
  expect(r.piezas).toHaveLength(2);
  expect(
    r.piezas.map((p) => [
      p.anchoMm,
      p.altoMm,
      p.permiteRotar,
      p.solapeInicioMm,
      p.solapeFinMm,
    ]),
  ).toEqual([
    [1170, 1600, false, 0, 20],
    [1170, 1600, false, 20, 0],
  ]);
  expect(r.visual.pieceBleedMm).toBe(2);
});

it('lee geometría diferida con el mismo formato que las OT', () => {
  const g = geometria();
  g.nestingResult.placements = Array.from(
    { length: 500 },
    () => g.nestingResult.placements[0],
  );
  const guardado = prepararDatosSnapshot('OrdenTrabajoItem', {
    trazabilidadSnapshotJson: g,
  });
  expect(guardado.trazabilidadSnapshotJson).toHaveProperty(
    '__grafo_geometrias_v2',
  );
  expect(
    extraerPiezasRollo(guardado.trazabilidadSnapshotJson, 0, 'OT').piezas,
  ).toHaveLength(500);
});

it('no inventa permiso de rotación ni rectángulos de un layout irregular', () => {
  const g = geometria();
  expect(() =>
    extraerPiezasRollo(
      { nestingResult: { ...g.nestingResult, visualConfig: {} } },
      0,
      'OT',
    ),
  ).toThrow('rotación');
  expect(() =>
    extraerPiezasRollo(
      {
        nestingResult: {
          ...g.nestingResult,
          algorithm: 'irregular-2d-bottom-left-v1',
        },
      },
      0,
      'OT',
    ),
  ).toThrow('rectangulares');
});

it('compara material independientemente del ancho, manteniendo acabado y espesor', () => {
  const a = {
    anchoMm: 1370,
    acabado: 'Brillante',
    largoRolloMm: 50000,
    espesorMm: 0.1,
  };
  expect(identidadMaterialRollo(a)).toBe(
    identidadMaterialRollo({ ...a, anchoMm: 1060, largoRolloMm: 25000 }),
  );
  expect(identidadMaterialRollo(a)).not.toBe(
    identidadMaterialRollo({ ...a, acabado: 'Mate' }),
  );
});
