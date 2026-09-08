import {
  NotificacionesOrdenesService,
  fechaEntregaLegible,
} from '../notificaciones/notificaciones-ordenes.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  ContextoNotificacion,
  NotificacionesService,
} from '../notificaciones/notificaciones.service';

test('conserva el día de entrega guardado como DATE', () => {
  expect(fechaEntregaLegible(new Date('2026-09-08T00:00:00.000Z'))).toBe(
    '08/09/2026',
  );
  expect(fechaEntregaLegible(null)).toBe('a confirmar');
});
test('un cambio de entrega usa fecha anterior, nueva y una clave por revisión', async () => {
  const queue = {
    encolar: jest
      .fn<Promise<{ encolada: boolean }>, [ContextoNotificacion]>()
      .mockResolvedValue({ encolada: true }),
  };
  const db = {
    ordenTrabajo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'ot',
        tenantId: 'tenant',
        clienteId: 'cliente',
        publicToken: 'token',
        estado: 'produccion',
        numero: 'OT-1',
        cliente: { nombre: 'Ana' },
      }),
    },
    configuracionNotificaciones: {
      findFirst: jest.fn().mockResolvedValue({ canalOrdenes: 'WHATSAPP_WEB' }),
    },
  };
  const service = new NotificacionesOrdenesService(
    db as unknown as PrismaService,
    queue as unknown as NotificacionesService,
  );
  await service.cambioEntrega('ot', '2026-09-08', '2026-09-10', 'revision-1');
  expect(queue.encolar).toHaveBeenCalledWith(
    expect.objectContaining({
      evento: 'orden_demorada',
      entidadId: 'ot:revision-1',
    }),
  );
  const payload = queue.encolar.mock.calls[0][0];
  expect(payload.parametros.slice(0, 4)).toEqual([
    'Ana',
    'OT-1',
    '08/09/2026',
    '10/09/2026',
  ]);
  db.configuracionNotificaciones.findFirst.mockResolvedValue({
    canalOrdenes: 'WATI',
  });
  await service.cambioEntrega('ot', '2026-09-10', '2026-09-11', 'revision-2');
  expect(queue.encolar).toHaveBeenCalledTimes(1);
});
