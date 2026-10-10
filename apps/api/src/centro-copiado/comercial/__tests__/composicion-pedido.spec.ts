import { calcularComercialHojas } from '../calculo-hojas';
import { componerPedidoComercial } from '../composicion-pedido';
import {
  REGLAS_COMPOSICION_COMERCIAL_INICIALES,
  type PedidoComposicionComercial,
  type PoliticaComposicionComercial,
  type ReglasComposicionComercial,
} from '../composicion-pedido.types';
import { DecimalComercial } from '../validaciones';
import { documento, pedido, tarifario } from './fixtures';

function politica(
  reglas: Partial<ReglasComposicionComercial> = {},
): PoliticaComposicionComercial {
  return {
    tenantId: 'empresa-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    monedaCodigo: 'ARS',
    reglas: { ...REGLAS_COMPOSICION_COMERCIAL_INICIALES, ...reglas },
  };
}

function importes(
  cambios: Partial<PedidoComposicionComercial> = {},
): PedidoComposicionComercial {
  return {
    tenantId: 'empresa-demo',
    pedidoId: 'pedido-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    monedaCodigo: 'ARS',
    decimalesPrecio: 2,
    impresion: [
      { clave: 'grupo-a', importeResuelto: '121', ivaPorcentaje: '21' },
    ],
    preparacion: { ivaPorcentaje: '21' },
    ivaAjusteMinimoPorcentaje: '21',
    terminaciones: [],
    ...cambios,
  };
}

const conCargos = () =>
  politica({
    preparacion: { modalidad: 'FIJA_PEDIDO', importe: '500' },
    minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '1000' },
  });
const anillado = {
  clave: 'anillado-demo',
  fiscal: { neto: '1000', iva: '200', total: '1200' },
};

it('inicia con IVA incluido, preparación incluida y sin mínimo', () => {
  const r = componerPedidoComercial(importes(), politica());
  expect(r).toMatchObject({
    estado: 'CALCULADO',
    convencionIva: 'INCLUIDO',
    preparacion: { importeEnConvencion: '0.00' },
    minimo: { importeEnConvencion: '0.00', importeExigible: '0.00' },
    total: { neto: '100.00', iva: '21.00', total: '121.00' },
  });
  expect(r.parcialConPrecio).toEqual(r.total);
});

it.each([
  ['INCLUIDO', '21', '100.00', '21.00', '121.00'],
  ['MAS_IVA', '21', '121.00', '25.41', '146.41'],
  ['INCLUIDO', '10', '110.00', '11.00', '121.00'],
  ['MAS_IVA', '10.5', '121.00', '12.71', '133.71'],
  ['INCLUIDO', '0', '121.00', '0.00', '121.00'],
  ['MAS_IVA', '0', '121.00', '0.00', '121.00'],
] as const)(
  '%s con alícuota resuelta %s: separa neto e IVA sin duplicarlo',
  (iva, porcentaje, neto, impuesto, total) => {
    const r = componerPedidoComercial(
      importes({
        impresion: [
          {
            clave: 'grupo-a',
            importeResuelto: '121',
            ivaPorcentaje: porcentaje,
          },
        ],
      }),
      politica({ iva }),
    );
    expect(r.total).toEqual({ neto, iva: impuesto, total });
  },
);

it('conserva alícuotas diferentes en impresión, preparación, ajuste y terminaciones', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [
        { clave: 'a', importeResuelto: '121', ivaPorcentaje: '21' },
        { clave: 'b', importeResuelto: '221', ivaPorcentaje: '10.5' },
      ],
      preparacion: { ivaPorcentaje: '0' },
      ivaAjusteMinimoPorcentaje: '10',
      terminaciones: [anillado],
    }),
    politica({
      preparacion: { modalidad: 'FIJA_PEDIDO', importe: '100' },
      minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '552' },
    }),
  );
  expect(r.minimo.fiscal).toEqual({
    neto: '100.00',
    iva: '10.00',
    total: '110.00',
  });
  expect(r.total).toEqual({ neto: '1500.00', iva: '252.00', total: '1752.00' });
  expect(r.terminaciones).toEqual([anillado]);
});

