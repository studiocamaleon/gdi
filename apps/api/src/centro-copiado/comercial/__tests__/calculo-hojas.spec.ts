import { calcularComercialHojas } from '../calculo-hojas';
import type { ReglasComercialesHojas } from '../tipos';
import { documento, fila, pedido, tarifario } from './fixtures';

it.each([
  ['HOJA', 1, 60, 60],
  ['HOJA', 2, 30, 30],
  ['CARILLA', 1, 60, 60],
  ['CARILLA', 2, 30, 60],
] as const)(
  '%s: 20 páginas × 3 copias a %i faz conservan hojas físicas y usan su unidad para precio y tramo',
  (unidad, faz, hojas, cantidad) => {
    const t = tarifario();
    const r = calcularComercialHojas(
      pedido([documento('a', { paginas: 20, copias: 3, faz })]),
      {
        ...t,
        reglas: { ...t.reglas, unidad },
      },
    );
    expect(r).toMatchObject({
      hojasFisicas: hojas,
      carillasImpresas: 60,
      cantidadComercial: cantidad,
    });
    expect(r.grupos[0]).toMatchObject({
      unidad,
      cantidadParaTramo: cantidad,
      cantidadFacturable: cantidad,
    });
  },
);

it('100 en doble faz significa 100 hojas físicas, no 100 carillas', () => {
  const carga = pedido([documento('a', { paginas: 100, faz: 2 })]);
  const t = tarifario();
  const hojas = calcularComercialHojas(carga, t);
  const caras = calcularComercialHojas(carga, {
    ...t,
    reglas: { ...t.reglas, unidad: 'CARILLA' },
  });
  expect(hojas.grupos[0]).toMatchObject({
    cantidadParaTramo: 50,
    tramo: { desdeCantidad: 1 },
    precioUnitario: '160',
  });
  expect(caras.grupos[0]).toMatchObject({
    cantidadParaTramo: 100,
    tramo: { desdeCantidad: 100 },
    precioUnitario: '130',
  });
});

it('acumula cargas distintas del pedido y aplica a cada archivo el precio de todo el grupo', () => {
  const t = tarifario({
    filas: [
      ...tarifario().filas,
      fila({ color: 'COLOR' }, [{ desdeCantidad: 1, precioUnitario: '200' }]),
    ],
  });
  const r = calcularComercialHojas(
    pedido([], {
      cargas: [
        { id: 'carga-a', documentos: [documento('a', { paginas: 60 })] },
        {
          id: 'carga-b',
          documentos: [
            documento('b', { paginas: 50 }),
            documento('c', { paginas: 10, color: 'COLOR' }),
          ],
        },
      ],
    }),
    t,
  );
  expect(r.grupos).toHaveLength(2);
  expect(r.grupos[0]).toMatchObject({
    cantidadParaTramo: 110,
    precioUnitario: '80',
    importeMatriz: '8800',
  });
  expect(r.grupos[0].partes.map((p) => p.importeMatriz)).toEqual([
    '4800',
    '4000',
  ]);
  expect(r.grupos[1]).toMatchObject({
    cantidadParaTramo: 10,
    precioUnitario: '200',
    importeMatriz: '2000',
  });
  expect(r.importeImpresionMatriz).toBe('10800');
});

it.each([
  [99, '100', '9900', 1, 99],
  [100, '80', '8000', 100, null],
  [101, '80', '8080', 100, null],
  [120, '80', '9600', 100, null],
])(
  'el tramo alcanzado se aplica a las %i unidades completas, incluido el descenso de total',
  (cantidad, precio, importe, desde, hasta) => {
    const r = calcularComercialHojas(
      pedido([documento('a', { paginas: cantidad })]),
      tarifario(),
    );
    expect(r.grupos[0]).toMatchObject({
      precioUnitario: precio,
      importeMatriz: importe,
      tramo: { desdeCantidad: desde, hastaCantidad: hasta },
    });
  },
);

it('por archivo mantiene cantidades separadas aunque coincidan nombre e ID local de distintas cargas', () => {
  const t = tarifario();
  const entrada = pedido([], {
    cargas: [
      {
        id: 'carga-a',
        documentos: [
          documento('1', { archivoNombre: 'igual.pdf', paginas: 60 }),
        ],
      },
      {
        id: 'carga-b',
        documentos: [
          documento('1', { archivoNombre: 'igual.pdf', paginas: 50 }),
        ],
      },
    ],
  });
  const r = calcularComercialHojas(entrada, {
    ...t,
    reglas: { ...t.reglas, acumulacion: 'ARCHIVO' },
  });
  expect(r.grupos.map((g) => g.cantidadParaTramo)).toEqual([60, 50]);
  expect(r.importeImpresionMatriz).toBe('11000');
  expect(calcularComercialHojas(entrada, t).importeImpresionMatriz).toBe(
    '8800',
  );
});

