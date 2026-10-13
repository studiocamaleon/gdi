import { calcularComercialCad } from '../calculo-cad';
import { calcularComercialHojas } from '../calculo-hojas';
import { componerPedidoComercial } from '../composicion-pedido';
import type { DocumentoCalculoCad, ReglasComercialesCad } from '../tipos-cad';
import { DecimalComercial } from '../validaciones';
import { documento, pedido, tarifario } from './fixtures';
import { documentoCad, filaCad, pedidoCad, tarifarioCad } from './fixtures-cad';

const conRedondeo = (
  incrementoMl = '0.1',
  acumulacion: ReglasComercialesCad['acumulacion'] = 'COMBINACION',
) => {
  const t = tarifarioCad();
  return {
    ...t,
    reglas: {
      ...t.reglas,
      acumulacion,
      redondeo: { modalidad: 'HACIA_ARRIBA' as const, incrementoMl },
    },
  };
};

it('cobra 1,21 ML de papel consumido para un plano 600 × 1200 con márgenes de 5 mm', () => {
  const r = calcularComercialCad(
    pedidoCad([documentoCad('a')]),
    tarifarioCad(),
  );
  expect(r).toMatchObject({
    estado: 'CALCULADO',
    consumoMl: '1.21',
    cantidadFacturable: '1.21',
    ajusteRedondeoMl: '0',
    impresionesFisicas: 1,
    importeImpresionMatriz: '6050',
  });
  expect(r.grupos[0].partes[0]).toMatchObject({
    referencia: { cargaId: 'carga-cad-1', documentoId: 'a', paginaOriginal: 1 },
    margenMm: 5,
    largoPapelMm: '1210',
    consumoMlPorCopia: '1.21',
    copiasEfectivas: 1,
    plan: { giro: 0, anchoSalidaMm: 610, largoSalidaMm: 1210, escala: 100 },
  });
});

it.each([
  [610, '0.851', 0],
  [914.4, '0.604', 90],
] as const)(
  'reutiliza la orientación productiva de A1 con rollo %s',
  (anchoRolloMm, ml, giro) => {
    const r = calcularComercialCad(
      pedidoCad([
        documentoCad('a', {
          medidasPaginas: [{ anchoMm: 594, altoMm: 841 }],
          rolloProduccion: { anchoRolloMm, margenMm: 5 },
        }),
      ]),
      tarifarioCad({ filas: [filaCad({ anchoRolloMm })] }),
    );
    expect(r.consumoMl).toBe(ml);
    expect(r.grupos[0].tramo).toEqual({
      desdeCantidad: '0',
      hastaCantidadExclusiva: '4',
      origen: 'GENERAL',
    });
    expect(r.grupos[0].partes[0].plan.giro).toBe(giro);
  },
);

it.each([
  ['0.1', 1, '1.3', '6500'],
  ['0.5', 1, '1.5', '7500'],
  ['0.1', 2, '2.5', '12500'],
] as const)(
  'redondea una vez el grupo cada %s ML con %s copias',
  (paso, copias, facturable, total) => {
    const r = calcularComercialCad(
      pedidoCad([documentoCad('a', { copias })]),
      conRedondeo(paso),
    );
    expect(r.cantidadFacturable).toBe(facturable);
    expect(r.consumoMl).toBe(copias === 1 ? '1.21' : '2.42');
    expect(r.importeImpresionMatriz).toBe(total);
  },
);

