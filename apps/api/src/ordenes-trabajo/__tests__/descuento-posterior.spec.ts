import {
  descontarLineaPersistida,
  validarAjustePosterior,
  validarTotalCobrado,
} from '../descuento-posterior';
import { planDescuentoCupon } from '../../cupones/cupon-reglas';
const iva = [
  { porcentaje: 21, traslado: 'POR_FUERA' },
  { porcentaje: 3.5, traslado: 'POR_DENTRO' },
];
const linea = {
  subtotal: 1000,
  impuestos: 210,
  descuentoMonto: 0,
  impuestosSnapshotJson: iva,
};
it('descuenta el neto y su IVA, sin descontar dos veces IIBB', () => {
  expect(
    descontarLineaPersistida(linea, { tipo: 'PORCENTAJE', valor: 10 }, 2),
  ).toEqual({
    subtotal: 900,
    impuestos: 189,
    total: 1089,
    descuentoTipo: 'PORCENTAJE',
    descuentoValor: 10,
    descuentoMonto: 100,
  });
});
it('reemplaza un descuento previo sobre la misma lista y permite quitarlo', () => {
  const anterior = {
    ...linea,
    subtotal: 900,
    impuestos: 189,
    descuentoMonto: 100,
  };
  expect(
    descontarLineaPersistida(anterior, { tipo: 'PORCENTAJE', valor: 20 }, 2)
      .subtotal,
  ).toBe(800);
  expect(descontarLineaPersistida(anterior, null, 2).total).toBe(1210);
});
it('conserva impuestos exentos y otras alícuotas guardadas', () => {
  expect(
    descontarLineaPersistida(
      { ...linea, impuestosSnapshotJson: [] },
      { tipo: 'MONTO', valor: 100 },
      2,
    ).total,
  ).toBe(900);
  expect(
    descontarLineaPersistida(
      {
        ...linea,
        impuestosSnapshotJson: [{ porcentaje: 10.5, traslado: 'POR_FUERA' }],
      },
      { tipo: 'MONTO', valor: 100 },
      2,
    ).total,
  ).toBe(994.5);
});
it('puede quitar un descuento del 100% usando la alícuota histórica', () => {
  expect(
    descontarLineaPersistida(
      { ...linea, subtotal: 0, impuestos: 0, descuentoMonto: 1000 },
      null,
      2,
    ).total,
  ).toBe(1210);
});
it.each([-1, 101, Infinity, NaN])('rechaza porcentaje %s', (valor) => {
  expect(() =>
    descontarLineaPersistida(linea, { tipo: 'PORCENTAJE', valor }, 2),
  ).toThrow();
});
it('un monto repartido entre varias líneas conserva centavos exactos', () => {
  const items = [1, 2, 3].map((i) => ({ key: String(i), neto: 100 }));
  const plan = planDescuentoCupon(
    { tipo: 'MONTO', valor: 10 },
    items,
    items.map((i) => i.key),
    2,
  );
  expect(plan.reduce((s, p) => s + p.valor, 0)).toBe(10);
  expect(
    plan.map(
      (p) =>
        descontarLineaPersistida({ ...linea, subtotal: 100 }, p, 2)
          .descuentoMonto,
    ),
  ).toEqual([3.34, 3.33, 3.33]);
});
const orden = {
  estado: 'finalizada',
  facturadoTotal: 0,
  updatedAt: new Date('2026-10-06T12:00:00Z'),
};
it('permite una OT terminada sin facturación y con versión vigente', () => {
  expect(() =>
    validarAjustePosterior(orden, orden.updatedAt.toISOString(), false),
  ).not.toThrow();
});
it.each(['cancelada', 'facturada', 'comprobante pendiente', 'versión vieja'])(
  'rechaza %s',
  (caso) => {
    expect(() =>
      validarAjustePosterior(
        {
          ...orden,
          estado: caso === 'cancelada' ? 'cancelada' : orden.estado,
          facturadoTotal: caso === 'facturada' ? 1 : 0,
        },
        caso === 'versión vieja' ? '2026-10-05' : orden.updatedAt.toISOString(),
        caso === 'comprobante pendiente',
      ),
    ).toThrow();
  },
);
it('rechaza bajar del importe cobrado y acepta el mismo total', () => {
  expect(() => validarTotalCobrado(899.99, 900)).toThrow('cobrado');
  expect(() => validarTotalCobrado(900, 900)).not.toThrow();
});
