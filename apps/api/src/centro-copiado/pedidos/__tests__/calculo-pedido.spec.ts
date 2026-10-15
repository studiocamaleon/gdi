import { documentoCad, filaCad } from '../../comercial/__tests__/fixtures-cad';
import {
  calcularPedidoCopiado,
  repartir,
  type LineaPedidoCopiado,
} from '../calculo-pedido';
import { contenidoEjemplo } from '../../tarifarios/__tests__/fixtures';
import { documento } from '../../comercial/__tests__/fixtures';
const ref = {
  tenantId: 'empresa-ficticia',
  tarifarioId: 'tarifa',
  versionId: 'v1',
  modalidad: 'TARIFARIO' as const,
  politicaRevision: 1,
  canalVenta: 'mostrador' as const,
  monedaCodigo: 'ARS',
};
function linea(id: string, paginas = 1): LineaPedidoCopiado {
  return {
    id,
    documentos: [
      documento(id, {
        paginas,
        papelMateriaPrimaId: '00000000-0000-4000-8000-000000000001',
        faz: 2,
      }),
    ],
    ivaPorcentaje: '21',
    costoImpresion: '20',
    costoTerminaciones: '0',
    terminacionesNeto: '0',
    acuerdoImpresionNeto: null,
    cargas: [],
    descuento: null,
  };
}
function input(lineas = [linea('a')]) {
  const contenido = contenidoEjemplo();
  contenido.margen = {
    minimoPorcentaje: '25',
    anteInsuficiente: 'AUTORIZACION',
  };
  contenido.hojas!.filas[0].precios = [
    { desdeCantidad: 1, precioUnitario: '121' },
    { desdeCantidad: 100, precioUnitario: '96.8' },
  ];
  return {
    referencia: ref,
    contenido,
    lineas,
    decimales: 2,
    tratamientoFiscal: 'FISCAL' as const,
  };
}
it('acumula 100 hojas de dos cargas y cobra el tramo a todas, con preparación única', () => {
  const i = input([linea('a', 100), linea('b', 100)]);
  i.contenido.composicion.preparacion = {
    modalidad: 'FIJA_PEDIDO',
    importe: '121',
  };
  const r = calcularPedidoCopiado(i);
  expect(r.grupos[0]).toMatchObject({ cantidad: '100', desde: '100' });
  expect(r.composicion.total?.total).toBe('9801.00');
  expect(r.precios.reduce((s, p) => s + Number(p.precio?.total), 0)).toBe(9801);
});
it('separa última hoja simple de cada original impar', () => {
  const i = input([linea('a', 3), linea('b', 3)]);
  i.contenido.hojas!.reglas.ultimaHojaImpar = 'COBRAR_SIMPLE';
  i.contenido.hojas!.filas.push({
    ...i.contenido.hojas!.filas[0],
    combinacion: { ...i.contenido.hojas!.filas[0].combinacion, faz: 1 },
    precios: [{ desdeCantidad: 1, precioUnitario: '60.5' }],
  });
  const r = calcularPedidoCopiado(i);
  expect(r.grupos.map((g) => g.cantidad)).toEqual(['2', '2']);
  expect(r.composicion.total?.total).toBe('363.00');
});
it('acuerdo prioritario, descuento explícito y mínimo después del descuento; terminaciones aparte', () => {
  const l = linea('a');
  l.acuerdoImpresionNeto = '20';
  l.terminacionesNeto = '100';
  l.descuento = { tipo: 'PORCENTAJE', valor: '50' };
  const i = input([l]);
  i.contenido.composicion.minimo = {
    modalidad: 'IMPORTE_PEDIDO',
    importe: '121',
  };
  const r = calcularPedidoCopiado(i);
  expect(r.precios[0].precio?.impresionNeto).toBe('100.00');
  expect(r.composicion.total?.neto).toBe('150.00');
});
it('no permite que ganancias de terminaciones oculten pérdida de impresión', () => {
  const l = linea('a');
  l.costoImpresion = '110';
  l.terminacionesNeto = '1000';
  const r = calcularPedidoCopiado(input([l]));
  expect(r.control.estado).toBe('CALCULADO');
  expect(r.control.porcentaje).toBe('-10.00');
});
it('ignora políticas antiguas de bloqueo y distingue costos faltantes', () => {
  const i = input();
  i.lineas[0].costoImpresion = '110';
  i.contenido.margen!.anteInsuficiente = 'BLOQUEO';
  expect(calcularPedidoCopiado(i).control.estado).toBe('CALCULADO');
  i.lineas[0].costoImpresion = null;
  expect(calcularPedidoCopiado(i).control.estado).toBe('NO_VERIFICABLE');
});
it('un precio ausente nunca se convierte en cero o respaldo implícito', () => {
  const i = input();
  i.contenido.hojas!.filas = [];
  const r = calcularPedidoCopiado(i);
  expect(r.estado).toBe('PRECIO_PENDIENTE');
  expect(r.precios[0].precio).toBeNull();
});
it('reparte centavos sin perder dinero y sin depender de ordenar las cargas', () => {
  expect(
    repartir('0.01', ['1', '1', '1'], 2).reduce((s, v) => s + Number(v), 0),
  ).toBe(0.01);
  const i = input([linea('b'), linea('a')]);
  const a = calcularPedidoCopiado(i);
  i.lineas.reverse();
  expect(calcularPedidoCopiado(i)).toEqual(a);
});
it('comisiones sobre bruto consideran el tratamiento fiscal del pedido', () => {
  const i = input();
  i.lineas[0].cargas = [
    {
      clave: 'c',
      nombre: 'Comisión ficticia',
      tipo: 'COMISION',
      base: 'BRUTO_COBRADO',
      porcentaje: '10',
    },
  ];
  expect(calcularPedidoCopiado(i).control.cargasTotal).toBe('12.10');
  expect(
    calcularPedidoCopiado({ ...i, tratamientoFiscal: 'SIN_COMPROBANTE' })
      .control.cargasTotal,
  ).toBe('10.00');
});

