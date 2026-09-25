import { NotFoundException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';

const email = 'admin@demo.example.invalid';
const fecha = new Date('2026-09-25T12:00:00Z');
const auth = { tenantId: 'empresa-demo', userId: 'otro-lector' } as CurrentAuth;

function escenario() {
  const emision = {
    tipo: 'emision',
    fecha,
    datosJson: null,
    usuarioNombre: email,
    usuario: { nombreCompleto: ' Lucas German ', email } as {
      nombreCompleto: string | null;
      email: string;
    } | null,
  };
  const evento = {
    tipo: 'emision',
    fecha,
    descripcion: 'Orden emitida',
    usuarioNombre: email,
  };
  const orden = {
    id: 'orden-demo',
    estado: 'pendiente',
    publicToken: 'token-ficticio-ya-existente',
    createdAt: fecha,
    updatedAt: fecha,
    vendedorEmpleadoId: null as string | null,
    vendedor: null as { nombreCompleto: string } | null,
    items: [],
    eventos: [evento],
    _count: { items: 0, eventos: 1 },
  };
  const prisma = {
    ordenTrabajo: { findFirst: jest.fn().mockResolvedValue(orden) },
    ordenTrabajoEvento: {
      findMany: jest.fn().mockResolvedValue([emision]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    loteProduccionEntrega: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
  Object.assign(service, { prisma });
  return { service, prisma, orden, emision, evento };
}

describe('vendedor en el detalle de la OT', () => {
  it('usa el nombre agregado al perfil del emisor, sin reescribir su firma histórica', async () => {
    const { service, prisma, evento } = escenario();
    const detalle = await service.findOne(auth, 'orden-demo');

    expect(detalle.vendedorNombre).toBe('Lucas German');
    expect(detalle.vendedorEmpleadoId).toBeNull();
    expect(detalle.eventos).toEqual([
      { ...evento, fecha: fecha.toISOString() },
    ]);
    expect(prisma.ordenTrabajo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'orden-demo', tenantId: 'empresa-demo' },
      }),
    );
    expect(prisma.ordenTrabajoEvento.findMany).toHaveBeenCalledWith({
      where: {
        ordenId: 'orden-demo',
        tenantId: 'empresa-demo',
        tipo: { in: ['borrador', 'emision', 'estado'] },
      },
      select: {
        tipo: true,
        fecha: true,
        datosJson: true,
        usuarioNombre: true,
        usuario: { select: { nombreCompleto: true, email: true } },
      },
      orderBy: { fecha: 'asc' },
    });
  });

  it('respeta al vendedor asignado aunque otra persona haya emitido la orden', async () => {
    const { service, orden } = escenario();
    orden.vendedorEmpleadoId = 'vendedora-asignada';
    orden.vendedor = { nombreCompleto: 'Ana Vendedora' };
    const detalle = await service.findOne(auth, 'orden-demo');
    expect(detalle.vendedorNombre).toBe('Ana Vendedora');
    expect(detalle.vendedorEmpleadoId).toBe('vendedora-asignada');
  });

  it('resuelve la primera emisión fuera del historial limitado, sin usar a un actor posterior', async () => {
    const { service, prisma, orden, emision } = escenario();
    orden.eventos = [];
    orden._count.eventos = 250;
    prisma.ordenTrabajoEvento.findMany.mockResolvedValue([
      emision,
      {
        ...emision,
        fecha: new Date('2026-09-26T12:00:00Z'),
        usuarioNombre: 'otro@demo.example.invalid',
        usuario: {
          email: 'otro@demo.example.invalid',
          nombreCompleto: 'Otra persona',
        },
      },
    ]);
    expect((await service.findOne(auth, 'orden-demo')).vendedorNombre).toBe(
      'Lucas German',
    );
  });

  it.each([null, '', '   '])(
    'conserva el correo si el perfil no tiene nombre (%p)',
    async (nombreCompleto) => {
      const { service, emision } = escenario();
      emision.usuario = { nombreCompleto, email };
      expect((await service.findOne(auth, 'orden-demo')).vendedorNombre).toBe(
        email,
      );
    },
  );

  it('conserva la firma si el usuario fue eliminado o el evento no tiene usuario asociado', async () => {
    const { service, emision } = escenario();
    emision.usuario = null;
    expect((await service.findOne(auth, 'orden-demo')).vendedorNombre).toBe(
      email,
    );
  });

  it.each(['Soporte Grafo (Operador)', 'Sistema', 'Nombre histórico'])(
    'preserva la firma %s',
    async (firma) => {
      const { service, emision } = escenario();
      emision.usuarioNombre = firma;
      expect((await service.findOne(auth, 'orden-demo')).vendedorNombre).toBe(
        firma,
      );
    },
  );

  it('no atribuye el borrador al usuario que lo está consultando', async () => {
    const { service, prisma, orden } = escenario();
    orden.estado = 'borrador';
    orden.eventos = [];
    prisma.ordenTrabajoEvento.findMany.mockResolvedValue([]);
    expect((await service.findOne(auth, 'orden-demo')).vendedorNombre).toBe(
      '—',
    );
  });

  it('no consulta autores si la OT no pertenece a la empresa de la sesión', async () => {
    const { service, prisma } = escenario();
    prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
    await expect(service.findOne(auth, 'otra-orden')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.ordenTrabajoEvento.findMany).not.toHaveBeenCalled();
  });
});
