import type { CurrentAuth } from '../../auth/auth.types';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { ProduccionService } from '../../produccion/produccion.service';
import { MetodosPagoService } from '../../administracion/metodos-pago.service';
import { CobrosService } from '../../administracion/cobros.service';

const auth = { tenantId: 'empresa', userId: 'operador' } as CurrentAuth;
it.each(['createEstacion','updateEstacion','toggleEstacion','deleteEstacion','crearDiaNoLaborable','eliminarDiaNoLaborable','actualizarConfiguracion'] as const)('P02 deniega %s antes de escribir', async (metodo) => {
  const service = new ProduccionService({} as never, capacidadesDePrueba(['estaciones']));
  await expect(Reflect.apply(service[metodo], service, [auth, {}, {}])).rejects.toMatchObject({ status: 403, response: { capacidad: 'estaciones' } });
});
it.each(['create','update','toggle','instalarCatalogo'] as const)('F01 deniega configurar métodos mediante %s', async (metodo) => {
  const service = new MetodosPagoService({} as never, capacidadesDePrueba(['cobros']));
  await expect(Reflect.apply(service[metodo], service, [auth, {}, {}])).rejects.toMatchObject({ status: 403, response: { capacidad: 'cobros' } });
});
function cobros(orden?: object | null) {
  const findFirst = jest.fn().mockResolvedValue(orden ?? null);
  const service = new CobrosService({ ordenTrabajo: { findFirst } } as never, {} as never, {} as never, {} as never, {} as never, capacidadesDePrueba(['cobros']));
  return { service, findFirst };
}
it('sin F01 no acepta un nuevo anticipo independiente', async () => {
  const { service, findFirst } = cobros();
  await expect(service.create(auth, {} as never)).rejects.toMatchObject({ status: 403 });
  expect(findFirst).not.toHaveBeenCalled();
});
it.each([
  [{ estado: 'pendiente', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 0 }, true],
  [{ estado: 'finalizada', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 0 }, true],
  [{ estado: 'entregada', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 0 }, true],
  [{ estado: 'pendiente', cobrosHabilitadosEmision: false, total: 100, cobradoTotal: 0 }, false],
  [{ estado: 'borrador', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 0 }, false],
  [{ estado: 'cancelada', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 0 }, false],
  [{ estado: 'entregada', cobrosHabilitadosEmision: true, total: 100, cobradoTotal: 100 }, false],
  [null, false],
])('el cobro conserva continuidad según el estado de la OT: %j', async (orden, permitido) => {
  const { service, findFirst } = cobros(orden);
  expect(await service.puedeRegistrarEnOrden(auth, 'orden')).toBe(permitido);
  expect(findFirst).toHaveBeenCalledWith({ where: { tenantId: 'empresa', id: 'orden' }, select: { estado: true, cobrosHabilitadosEmision: true, total: true, cobradoTotal: true } });
});
