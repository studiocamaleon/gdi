import { calcularComercialHojas } from '../calculo-hojas';
import type { DocumentoCalculoHojas, ReglasComercialesHojas } from '../tipos';
import { ErrorCalculoComercial } from '../validaciones';
import { documento, fila, pedido, tarifario } from './fixtures';

it.each([null, undefined])(
  'un precio %s del tramo alcanzado no utiliza el de otro tramo',
  (precio) => {
    const r = calcularComercialHojas(
      pedido([documento('a', { paginas: 110 })]),
      tarifario({
        filas: [
          fila({}, [
            { desdeCantidad: 1, precioUnitario: '100' },
            ...(precio === null
              ? [{ desdeCantidad: 100, precioUnitario: null }]
              : []),
          ]),
        ],
      }),
    );
    expect(r).toMatchObject({
      estado: 'PRECIO_PENDIENTE',
      importeConPrecio: '0',
      importeImpresionMatriz: null,
    });
    expect(r.grupos[0]).toMatchObject({
      motivoPendiente: 'TRAMO_SIN_PRECIO',
      tramo: { desdeCantidad: 100 },
      precioUnitario: null,
    });
  },
);

it('un precio cero explícito es calculable y no se confunde con uno pendiente', () => {
  const r = calcularComercialHojas(
    pedido([documento('a')]),
    tarifario({
      filas: [fila({}, [{ desdeCantidad: 1, precioUnitario: '0' }])],
    }),
  );
  expect(r).toMatchObject({ estado: 'CALCULADO', importeImpresionMatriz: '0' });
  expect(r.grupos[0]).toMatchObject({
    precioUnitario: '0',
    motivoPendiente: null,
  });
});

it('mantiene aritmética decimal exacta y no redondea cada archivo antes de componer', () => {
  const r = calcularComercialHojas(
    pedido([documento('a'), documento('b')]),
    tarifario({
      filas: [fila({}, [{ desdeCantidad: 1, precioUnitario: '0.005' }])],
    }),
  );
  expect(r.importeImpresionMatriz).toBe('0.01');
  expect(r.grupos[0].partes.map((p) => p.importeMatriz)).toEqual([
    '0.005',
    '0.005',
  ]);
  const decimal = calcularComercialHojas(
    pedido([documento('a', { paginas: 3 })]),
    tarifario({
      filas: [fila({}, [{ desdeCantidad: 1, precioUnitario: '0.1' }])],
    }),
  );
  expect(decimal.importeImpresionMatriz).toBe('0.3');
});

it.each(
  [[], [0], [2], [1, 5, 5], [1, 5, 3], [1, 2.5], [1, Infinity]].map(
    (rangos) => ({ rangos }),
  ),
)('rechaza rangos ambiguos o discontinuos en su inicio: %j', ({ rangos }) => {
  const entrada = pedido([documento('a')]);
  expect(() =>
    calcularComercialHojas(entrada, tarifario({ rangosGenerales: rangos })),
  ).toThrow(ErrorCalculoComercial);
  expect(() =>
    calcularComercialHojas(
      entrada,
      tarifario({ filas: [{ ...fila(), rangosPropios: rangos }] }),
    ),
  ).toThrow(ErrorCalculoComercial);
});

it.each([
  '-1',
  'NaN',
  'Infinity',
  '',
  '1,50',
  '0.000000001',
  '1000000000000000000',
])(
  'rechaza un precio inválido sin transformarlo en cero: %s',
  (precioUnitario) => {
    expect(() =>
      calcularComercialHojas(
        pedido([documento('a')]),
        tarifario({
          filas: [fila({}, [{ desdeCantidad: 1, precioUnitario }])],
        }),
      ),
    ).toThrow('El precio debe ser');
  },
);

it('no conserva precios huérfanos al cambiar los rangos y no acepta duplicados', () => {
  const entrada = pedido([documento('a')]);
  expect(() =>
    calcularComercialHojas(entrada, tarifario({ rangosGenerales: [1, 50] })),
  ).toThrow('tramo inexistente');
  expect(() =>
    calcularComercialHojas(entrada, tarifario({ filas: [fila(), fila()] })),
  ).toThrow('repite una combinación');
  expect(() =>
    calcularComercialHojas(
      entrada,
      tarifario({
        filas: [
          fila({}, [
            { desdeCantidad: 1, precioUnitario: '100' },
            { desdeCantidad: 1, precioUnitario: '200' },
          ]),
        ],
      }),
    ),
  ).toThrow('repite un precio');
});

it.each([
  { unidad: 'M2' },
  { acumulacion: 'CLIENTE' },
  { ultimaHojaImpar: 'DIVIDIR_PRECIO' },
  { cobertura: 'RECARGO' },
])(
  'rechaza una modalidad desconocida en vez de activar un valor implícito: %j',
  (regla) => {
    const t = tarifario();
    expect(() =>
      calcularComercialHojas(pedido([documento('a')]), {
        ...t,
        reglas: { ...t.reglas, ...regla } as ReglasComercialesHojas,
      }),
    ).toThrow(ErrorCalculoComercial);
  },
);

