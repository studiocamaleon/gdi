import { PresupuestosService } from '../presupuestos.service';
import type { CurrentAuth } from '../../auth/auth.types';

const auth = { tenantId: 'tenant-1', userId: 'comercial-1' } as CurrentAuth;
function escenario() {
  const items = ['a', 'b'].map((id) => ({
    cotizacionItemId: id,
    nombre: id,
    cantidad: 10,
    subtotal: 100,
    total: 121,
  }));
  const presupuesto = {
    id: 'pres-1',
    estado: 'aprobado',
    clienteId: 'cli-1',
    emisionJson: { items, fechaEntrega: '2001-01-01', canalVenta: 'mostrador' },
  };
  const prisma = {
    ordenTrabajoItem: {
      findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValue(items),
    },
    fidelizacionReserva: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const ordenes = {
    create: jest
      .fn()
      .mockResolvedValue({
        id: 'ot-1',
        numero: 'OT-1',
        estado: 'pendiente',
        fechaEntrega: '2099-01-01',
      }),
  };
  const archivos = { revincularCotizacionAOrden: jest.fn() };
  const servicio = Object.assign(Object.create(PresupuestosService.prototype), {
    prisma,
    ordenes,
    archivos,
    capacidades: { exigir: jest.fn() },
    exigir: jest.fn().mockResolvedValue(presupuesto),
  }) as PresupuestosService;
  return { servicio, ordenes, archivos, items, prisma };
}

it('convierte en OT emitida y pide recalcular desde todos los snapshots sin modificar los precios aceptados', async () => {
  const { servicio, ordenes, items } = escenario();
  expect(await servicio.convertir(auth, 'pres-1', {})).toMatchObject({
    ordenId: 'ot-1',
    completa: true,
    itemsPendientes: 0,
  });
  expect(ordenes.create).toHaveBeenCalledWith(
    auth,
    expect.objectContaining({ estado: 'pendiente', items }),
    { conversionPresupuesto: { itemIds: ['a', 'b'] } },
  );
});

it('una conversión parcial sólo emite los ítems elegidos', async () => {
  const { servicio, ordenes, prisma, items } = escenario();
  prisma.ordenTrabajoItem.findMany
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([items[1]]);
  expect(
    await servicio.convertir(auth, 'pres-1', { itemIds: ['b'] }),
  ).toMatchObject({ parcial: true, completa: false, itemsPendientes: 1 });
  expect(ordenes.create).toHaveBeenCalledWith(
    auth,
    expect.objectContaining({ items: [items[1]] }),
    { conversionPresupuesto: { itemIds: ['a', 'b'] } },
  );
});

it('si la emisión falla propaga el error y no mueve los archivos', async () => {
  const { servicio, ordenes, archivos } = escenario();
  ordenes.create.mockRejectedValue(new Error('No se pudo estimar'));
  await expect(servicio.convertir(auth, 'pres-1', {})).rejects.toThrow(
    'No se pudo estimar',
  );
  expect(archivos.revincularCotizacionAOrden).not.toHaveBeenCalled();
});
