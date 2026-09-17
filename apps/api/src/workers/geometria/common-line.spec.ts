import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PlacementTrabajoNestingOpenNest,
} from '../colas';
import { optimizarCommonLines } from './common-line';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

const rectangulo = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
];

function entrada(longitudMinimaMm = 20): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-common-line',
    correlationId: 'corr-common-line',
    solicitadoEl: '2026-09-04T00:00:00.000Z',
    motor: 'collision',
    placa: { anchoMm: 300, altoMm: 100, margenMm: 0, maxPlacas: 1 },
    separacionMm: 5,
    commonLine: {
      habilitado: true,
      anchoCorteMm: 1,
      longitudMinimaMm,
      toleranciaMm: 0.1,
    },
    timeoutMs: 5_000,
    semilla: 7,
    piezas: [
      {
        id: 'rectangulo',
        cantidad: 2,
        rotaciones: 1,
        contorno: rectangulo,
      },
    ],
  };
}

function placement(copia: number, x: number): PlacementTrabajoNestingOpenNest {
  return {
    piezaId: 'rectangulo',
    copia,
    placa: 0,
    rotacionGrados: 0,
    traslacion: { x, y: 0 },
    contorno: rectangulo.map((punto) => ({
      x: punto.x + x,
      y: punto.y,
    })),
    huecos: [],
  };
}

function resultado(): Omit<NestingIrregularOpenNestResult, 'validacion'> {
  return {
    schemaVersion: 1,
    algoritmo: 'opennest-v1',
    motor: 'collision',
    versionMotor: 'test',
    cantidadSolicitada: 2,
    cantidadColocada: 2,
    placasUsadas: 1,
    duracionMs: 10,
    placements: [placement(0, 0), placement(1, 105)],
  };
}

describe('postprocesador Common Line', () => {
  it('convierte dos bordes rectos compatibles en una sola trayectoria', () => {
    const input = entrada();
    const optimizado = optimizarCommonLines(input, resultado());
    const validado = validarResultadoNestingOpenNest(input, optimizado);

    expect(validado.commonLine).toMatchObject({
      habilitado: true,
      aplicado: true,
      longitudCompartidaMm: 50,
      ahorroRecorridoMm: 50,
    });
    expect(validado.commonLine?.tramos).toHaveLength(1);
    expect(validado.commonLine?.tramos[0]).toMatchObject({
      placa: 0,
      inicio: { x: 100.5, y: 0 },
      fin: { x: 100.5, y: 50 },
    });
    expect(validado.placements[1].traslacion.x).toBe(101);
    expect(validado.validacion.separacionRespetada).toBe(true);
  });

  it('rechaza la cercanía si se elimina la declaración de línea compartida', () => {
    const input = entrada();
    const optimizado = optimizarCommonLines(input, resultado());

    expect(() =>
      validarResultadoNestingOpenNest(input, {
        ...optimizado,
        commonLine: undefined,
      }),
    ).toThrow('No se respeta la separación');
  });

  it('encadena más de dos piezas sin romper los contactos ya creados', () => {
    const input = entrada();
    input.placa.anchoMm = 400;
    input.piezas[0].cantidad = 3;
    const base = resultado();
    base.cantidadSolicitada = 3;
    base.cantidadColocada = 3;
    base.placements.push(placement(2, 210));

    const optimizado = validarResultadoNestingOpenNest(
      input,
      optimizarCommonLines(input, base),
    );

    expect(optimizado.commonLine?.tramos).toHaveLength(2);
    expect(optimizado.commonLine?.ahorroRecorridoMm).toBe(100);
    expect(optimizado.placements.map((item) => item.traslacion.x)).toEqual([
      0, 101, 202,
    ]);
  });

  it('procesa una tirada de piezas sin abandonar la validación incremental', () => {
    const cantidad = 120;
    const input = entrada();
    input.placa.anchoMm = cantidad * 105;
    input.piezas[0].cantidad = cantidad;
    const base = resultado();
    base.cantidadSolicitada = cantidad;
    base.cantidadColocada = cantidad;
    base.placements = Array.from({ length: cantidad }, (_, copia) =>
      placement(copia, copia * 105),
    );

    const optimizado = validarResultadoNestingOpenNest(
      input,
      optimizarCommonLines(input, base),
    );

    expect(optimizado.commonLine?.tramos).toHaveLength(cantidad - 1);
    expect(optimizado.commonLine?.ahorroRecorridoMm).toBe(
      (cantidad - 1) * 50,
    );
  });

  it('conserva el layout normal cuando ningún borde alcanza el mínimo', () => {
    const input = entrada(60);
    const optimizado = validarResultadoNestingOpenNest(
      input,
      optimizarCommonLines(input, resultado()),
    );

    expect(optimizado.commonLine?.aplicado).toBe(false);
    expect(optimizado.commonLine?.tramos).toHaveLength(0);
    expect(optimizado.placements[1].traslacion.x).toBe(105);
  });
});
