import type { NestingIrregularOpenNestData } from '../colas';
import {
  calcularMinimoTeoricoPlacas,
  crearPlanesOrientacion,
  OpenNestService,
  OpenNestSubprocessError,
} from './opennest.service';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../colas';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import * as patrones from './cartera-patrones';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import type { BibliotecaPatronesService } from './biblioteca-patrones.service';

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
  it('no arranca procesos cuando la base ya demuestra el mínimo de placas y patrones', async () => {
    const data = input(72);
    const service = new OpenNestServicePrueba(data);

    const result = await service.resolver(data);

    expect(service.llamadas).toBe(0);
    expect(result.algoritmo).toBe('grafonest-baseline-v1');
    expect(result.busqueda?.motivoFin).toBe('MINIMO_PLACAS');
    expect(result.optimizacionAgotada).toBe(false);
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

    expect(service.llamadas).toBe(0);
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

  it.each([
    { ancho: 40, cantidad: 5, minimo: 3 },
    { ancho: 50, cantidad: 4, minimo: 2 },
    { ancho: 60, cantidad: 3, minimo: 3 },
  ])(
    'demuestra la cota de $cantidad piezas de $ancho% sin excluir el contacto exacto',
    ({ ancho, cantidad, minimo }) => {
      const data = input(1);
      data.placa = { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 10 };
      data.piezas = [
        {
          id: 'pieza',
          cantidad,
          rotaciones: 1,
          contorno: [
            { x: 0, y: 0 },
            { x: ancho, y: 0 },
            { x: ancho, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      ];
      expect(calcularMinimoTeoricoPlacas(data)).toBe(minimo);
    },
  );

  it('evita buscar un acomodo imposible de dos piezas mayores que media placa', async () => {
    const data = input(4);
    data.separacionMm = 0;
    data.placa = { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 6 };
    data.piezas = ['a', 'b'].map((id) => ({
      id,
      cantidad: 3,
      rotaciones: 4,
      contorno: [
        [0, 0],
        [100, 0],
        [100, 30],
        [30, 30],
        [30, 100],
        [0, 100],
      ].map(([x, y]) => ({ x, y })),
    }));
    const service = new OpenNestServicePrueba(data);
    const r = await service.resolver(data);
    expect(r).toMatchObject({
      placasUsadas: 6,
      busqueda: { minimoTeoricoPlacas: 6, motivoFin: 'MINIMO_PLACAS' },
    });
    expect(service.llamadas).toBe(0);
    expect(() => validarResultadoNestingOpenNest(data, r)).not.toThrow();
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
    piezas: ['triangulo-a', 'triangulo-b'].map((id) => ({
      id,
      cantidad: 1,
      rotaciones: 72,
      contorno: [
        { x: 0, y: 0 },
        { x: 70, y: 0 },
        { x: 0, y: 70 },
      ],
    })),
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([120_000, 300_000])(
    'continúa buscando hasta el presupuesto global de %i ms',
    async (timeoutMs) => {
      const data = { ...dataTriangulos(), timeoutMs };
      let reloj = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => reloj);
      class Servicio extends OpenNestService {
        protected override ejecutarRunner(options: { timeoutMs: number }) {
          reloj += options.timeoutMs;
          return Promise.resolve({
            ok: false as const,
            error: { message: 'Sin mejora en este intento.' },
          });
        }
      }
      const result = await new Servicio().resolver(data);
      expect(result.duracionMs).toBe(timeoutMs);
      expect(result.busqueda?.presupuestoMs).toBe(timeoutMs);
      expect(result.busqueda?.motivoFin).toBe('PRESUPUESTO_AGOTADO');
      expect(result.cantidadColocada).toBe(2);
    },
  );

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
    expect(rotaciones).toBe(0);
    expect(result.placements[0].rotacionGrados).toBe(90);
    expect(result.placasUsadas).toBe(1);
    expect(result.busqueda?.intentos).toBe(0);
  });

  it('busca un encaje irregular aunque la base rectangular exceda el máximo de placas', async () => {
    const data = dataTriangulos();
    data.placa.maxPlacas = 1;
    expect(() => resolverNestingBaseSeguro(data)).toThrow('solución base');
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { entrada: unknown }) {
        reloj += 100;
        const intento = options.entrada as NestingIrregularOpenNestData;
        if (intento.piezas[0].rotaciones === 1)
          return {
            ok: false as const,
            error: { message: 'Hace falta girar.' },
          };
        return {
          ok: true as const,
          result: {
            ...resolverNestingBaseSeguro({
              ...data,
              placa: { ...data.placa, maxPlacas: 2 },
            }),
            placasUsadas: 1,
            algoritmo: 'opennest-v1' as const,
            placements: data.piezas.map((p, i) => ({
              piezaId: p.id,
              copia: 0,
              placa: 0,
              rotacionGrados: i * 180,
              traslacion: { x: i * 70, y: i * 70 },
              contorno: i
                ? p.contorno.map((q) => ({ x: 70 - q.x, y: 70 - q.y }))
                : p.contorno,
              huecos: [],
            })),
          },
        };
      }
    }
    const r = await new Servicio().resolver(data);
    expect(r.placasUsadas).toBe(1);
    expect(r.cantidadColocada).toBe(2);
    expect(r.busqueda?.intentos).toBe(2);
    expect(() => validarResultadoNestingOpenNest(data, r)).not.toThrow();
  });

  it('no entrega una solución inexistente cuando ninguna estrategia alcanza las placas permitidas', async () => {
    const data = dataTriangulos();
    data.placa.maxPlacas = 1;
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { timeoutMs: number }) {
        reloj += options.timeoutMs;
        return { ok: false as const, error: { message: 'Sin plan.' } };
      }
    }
    await expect(new Servicio().resolver(data)).rejects.toThrow(
      'No se encontró un plan completo',
    );
  });
});

