import { MessageEvent, NotFoundException } from '@nestjs/common';
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
  it.each([false, true])(
    'la audiencia general respeta incluirActor=%s y el tenant activo',
    async (incluirActor) => {
      const findMany = jest.fn().mockResolvedValue([{ id: 'destinatario' }]);
      const create = jest.fn().mockResolvedValue({ id: 1n });
      const service = new EventosSistemaService({
        user: { findMany },
        eventoSistema: { create },
      } as never);
      await service.publicarDesdeAuth(auth, {
        tipo: 'prueba',
        entidadTipo: 'presupuesto',
        titulo: 'Aviso',
        mensaje: 'Mensaje',
        topicos: [],
        todosLosUsuariosDelTenant: true,
        incluirActor,
      });
      expect(findMany).toHaveBeenCalledWith({
        where: {
          ...(incluirActor ? {} : { id: { not: auth.userId } }),
          activo: true,
          memberships: { some: { tenantId: auth.tenantId, activa: true } },
        },
        select: { id: true },
      });
    },
  );

  it('sin audiencia explícita no convierte eventos anteriores en avisos para toda la empresa', async () => {
    const findMany = jest.fn();
    const create = jest.fn().mockResolvedValue({ id: 1n });
    const service = new EventosSistemaService({
      user: { findMany },
      eventoSistema: { create },
    } as never);
    await service.publicarDesdeAuth(auth, {
      tipo: 'prueba',
      entidadTipo: 'presupuesto',
      titulo: 'Aviso',
      mensaje: 'Mensaje',
      topicos: [],
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.notificaciones).toBeUndefined();
  });

  describe('canal en vivo', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function preparar() {
      const prisma = {
        eventoSistema: {
          findFirst: jest.fn().mockResolvedValue({ id: 40n }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        notificacionInterna: { count: jest.fn().mockResolvedValue(2) },
      };
      return { prisma, service: new EventosSistemaService(prisma as never) };
    }

    it('conserva el cursor real en el inicio y los latidos, y libera los timers al salir', async () => {
      const { service } = preparar();
      const eventos: MessageEvent[] = [];
      const suscripcion = service
        .stream(auth)
        .subscribe((evento) => eventos.push(evento));
      try {
        await jest.advanceTimersByTimeAsync(15_000);
        expect(eventos).toEqual([
          expect.objectContaining({
            type: 'ready',
            id: '40',
            data: { ultimoId: '40', noLeidas: 2 },
          }),
          expect.objectContaining({ type: 'heartbeat', id: '40' }),
        ]);
        expect(suscripcion.closed).toBe(false);
      } finally {
        suscripcion.unsubscribe();
      }
      expect(jest.getTimerCount()).toBe(0);
    });

    it('confirma la reconexión y reproduce los eventos posteriores al cursor recibido', async () => {
      const { prisma, service } = preparar();
      prisma.eventoSistema.findMany.mockResolvedValueOnce([
        {
          id: 41n,
          tipo: 'produccion.paso_completar',
          topicos: ['tablero-produccion'],
          createdAt: new Date('2026-09-14T19:00:00Z'),
        },
      ]);
      const eventos: MessageEvent[] = [];
      const suscripcion = service
        .stream(auth, '40')
        .subscribe((evento) => eventos.push(evento));
      try {
        await jest.advanceTimersByTimeAsync(15_000);
        expect(prisma.eventoSistema.findFirst).not.toHaveBeenCalled();
        expect(prisma.eventoSistema.findMany).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: { tenantId: auth.tenantId, id: { gt: 40n } },
          }),
        );
        expect(eventos.map((evento) => [evento.type, evento.id])).toEqual([
          ['ready', '40'],
          ['cambio', '41'],
          ['heartbeat', '41'],
        ]);
      } finally {
        suscripcion.unsubscribe();
      }
    });
  });

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
