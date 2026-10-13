import { evaluarMargen, type CargaMargen } from '../control-margen';
import { referenciaComercialMotor } from '../../tarifarios/referencia-comercial-motor';
import { validarContenidoTarifario } from '../../tarifarios/contenido-tarifario';
import { contenidoEjemplo } from '../../tarifarios/__tests__/fixtures';

const politica = {
  minimoPorcentaje: '20',
  anteInsuficiente: 'AUTORIZACION' as const,
};
const calcular = (
  costo = '8000',
  cargas: CargaMargen[] | null = [],
  neto = '10000',
  total = '12100',
) =>
  evaluarMargen({
    ventas: [{ neto, total, cargas }],
    costoProduccion: costo,
    decimales: 2,
  });
const carga = (
  clave: string,
  porcentaje: string,
  base: CargaMargen['base'],
  tipo: CargaMargen['tipo'] = 'COMISION',
): CargaMargen => ({ clave, nombre: 'Cargo ficticio', porcentaje, base, tipo });

it.each([
  ['8000', '20.00', 'CALCULADO'],
  ['9200', '8.00', 'CALCULADO'],
  ['10500', '-5.00', 'CALCULADO'],
])(
  'evalúa costo %s con margen sobre venta neta',
  (costo, porcentaje, estado) => {
    expect(calcular(costo)).toMatchObject({ porcentaje, estado });
  },
);
it('descuenta cargas sobre sus bases y no resta IVA como costo', () => {
  expect(
    calcular('8000', [
      carga('pasarela', '6', 'BRUTO_COBRADO'),
      carga('vendedor', '5', 'NETO'),
      carga('interno', '3.5', 'NETO', 'IMPUESTO_INTERNO'),
      carga('bancario', '0.6', 'BRUTO_COBRADO', 'IMPUESTO_INTERNO'),
    ]),
  ).toMatchObject({
    cargasTotal: '1648.60',
    utilidad: '351.40',
    porcentaje: '3.51',
    estado: 'CALCULADO',
  });
});
it('conserva el cálculo aunque el porcentaje visible redondee', () => {
  expect(calcular('8000.001')).toMatchObject({
    porcentaje: '20.00',
    estado: 'CALCULADO',
  });
});
it('una pérdida es informativa y no modifica el precio', () => {
  expect(
    evaluarMargen({
      ventas: [{ neto: '100', total: '121', cargas: [] }],
      costoProduccion: '110',
      decimales: 2,
    }),
  ).toMatchObject({ estado: 'CALCULADO', negativo: true, utilidad: '-10.00' });
});
it('distingue costos/cargas faltantes y calcula sin exigir un umbral', () => {
  expect(calcular('0', null).estado).toBe('NO_VERIFICABLE');
  expect(
    evaluarMargen({
      ventas: [{ neto: '100', total: '121', cargas: [] }],
      costoProduccion: null,
      decimales: 2,
    }).utilidad,
  ).toBeNull();
  expect(
    evaluarMargen({
      ventas: [{ neto: '100', total: '121', cargas: [] }],
      costoProduccion: '80',
      decimales: 2,
    }),
  ).toMatchObject({ estado: 'CALCULADO', porcentaje: '20.00' });
});
it('precio cero informa pérdida sin dividir por cero', () => {
  expect(calcular('60', [], '0', '0')).toMatchObject({
    utilidad: '-60.00',
    porcentaje: null,
    estado: 'CALCULADO',
  });
});
it('acumula cargos antes de redondear y rechaza cargos duplicados', () => {
  const cargos = [carga('comision', '5', 'NETO')];
  const ventas = Array.from({ length: 100 }, () => ({
    neto: '0.1',
    total: '0.1',
    cargas: cargos,
  }));
  expect(
    evaluarMargen({ ventas, costoProduccion: '1', decimales: 2 }).cargasTotal,
  ).toBe('0.50');
  expect(calcular('1', [...cargos, ...cargos]).estado).toBe('NO_VERIFICABLE');
});
it('usa las ventas ya ajustadas y evalúa terminaciones en una cuenta independiente', () => {
  const impresion = calcular('80', [], '90', '108.90');
  const terminaciones = calcular('10', [], '1000', '1210');
  expect(impresion.estado).toBe('CALCULADO');
  expect(terminaciones.estado).toBe('CALCULADO');
});
it.each(['-1', '100', 'NaN', '1.00001', ''])(
  'rechaza margen de tarifario inválido %s',
  (minimoPorcentaje) => {
    expect(() =>
      validarContenidoTarifario({
        ...contenidoEjemplo(),
        margen: { ...politica, minimoPorcentaje },
      }),
    ).toThrow();
  },
);
it('mantiene versiones anteriores sin reescribir y admite la política explícita', () => {
  expect(validarContenidoTarifario(contenidoEjemplo()).margen).toBeUndefined();
  expect(
    validarContenidoTarifario({ ...contenidoEjemplo(), margen: politica })
      .margen,
  ).toEqual(politica);
});

const cotizacion = () => ({
  desglosePrecio: {
    precioNetoTotal: 100,
    precioConfig: { metodoCalculo: 'por_margen' },
    impuestos: [
      {
        catalogoId: 'iva',
        nombre: 'IVA ficticio',
        porcentaje: 21,
        traslado: 'POR_FUERA',
        baseCalculo: 'NETO',
      },
      {
        catalogoId: 'interno',
        nombre: 'Interno ficticio',
        porcentaje: 3,
        traslado: 'POR_DENTRO',
        baseCalculo: 'NETO',
      },
    ],
    comisiones: [
      {
        catalogoId: 'comision',
        nombre: 'Comisión ficticia',
        porcentaje: 6,
        baseCalculo: 'BRUTO_COBRADO',
      },
    ],
  },
});
it('toma tasas y venta del mismo snapshot del motor, sin duplicarlas por segmento', () => {
  const r = referenciaComercialMotor(
    [cotizacion(), cotizacion()] as never,
    '21',
  );
  expect(r.ventaMotorNeta).toBe('200');
  expect(r.cargas).toHaveLength(2);
});
it('rehúsa sugerir si falta desglose, base, IVA coherente o cambian las tasas entre segmentos', () => {
  expect(referenciaComercialMotor([{}] as never, '21').cargas).toBeNull();
  const c = cotizacion();
  c.desglosePrecio.comisiones[0].baseCalculo = '';
  expect(
    referenciaComercialMotor([c] as never, '21').ventaMotorNeta,
  ).toBeNull();
  expect(
    referenciaComercialMotor([cotizacion()] as never, '0').cargas,
  ).toBeNull();
  const otra = cotizacion();
  otra.desglosePrecio.comisiones[0].porcentaje = 10;
  expect(
    referenciaComercialMotor([cotizacion(), otra] as never, '21').cargas,
  ).toBeNull();
});

it('el redondeo no genera decisiones de autorización', () => {
  const entrada = {
    ventas: [{ neto: '100.01', total: '100.01', cargas: [] }],
    costoProduccion: '60.01',
    decimales: 2,
  };
  expect(evaluarMargen(entrada)).toMatchObject({
    estado: 'CALCULADO',
    porcentaje: '40.00',
  });
  expect(evaluarMargen({ ...entrada, costoProduccion: '60.02' }).estado).toBe(
    'CALCULADO',
  );
  expect(
    evaluarMargen({
      ...entrada,
      costoProduccion: '100.02',
    }).estado,
  ).toBe('CALCULADO');
});