describe('conservación de candidatos y procedencia', () => {
  afterEach(() => jest.restoreAllMocks());

  it('entrega un plan reutilizado para cotizar y permite seguir mejorándolo en preparación', async () => {
    const data: NestingIrregularOpenNestData = {
      ...input(1),
      timeoutMs: 500,
      separacionMm: 0,
      placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 2 },
      piezas: ['a', 'b'].map((id) => ({
        id,
        cantidad: 1,
        rotaciones: 1,
        contorno: cuadrado(60),
      })),
    };
    const biblioteca = {
      obtenerFamilia: jest.fn().mockResolvedValue({
        patrones: data.piezas.map((p, i) => ({
          counts: [i === 0 ? 1 : 0, i === 1 ? 1 : 0],
          origen: 'biblioteca',
          placements: [
            {
              pieceId: p.id,
              xMm: 0,
              yMm: 0,
              widthMm: 60,
              heightMm: 60,
              rotated: false,
            },
          ],
        })),
        planes: [
          {
            seleccion: [
              { patron: 0, repeticiones: 1 },
              { patron: 1, repeticiones: 1 },
            ],
            optimoPlacasDentroCartera: false,
            optimoPatronesDentroCartera: false,
          },
        ],
      }),
      aprender: jest.fn(),
    };
    let reloj = 0,
      llamadas = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    class Servicio extends OpenNestService {
      constructor() {
        super(undefined, biblioteca as unknown as BibliotecaPatronesService);
      }
      protected override async ejecutarRunner(options: { timeoutMs: number }) {
        llamadas++;
        reloj += options.timeoutMs;
        return { ok: false as const, error: { message: 'Sin mejora.' } };
      }
    }
    const cotizacion = await new Servicio().resolver(data);
    expect(llamadas).toBe(0);
    expect(cotizacion.busqueda?.motivoFin).toBe('PLAN_REUTILIZADO');
    expect(cotizacion.presupuestoExploradoMs).toBe(0);
    expect(cotizacion.optimizacionAgotada).toBe(false);
    const preparacion = await new Servicio().resolver({
      ...data,
      buscarMejora: true,
    });
    expect(llamadas).toBeGreaterThan(0);
    expect(preparacion.busqueda?.motivoFin).toBe('PRESUPUESTO_AGOTADO');
    expect(preparacion.placements).toEqual(cotizacion.placements);
  });

  it('recupera y valida un plan completo conocido sin depender de un selector ni del motor', async () => {
    const data = {
      ...input(1),
      piezas: [{ ...input(1).piezas[0], cantidad: 1 }],
    };
    const ps = [
      {
        counts: [1],
        origen: 'biblioteca',
        placements: [
          {
            pieceId: 'pieza',
            xMm: 5,
            yMm: 5,
            widthMm: 100,
            heightMm: 100,
            rotated: false,
          },
        ],
      },
    ];
    const biblioteca = {
      obtenerFamilia: jest.fn().mockResolvedValue({
        patrones: ps,
        planes: [
          {
            seleccion: [{ patron: 0, repeticiones: 1 }],
            optimoPlacasDentroCartera: false,
            optimoPatronesDentroCartera: false,
          },
        ],
      }),
      aprender: jest.fn(),
    };
    class Servicio extends OpenNestService {
      constructor() {
        super(undefined, biblioteca as unknown as BibliotecaPatronesService);
      }
      protected override async ejecutarRunner(): Promise<never> {
        throw new Error('No debe iniciar');
      }
      protected override async ejecutarSelector(): Promise<never> {
        throw new Error('No debe iniciar');
      }
    }
    const r = await new Servicio().resolver(data);
    expect(r.origenSolucion?.etapa).toBe('biblioteca');
    expect(r.busqueda?.intentos).toBe(0);
    expect(
      r.busqueda?.fases?.some((f) => f.etapa === 'biblioteca-plan-completo'),
    ).toBe(true);
    expect(biblioteca.aprender).toHaveBeenCalledTimes(1);
    expect(() => validarResultadoNestingOpenNest(data, r)).not.toThrow();
  });

  it('retiene el plan válido si después llegan una selección inválida y un timeout', async () => {
    const data: NestingIrregularOpenNestData = {
      ...input(1),
      timeoutMs: 10_000,
      separacionMm: 0,
      placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 30 },
      piezas: ['a', 'b'].map((id) => ({
        id,
        cantidad: 10,
        rotaciones: 1,
        contorno: cuadrado(60),
      })),
    };
    const cartera = await patrones.generarCarteraPatrones(data, {
      plazo: Date.now(),
    });
    const seleccion = [
      [1, 0],
      [0, 1],
    ].map((counts) => ({
      patron: cartera.findIndex((p) => p.counts.join(',') === counts.join(',')),
      repeticiones: 10,
    }));
    expect(seleccion.every((p) => p.patron >= 0)).toBe(true);
    jest.spyOn(patrones, 'generarCarteraPatrones').mockResolvedValue(cartera);
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    class Servicio extends OpenNestService {
      protected override async ejecutarSelector(options: {
        entrada: unknown;
        onCandidate?: (p: patrones.SeleccionPatrones) => void;
      }): Promise<patrones.SeleccionPatrones> {
        expect(options.entrada).toEqual(
          expect.objectContaining({ seleccionInicial: seleccion }),
        );
        const plan = {
          seleccion,
          optimoPlacasDentroCartera: false,
          optimoPatronesDentroCartera: false,
        };
        options.onCandidate?.(plan);
        options.onCandidate?.({
          ...plan,
          seleccion: [{ patron: 99999, repeticiones: 1 }],
        });
        reloj = 10_000;
        throw new OpenNestSubprocessError(
          'Timeout del objetivo secundario',
          'TIMEOUT',
        );
      }
    }
    const result = await new Servicio().resolver(data);
    expect(result.calidadSolucion).toBe('OPTIMIZADA');
    expect(result.cantidadColocada).toBe(20);
    expect(result.planPatrones?.patronesElegidos).toBe(2);
    expect(result.busqueda?.descartes?.timeout).toBe(1);
    expect(() => validarResultadoNestingOpenNest(data, result)).not.toThrow();
  });

  it('conserva el motor ejecutor de un ganador alternativo sin romper la validación de la solicitud', async () => {
    const data: NestingIrregularOpenNestData = {
      ...input(),
      timeoutMs: 20_000,
      separacionMm: 0,
      placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 2 },
      piezas: ['a', 'b'].map((id) => ({
        id,
        cantidad: 1,
        rotaciones: 72,
        contorno: [
          { x: 0, y: 0 },
          { x: 70, y: 0 },
          { x: 0, y: 70 },
        ],
      })),
    };
    let reloj = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    class Servicio extends OpenNestService {
      protected override async ejecutarRunner(options: { entrada: unknown }) {
        reloj += 500;
        const intento = options.entrada as NestingIrregularOpenNestData;
        if (intento.motor !== 'nfp')
          return { ok: false as const, error: { message: 'sin mejora' } };
        const base = resolverNestingBaseSeguro(data);
        return {
          ok: true as const,
          result: {
            ...base,
            algoritmo: 'opennest-v1' as const,
            motor: intento.motor,
            placasUsadas: 1,
            placements: [
              base.placements[0],
              {
                piezaId: 'b',
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
            ],
          },
        };
      }
    }
    const result = await new Servicio().resolver(data);
    expect(result).toMatchObject({
      motor: 'collision',
      motorEjecutor: 'nfp',
      placasUsadas: 1,
    });
    expect(() => validarResultadoNestingOpenNest(data, result)).not.toThrow();
  });
});