it.each([
  { papelMateriaPrimaId: 'otro-papel' },
  { gramaje: 150 },
  { tamano: 'A3', tamanoAnchoMm: 297, tamanoAltoMm: 420 },
  { color: 'COLOR' as const },
  { faz: 2 as const, paginas: 120 },
])('separa la combinación cuando cambia %j', (cambio) => {
  const r = calcularComercialHojas(
    pedido([
      documento('a', { paginas: 60 }),
      documento('b', { paginas: 60, ...cambio }),
    ]),
    tarifario(),
  );
  expect(r.grupos.map((g) => g.cantidadParaTramo)).toEqual([60, 60]);
  expect(r.grupos.every((g) => g.tramo.desdeCantidad === 1)).toBe(true);
});

it('los rangos propios reemplazan los generales y conservan precios independientes', () => {
  const propio = {
    ...fila({ color: 'COLOR' }, [
      { desdeCantidad: 1, precioUnitario: '200' },
      { desdeCantidad: 20, precioUnitario: '150' },
      { desdeCantidad: 100, precioUnitario: '120' },
    ]),
    rangosPropios: [1, 20, 100],
  };
  const entrada = pedido([
    documento('a', { paginas: 60 }),
    documento('b', { paginas: 60, color: 'COLOR' }),
  ]);
  const t = tarifario({ filas: [fila(), propio] });
  const r = calcularComercialHojas(entrada, t);
  expect(
    r.grupos.map((g) => [
      g.tramo.origen,
      g.tramo.desdeCantidad,
      g.precioUnitario,
    ]),
  ).toEqual([
    ['GENERAL', 1, '100'],
    ['COMBINACION', 20, '150'],
  ]);
  const actualizado = calcularComercialHojas(entrada, {
    ...t,
    versionId: 'version-2',
    rangosGenerales: [1, 50],
    filas: [
      fila({}, [
        { desdeCantidad: 1, precioUnitario: '100' },
        { desdeCantidad: 50, precioUnitario: '70' },
      ]),
      propio,
    ],
  });
  expect(
    actualizado.grupos.map((g) => [g.tramo.desdeCantidad, g.precioUnitario]),
  ).toEqual([
    [50, '70'],
    [20, '150'],
  ]);
  expect(r.versionId).toBe('version-1');
  expect(actualizado.versionId).toBe('version-2');
});

it('con precio único acumula coberturas, conservando la cobertura productiva por archivo', () => {
  const entrada = pedido([
    documento('normal', { paginas: 60, cobertura: 'normal' }),
    documento('alta', { paginas: 50, cobertura: 'alta' }),
  ]);
  const t = tarifario();
  const unico = calcularComercialHojas(entrada, t);
  expect(unico.grupos).toHaveLength(1);
  expect(unico.grupos[0].partes.map((p) => p.coberturaProduccion)).toEqual([
    'normal',
    'alta',
  ]);
  expect(unico.importeImpresionMatriz).toBe('8800');
  const separado = calcularComercialHojas(entrada, {
    ...t,
    reglas: { ...t.reglas, cobertura: 'DIFERENCIADA' },
    filas: [
      fila({ cobertura: 'normal' }),
      fila({ cobertura: 'alta' }, [
        { desdeCantidad: 1, precioUnitario: '200' },
      ]),
    ],
  });
  expect(separado.grupos.map((g) => g.cantidadParaTramo)).toEqual([60, 50]);
  expect(separado.importeImpresionMatriz).toBe('16000');
});

it('una cobertura diferenciada sin precio queda pendiente, sin usar el precio de otro nivel', () => {
  const t = tarifario();
  const r = calcularComercialHojas(
    pedido([documento('a', { cobertura: 'alta' })]),
    {
      ...t,
      reglas: { ...t.reglas, cobertura: 'DIFERENCIADA' },
      filas: [fila({ cobertura: 'normal' })],
    },
  );
  expect(r).toMatchObject({
    estado: 'PRECIO_PENDIENTE',
    importeImpresionMatriz: null,
    importeConPrecio: '0',
  });
});

