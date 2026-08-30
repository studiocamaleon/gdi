import { NotFoundException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { EventosSistemaService } from './eventos-sistema.service';

const auth: CurrentAuth = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
  sessionId: 'sesion-qa',
  membershipId: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@grafo.test',
};

describe('EventosSistemaService', () => {
  it('deduplica la audiencia, excluye al actor y valida membresía activa del tenant', async () => {
    const create = jest.fn().mockResolvedValue({ id: 9n });
    const prisma = {
      proyectoCampana: {
        findFirst: jest.fn().mockResolvedValue({
          responsable: { userId: auth.userId },
          equipo: [
            { empleado: { userId: 'dddddddd-dddd-4ddd-addd-dddddddddddd' } },
            { empleado: { userId: 'dddddddd-dddd-4ddd-addd-dddddddddddd' } },
          ],
        }),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'dddddddd-dddd-4ddd-addd-dddddddddddd' }]),
      },
      eventoSistema: { create },
    };
    const service = new EventosSistemaService(prisma as never);

    await service.publicarDesdeAuth(auth, {
      tipo: 'documento.aprobado',
      entidadTipo: 'campana',
      entidadId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
      titulo: 'Documento aprobado',
      mensaje: 'La versión quedó aprobada.',
      topicos: ['campana:1', 'campana:1'],
      proyectoCampanaId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberships: {
            some: { tenantId: auth.tenantId, activa: true },
          },
        }),
      }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: auth.tenantId,
        topicos: ['campana:1'],
        notificaciones: {
          create: [
            {
              tenantId: auth.tenantId,
              userId: 'dddddddd-dddd-4ddd-addd-dddddddddddd',
            },
          ],
        },
      }),
    });
  });

  it('serializa BigInt y sólo lista la bandeja del usuario y tenant actuales', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'ffffffff-ffff-4fff-afff-ffffffffffff',
        leidaEl: null,
        createdAt: new Date('2026-08-29T22:00:00.000Z'),
        evento: {
          id: 42n,
          tipo: 'produccion.paso_completar',
          actorNombre: 'Operario QA',
          titulo: 'Avance',
          mensaje: 'Paso completado.',
          href: '/produccion/ordenes/1',
          severidad: 'EXITO',
          createdAt: new Date('2026-08-29T22:00:00.000Z'),
        },
      },
    ]);
    const service = new EventosSistemaService({
      notificacionInterna: { findMany },
    } as never);

    const resultado = await service.listarNotificaciones(auth, '500');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          archivadaEl: null,
        },
        take: 100,
      }),
    );
    expect(resultado[0]?.evento.id).toBe('42');
  });

  it('no permite marcar una notificación ajena como leída', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new EventosSistemaService({
      notificacionInterna: { updateMany },
    } as never);

    await expect(
      service.marcarLeida(auth, 'ffffffff-ffff-4fff-afff-ffffffffffff'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ffffffff-ffff-4fff-afff-ffffffffffff',
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      data: { leidaEl: expect.any(Date) },
    });
  });
});