it('acumula CAD por papel consumido y redondea una vez antes de repartir las líneas', () => {
  const a = linea('a'),
    b = linea('b');
  a.documentos = [documentoCad('plano-a')];
  b.documentos = [documentoCad('plano-b')];
  const i = input([a, b]);
  const fila = filaCad();
  i.contenido.cad!.filas = [
    {
      ...fila,
      precios: [...fila.precios],
      rangosPropios: fila.rangosPropios ? [...fila.rangosPropios] : null,
    },
  ];
  i.contenido.cad!.rangosGenerales = ['0', '4'];
  i.contenido.cad!.reglas.redondeo = {
    modalidad: 'HACIA_ARRIBA',
    incrementoMl: '1',
  };
  const r = calcularPedidoCopiado(i);
  expect(r.grupos).toHaveLength(1);
  expect(r.composicion.total?.total).toBe('15000.00');
  expect(r.precios.reduce((s, p) => s + Number(p.precio?.total), 0)).toBe(
    15000,
  );
});
it('las coberturas diferenciadas conservan tramos separados al reunir cargas', () => {
  const i = input([linea('a', 100), linea('b', 100)]);
  i.lineas[0].documentos[0].cobertura = 'borrador';
  i.lineas[1].documentos[0].cobertura = 'alta';
  i.contenido.hojas!.reglas.cobertura = 'DIFERENCIADA';
  const fila = i.contenido.hojas!.filas[0];
  i.contenido.hojas!.filas = ['borrador', 'alta'].map((cobertura) => ({
    ...fila,
    combinacion: {
      ...fila.combinacion,
      cobertura: cobertura as 'borrador' | 'alta',
    },
  }));
  const r = calcularPedidoCopiado(i);
  expect(r.grupos.map((g) => [g.cantidad, g.desde])).toEqual([
    ['50', '1'],
    ['50', '1'],
  ]);
  expect(r.composicion.total?.total).toBe('12100.00');
});

it('cotiza el pedido con medidas PDF fraccionarias y conserva el total al repartir sus cargas', () => {
  const lineas = [1, 5].map((copias, n) => ({
    ...linea(`carga-${n}`),
    documentos: [
      documentoCad(`plano-${n}`, {
        copias,
        medidasPaginas: [{ anchoMm: 594, altoMm: 2383.94 * (25.4 / 72) }],
      }),
    ],
  }));
  const i = input(lineas);
  const fila = filaCad();
  i.contenido.cad!.filas = [{ ...fila, precios: [...fila.precios] }];
  i.contenido.cad!.rangosGenerales = ['0', '4'];
  const r = calcularPedidoCopiado(i);
  expect(r.estado).toBe('CALCULADO');
  expect(r.grupos).toEqual([
    { unidad: 'ML', cantidad: '5.106006333336', desde: '4', precio: '4000' },
  ]);
  // El pedido suma los importes fiscales redondeados de cada renglón.
  expect(r.composicion.total).toMatchObject({
    neto: '16879.35',
    iva: '3544.67',
    total: '20424.02',
  });
  expect(r.precios.reduce((sum, p) => sum + Number(p.precio?.total), 0)).toBe(
    20424.02,
  );
  expect(r.control.estado).toBe('CALCULADO');
});

it('evalúa contribución de impresión y terminaciones sin descontar tiempo interno', () => {
  const l = linea('a');
  l.costoImpresion = '110';
  l.costoVariableImpresion = '20';
  l.terminacionesNeto = '100';
  l.costoTerminaciones = '120';
  l.costoVariableTerminaciones = '40';
  const r = calcularPedidoCopiado(input([l]));
  expect(r.costoImpresion).toBe('110.00');
  expect(r.control).toMatchObject({
    metrica: 'CONTRIBUCION',
    estado: 'CALCULADO',
    porcentaje: '80.00',
  });
  expect(r.terminaciones[0].control).toMatchObject({
    metrica: 'CONTRIBUCION',
    estado: 'CALCULADO',
    porcentaje: '60.00',
  });
  l.costoVariableImpresion = null;
  expect(calcularPedidoCopiado(input([l])).control.estado).toBe(
    'NO_VERIFICABLE',
  );
  l.costoVariableTerminaciones = null;
  expect(
    calcularPedidoCopiado(input([l])).terminaciones[0].control.estado,
  ).toBe('NO_VERIFICABLE');
});