it.each([
  ['INCLUIDO', '300.00', '500.00', '200.00', '1000.00', '2200.00'],
  ['MAS_IVA', '363.00', '605.00', '242.00', '1210.00', '2410.00'],
] as const)(
  '%s: mínimo sobre impresión + preparación y terminaciones después',
  (iva, totalImpresion, totalPreparacion, totalAjuste, antes, total) => {
    const p = conCargos();
    const r = componerPedidoComercial(
      importes({
        impresion: [
          { clave: 'a', importeResuelto: '300', ivaPorcentaje: '21' },
        ],
        terminaciones: [anillado],
      }),
      { ...p, reglas: { ...p.reglas, iva } },
    );
    expect(r.impresion[0].fiscal?.total).toBe(totalImpresion);
    expect(r.preparacion.fiscal?.total).toBe(totalPreparacion);
    expect(r.minimo).toMatchObject({
      baseComparada: '800.00',
      importeEnConvencion: '200.00',
      fiscal: { total: totalAjuste },
    });
    expect(r.subtotalAntesTerminaciones?.total).toBe(antes);
    expect(r.total?.total).toBe(total);
  },
);

it.each(['1000', '1500'])(
  'no agrega mínimo cuando la base alcanza o supera el piso (%s)',
  (valor) => {
    const r = componerPedidoComercial(
      importes({
        impresion: [
          { clave: 'a', importeResuelto: valor, ivaPorcentaje: '21' },
        ],
      }),
      politica({ minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '1000' } }),
    );
    expect(r.minimo.importeEnConvencion).toBe('0.00');
    expect(r.total?.total).toBe(`${valor}.00`);
  },
);

it('sin mínimo sólo suma impresión, preparación y terminaciones', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [{ clave: 'a', importeResuelto: '300', ivaPorcentaje: '21' }],
      terminaciones: [anillado],
    }),
    politica({ preparacion: { modalidad: 'FIJA_PEDIDO', importe: '500' } }),
  );
  expect(r.minimo.importeEnConvencion).toBe('0.00');
  expect(r.total?.total).toBe('2000.00');
});

it('evalúa el mínimo sobre importes ya ajustados sin volver a descontarlos', () => {
  // D20: 10.000 de matriz → 9.000 por acuerdo → 8.100 tras 10 % autorizado.
  // Resolver alcance, permisos y auditoría corresponde al caller, aún pendiente.
  const datos = importes({
    impresion: [{ clave: 'a', importeResuelto: '8100', ivaPorcentaje: '21' }],
    preparacion: { ivaPorcentaje: '21', importeAjustado: '400' },
  });
  const p = politica({
    preparacion: { modalidad: 'FIJA_PEDIDO', importe: '500' },
    minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '9000' },
  });
  const r = componerPedidoComercial(datos, p);
  expect(r.preparacion).toMatchObject({
    importeConfigurado: '500',
    importeResuelto: '400',
  });
  expect(r.minimo.baseComparada).toBe('8500.00');
  expect(r.minimo.importeEnConvencion).toBe('500.00');
  expect(r.total?.total).toBe('9000.00');
  // Un manual final de 8.500 reemplaza el importe anterior; no vuelve a sufrir 10 %.
  datos.impresion = [
    { clave: 'a', importeResuelto: '8500', ivaPorcentaje: '21' },
  ];
  const manual = componerPedidoComercial(datos, p);
  expect(manual.minimo.importeEnConvencion).toBe('100.00');
  expect(manual.total?.total).toBe('9000.00');
});