it.each([
  ['HOJA', 'MANTENER_DOBLE', [[2, 18]], '2880'],
  [
    'HOJA',
    'COBRAR_SIMPLE',
    [
      [2, 15],
      [1, 3],
    ],
    '2700',
  ],
  ['CARILLA', 'MANTENER_DOBLE', [[2, 33]], '5280'],
  [
    'CARILLA',
    'COBRAR_SIMPLE',
    [
      [2, 30],
      [1, 3],
    ],
    '5100',
  ],
] as const)(
  '11 páginas × 3 copias: %s / %s',
  (unidad, ultimaHojaImpar, cantidades, importe) => {
    const t = tarifario();
    const r = calcularComercialHojas(
      pedido([documento('a', { paginas: 11, copias: 3, faz: 2 })]),
      {
        ...t,
        reglas: { ...t.reglas, unidad, ultimaHojaImpar },
      },
    );
    expect(r).toMatchObject({
      hojasFisicas: 18,
      carillasImpresas: 33,
      importeImpresionMatriz: importe,
    });
    expect(
      r.grupos.map((g) => [g.combinacion.faz, g.cantidadParaTramo]),
    ).toEqual(cantidades);
    expect(
      r.grupos.flatMap((g) => g.partes).every((p) => p.fazProduccion === 2),
    ).toBe(true);
  },
);

it('un original de una página doble faz pasa entero a simple sin crear una parte doble vacía', () => {
  const t = tarifario();
  const r = calcularComercialHojas(
    pedido([documento('a', { paginas: 1, copias: 3, faz: 2 })]),
    {
      ...t,
      reglas: { ...t.reglas, ultimaHojaImpar: 'COBRAR_SIMPLE' },
    },
  );
  expect(r.grupos).toHaveLength(1);
  expect(r.grupos[0]).toMatchObject({
    combinacion: { faz: 1 },
    cantidadParaTramo: 3,
    importeMatriz: '300',
  });
});

it.each([1, 2, 10] as const)(
  'simple faz y originales pares conservan su clasificación con %i copias',
  (copias) => {
    const t = tarifario();
    const r = calcularComercialHojas(
      pedido([
        documento('simple', { paginas: 3, faz: 1, copias }),
        documento('doble-par', { paginas: 4, faz: 2, copias }),
      ]),
      { ...t, reglas: { ...t.reglas, ultimaHojaImpar: 'COBRAR_SIMPLE' } },
    );
    expect(
      r.grupos.map((g) => [g.combinacion.faz, g.cantidadParaTramo]),
    ).toEqual([
      [1, 3 * copias],
      [2, 2 * copias],
    ]);
    expect(r.carillasImpresas).toBe(7 * copias);
  },
);

it('aplica el precio simple independiente aunque reclasificar la última hoja cueste más', () => {
  const t = tarifario({
    filas: [
      fila({}, [{ desdeCantidad: 1, precioUnitario: '190' }]),
      tarifario().filas[1],
    ],
  });
  const entrada = pedido([documento('a', { faz: 2 })]);
  expect(calcularComercialHojas(entrada, t).importeImpresionMatriz).toBe('160');
  expect(
    calcularComercialHojas(entrada, {
      ...t,
      reglas: { ...t.reglas, ultimaHojaImpar: 'COBRAR_SIMPLE' },
    }).importeImpresionMatriz,
  ).toBe('190');
});

it('reclasifica antes de acumular: las últimas hojas impares alcanzan el tramo simple junto con otros archivos', () => {
  const t = tarifario();
  const entrada = pedido([
    documento('doble', { paginas: 11, copias: 3, faz: 2 }),
    documento('simple', { paginas: 97 }),
  ]);
  const reglas: ReglasComercialesHojas = {
    ...t.reglas,
    ultimaHojaImpar: 'COBRAR_SIMPLE',
  };
  const r = calcularComercialHojas(entrada, { ...t, reglas });
  expect(
    r.grupos.map((g) => [
      g.combinacion.faz,
      g.cantidadParaTramo,
      g.precioUnitario,
    ]),
  ).toEqual([
    [2, 15, '160'],
    [1, 100, '80'],
  ]);
  expect(r.grupos[1].partes.map((p) => p.importeMatriz)).toEqual([
    '240',
    '7760',
  ]);
  const porArchivo = calcularComercialHojas(entrada, {
    ...t,
    reglas: { ...reglas, acumulacion: 'ARCHIVO' },
  });
  expect(
    porArchivo.grupos.map((g) => [g.cantidadParaTramo, g.precioUnitario]),
  ).toEqual([
    [15, '160'],
    [3, '100'],
    [97, '100'],
  ]);
});

