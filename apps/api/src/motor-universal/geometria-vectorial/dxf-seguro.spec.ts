import { Helper } from 'dxf';
import { inspeccionarVector } from '../../productos-servicios/geometrias/interpretar-vector';
import { normalizarFuenteVectorial } from './fuente-vectorial';
import { crearHelperDxfSeguro } from './dxf-seguro';

const insertar = (nombre: string, columnas = 1, filas = 1) => [
  '0',
  'INSERT',
  '2',
  nombre,
  '10',
  '0',
  '20',
  '0',
  '70',
  String(columnas),
  '71',
  String(filas),
  '44',
  '120',
  '45',
  '70',
];
const bloque = (nombre: string, entidades: string[]) => [
  '0',
  'BLOCK',
  '2',
  nombre,
  '70',
  '0',
  '10',
  '0',
  '20',
  '0',
  ...entidades,
  '0',
  'ENDBLK',
];
const rectangulo = [
  '0',
  'LWPOLYLINE',
  '8',
  'CORTE',
  '90',
  '4',
  '70',
  '1',
  '10',
  '0',
  '20',
  '0',
  '10',
  '100',
  '20',
  '0',
  '10',
  '100',
  '20',
  '50',
  '10',
  '0',
  '20',
  '50',
];
const archivo = (bloques: string[], entidades: string[]) =>
  [
    '0',
    'SECTION',
    '2',
    'BLOCKS',
    ...bloques,
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entidades,
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
const arco = (fin: string) => [
  '0',
  'ARC',
  '10',
  '0',
  '20',
  '0',
  '40',
  '10',
  '50',
  '0',
  '51',
  fin,
];
const cadena = (profundidad: number, repeticiones: number) =>
  Array.from({ length: profundidad }, (_, i) =>
    bloque(
      `B${i}`,
      i === profundidad - 1 ? rectangulo : insertar(`B${i + 1}`, repeticiones),
    ),
  ).flat();

const spline = (controles: number, grado: number, knots: number[]) => [
  '0',
  'SPLINE',
  '71',
  String(grado),
  ...knots.flatMap((k) => ['40', String(k)]),
  ...Array.from({ length: controles }, (_, i) => [
    '10',
    String(i * 10),
    '20',
    String(i % 2 ? 50 : 0),
  ]).flat(),
];

describe.each([
  [
    'normalización del motor',
    (contenido: string) =>
      normalizarFuenteVectorial({ contenido, nombreArchivo: 'ficticio.dxf' }),
  ],
  [
    'inspección de geometrías',
    (contenido: string) => inspeccionarVector(contenido, 'ficticio.dxf'),
  ],
] as const)('DXF con presupuesto previo: %s', (_nombre, leer) => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['ciclo directo', archivo(bloque('A', insertar('A')), insertar('A'))],
    [
      'ciclo indirecto',
      archivo(
        [...bloque('A', insertar('B')), ...bloque('B', insertar('A'))],
        insertar('A'),
      ),
    ],
    [
      'millones de repeticiones de un bloque vacío',
      archivo(bloque('A', []), insertar('A', 1_000_000_000)),
    ],
    [
      'multiplicación de filas y columnas',
      archivo(bloque('A', rectangulo), insertar('A', 101, 101)),
    ],
    ['expansión exponencial', archivo(cadena(15, 2), insertar('B0'))],
    ['anidación excesiva', archivo(cadena(34, 1), insertar('B0'))],
    ['referencia desconocida', archivo([], insertar('NO_EXISTE'))],
    ['conteo negativo', archivo(bloque('A', rectangulo), insertar('A', -1))],
    [
      'conteo inválido',
      archivo(bloque('A', rectangulo), insertar('A', Number.NaN)),
    ],
    ['curva con mil millones de grados', archivo([], arco('1000000000'))],
    ['curva infinita', archivo([], arco('1e999'))],
    [
      'elipse con recorrido excesivo',
      archivo(
        [],
        [
          '0',
          'ELLIPSE',
          '10',
          '0',
          '20',
          '0',
          '11',
          '10',
          '21',
          '0',
          '40',
          '0.5',
          '41',
          '0',
          '42',
          '1000000000',
        ],
      ),
    ],
    [
      'texto ignorado que multiplica memoria',
      archivo(
        bloque('A', ['0', 'TEXT', '1', 'ficticio'.repeat(15_000)]),
        insertar('A', 100),
      ),
    ],
    [
      'total de curvas expandidas',
      archivo(
        bloque('A', ['0', 'CIRCLE', '10', '0', '20', '0', '40', '10']),
        insertar('A', 2000),
      ),
    ],
    [
      'spline con exceso de trabajo',
      archivo(
        [],
        spline(
          1200,
          3,
          Array.from({ length: 1204 }, (_, i) => i),
        ),
      ),
    ],
    [
      'spline con nudos desordenados',
      archivo([], spline(4, 3, [0, 0, 0, 0, 2, 1, 2, 2])),
    ],
  ])('rechaza %s antes de expandir o interpolar', (_caso, contenido) => {
    // Si regresa el fallo, la suite falla sin ejecutar una expansión dañina.
    // El antes/después sin sustituciones se comprueba en un proceso limitado.
    const noExpandir = () => {
      throw new Error('Conversión invocada antes del rechazo');
    };
    const expandir = jest
      .spyOn(Helper.prototype, 'denormalised', 'get')
      .mockImplementation(noExpandir);
    const convertir = jest
      .spyOn(Helper.prototype, 'toPolylines')
      .mockImplementation(noExpandir);
    expect(Buffer.byteLength(contenido)).toBeLessThan(512 * 1024);
    expect(() => leer(contenido)).toThrow(
      /DXF contiene bloques o curvas inválidos|DXF supera el límite de complejidad/,
    );
    expect(expandir).not.toHaveBeenCalled();
    expect(convertir).not.toHaveBeenCalled();
  });

  it('aplica el límite en bytes antes de interpretar', () => {
    expect(() => leer('á'.repeat(270_000))).toThrow(/512 KB/);
  });

  it('conserva un bloque legítimo reutilizado en dos inserciones', () => {
    const contenido = archivo(
      [
        ...bloque('PIEZA', rectangulo),
        ...bloque('GRUPO', insertar('PIEZA', 2)),
      ],
      insertar('GRUPO'),
    );
    const resultado = leer(contenido);
    if ('svg' in resultado) {
      expect(resultado.anchoSugeridoMm).toBeCloseTo(220);
      expect(resultado.altoSugeridoMm).toBeCloseTo(50);
    } else {
      expect(resultado.entidades).toHaveLength(2);
      expect(resultado.entidades[0].ancho).toBeCloseTo(100);
      expect(resultado.entidades[1].alto).toBeCloseTo(50);
    }
  });
});

it('convierte una spline cúbica y un arco comunes sin alterar sus puntos', () => {
  const contenido = archivo(
    [],
    [...spline(4, 3, [0, 0, 0, 0, 1, 1, 1, 1]), ...arco('180')],
  );
  expect(crearHelperDxfSeguro(contenido).toPolylines()).toEqual(
    new Helper(contenido).toPolylines(),
  );
});