it.each(['COMBINACION', 'ARCHIVO'] as const)(
  '%s: cobra preparación y mínimo una vez entre cargas, tomos y última hoja impar',
  (acumulacion) => {
    const t = tarifario();
    const hojas = calcularComercialHojas(
      pedido([], {
        cargas: [
          {
            id: 'carga-a',
            grupos: [{ id: 'tomo-a', juegos: 3 }],
            documentos: [
              documento('a', { paginas: 11, faz: 2, grupoId: 'tomo-a' }),
            ],
          },
          { id: 'carga-b', documentos: [documento('b', { paginas: 2 })] },
        ],
      }),
      {
        ...t,
        reglas: { ...t.reglas, acumulacion, ultimaHojaImpar: 'COBRAR_SIMPLE' },
      },
    );
    const antes = JSON.stringify(hojas);
    const datos = importes({
      impresion: hojas.grupos.map((g) => ({
        clave: g.clave,
        importeResuelto: g.importeMatriz,
        ivaPorcentaje: '21',
      })),
    });
    const p = politica({
      preparacion: { modalidad: 'FIJA_PEDIDO', importe: '500' },
      minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '4000' },
    });
    const r = componerPedidoComercial(datos, p);
    expect(hojas.importeImpresionMatriz).toBe('2900');
    expect(hojas.hojasFisicas).toBe(20);
    expect(r.preparacion.importeEnConvencion).toBe('500.00');
    expect(r.minimo.importeEnConvencion).toBe('600.00');
    expect(r.total?.total).toBe('4000.00');
    expect(JSON.stringify(hojas)).toBe(antes);
    expect(componerPedidoComercial(datos, p)).toEqual(r);
  },
);

it('al quitar todas las impresiones no conserva preparación ni mínimo del pedido anterior', () => {
  const p = conCargos();
  expect(componerPedidoComercial(importes(), p).total?.total).toBe('1000.00');
  const vacio = componerPedidoComercial(importes({ impresion: [] }), p);
  expect(vacio.estado).toBe('CALCULADO');
  expect(vacio.preparacion.importeEnConvencion).toBe('0.00');
  expect(vacio.minimo.importeExigible).toBe('0.00');
  expect(vacio.total).toEqual({ neto: '0.00', iva: '0.00', total: '0.00' });
});

it('un precio explícito cero conserva el trabajo y aplica los cargos del pedido', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [{ clave: 'a', importeResuelto: '0', ivaPorcentaje: '0' }],
    }),
    conCargos(),
  );
  expect(r.estado).toBe('CALCULADO');
  expect(r.minimo.importeEnConvencion).toBe('500.00');
  expect(r.total?.total).toBe('1000.00');
});

it('un precio pendiente no se resuelve por preparación, mínimo ni terminaciones', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [
        { clave: 'a', importeResuelto: '100', ivaPorcentaje: '21' },
        { clave: 'b', importeResuelto: null, ivaPorcentaje: '21' },
      ],
      terminaciones: [anillado],
    }),
    conCargos(),
  );
  expect(r.estado).toBe('PRECIO_PENDIENTE');
  expect(r.impresion[1].fiscal).toBeNull();
  expect(r.minimo.baseComparada).toBeNull();
  expect(r.minimo.importeEnConvencion).toBeNull();
  expect(r.subtotalAntesTerminaciones).toBeNull();
  expect(r.total).toBeNull();
  expect(r.parcialConPrecio.total).toBe('1800.00');
});

it.each([false, true])(
  'un precio pendiente sigue pendiente aunque el mínimo esté deshabilitado o sea cero (%s)',
  (minimoCero) => {
    const r = componerPedidoComercial(
      importes({
        impresion: [{ clave: 'a', importeResuelto: null, ivaPorcentaje: '0' }],
      }),
      politica({
        minimo: minimoCero
          ? { modalidad: 'IMPORTE_PEDIDO', importe: '0' }
          : { modalidad: 'SIN_MINIMO' },
      }),
    );
    expect(r.minimo.importeEnConvencion).toBe('0.00');
    expect(r.estado).toBe('PRECIO_PENDIENTE');
    expect(r.total).toBeNull();
  },
);

it('una terminación pendiente permite calcular el mínimo pero no un total válido', () => {
  const r = componerPedidoComercial(
    importes({ terminaciones: [{ clave: 'pouch-demo', fiscal: null }] }),
    conCargos(),
  );
  expect(r.minimo.importeEnConvencion).toBe('379.00');
  expect(r.subtotalAntesTerminaciones?.total).toBe('1000.00');
  expect(r.subtotalTerminaciones).toBeNull();
  expect(r.estado).toBe('PRECIO_PENDIENTE');
  expect(r.total).toBeNull();
  expect(r.parcialConPrecio.total).toBe('1000.00');
});