it.each([
  ['COMBINACION', '4.1', '16400', ['4.03']],
  ['ARCHIVO', '4.2', '21000', ['2.42', '1.61']],
] as const)(
  '%s: acumula 2,42 + 1,61 ML y luego elige tramo y redondea',
  (acumulacion, facturable, total, tramos) => {
    const carga = pedidoCad([], {
      cargas: [
        { id: 'carga-a', documentos: [documentoCad('a', { copias: 2 })] },
        {
          id: 'carga-b',
          documentos: [
            documentoCad('b', {
              medidasPaginas: [{ anchoMm: 600, altoMm: 1600 }],
            }),
          ],
        },
      ],
    });
    const r = calcularComercialCad(carga, conRedondeo('0.1', acumulacion));
    expect(r.consumoMl).toBe('4.03');
    expect(r.cantidadFacturable).toBe(facturable);
    expect(r.importeImpresionMatriz).toBe(total);
    expect(r.grupos.map((g) => g.cantidadParaTramo)).toEqual(tramos);
    if (acumulacion === 'COMBINACION') {
      const g = r.grupos[0];
      expect(g.partes.map((p) => p.importeConsumoMatriz)).toEqual([
        '9680',
        '6440',
      ]);
      expect(g.importeAjusteRedondeo).toBe('280');
      expect(g.ajusteRedondeoMl).toBe('0.07');
      expect(g.tramo.desdeCantidad).toBe('4');
      expect(
        new DecimalComercial(g.importeConsumoMatriz!)
          .plus(g.importeAjusteRedondeo!)
          .toFixed(),
      ).toBe(g.importeMatriz);
    }
  },
);

it.each([
  [3950, '3.96', '4', '0', '20000'],
  [3990, '4', '4', '4', '16000'],
  [4000, '4.01', '4.1', '4', '16400'],
] as const)(
  'tramo por consumo antes del redondeo para largo original %s mm',
  (altoMm, real, facturable, desde, total) => {
    const r = calcularComercialCad(
      pedidoCad([
        documentoCad('a', { medidasPaginas: [{ anchoMm: 600, altoMm }] }),
      ]),
      conRedondeo(),
    );
    expect(r.grupos[0]).toMatchObject({
      cantidadParaTramo: real,
      cantidadFacturable: facturable,
      tramo: { desdeCantidad: desde },
      importeMatriz: total,
    });
  },
);

it('no agrega un incremento a un múltiplo decimal exacto ni redondea cada página', () => {
  const r = calcularComercialCad(
    pedidoCad([
      documentoCad('a', {
        paginas: 3,
        paginasOriginales: 3,
        medidasPaginas: [
          { anchoMm: 600, altoMm: 1200.1 },
          { anchoMm: 600, altoMm: 790.2 },
          { anchoMm: 600, altoMm: 580.3 },
        ],
      }),
    ]),
    conRedondeo('0.0001'),
  );
  expect(r.consumoMl).toBe('2.6006');
  expect(r.cantidadFacturable).toBe('2.6006');
  expect(r.ajusteRedondeoMl).toBe('0');
  const otro = calcularComercialCad(
    pedidoCad([
      documentoCad('a', {
        medidasPaginas: [{ anchoMm: 600, altoMm: 1290 }],
      }),
    ]),
    conRedondeo(),
  );
  expect(otro.cantidadFacturable).toBe('1.3');
  expect(otro.ajusteRedondeoMl).toBe('0');
});

it('no cobra otro incremento por el residuo binario al sumar los márgenes', () => {
  const r = calcularComercialCad(
    pedidoCad([
      documentoCad('a', {
        medidasPaginas: [{ anchoMm: 600, altoMm: 1.12 }],
      }),
    ]),
    conRedondeo('0.00001'),
  );
  expect(r.grupos[0].partes[0].plan.largoSalidaMm).toBe(11.120000000000001);
  expect(r.grupos[0].partes[0].largoPapelMm).toBe('11.12');
  expect(r.consumoMl).toBe('0.01112');
  expect(r.cantidadFacturable).toBe('0.01112');
  expect(r.ajusteRedondeoMl).toBe('0');
});

it('selecciona páginas originales y reemplaza las copias por sus excepciones', () => {
  const r = calcularComercialCad(
    pedidoCad([
      documentoCad('a', {
        paginas: 2,
        paginasOriginales: 3,
        rangoPaginas: '3,1,1',
        copias: 2,
        medidasPaginas: [
          { anchoMm: 600, altoMm: 1200 },
          { anchoMm: 2000, altoMm: 2000 },
          { anchoMm: 600, altoMm: 1600 },
        ],
        copiasPorPagina: [
          { pagina: 2, copias: 9000 },
          { pagina: 3, copias: 3 },
        ],
      }),
    ]),
    conRedondeo(),
  );
  expect(r.impresionesFisicas).toBe(5);
  expect(r.consumoMl).toBe('7.25');
  expect(r.cantidadFacturable).toBe('7.3');
  expect(
    r.grupos[0].partes.map((p) => [
      p.referencia.paginaOriginal,
      p.copiasEfectivas,
      p.consumoMl,
    ]),
  ).toEqual([
    [1, 2, '2.42'],
    [3, 3, '4.83'],
  ]);
});

