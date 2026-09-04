import type { NestingIrregularOpenNestData } from '../colas';
import {
  calcularMinimoTeoricoPlacas,
  crearPlanesOrientacion,
  OpenNestService,
} from './opennest.service';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../colas';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';

class OpenNestServicePrueba extends OpenNestService {
  llamadas = 0;

  constructor(private readonly data: NestingIrregularOpenNestData) {
    super();
  }

  protected override async ejecutarRunner() {
    this.llamadas += 1;
    const { validacion: _validacion, ...base } = resolverNestingBaseSeguro(
      this.data,
    );
    return {
      ok: true as const,
      result: {
        ...base,
        algoritmo: 'opennest-v1' as const,
        versionMotor: 'test',
        calidadSolucion: undefined,
      },
    };
  }
}

const cuadrado = (lado: number) => [
  { x: 0, y: 0 },
  { x: lado, y: 0 },
  { x: lado, y: lado },
  { x: 0, y: lado },
];

function input(rotaciones = 72): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-test',
    correlationId: 'corr-test',
    solicitadoEl: '2026-09-04T00:00:00.000Z',
    motor: 'collision',
    placa: { anchoMm: 1_600, altoMm: 2_440, margenMm: 5, maxPlacas: 25 },
    separacionMm: 5,
    timeoutMs: 60_000,
    semilla: 7,
    piezas: [
      {
        id: 'pieza',
        cantidad: 25,
        rotaciones,
        contorno: cuadrado(100),
      },
    ],
  };
}

describe('política jerárquica de orientación de GrafoNest', () => {
  it('ejecuta el optimizador aunque la base ya use el mínimo de placas', async () => {
    const data = input(72);
    const service = new OpenNestServicePrueba(data);

    const result = await service.resolver(data);

    expect(service.llamadas).toBe(1);
    expect(result.algoritmo).toBe('opennest-v1');
    expect(result.calidadSolucion).toBe('OPTIMIZADA');
    expect(result.placasUsadas).toBe(1);
    expect(result.versionPoliticaOrientacion).toBe(
      VERSION_POLITICA_ORIENTACION_GRAFONEST,
    );
  });

  it('prueba uniforme, cardinal y libre en ese orden', () => {
    const planes = crearPlanesOrientacion(input(72));

    expect(planes.map((plan) => plan.estrategia)).toEqual([
      'uniforme',
      'cardinal',
      'libre',
    ]);
    expect(planes.map((plan) => plan.input.piezas[0].rotaciones)).toEqual([
      1, 4, 72,
    ]);
  });

  it('no repite candidatos cuando la pieza tiene orientación fija', () => {
    const planes = crearPlanesOrientacion(input(1));

    expect(planes).toHaveLength(1);
    expect(planes[0].estrategia).toBe('uniforme');
    expect(planes[0].rotacionesMaximas).toBe(1);
  });

  it('no habilita rotaciones que no existían en una pieza', () => {
    const data = input(2);
    data.piezas.push({
      id: 'pieza-ocho-angulos',
      cantidad: 1,
      rotaciones: 8,
      contorno: cuadrado(50),
    });

    expect(
      crearPlanesOrientacion(data).map((plan) =>
        plan.input.piezas.map((pieza) => pieza.rotaciones),
      ),
    ).toEqual([
      [1, 1],
      [2, 4],
      [2, 8],
    ]);
  });

  it('calcula un límite inferior con área neta y margen útil', () => {
    const data = input(1);
    data.placa = { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 10 };
    data.piezas = [
      {
        id: 'marco',
        cantidad: 3,
        rotaciones: 1,
        contorno: cuadrado(100),
        huecos: [cuadrado(50)],
      },
    ];

    // Cada marco tiene 7.500 mm² netos; tres requieren como mínimo 3 placas.
    expect(calcularMinimoTeoricoPlacas(data)).toBe(3);
  });
});