it('redondea por grupo comercial después de acumular, no por archivo ni unidad', () => {
  const t = tarifario();
  const hojas = calcularComercialHojas(
    pedido([documento('a'), documento('b'), documento('c')]),
    {
      ...t,
      filas: [
        {
          ...t.filas[0],
          precios: [{ desdeCantidad: 1, precioUnitario: '0.005' }],
        },
      ],
    },
  );
  const r = componerPedidoComercial(
    importes({
      impresion: hojas.grupos.map((g) => ({
        clave: g.clave,
        importeResuelto: g.importeMatriz,
        ivaPorcentaje: '0',
      })),
    }),
    politica(),
  );
  expect(r.impresion[0].importeResuelto).toBe('0.015');
  expect(r.total?.total).toBe('0.02');
});

it.each([0, 2, 3, 6])(
  'respeta precisión %i y conserva neto + IVA = total en cada concepto y sumatoria',
  (decimales) => {
    for (const iva of ['INCLUIDO', 'MAS_IVA'] as const) {
      const r = componerPedidoComercial(
        importes({
          decimalesPrecio: decimales,
          impresion: ['0.005', '0.03', '1.005', '9.99999999'].map(
            (valor, i) => ({
              clave: `grupo-${i}`,
              importeResuelto: valor,
              ivaPorcentaje: '21',
            }),
          ),
        }),
        politica({
          iva,
          preparacion: { modalidad: 'FIJA_PEDIDO', importe: '0.005' },
          minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '13.555' },
        }),
      );
      const fiscales = [
        ...r.impresion.map((c) => c.fiscal),
        r.preparacion.fiscal,
        r.minimo.fiscal,
      ];
      for (const f of [...fiscales, r.total]) {
        expect(
          new DecimalComercial(f!.neto).plus(f!.iva).toFixed(decimales),
        ).toBe(f!.total);
      }
      const suma = fiscales.reduce(
        (acc, f) => acc.plus(f!.total),
        new DecimalComercial(0),
      );
      expect(suma.toFixed(decimales)).toBe(r.total!.total);
      expect(
        r.subtotalAntesTerminaciones![iva === 'INCLUIDO' ? 'total' : 'neto'],
      ).toBe(new DecimalComercial('13.555').toFixed(decimales));
    }
  },
);

it('compara el mínimo contra conceptos ya redondeados y agrega sólo lo necesario', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [{ clave: 'a', importeResuelto: '0.004', ivaPorcentaje: '0' }],
      preparacion: { ivaPorcentaje: '0' },
      ivaAjusteMinimoPorcentaje: '0',
    }),
    politica({
      preparacion: { modalidad: 'FIJA_PEDIDO', importe: '0.004' },
      minimo: { modalidad: 'IMPORTE_PEDIDO', importe: '0.01' },
    }),
  );
  expect(r.minimo.baseComparada).toBe('0.00');
  expect(r.minimo.importeEnConvencion).toBe('0.01');
  expect(r.total?.total).toBe('0.01');
});

it('conserva importes mayores al entero seguro sin convertirlos a Number', () => {
  const r = componerPedidoComercial(
    importes({
      impresion: [
        {
          clave: 'a',
          importeResuelto: '9007199254740993.01',
          ivaPorcentaje: '0',
        },
      ],
    }),
    politica(),
  );
  expect(r.total?.total).toBe('9007199254740993.01');
});

it('recalcular no muta entradas ni comparte objetos de las terminaciones', () => {
  const p = conCargos();
  const datos = importes({ terminaciones: [structuredClone(anillado)] });
  const snapshot = JSON.stringify({ p, datos });
  const r = componerPedidoComercial(datos, p);
  expect(componerPedidoComercial(datos, p)).toEqual(r);
  expect(r.terminaciones[0].fiscal).not.toBe(datos.terminaciones[0].fiscal);
  r.terminaciones[0].fiscal = null;
  expect(JSON.stringify({ p, datos })).toBe(snapshot);
});

it.each(['tenantId', 'tarifarioId', 'versionId', 'monedaCodigo'] as const)(
  'rechaza composición con %s de otra política',
  (campo) => {
    const datos = importes();
    datos[campo] = campo === 'monedaCodigo' ? 'USD' : 'otro-demo';
    expect(() => componerPedidoComercial(datos, politica())).toThrow();
  },
);

