import { itemVisiblePresupuesto } from '../presupuesto-importes';
import { cargosVisiblesDe } from '../presupuesto-cargos';
it('conserva el precio sin comprobante sin alterar el snapshot fiscal', () => {
  const item = { subtotal: 1000, impuestos: 210, total: 1210 };
  expect(itemVisiblePresupuesto(item, 'SIN_COMPROBANTE')).toEqual({
    subtotal: 1000,
    impuestos: 0,
    total: 1000,
  });
  expect(item.impuestos).toBe(210);
  expect(itemVisiblePresupuesto(item)).toEqual(item);
  expect(
    cargosVisiblesDe({
      tratamientoFiscal: 'SIN_COMPROBANTE',
      cargos: [{ nombreSnapshot: 'Entrega', montoNeto: 100, total: 121 }],
    }),
  ).toEqual([{ nombre: 'Entrega', descripcion: null, total: 100 }]);
});