it.each([
  { papelMateriaPrimaId: 'otro-papel-demo' },
  { gramaje: 90 },
  { color: 'COLOR' as const },
  { rolloProduccion: { anchoRolloMm: 914.4, margenMm: 5 } },
])('separa volumen al cambiar %j', (cambios) => {
  const r = calcularComercialCad(
    pedidoCad([documentoCad('a'), documentoCad('b', cambios)]),
    tarifarioCad(),
  );
  expect(r.grupos).toHaveLength(2);
  expect(r.grupos.map((g) => g.cantidadParaTramo)).toEqual(['1.21', '1.21']);
});

it.each(['UNICA', 'DIFERENCIADA'] as const)(
  '%s: sólo separa coberturas cuando cambian el precio',
  (cobertura) => {
    const t = tarifarioCad();
    const r = calcularComercialCad(
      pedidoCad([
        documentoCad('a', { cobertura: 'borrador' }),
        documentoCad('b', { cobertura: 'alta' }),
      ]),
      {
        ...t,
        reglas: { ...t.reglas, cobertura },
        filas:
          cobertura === 'UNICA'
            ? t.filas
            : [
                filaCad({ cobertura: 'borrador' }),
                filaCad({ cobertura: 'alta' }),
              ],
      },
    );
    expect(r.grupos).toHaveLength(cobertura === 'UNICA' ? 1 : 2);
    expect(
      r.grupos.flatMap((g) => g.partes.map((p) => p.coberturaProduccion)),
    ).toEqual(['borrador', 'alta']);
  },
);

it('los nombres iguales no fusionan archivos; el ID local repetido en otra carga es válido', () => {
  const r = calcularComercialCad(
    pedidoCad([], {
      cargas: [
        {
          id: 'a',
          documentos: [documentoCad('x', { archivoNombre: 'plano.pdf' })],
        },
        {
          id: 'b',
          documentos: [documentoCad('x', { archivoNombre: 'plano.pdf' })],
        },
      ],
    }),
    conRedondeo('0.1', 'ARCHIVO'),
  );
  expect(r.grupos).toHaveLength(2);
  expect(r.cantidadFacturable).toBe('2.6');
});

it('rangos propios reemplazan a los generales y aceptan límites decimales normalizados', () => {
  const t = tarifarioCad({
    rangosGenerales: ['0.00', '4'],
    filas: [
      {
        ...filaCad(),
        rangosPropios: ['0', '1.210'],
        precios: [
          { desdeCantidad: '0.0', precioUnitario: '5000' },
          { desdeCantidad: '1.21', precioUnitario: '3000' },
        ],
      },
    ],
  });
  const r = calcularComercialCad(pedidoCad([documentoCad('a')]), t);
  expect(r.grupos[0].tramo).toEqual({
    desdeCantidad: '1.21',
    hastaCantidadExclusiva: null,
    origen: 'COMBINACION',
  });
  expect(r.importeImpresionMatriz).toBe('3630');
});

it.each(['fila', 'celda', 'null'] as const)(
  'conserva consumo y total pendiente cuando falta %s',
  (falta) => {
    const r = calcularComercialCad(pedidoCad([documentoCad('a')]), {
      ...conRedondeo(),
      filas:
        falta === 'fila'
          ? []
          : [
              filaCad(
                {},
                falta === 'celda'
                  ? []
                  : [{ desdeCantidad: '0', precioUnitario: null }],
              ),
            ],
    });
    expect(r).toMatchObject({
      estado: 'PRECIO_PENDIENTE',
      consumoMl: '1.21',
      cantidadFacturable: '1.3',
      importeConPrecio: '0',
      importeImpresionMatriz: null,
    });
    expect(r.grupos[0].importeAjusteRedondeo).toBeNull();
    expect(r.grupos[0].partes[0].importeConsumoMatriz).toBeNull();
    expect(r.grupos[0].motivoPendiente).toBe(
      falta === 'fila' ? 'COMBINACION_SIN_PRECIO' : 'TRAMO_SIN_PRECIO',
    );
  },
);