it('si falta la tarifa simple necesaria, no omite las últimas hojas ni inventa un precio', () => {
  const t = tarifario();
  const r = calcularComercialHojas(
    pedido([documento('a', { paginas: 11, copias: 3, faz: 2 })]),
    {
      ...t,
      filas: [t.filas[1]],
      reglas: { ...t.reglas, ultimaHojaImpar: 'COBRAR_SIMPLE' },
    },
  );
  expect(r).toMatchObject({
    estado: 'PRECIO_PENDIENTE',
    hojasFisicas: 18,
    carillasImpresas: 33,
    importeConPrecio: '2400',
    importeImpresionMatriz: null,
  });
  expect(r.grupos[1]).toMatchObject({
    cantidadParaTramo: 3,
    precioUnitario: null,
    motivoPendiente: 'COMBINACION_SIN_PRECIO',
  });
});

it.each(['MANTENER_DOBLE', 'COBRAR_SIMPLE'] as const)(
  'los tomos conservan el frente de cada original: %s',
  (ultimaHojaImpar) => {
    const t = tarifario();
    const entrada = pedido([], {
      cargas: [
        {
          id: 'carga',
          documentos: [
            documento('a', { paginas: 3, copias: 99, faz: 2, grupoId: 'tomo' }),
            documento('b', { paginas: 3, copias: 99, faz: 2, grupoId: 'tomo' }),
          ],
          grupos: [{ id: 'tomo', juegos: 10 }],
        },
      ],
    });
    const r = calcularComercialHojas(entrada, {
      ...t,
      reglas: { ...t.reglas, ultimaHojaImpar },
    });
    expect(r).toMatchObject({ hojasFisicas: 40, carillasImpresas: 60 });
    expect(
      r.grupos.flatMap((g) => g.partes).every((p) => p.copiasEfectivas === 10),
    ).toBe(true);
    expect(
      r.grupos.map((g) => [g.combinacion.faz, g.cantidadParaTramo]),
    ).toEqual(
      ultimaHojaImpar === 'COBRAR_SIMPLE'
        ? [
            [2, 20],
            [1, 20],
          ]
        : [[2, 40]],
    );
    const separados = calcularComercialHojas(entrada, {
      ...t,
      reglas: { ...t.reglas, ultimaHojaImpar, acumulacion: 'ARCHIVO' },
    });
    expect(separados.grupos).toHaveLength(
      ultimaHojaImpar === 'COBRAR_SIMPLE' ? 4 : 2,
    );
  },
);

it('los juegos se resuelven dentro de cada carga y los tomos pueden acumular con documentos sueltos', () => {
  const r = calcularComercialHojas(
    pedido([], {
      cargas: [
        {
          id: 'carga-a',
          documentos: [documento('a', { paginas: 10, grupoId: 'tomo' })],
          grupos: [{ id: 'tomo', juegos: 3 }],
        },
        {
          id: 'carga-b',
          documentos: [
            documento('a', { paginas: 10, grupoId: 'tomo' }),
            documento('suelto', { paginas: 20 }),
          ],
          grupos: [{ id: 'tomo', juegos: 5 }],
        },
      ],
    }),
    tarifario(),
  );
  expect(r.grupos).toHaveLength(1);
  expect(r.grupos[0]).toMatchObject({
    cantidadParaTramo: 100,
    precioUnitario: '80',
  });
  expect(r.grupos[0].partes.map((p) => p.copiasEfectivas)).toEqual([3, 5, 1]);
});

it('usa sólo las páginas seleccionadas, no las páginas del PDF original', () => {
  const r = calcularComercialHojas(
    pedido([
      documento('a', {
        paginas: 3,
        paginasOriginales: 20,
        rangoPaginas: '1,5,20',
        copias: 2,
        faz: 2,
      }),
    ]),
    tarifario(),
  );
  expect(r).toMatchObject({ hojasFisicas: 4, carillasImpresas: 6 });
});

it('recalcula todo el grupo al agregar, quitar y editar archivos; no arrastra cantidades de pedidos anteriores', () => {
  const a = documento('a', { paginas: 60 });
  const b = documento('b', { paginas: 50 });
  const t = tarifario();
  expect(calcularComercialHojas(pedido([a, b]), t).importeImpresionMatriz).toBe(
    '8800',
  );
  expect(calcularComercialHojas(pedido([a]), t).importeImpresionMatriz).toBe(
    '6000',
  );
  expect(
    calcularComercialHojas(pedido([a, { ...b, paginas: 39 }]), t)
      .importeImpresionMatriz,
  ).toBe('9900');
  expect(
    calcularComercialHojas(pedido([b], { pedidoId: 'otro-pedido' }), t)
      .importeImpresionMatriz,
  ).toBe('5000');
  expect(calcularComercialHojas(pedido([]), t)).toMatchObject({
    grupos: [],
    cantidadComercial: 0,
    importeImpresionMatriz: '0',
  });
});
