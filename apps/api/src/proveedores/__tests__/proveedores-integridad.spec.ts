import { BadRequestException, ConflictException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { ProveedoresQueryDto } from '../dto/proveedores-query.dto';
import { exigirProveedorActivoDelTenant } from '../proveedor-validacion';
import { ProveedoresService } from '../proveedores.service';

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@empresa.test',
};

const FECHA = new Date('2026-08-16T12:00:00.000Z');

function proveedor() {
  return {
    id: 'p1',
    tenantId: AUTH.tenantId,
    nombre: 'Papelera Sur',
    razonSocial: null,
    emailPrincipal: '',
    telefonoCodigo: '',
    telefonoNumero: '',
    paisCodigo: 'AR',
    cuit: null,
    condicionIva: null,
    condicionPagoDias: null,
    cbuAlias: null,
    activo: true,
    createdAt: FECHA,
    updatedAt: FECHA,
    contactos: [],
    direcciones: [],
    eventos: [],
  };
}

function prismaParaBorrado(rastro: Partial<Record<string, number>> = {}) {
  const borrar = jest.fn().mockResolvedValue(proveedor());
  const count = (clave: string) =>
    jest.fn().mockResolvedValue(rastro[clave] ?? 0);
  const prisma = {
    proveedor: {
      findFirst: jest.fn().mockResolvedValue(proveedor()),
      delete: borrar,
    },
    valor: { count: count('valores') },
    productoConfigPaso: { count: count('configuraciones') },
    archivo: { count: count('archivos') },
    materiaPrimaVariante: { count: count('variantes') },
    egreso: { count: count('egresos') },
    pago: { count: count('pagos') },
    gastoRecurrente: { count: count('recurrentes') },
    gastoFijoEstructura: { count: count('gastosFijos') },
    familiaPasoDefaults: { count: count('familias') },
    pasoTenant: { count: count('pasos') },
  } as unknown as PrismaService & { $transaction: jest.Mock };
  prisma.$transaction = jest.fn(
    (callback: (tx: PrismaService) => Promise<unknown>) => callback(prisma),
  );
  return { prisma, borrar };
}

const payloadBase = {
  nombre: 'Papelera Sur',
  email: '',
  pais: 'AR',
  telefonoCodigo: '',
  telefonoNumero: '',
  contactos: [],
  direcciones: [],
};

describe('integridad de proveedores', () => {
  it('busca en el backend y excluye inactivos por defecto', async () => {
    const findMany = jest.fn().mockResolvedValue([proveedor()]);
    const prisma = {
      proveedor: {
        findMany,
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((operaciones: Promise<unknown>[]) =>
        Promise.all(operaciones),
      ),
    } as unknown as PrismaService;
    const query = new ProveedoresQueryDto();
    query.q = 'Papelera';

    const resultado = await new ProveedoresService(prisma).findAll(AUTH, query);

    expect(resultado.total).toBe(1);
    const consulta = JSON.stringify(findMany.mock.calls[0]);
    expect(consulta).toContain(`"tenantId":"${AUTH.tenantId}"`);
    expect(consulta).toContain('"activo":true');
    expect(consulta).toContain('"OR"');
  });

  it('no elimina un proveedor con historia y explica cómo conservarla', async () => {
    const { prisma, borrar } = prismaParaBorrado({ egresos: 2, pagos: 1 });
    const service = new ProveedoresService(prisma);

    await expect(service.remove(AUTH, 'p1')).rejects.toThrow(
      /2 egresos, 1 pago/,
    );
    await expect(service.remove(AUTH, 'p1')).rejects.toThrow(/Inhabilitalo/);
    expect(borrar).not.toHaveBeenCalled();
  });

  it('elimina un proveedor que nunca tuvo actividad', async () => {
    const { prisma, borrar } = prismaParaBorrado();
    await new ProveedoresService(prisma).remove(AUTH, 'p1');
    expect(borrar).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('rechaza un CUIT con dígito verificador inválido antes de escribir', async () => {
    const prisma = {} as PrismaService;
    const service = new ProveedoresService(prisma);
    await expect(
      service.create(AUTH, { ...payloadBase, cuit: '30712345670' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('detecta una edición concurrente mediante updatedAt', async () => {
    const prisma = {
      proveedor: {
        findFirst: jest.fn().mockResolvedValue(proveedor()),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService & { $transaction: jest.Mock };
    prisma.$transaction = jest.fn(
      (callback: (tx: PrismaService) => Promise<unknown>) => callback(prisma),
    );
    const service = new ProveedoresService(prisma);

    await expect(
      service.update(AUTH, 'p1', {
        ...payloadBase,
        updatedAt: FECHA.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('validación de referencias a proveedores', () => {
  it('acepta sólo proveedores activos del tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'p1',
      nombre: 'Papelera Sur',
    });
    const prisma = { proveedor: { findFirst } } as unknown as PrismaService;

    await exigirProveedorActivoDelTenant(prisma, 't1', 'p1');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1', tenantId: 't1', activo: true },
      }),
    );
  });

  it('rechaza proveedores inactivos, inexistentes o de otro tenant', async () => {
    const prisma = {
      proveedor: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      exigirProveedorActivoDelTenant(prisma, 't1', 'p-externo'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