it('distingue cero explícito y muestra el parcial conocido sin completar el total', () => {
  const carga = pedidoCad([
    documentoCad('a'),
    documentoCad('b', { color: 'COLOR' }),
  ]);
  const r = calcularComercialCad(carga, tarifarioCad());
  expect(r.importeConPrecio).toBe('6050');
  expect(r.importeImpresionMatriz).toBeNull();
  const cero = calcularComercialCad(
    pedidoCad([documentoCad('a')]),
    tarifarioCad({
      filas: [filaCad({}, [{ desdeCantidad: '0', precioUnitario: '0' }])],
    }),
  );
  expect(cero.estado).toBe('CALCULADO');
  expect(cero.importeImpresionMatriz).toBe('0');
});

it('recalcula al agregar o quitar archivos sin acumular otros pedidos ni mutar entradas', () => {
  const t = conRedondeo();
  const p = pedidoCad([documentoCad('a')]);
  const antes = JSON.stringify({ p, t });
  const primero = calcularComercialCad(p, t);
  const agregado = calcularComercialCad(
    pedidoCad([documentoCad('a'), documentoCad('b', { copias: 3 })]),
    t,
  );
  expect(agregado.consumoMl).toBe('4.84');
  expect(agregado.grupos[0].precioUnitario).toBe('4000');
  expect(calcularComercialCad(p, t)).toEqual(primero);
  expect(
    calcularComercialCad({ ...p, pedidoId: 'otro-pedido-demo' }, t).grupos[0]
      .clave,
  ).not.toBe(primero.grupos[0].clave);
  expect(calcularComercialCad(pedidoCad([]), t)).toMatchObject({
    estado: 'CALCULADO',
    grupos: [],
    consumoMl: '0',
    cantidadFacturable: '0',
    importeImpresionMatriz: '0',
  });
  expect(JSON.stringify({ p, t })).toBe(antes);
  expect(primero.reglas.redondeo).not.toBe(t.reglas.redondeo);
});

it('compone hojas y CAD sin mezclar unidades ni repetir preparación y mínimo', () => {
  const hojas = calcularComercialHojas(
    pedido([documento('h', { paginas: 3 })]),
    tarifario(),
  );
  const cad = calcularComercialCad(
    pedidoCad([documentoCad('c')]),
    tarifarioCad(),
  );
  const referencia = {
    tenantId: 'empresa-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    monedaCodigo: 'ARS',
  };
  const r = componerPedidoComercial(
    {
      ...referencia,
      pedidoId: 'pedido-demo',
      decimalesPrecio: 2,
      impresion: [...hojas.grupos, ...cad.grupos].map((g) => ({
        clave: g.clave,
        importeResuelto: g.importeMatriz,
        ivaPorcentaje: '21',
      })),
      preparacion: { ivaPorcentaje: '21' },
      ivaAjusteMinimoPorcentaje: '21',
      terminaciones: [],
    },
    {
      ...referencia,
      reglas: {
        iva: 'INCLUIDO',
        preparacion: { modalidad: 'FIJA_PEDIDO', importe: '500' },
        minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '7000' },
      },
    },
  );
  expect(hojas.cantidadComercial).toBe(3);
  expect(cad.consumoMl).toBe('1.21');
  expect(r.preparacion.importeEnConvencion).toBe('500.00');
  expect(r.minimo.importeEnConvencion).toBe('150.00');
  expect(r.total?.total).toBe('7000.00');
});

