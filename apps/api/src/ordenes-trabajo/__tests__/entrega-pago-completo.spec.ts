import { EntregaService } from '../entrega.service';
import type { CurrentAuth } from '../../auth/auth.types';

const auth = {
  tenantId: 'empresa-ficticia',
  userId: 'usuario-ficticio',
  email: 'operador@example.test',
} as CurrentAuth;
function preparar(pagado: number, directo = 0, estado = 'finalizada') {
  const orden = {
    id: 'orden-ficticia',
    tenantId: auth.tenantId,
    total: 100,
    cobradoTotal: 999,
    estado,
    items: [
      {
        id: 'item-ficticio',
        parentItemId: null,
        nombre: 'Copias ficticias',
        entregadoEl: null,
        pasos: [{ estado: 'hecho' }],
      },
    ],
  };
  const db = {
    ordenTrabajo: {
      findFirst: jest.fn().mockResolvedValue(orden),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ordenTrabajoItem: {
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    ordenTrabajoEvento: { create: jest.fn() },
    empleado: { findFirst: jest.fn().mockResolvedValue(null) },
    cobroOrden: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { monto: pagado } }),
    },
    cobro: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { montoBruto: directo } }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ total: 100, estado }]),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((fn) => fn(db));
  const servicio = new EntregaService(
    db as never,
    { create: jest.fn() } as never,
    { reconciliarOrden: jest.fn() } as never,
  );
  return { db, servicio };
}
it.each([0, 40, 99.99])(
  'no entrega con pago insuficiente (%s), aunque el total cacheado indique saldada',
  async (pagado) => {
    const { db, servicio } = preparar(pagado);
    await expect(
      servicio.entregar(auth, 'orden-ficticia', {
        itemIds: ['item-ficticio'],
        exigirPagoCompleto: true,
      }),
    ).rejects.toThrow('100%');
    expect(db.ordenTrabajoItem.updateMany).not.toHaveBeenCalled();
    expect(db.ordenTrabajoEvento.create).not.toHaveBeenCalled();
  },
);
it.each([
  [100, 0],
  [40, 60],
  [0, 100],
])(
  'entrega saldada con aplicaciones %s y pagos directos %s sin duplicarlos',
  async (aplicado, directo) => {
    const { db, servicio } = preparar(aplicado, directo);
    await expect(
      servicio.entregar(auth, 'orden-ficticia', {
        itemIds: ['item-ficticio'],
        exigirPagoCompleto: true,
      }),
    ).resolves.toMatchObject({ entregados: 1, ordenCerrada: true });
    expect(db.ordenTrabajo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: 'entregada', progresoPct: 100 },
      }),
    );
    expect(db.cobro.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: auth.tenantId,
          ordenId: 'orden-ficticia',
          anuladoEl: null,
          aplicacionesOrden: { none: { ordenId: 'orden-ficticia' } },
        },
      }),
    );
    expect(db.cobroOrden.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: auth.tenantId,
          ordenId: 'orden-ficticia',
          cobro: { anuladoEl: null },
        },
      }),
    );
  },
);
it('rechaza un cambio de estado durante la comprobación', async () => {
  const { db, servicio } = preparar(100);
  db.$queryRaw.mockResolvedValue([{ total: 100, estado: 'cancelada' }]);
  await expect(
    servicio.entregar(auth, 'orden-ficticia', {
      itemIds: ['item-ficticio'],
      exigirPagoCompleto: true,
    }),
  ).rejects.toThrow('finalizada');
  expect(db.ordenTrabajoItem.updateMany).not.toHaveBeenCalled();
});
it('conserva el circuito habitual de entrega cuando no se pide el cierre inmediato pagado', async () => {
  const { db, servicio } = preparar(0);
  await servicio.entregar(auth, 'orden-ficticia', {
    itemIds: ['item-ficticio'],
  });
  expect(db.$queryRaw).not.toHaveBeenCalled();
  expect(db.ordenTrabajoItem.updateMany).toHaveBeenCalled();
});
