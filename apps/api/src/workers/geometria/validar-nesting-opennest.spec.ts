import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  PlacementTrabajoNestingOpenNest,
} from '../colas';
import {
  NestingOpenNestInvalidoError,
  validarEntradaNestingOpenNest,
  validarResultadoNestingOpenNest,
} from './validar-nesting-opennest';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

function input(separacionMm = 5): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-test',
    correlationId: 'corr-test',
    solicitadoEl: '2026-09-04T00:00:00.000Z',
    motor: 'collision',
    placa: { anchoMm: 100, altoMm: 50, margenMm: 5, maxPlacas: 2 },
    separacionMm,
    timeoutMs: 5_000,
    semilla: 7,
    piezas: [
      {
        id: 'cuadrado',
        cantidad: 2,
        contorno: square.map((p) => ({ ...p })),
        rotaciones: 1,
      },
    ],
  };
}

function placement(copia: number, x: number): PlacementTrabajoNestingOpenNest {
  return {
    piezaId: 'cuadrado',
    copia,
    placa: 0,
    rotacionGrados: 0,
    traslacion: { x, y: 5 },
    contorno: square.map((point) => ({ x: point.x + x, y: point.y + 5 })),
    huecos: [],
  };
}

function result(
  placements: PlacementTrabajoNestingOpenNest[],
): Omit<NestingIrregularOpenNestResult, 'validacion'> {
  return {
    schemaVersion: 1,
    algoritmo: 'opennest-v1',
    motor: 'collision',
    versionMotor: 'test',
    cantidadSolicitada: 2,
    cantidadColocada: placements.length,
    placasUsadas: new Set(placements.map((item) => item.placa)).size,
    duracionMs: 20,
    placements,
  };
}

describe('validador de resultados OpenNest', () => {
  it('acepta una solución completa, dentro de placa y separada', () => {
    const data = input();
    validarEntradaNestingOpenNest(data);

    const validated = validarResultadoNestingOpenNest(
      data,
      result([placement(0, 5), placement(1, 20)]),
    );

    expect(validated.validacion).toEqual({
      completa: true,
      dentroDePlaca: true,
      sinSolapamientos: true,
      separacionRespetada: true,
    });
  });

  it('rechaza resultados parciales', () => {
    expect(() =>
      validarResultadoNestingOpenNest(input(), result([placement(0, 5)])),
    ).toThrow('de 2 piezas');
  });

  it('rechaza solapamientos con área positiva', () => {
    expect(() =>
      validarResultadoNestingOpenNest(
        input(),
        result([placement(0, 5), placement(1, 12)]),
      ),
    ).toThrow('Hay solapamiento');
  });

  it('rechaza distancias menores a la separación configurada', () => {
    expect(() =>
      validarResultadoNestingOpenNest(
        input(),
        result([placement(0, 5), placement(1, 19)]),
      ),
    ).toThrow('No se respeta la separación');
  });

  it('rechaza piezas fuera del área útil', () => {
    expect(() =>
      validarResultadoNestingOpenNest(
        input(),
        result([placement(0, 0), placement(1, 20)]),
      ),
    ).toThrow('fuera del área útil');
  });

  it('permite ubicar una pieza dentro del hueco real de otra', () => {
    const data: NestingIrregularOpenNestData = {
      ...input(2),
      piezas: [
        {
          id: 'marco',
          cantidad: 1,
          rotaciones: 1,
          contorno: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 40 },
            { x: 0, y: 40 },
          ],
          huecos: [
            [
              { x: 10, y: 10 },
              { x: 30, y: 10 },
              { x: 30, y: 30 },
              { x: 10, y: 30 },
            ],
          ],
        },
        {
          id: 'inserto',
          cantidad: 1,
          rotaciones: 1,
          contorno: square,
        },
      ],
    };
    const marco: PlacementTrabajoNestingOpenNest = {
      piezaId: 'marco',
      copia: 0,
      placa: 0,
      rotacionGrados: 0,
      traslacion: { x: 5, y: 5 },
      contorno: data.piezas[0].contorno.map(({ x, y }) => ({
        x: x + 5,
        y: y + 5,
      })),
      huecos: (data.piezas[0].huecos ?? []).map((ring) =>
        ring.map(({ x, y }) => ({ x: x + 5, y: y + 5 })),
      ),
    };
    const inserto: PlacementTrabajoNestingOpenNest = {
      ...placement(0, 20),
      piezaId: 'inserto',
      traslacion: { x: 20, y: 20 },
      contorno: square.map(({ x, y }) => ({ x: x + 20, y: y + 20 })),
    };
    const candidate = {
      ...result([marco, inserto]),
      cantidadSolicitada: 2,
      cantidadColocada: 2,
    };

    expect(
      validarResultadoNestingOpenNest(data, candidate).validacion
        .sinSolapamientos,
    ).toBe(true);
  });

  it('rechaza entradas no finitas antes de tocar código nativo', () => {
    const data = input();
    data.piezas[0].contorno[0].x = Number.NaN;
    expect(() => validarEntradaNestingOpenNest(data)).toThrow(
      NestingOpenNestInvalidoError,
    );
  });

  const tirada = () => {
    const data = input(0);
    data.piezas[0].cantidad = 4;
    const candidate = {
      ...result([
        placement(0, 5),
        placement(1, 15),
        { ...placement(2, 5), placa: 1 },
        { ...placement(3, 15), placa: 1 },
      ]),
      cantidadSolicitada: 4,
    };
    return { data, candidate };
  };

  it('acepta placas repetidas conservando las cuatro identidades físicas', () => {
    const { data, candidate } = tirada();
    expect(
      validarResultadoNestingOpenNest(data, candidate).cantidadColocada,
    ).toBe(4);
  });

  it('detecta un solapamiento pequeño en otra copia aunque sus poses declaradas sean iguales', () => {
    const { data, candidate } = tirada();
    // Dentro de la tolerancia de transformación (0,02 mm), pero produce
    // 0,05 mm² de solapamiento: una firma por poses/redondeo sería insegura.
    candidate.placements[3].contorno.forEach((p) => (p.x -= 0.005));
    expect(() => validarResultadoNestingOpenNest(data, candidate)).toThrow(
      'solapamiento',
    );
  });

  it('revalida geometría entre llamadas y después de una mutación', () => {
    const { data, candidate } = tirada();
    validarResultadoNestingOpenNest(data, candidate);
    candidate.placements[3].contorno.forEach((p) => (p.x -= 0.005));
    expect(() => validarResultadoNestingOpenNest(data, candidate)).toThrow(
      'solapamiento',
    );
  });

  it('comprueba las transformaciones y los giros de todas las copias', () => {
    const { data, candidate } = tirada();
    candidate.placements[3].rotacionGrados = 90;
    expect(() => validarResultadoNestingOpenNest(data, candidate)).toThrow(
      'rotación no permitida',
    );
  });

  it('comprueba la demanda aunque la geometría del patrón coincida', () => {
    const { data, candidate } = tirada();
    candidate.placements[3].copia = 1;
    expect(() => validarResultadoNestingOpenNest(data, candidate)).toThrow(
      'repitió la instancia',
    );
  });
});