it('conserva 20 decimales de ML × precio hasta componer el importe monetario', () => {
  const r = calcularComercialCad(
    pedidoCad([
      documentoCad('a', {
        medidasPaginas: [{ anchoMm: 600, altoMm: 1200.000000001 }],
      }),
    ]),
    tarifarioCad({
      filas: [
        filaCad({}, [{ desdeCantidad: '0', precioUnitario: '5000.12345678' }]),
      ],
    }),
  );
  expect(r.consumoMl).toBe('1.210000000001');
  expect(r.importeImpresionMatriz).toBe('6050.14938270880012345678');
  const referencia = {
    tenantId: 'empresa-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    monedaCodigo: 'ARS',
  };
  const compuesto = componerPedidoComercial(
    {
      ...referencia,
      pedidoId: 'pedido-demo',
      decimalesPrecio: 2,
      impresion: r.grupos.map((g) => ({
        clave: g.clave,
        importeResuelto: g.importeMatriz,
        ivaPorcentaje: '0',
      })),
      preparacion: { ivaPorcentaje: '0' },
      ivaAjusteMinimoPorcentaje: '0',
      terminaciones: [],
    },
    {
      ...referencia,
      reglas: {
        iva: 'INCLUIDO',
        preparacion: { modalidad: 'INCLUIDA' },
        minimo: { modalidad: 'SIN_MINIMO' },
      },
    },
  );
  expect(compuesto.total?.total).toBe('6050.15');
});

it.each([
  { modo: 'HOJAS' },
  { faz: 2 },
  { grupoId: 'tomo-demo' },
  { terminaciones: ['pouch'] },
  { copias: 0 },
  { copias: 1.5 },
  { copias: 10001 },
  { gramaje: undefined },
  { gramaje: -1 },
  { cobertura: 'desconocida' },
  { color: 'RGB' },
  { archivoNombre: 'plano.txt' },
  { medidasPaginas: undefined },
  { paginasOriginales: undefined },
  { paginas: 2 },
  { rangoPaginas: '2' },
  { medidasPaginas: [{ anchoMm: 2000, altoMm: 2000 }] },
  { medidasPaginas: [{ anchoMm: NaN, altoMm: 1200 }] },
  { medidasPaginas: [{ anchoMm: 600, altoMm: 0 }] },
  { copiasPorPagina: [{ pagina: 2, copias: 1 }] },
  {
    copiasPorPagina: [
      { pagina: 1, copias: 1 },
      { pagina: 1, copias: 2 },
    ],
  },
  { rolloProduccion: { anchoRolloMm: 610, margenMm: 0 } },
] as unknown as Partial<DocumentoCalculoCad>[])(
  'rechaza documentos CAD inválidos: %j',
  (cambios) => {
    expect(() =>
      calcularComercialCad(
        pedidoCad([documentoCad('a', cambios)]),
        tarifarioCad(),
      ),
    ).toThrow();
  },
);

it('rechaza más de 10.000 impresiones efectivas del PDF', () => {
  expect(() =>
    calcularComercialCad(
      pedidoCad([
        documentoCad('a', {
          paginas: 2,
          paginasOriginales: 2,
          copias: 6000,
          medidasPaginas: [
            { anchoMm: 600, altoMm: 1200 },
            { anchoMm: 600, altoMm: 1600 },
          ],
        }),
      ]),
      tarifarioCad(),
    ),
  ).toThrow(/10.000 impresiones/);
});

it('rechaza otra empresa y referencias duplicadas', () => {
  const p = pedidoCad([documentoCad('a')]);
  expect(() =>
    calcularComercialCad(
      { ...p, tenantId: 'otra-empresa-demo' },
      tarifarioCad(),
    ),
  ).toThrow(/empresa/);
  expect(() =>
    calcularComercialCad(
      { ...p, cargas: [...p.cargas, ...p.cargas] },
      tarifarioCad(),
    ),
  ).toThrow(/cargas CAD repetidas/);
  expect(() =>
    calcularComercialCad(
      pedidoCad([documentoCad('a'), documentoCad('a')]),
      tarifarioCad(),
    ),
  ).toThrow(/repite un documento/);
});
