import { cantidadMl, indexarTarifarioCad } from '../validaciones-cad';
import type {
  CombinacionComercialCad,
  ReglasComercialesCad,
} from '../tipos-cad';
import { filaCad, tarifarioCad } from './fixtures-cad';

it.each(
  [
    [],
    ['1'],
    ['0', '0.0'],
    ['0', '4', '3'],
    ['0', '-1'],
    ['0', '1e1'],
    ['0', '1,2'],
    ['0', '0.1234567890123'],
  ].map((rangosGenerales) => ({ rangosGenerales })),
)('rechaza rangos CAD inválidos $rangosGenerales', ({ rangosGenerales }) => {
  expect(() =>
    indexarTarifarioCad(tarifarioCad({ rangosGenerales, filas: [] })),
  ).toThrow();
});

it.each([
  '0',
  '-0.1',
  'NaN',
  'Infinity',
  '1,5',
  '0.0000000000001',
  '9007199254740992',
])('rechaza incremento CAD %s', (incrementoMl) => {
  const t = tarifarioCad();
  expect(() =>
    indexarTarifarioCad({
      ...t,
      reglas: {
        ...t.reglas,
        redondeo: { modalidad: 'HACIA_ARRIBA', incrementoMl },
      },
    }),
  ).toThrow();
});

it.each([
  { unidad: 'M2' },
  { unidad: 'PLANO' },
  { acumulacion: 'PEDIDO_COMPLETO' },
  { cobertura: 'NINGUNA' },
  { redondeo: { modalidad: 'HACIA_ABAJO' } },
] as unknown as Partial<ReglasComercialesCad>[])(
  'rechaza reglas no acordadas %j',
  (reglas) => {
    const t = tarifarioCad();
    expect(() =>
      indexarTarifarioCad({ ...t, reglas: { ...t.reglas, ...reglas } }),
    ).toThrow();
  },
);

it.each([
  { anchoRolloMm: NaN },
  { anchoRolloMm: Infinity },
  { anchoRolloMm: 299 },
  { anchoRolloMm: 915 },
  { gramaje: undefined },
  { gramaje: 0 },
  { papelMateriaPrimaId: '' },
  { color: 'RGB' },
  { cobertura: 'alta' },
] as unknown as Partial<CombinacionComercialCad>[])(
  'rechaza combinación CAD inválida %j',
  (cambios) => {
    expect(() =>
      indexarTarifarioCad(tarifarioCad({ filas: [filaCad(cambios)] })),
    ).toThrow();
  },
);

it('rechaza precios sin rango, repetidos, inválidos y filas duplicadas', () => {
  for (const filas of [
    [filaCad({}, [{ desdeCantidad: '1', precioUnitario: '100' }])],
    [
      filaCad({}, [
        { desdeCantidad: '0', precioUnitario: '100' },
        { desdeCantidad: '0.00', precioUnitario: '200' },
      ]),
    ],
    [filaCad({}, [{ desdeCantidad: '0', precioUnitario: '-1' }])],
    [filaCad({}, [{ desdeCantidad: '0', precioUnitario: '1.123456789' }])],
    [filaCad(), filaCad()],
    [{ ...filaCad(), rangosPropios: [] }],
    [{ ...filaCad(), rangosPropios: ['0', '2'] }],
  ])
    expect(() => indexarTarifarioCad(tarifarioCad({ filas }))).toThrow();
});

it('acepta gramaje nulo explícito, cero como precio y celdas pendientes', () => {
  expect(() =>
    indexarTarifarioCad(
      tarifarioCad({
        filas: [
          filaCad({ gramaje: null }, [
            { desdeCantidad: '0', precioUnitario: '0' },
            { desdeCantidad: '4', precioUnitario: null },
          ]),
        ],
      }),
    ),
  ).not.toThrow();
});

it('mantiene límites de precisión y magnitud sin convertir ni redondear cantidades', () => {
  expect(cantidadMl('0.000000000001').toFixed()).toBe('0.000000000001');
  expect(cantidadMl('9007199254740991').toFixed()).toBe('9007199254740991');
  expect(() => cantidadMl('9007199254740991.1')).toThrow(/límite/);
  expect(() => cantidadMl('0.0000000000001')).toThrow(/12 decimales/);
});
