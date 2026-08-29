import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { CampanasService } from '../campanas.service';

const auth: CurrentAuth = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
  sessionId: 'sesion-qa',
  membershipId: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@grafo.test',
};

const campana = {
  id: '11111111-1111-4111-a111-111111111111',
  tenantId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  clienteId: '22222222-2222-4222-a222-222222222222',
  responsableEmpleadoId: null,
  estado: 'borrador',
  fechaInicio: null,
  fechaObjetivo: null,
  updatedAt: new Date('2026-08-29T20:00:00.000Z'),
};

function escenario(opciones?: {
  campanaEncontrada?: boolean;
  documento?: Record<string, unknown> | null;
  actualizadas?: number;
}) {
  const eventoCreate = jest.fn().mockResolvedValue({});
  const cotizacionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const ordenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const campanaUpdateMany = jest
    .fn()
    .mockResolvedValue({ count: opciones?.actualizadas ?? 1 });
  const tx = {
    proyectoCampana: { updateMany: campanaUpdateMany },
    proyectoCampanaEvento: { create: eventoCreate },
    cotizacion: { updateMany: cotizacionUpdateMany },
    ordenTrabajo: { updateMany: ordenUpdateMany },
  };
  const prisma = {
    proyectoCampana: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opciones?.campanaEncontrada === false ? null : campana,
        ),
    },
    proyectoCampanaHito: { findFirst: jest.fn().mockResolvedValue(null) },
    cotizacion: {
      findFirst: jest.fn().mockResolvedValue(
        opciones?.documento === undefined
          ? {
              id: '33333333-3333-4333-a333-333333333333',
              numero: 'PRES-QA',
              clienteId: campana.clienteId,
              proyectoCampanaId: null,
            }
          : opciones.documento,
      ),
    },
    ordenTrabajo: { findFirst: jest.fn().mockResolvedValue(null) },
    cliente: {
      findFirst: jest.fn().mockResolvedValue({ id: campana.clienteId }),
    },
    empleado: { count: jest.fn().mockResolvedValue(0) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ nombreCompleto: 'Admin QA' }),
    },
    $transaction: jest.fn((fn: (arg: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
    ),
  };
  const service = new CampanasService(prisma as never);
  jest.spyOn(service, 'detalle').mockResolvedValue({ id: campana.id } as never);
  return {
    service,
    prisma,
    tx,
    eventoCreate,
    cotizacionUpdateMany,
    campanaUpdateMany,
  };
}

describe('CampanasService — aislamiento y consistencia', () => {
  it('acota el detalle por tenant y oculta campañas ajenas como 404', async () => {
    const { prisma } = escenario({ campanaEncontrada: false });
    jest.restoreAllMocks();
    const realService = new CampanasService(prisma as never);

    await expect(realService.detalle(auth, campana.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.proyectoCampana.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: campana.id, tenantId: auth.tenantId },
      }),
    );
  });

  it('rechaza vincular un documento de otro cliente', async () => {
    const { service, prisma } = escenario({
      documento: {
        id: '33333333-3333-4333-a333-333333333333',
        numero: 'PRES-AJENO',
        clienteId: '44444444-4444-4444-a444-444444444444',
        proyectoCampanaId: null,
      },
    });

    await expect(
      service.vincularCotizacion(
        auth,
        campana.id,
        '33333333-3333-4333-a333-333333333333',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no permite robar un documento asignado a otra campaña', async () => {
    const { service, prisma } = escenario({
      documento: {
        id: '33333333-3333-4333-a333-333333333333',
        numero: 'PRES-OTRA',
        clienteId: campana.clienteId,
        proyectoCampanaId: '55555555-5555-4555-a555-555555555555',
      },
    });

    await expect(
      service.vincularCotizacion(
        auth,
        campana.id,
        '33333333-3333-4333-a333-333333333333',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('vincula y audita dentro de la misma transacción con filtro de tenant', async () => {
    const { service, cotizacionUpdateMany, eventoCreate } = escenario();

    await service.vincularCotizacion(
      auth,
      campana.id,
      '33333333-3333-4333-a333-333333333333',
    );

    expect(cotizacionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: '33333333-3333-4333-a333-333333333333',
        tenantId: auth.tenantId,
      },
      data: { proyectoCampanaId: campana.id },
    });
    expect(eventoCreate).toHaveBeenCalledTimes(1);
    // Jest expone las llamadas de un mock sin genérico como `any`; acá se
    // tipa únicamente la forma mínima que el contrato del evento garantiza.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const llamadaEvento = eventoCreate.mock.calls[0][0] as {
      data: { tenantId: string; proyectoCampanaId: string; tipo: string };
    };
    expect(llamadaEvento.data).toMatchObject({
      tenantId: auth.tenantId,
      proyectoCampanaId: campana.id,
      tipo: 'vinculo',
    });
  });

  it('detecta una edición concurrente mediante updatedAt', async () => {
    const { service, campanaUpdateMany, eventoCreate } = escenario({
      actualizadas: 0,
    });

    await expect(
      service.editar(auth, campana.id, {
        updatedAt: campana.updatedAt.toISOString(),
        nombre: 'Cambio concurrente',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(campanaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: campana.id,
          tenantId: auth.tenantId,
          updatedAt: campana.updatedAt,
        },
      }),
    );
    expect(eventoCreate).not.toHaveBeenCalled();
  });

  it('rechaza personas repetidas en el equipo antes de escribir', async () => {
    const { service, prisma } = escenario();
    const empleadoId = '66666666-6666-4666-a666-666666666666';

    await expect(
      service.reemplazarEquipo(auth, campana.id, {
        equipo: [{ empleadoId }, { empleadoId }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('acota la búsqueda de hitos por tenant y campaña', async () => {
    const { service, prisma } = escenario();

    await expect(
      service.editarHito(
        auth,
        campana.id,
        '77777777-7777-4777-a777-777777777777',
        {
          updatedAt: '2026-08-29T20:00:00.000Z',
          estado: 'completado',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.proyectoCampanaHito.findFirst).toHaveBeenCalledWith({
      where: {
        id: '77777777-7777-4777-a777-777777777777',
        proyectoCampanaId: campana.id,
        tenantId: auth.tenantId,
      },
    });
  });
});
