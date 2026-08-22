import {
  EstadoConfiguracionMaquina,
  EstadoMaquina,
  RolSistema,
} from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import type { UpsertMaquinaDto } from '../dto/upsert-maquina.dto';
import { MaquinariaService } from '../maquinaria.service';

const auth: CurrentAuth = {
  userId: '44444444-4444-4444-8444-444444444444',
  sessionId: '55555555-5555-4555-8555-555555555555',
  tenantId: '11111111-1111-4111-8111-111111111111',
  membershipId: '66666666-6666-4666-8666-666666666666',
  role: RolSistema.ADMINISTRADOR,
  email: 'ana@example.com',
};

function buildService(maquina: Record<string, unknown>) {
  const prisma = {
    maquina: {
      findFirst: jest.fn().mockResolvedValue(maquina),
      update: jest.fn().mockResolvedValue(maquina),
    },
    maquinaHistorial: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (callback: (tx: typeof prisma) => unknown) =>
      Promise.resolve(callback(prisma)),
  );
  const service = new MaquinariaService(prisma as never);
  // Estos tests verifican la transición; el mapper se cubre por separado.
  (
    service as unknown as { toMaquinaResponse: (value: unknown) => unknown }
  ).toMaquinaResponse = (value) => value;
  return { service, prisma };
}

describe('MaquinariaService — disponibilidad', () => {
  it('no permite activar una máquina incompleta', async () => {
    const { service, prisma } = buildService({
      id: '22222222-2222-4222-8222-222222222222',
      activo: false,
      estadoConfiguracion: EstadoConfiguracionMaquina.INCOMPLETA,
    });

    await expect(
      service.setActivo(auth, '22222222-2222-4222-8222-222222222222', true),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.maquina.update).not.toHaveBeenCalled();
  });

  it('activa explícitamente una máquina lista y sincroniza el estado', async () => {
    const maquina = {
      id: '22222222-2222-4222-8222-222222222222',
      activo: false,
      estado: EstadoMaquina.INACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
    };
    const { service, prisma } = buildService(maquina);

    await service.setActivo(auth, maquina.id, true);

    expect(prisma.maquina.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: maquina.id },
        data: { activo: true, estado: EstadoMaquina.ACTIVA },
      }),
    );
  });

  it('desactiva explícitamente sin invertir accidentalmente la intención', async () => {
    const maquina = {
      id: '22222222-2222-4222-8222-222222222222',
      activo: false,
      estado: EstadoMaquina.INACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
    };
    const { service, prisma } = buildService(maquina);

    await service.setActivo(auth, maquina.id, false);

    expect(prisma.maquina.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { activo: false, estado: EstadoMaquina.INACTIVA },
      }),
    );
  });

  it('rechaza una edición basada en una versión desactualizada', async () => {
    const updatedAt = new Date('2026-08-16T10:00:00.000Z');
    const { service, prisma } = buildService({
      id: '22222222-2222-4222-8222-222222222222',
      codigo: 'MAQ-1',
      updatedAt,
    });

    await expect(
      service.update(auth, '22222222-2222-4222-8222-222222222222', {
        expectedUpdatedAt: '2026-08-16T09:00:00.000Z',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.maquina.update).not.toHaveBeenCalled();
  });

  it('consulta el historial dentro del tenant y devuelve fechas serializadas', async () => {
    const maquina = {
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: auth.tenantId,
    };
    const { service, prisma } = buildService(maquina);
    prisma.maquinaHistorial.findMany.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        accion: 'ACTUALIZADA',
        actorNombre: 'Ana',
        descripcion: 'Actualizó: Datos generales.',
        cambiosJson: { secciones: ['Datos generales'] },
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
      },
    ]);

    await expect(service.historial(auth, maquina.id)).resolves.toEqual([
      expect.objectContaining({
        accion: 'actualizada',
        actorNombre: 'Ana',
        createdAt: '2026-08-16T12:00:00.000Z',
      }),
    ]);
    expect(prisma.maquinaHistorial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: auth.tenantId, maquinaId: maquina.id },
      }),
    );
  });
});

describe('MaquinariaService — parámetros técnicos', () => {
  const validarParametrosTecnicos = (
    service: MaquinariaService,
    parametrosTecnicos: Record<string, unknown>,
  ) => {
    const servicio = service as unknown as {
      validateTechnicalPayload: (payload: UpsertMaquinaDto) => void;
    };
    servicio.validateTechnicalPayload({
      parametrosTecnicos,
    } as UpsertMaquinaDto);
  };

  it('admite la política configurable de uniones del corte con hilo caliente', () => {
    const { service } = buildService({});

    expect(() =>
      validarParametrosTecnicos(service, {
        tipoUnionVectorial: 'cola_milano',
        anchoEncastreMm: 30,
        profundidadEncastreMm: 30,
        modoCantidadEncastres: 'por_distancia',
        distanciaMaximaEncastresMm: 100,
        cantidadFijaEncastres: 1,
        cantidadMinimaEncastres: 1,
        cantidadMaximaEncastres: 100,
        kerfEncastreMm: 0.3,
      }),
    ).not.toThrow();
  });

  it('sigue rechazando parámetros que no pertenecen al catálogo', () => {
    const { service } = buildService({});

    expect(() =>
      validarParametrosTecnicos(service, { parametroInventado: true }),
    ).toThrow(BadRequestException);
  });
});