it.each([-1, 1.5, 7, NaN, Infinity])(
  'rechaza precisión monetaria %s',
  (decimalesPrecio) => {
    expect(() =>
      componerPedidoComercial(importes({ decimalesPrecio }), politica()),
    ).toThrow(/precisión/);
  },
);

it.each([
  '-1',
  'NaN',
  'Infinity',
  '1e3',
  '1,5',
  '',
  ' 1',
  '1.123456789012345678901',
  '1'.repeat(35),
])('rechaza importe malformado %s', (valor) => {
  expect(() =>
    componerPedidoComercial(
      importes({
        impresion: [
          { clave: 'a', importeResuelto: valor, ivaPorcentaje: '21' },
        ],
      }),
      politica(),
    ),
  ).toThrow(/decimal no negativo/);
});

it.each(['', '-1', 'NaN', 'Infinity', '101', '1e1', '21,0'])(
  'no asume cero ni 21 para alícuota inválida %s',
  (valor) => {
    expect(() =>
      componerPedidoComercial(
        importes({
          impresion: [
            { clave: 'a', importeResuelto: '121', ivaPorcentaje: valor },
          ],
        }),
        politica(),
      ),
    ).toThrow(/alícuota/);
    expect(() =>
      componerPedidoComercial(
        importes({
          preparacion: { ivaPorcentaje: valor },
        }),
        politica(),
      ),
    ).toThrow(/alícuota/);
    expect(() =>
      componerPedidoComercial(
        importes({
          ivaAjusteMinimoPorcentaje: valor,
        }),
        politica(),
      ),
    ).toThrow(/alícuota/);
  },
);

it.each([
  { iva: 'INVALIDO' },
  { preparacion: { modalidad: 'POR_ARCHIVO', importe: '500' } },
  { minimo: { modalidad: 'HOJAS', importe: '10' } },
  { preparacion: { modalidad: 'FIJA_PEDIDO', importe: '-1' } },
  { minimo: { modalidad: 'IMPORTE_PEDIDO', importe: 'NaN' } },
])('rechaza reglas de composición inválidas %j', (reglas) => {
  expect(() =>
    componerPedidoComercial(
      importes(),
      politica(reglas as Partial<ReglasComposicionComercial>),
    ),
  ).toThrow();
});

it('rechaza cargos ajustados sobre preparación incluida', () => {
  expect(() =>
    componerPedidoComercial(
      importes({
        preparacion: { ivaPorcentaje: '21', importeAjustado: '50' },
      }),
      politica(),
    ),
  ).toThrow(/preparación incluida/);
});

it('rechaza conceptos duplicados en impresión o terminaciones', () => {
  const datos = importes();
  expect(() =>
    componerPedidoComercial(
      { ...datos, impresion: [...datos.impresion, ...datos.impresion] },
      politica(),
    ),
  ).toThrow(/repite/);
  expect(() =>
    componerPedidoComercial(
      importes({ terminaciones: [anillado, anillado] }),
      politica(),
    ),
  ).toThrow(/repite/);
});

it('rechaza terminaciones sin un trabajo de impresión', () => {
  expect(() =>
    componerPedidoComercial(
      importes({ impresion: [], terminaciones: [anillado] }),
      politica(),
    ),
  ).toThrow(/pertenecer/);
});

it.each([
  { neto: '100', iva: '21', total: '122' },
  { neto: '100.001', iva: '21', total: '121.001' },
  { neto: '100', iva: '-1', total: '99' },
])('rechaza terminación inconsistente o sin redondear: %j', (fiscal) => {
  expect(() =>
    componerPedidoComercial(
      importes({
        terminaciones: [{ clave: 'terminacion-demo', fiscal }],
      }),
      politica(),
    ),
  ).toThrow();
});

it('rechaza desbordamiento al sumar importes permitidos individualmente', () => {
  expect(() =>
    componerPedidoComercial(
      importes({
        impresion: ['a', 'b'].map((clave) => ({
          clave,
          importeResuelto: '9'.repeat(34),
          ivaPorcentaje: '0',
        })),
      }),
      politica(),
    ),
  ).toThrow(/Importe acumulado/);
});