it('la fila debe indicar una cobertura compatible con la modalidad del tarifario', () => {
  expect(() =>
    calcularComercialHojas(
      pedido([documento('a')]),
      tarifario({ filas: [fila({ cobertura: 'normal' })] }),
    ),
  ).toThrow('cobertura');
  const t = tarifario();
  expect(() =>
    calcularComercialHojas(pedido([documento('a')]), {
      ...t,
      reglas: { ...t.reglas, cobertura: 'DIFERENCIADA' },
    }),
  ).toThrow('cobertura');
});

it.each([
  { paginas: 0 },
  { paginas: 1.5 },
  { copias: 0 },
  { copias: 1.5 },
  { faz: 3 },
  { cobertura: 'inventada' },
  { gramaje: undefined },
  { gramaje: -80 },
  { tamanoAnchoMm: 297 },
  { papelMateriaPrimaId: '' },
  { grupoId: '' },
  { paginas: 3, paginasOriginales: 10, rangoPaginas: '1-5' },
  { modo: 'CAD' },
  { copiasPorPagina: [{ pagina: 1, copias: 2 }] },
])('no tarifica un documento inválido: %j', (cambio) => {
  const doc = { ...documento('a'), ...cambio } as DocumentoCalculoHojas;
  expect(() => calcularComercialHojas(pedido([doc]), tarifario())).toThrow(
    ErrorCalculoComercial,
  );
});

it('rechaza documentos, tomos y cargas duplicados, y referencias a tomos inexistentes', () => {
  const a = documento('a');
  expect(() => calcularComercialHojas(pedido([a, a]), tarifario())).toThrow(
    'documentos repetidos',
  );
  const p = pedido([a]);
  expect(() =>
    calcularComercialHojas(
      { ...p, cargas: [...p.cargas, ...p.cargas] },
      tarifario(),
    ),
  ).toThrow('cargas repetidas');
  expect(() =>
    calcularComercialHojas(
      pedido([{ ...a, grupoId: 'inexistente' }]),
      tarifario(),
    ),
  ).toThrow('tomo inexistente');
  expect(() =>
    calcularComercialHojas(
      pedido([], {
        cargas: [
          { id: 'carga', documentos: [], grupos: [{ id: 'tomo', juegos: 1 }] },
        ],
      }),
      tarifario(),
    ),
  ).toThrow('está vacío');
  expect(() =>
    calcularComercialHojas(
      pedido([], {
        cargas: [
          {
            id: 'carga',
            documentos: [{ ...a, grupoId: 'tomo' }],
            grupos: [
              { id: 'tomo', juegos: 1 },
              { id: 'tomo', juegos: 2 },
            ],
          },
        ],
      }),
      tarifario(),
    ),
  ).toThrow('tomos repetidos');
});

it.each([0, 1.5, NaN])(
  'rechaza juegos inválidos aunque las copias del archivo sean válidas: %s',
  (juegos) => {
    expect(() =>
      calcularComercialHojas(
        pedido([], {
          cargas: [
            {
              id: 'carga',
              documentos: [documento('a', { grupoId: 'tomo' })],
              grupos: [{ id: 'tomo', juegos }],
            },
          ],
        }),
        tarifario(),
      ),
    ).toThrow('Juegos del tomo');
  },
);

it('rechaza desbordes tanto por archivo como por acumulación de archivos', () => {
  const a = documento('a', { copias: Number.MAX_SAFE_INTEGER });
  expect(() =>
    calcularComercialHojas(pedido([{ ...a, paginas: 2 }]), tarifario()),
  ).toThrow('entero positivo seguro');
  expect(() =>
    calcularComercialHojas(pedido([a, documento('b')]), tarifario()),
  ).toThrow('cantidad acumulada');
});

it('permite la empresa propietaria y rechaza usar su tarifario en otra empresa', () => {
  const entrada = pedido([documento('a')]);
  expect(calcularComercialHojas(entrada, tarifario()).estado).toBe('CALCULADO');
  expect(() =>
    calcularComercialHojas(
      { ...entrada, tenantId: 'otra-empresa-demo' },
      tarifario(),
    ),
  ).toThrow('no pertenece a la empresa');
});

function congelar(valor: unknown): void {
  if (!valor || typeof valor !== 'object') return;
  Object.freeze(valor);
  Object.values(valor).forEach(congelar);
}

it('no modifica el pedido, las instrucciones de impresión ni el tarifario recibido', () => {
  const entrada = pedido([
    documento('a', {
      paginas: 11,
      copias: 3,
      faz: 2,
      cobertura: 'borrador',
      terminaciones: ['Anillado'],
    }),
  ]);
  const t = tarifario();
  const conImpar = {
    ...t,
    reglas: { ...t.reglas, ultimaHojaImpar: 'COBRAR_SIMPLE' as const },
  };
  const antes = JSON.stringify([entrada, conImpar]);
  congelar(entrada);
  congelar(conImpar);
  const r = calcularComercialHojas(entrada, conImpar);
  expect(r.importeImpresionMatriz).toBe('2700');
  expect(JSON.stringify([entrada, conImpar])).toBe(antes);
  // La salida también se puede componer sin modificar los datos de entrada.
  r.grupos[0].combinacion.gramaje = 90;
  expect(entrada.cargas[0].documentos[0].gramaje).toBe(80);
});
