import { cargosConOrigen } from '../cargos-con-origen';

const cargo = { montoNeto: 200, impuestoMonto: 42, total: 242 };
const base = {
  cargosDirectos: 242,
  cargosDirectosJson: [],
  cotizacion: { cargosDirectosCotizacionJson: [cargo] },
};

describe('Respaldo del desglose de cargos de una OT', () => {
  it('para sin comprobante compara el neto y conserva el snapshot fiscal', () => {
    expect(
      cargosConOrigen({
        ...base,
        cargosDirectos: 200,
        tratamientoFiscal: 'SIN_COMPROBANTE',
      }),
    ).toEqual([cargo]);
    expect(
      cargosConOrigen({ ...base, tratamientoFiscal: 'SIN_COMPROBANTE' }),
    ).toEqual([]);
  });

  it('compara los importes decimales a centavos', () => {
    expect(
      cargosConOrigen({
        ...base,
        cargosDirectos: { toString: () => '0.30' },
        cotizacion: {
          cargosDirectosCotizacionJson: [{ total: 0.1 }, { total: 0.2 }],
        },
      }),
    ).toEqual([{ total: 0.1 }, { total: 0.2 }]);
  });

  it.each([null, undefined, 0, -1, NaN, Infinity])(
    'no recupera sin un importe válido positivo (%s)',
    (cargosDirectos) => {
      expect(cargosConOrigen({ ...base, cargosDirectos })).toEqual([]);
    },
  );

  it.each([
    null,
    {},
    [null],
    [{ total: '' }],
    [{ total: -1 }, { total: 243 }],
    [{ total: 'mal' }],
  ])('no usa un respaldo mal formado (%j)', (cargosDirectosCotizacionJson) => {
    expect(
      cargosConOrigen({
        ...base,
        cotizacion: { cargosDirectosCotizacionJson },
      }),
    ).toEqual([]);
  });

  it('no sustituye un desglose propio inválido con otro de origen', () => {
    expect(
      cargosConOrigen({ ...base, cargosDirectosJson: { total: 242 } }),
    ).toEqual([]);
  });
});
