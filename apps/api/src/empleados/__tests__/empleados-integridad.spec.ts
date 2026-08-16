import { BadRequestException, ConflictException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { EmpleadosQueryDto } from '../dto/empleados-query.dto';
import { EmpleadosService } from '../empleados.service';
import type { AuthService } from '../../auth/auth.service';

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@empresa.test',
  permisos: new Set([
    'registros.gestionar_empleados',
    'registros.ver_comisiones',
  ]),
};

const FECHA = new Date('2026-08-16T12:00:00.000Z');

function empleado() {
  return {
    id: 'e1',
    tenantId: AUTH.tenantId,
    userId: null,
    nombreCompleto: 'Ana Pérez',
    emailPrincipal: 'ana@empresa.test',
    telefonoCodigo: '54',
    telefonoNumero: '1122334455',
    sector: 'Ventas',
    ocupacion: null,
    sexo: null,
    fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
    comisionesHabilitadas: false,
    activo: true,
    fechaBaja: null,
    motivoBaja: null,
    createdAt: FECHA,
    updatedAt: FECHA,
    direcciones: [],
    comisiones: [],
    eventos: [],
    user: null,
  };
}

const payload = {
  nombreCompleto: 'Ana Pérez',
  email: 'ana@empresa.test',
  telefonoCodigo: '54',
  telefonoNumero: '1122334455',
  sector: 'Ventas',
  fechaIngreso: '2025-01-01',
  fechaNacimiento: '1990-01-01',
  comisionesHabilitadas: false,
  direcciones: [],
  comisiones: [],
};

describe('integridad de empleados', () => {
  const revokeEmployeeAccessInTransaction = jest
    .fn()
    .mockResolvedValue(undefined);
  const authService = {
    revokeEmployeeAccessInTransaction,
  } as unknown as AuthService;

  beforeEach(() => jest.clearAllMocks());

  it('busca en backend y excluye bajas por defecto', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      empleado: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const query = new EmpleadosQueryDto();
    query.q = 'Ana';

    await new EmpleadosService(prisma, authService).findAll(AUTH, query);

    const consulta = JSON.stringify(findMany.mock.calls[0]);
    expect(consulta).toContain(`"tenantId":"${AUTH.tenantId}"`);
    expect(consulta).toContain('"activo":true');
    expect(consulta).toContain('"OR"');
  });

  it('el catálogo operativo contiene sólo empleados activos', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { empleado: { findMany } } as unknown as PrismaService;

    await new EmpleadosService(prisma, authService).opciones(AUTH);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: AUTH.tenantId, activo: true },
      }),
    );
  });

  it('la baja solicita revocar el acceso y audita en la misma transacción', async () => {
    const update = jest
      .fn<Promise<object>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    const createEvento = jest
      .fn<Promise<object>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue({});
    const prisma = {
      empleado: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'e1',
          activo: true,
          userId: 'u1',
        }),
        update,
      },
      empleadoEvento: { create: createEvento },
    } as unknown as PrismaService & { $transaction: jest.Mock };
    prisma.$transaction = jest.fn(
      (callback: (tx: PrismaService) => Promise<unknown>) => callback(prisma),
    );

    await new EmpleadosService(prisma, authService).fijarEstadoMuchos(
      AUTH,
      ['e1'],
      false,
      'Fin de relación',
    );

    expect(revokeEmployeeAccessInTransaction).toHaveBeenCalledWith(
      prisma,
      AUTH.tenantId,
      'e1',
      'u1',
    );
    expect(update.mock.calls[0][0].data.activo).toBe(false);
    expect(createEvento.mock.calls[0][0].data.tipo).toBe('baja');
  });

  it('rechaza fechas incoherentes y porcentajes fuera de rango', () => {
    const service = new EmpleadosService({} as PrismaService, authService);
    const normalizePayload = Reflect.get(service, 'normalizePayload') as (
      input: Record<string, unknown>,
    ) => unknown;
    expect(() =>
      normalizePayload.call(service, {
        ...payload,
        fechaNacimiento: '2025-02-01',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizePayload.call(service, {
        ...payload,
        comisionesHabilitadas: true,
        comisiones: [
          { descripcion: 'Venta', tipo: 'porcentaje', valor: '101' },
        ],
      }),
    ).toThrow(/100%/);
  });

  it('detecta una edición concurrente', async () => {
    const prisma = {
      empleado: {
        findFirst: jest.fn().mockResolvedValue(empleado()),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService & { $transaction: jest.Mock };
    prisma.$transaction = jest.fn(
      (callback: (tx: PrismaService) => Promise<unknown>) => callback(prisma),
    );

    await expect(
      new EmpleadosService(prisma, authService).update(AUTH, 'e1', {
        ...payload,
        updatedAt: FECHA.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
