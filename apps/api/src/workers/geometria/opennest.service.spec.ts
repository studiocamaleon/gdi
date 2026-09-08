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

  it('aplica Common Line sin prolongar la búsqueda al alcanzar el mínimo', async () => {
    const data = input(72);
    data.commonLine = {
      habilitado: true,
      anchoCorteMm: 1,
      longitudMinimaMm: 20,
      toleranciaMm: 0.1,
    };
    const service = new OpenNestServicePrueba(data);

    const result = await service.resolver(data);

    expect(service.llamadas).toBe(1);
    expect(result.commonLine?.aplicado).toBe(true);
    expect(result.commonLine?.ahorroRecorridoMm).toBeGreaterThan(0);
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

describe('búsqueda de calidad con varios arranques', () => {
  const dataTriangulos = (): NestingIrregularOpenNestData => ({
    ...input(),
    timeoutMs: 5_000,
    separacionMm: 0,
    placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 2 },
    // Dos tipos conservan la regresión de búsqueda general: una sola silueta
    // repetida ahora resuelve este encaje con el candidato periódico inicial.
    piezas: ['triangulo-a', 'triangulo-b'].map(id => (
      {
        id,
        cantidad: 1,
        rotaciones: 72,
        contorno: [
          { x: 0, y: 0 },
          { x: 70, y: 0 },
          { x: 0, y: 70 },
        ],
      }
    )),
  });

  afterEach(() => jest.restoreAllMocks());

  it('continúa después de los tres primeros planes y encuentra una placa menos con otra semilla', async () => {
    const data = { ...dataTriangulos(), timeoutMs: 120_000 };
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    const llamadas: NestingIrregularOpenNestData[] = [];
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { entrada: unknown }) {
        llamadas.push(options.entrada as NestingIrregularOpenNestData);
        reloj += 500;
        const base = resolverNestingBaseSeguro(data);
        const resultado = {
          ...base,
          algoritmo: 'opennest-v1' as const,
          versionMotor: 'test',
          calidadSolucion: undefined,
        };
        if (llamadas.length < 4)
          return { ok: true as const, result: resultado };
        resultado.placasUsadas = 1;
        resultado.placements = [
          {
            piezaId: 'triangulo-a',
            copia: 0,
            placa: 0,
            rotacionGrados: 0,
            traslacion: { x: 0, y: 0 },
            contorno: data.piezas[0].contorno,
            huecos: [],
          },
          {
            piezaId: 'triangulo-b',
            copia: 0,
            placa: 0,
            rotacionGrados: 180,
            traslacion: { x: 70, y: 70 },
            contorno: [
              { x: 70, y: 70 },
              { x: 0, y: 70 },
              { x: 70, y: 0 },
            ],
            huecos: [],
          },
        ];
        return { ok: true as const, result: resultado };
      }
    }
    const result = await new Servicio().resolver(data);
    expect(llamadas).toHaveLength(4);
    expect(llamadas[3].semilla).not.toBe(llamadas[0].semilla);
    expect(llamadas[3].piezas[0].rotaciones).toBe(72);
    // Las dos orientaciones libres reciben el mismo límite externo de la
    // búsqueda determinista, independientemente del orden de la vuelta.
    expect(llamadas[2].timeoutMs).toBe(8_000);
    expect(llamadas[3].timeoutMs).toBe(8_000);
    expect(llamadas[3]).toMatchObject({ iteraciones: 1000 });
    expect(llamadas[0].placa.maxPlacas).toBe(2);
    expect(llamadas.slice(1).every((l) => l.placa.maxPlacas === 1)).toBe(true);
    expect(result.placasUsadas).toBe(1);
    expect(result.busqueda).toMatchObject({
      motivoFin: 'MINIMO_PLACAS',
      intentos: 4,
      candidatosValidos: 2,
    });
  });

  it('conserva el resultado completo y declara el límite si sólo obtiene candidatos parciales', async () => {
    const data = dataTriangulos();
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    const motores = new Set<string>();
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { entrada: unknown }) {
        const plan = options.entrada as NestingIrregularOpenNestData;
        motores.add(plan.motor);
        reloj += 500;
        const base = resolverNestingBaseSeguro(data);
        return {
          ok: true as const,
          result: {
            ...base,
            motor: plan.motor,
            cantidadColocada: 1,
            placasUsadas: 1,
            placements: base.placements.slice(0, 1),
          },
        };
      }
    }
    const result = await new Servicio().resolver(data);
    expect(result.cantidadColocada).toBe(2);
    expect(result.placasUsadas).toBe(2);
    expect(result.optimizacionAgotada).toBe(true);
    expect(result.busqueda).toMatchObject({
      motivoFin: 'PRESUPUESTO_AGOTADO',
      candidatosValidos: 0,
    });
    expect(motores).toEqual(new Set(['collision', 'nfp']));
  });

  it('omite orientación fija cuando una pieza sólo cabe girada', async () => {
    const data = input(4);
    data.piezas = [
      {
        id: 'rectangulo',
        cantidad: 1,
        rotaciones: 4,
        contorno: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 40 },
          { x: 0, y: 40 },
        ],
      },
    ];
    data.placa = { anchoMm: 50, altoMm: 100, margenMm: 0, maxPlacas: 1 };
    data.separacionMm = 0;
    let rotaciones = 0;
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { entrada: unknown }) {
        const plan = options.entrada as NestingIrregularOpenNestData;
        rotaciones = plan.piezas[0].rotaciones;
        return {
          ok: true as const,
          result: { ...resolverNestingBaseSeguro(plan), versionMotor: 'test' },
        };
      }
    }
    const result = await new Servicio().resolver(data);
    expect(rotaciones).toBe(4);
    expect(result.placasUsadas).toBe(1);
    expect(result.busqueda?.intentos).toBe(1);
  });
});
