import { NotFoundException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { InventarioService } from '../inventario.service';
import type { CurrentAuth } from '../../auth/auth.types';

const auth: CurrentAuth = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  sessionId: 'session-1',
  membershipId: 'membership-1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@grafoprint.test',
};

describe('InventarioService.bulkUpdateCostos', () => {
  it('actualiza precios por variante y unidades por material en transacción', async () => {
    const varianteUpdate = jest.fn().mockResolvedValue({});
    const materiaUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      materiaPrimaVariante: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'var-1' }, { id: 'var-2' }]),
      },
      materiaPrima: {
        findMany: jest.fn().mockResolvedValue([{ id: 'mat-1' }]),
      },
      $transaction: jest.fn(async (cb) =>
        cb({
          materiaPrimaVariante: { update: varianteUpdate },
          materiaPrima: { update: materiaUpdate },
        }),
      ),
    };
    const service = new InventarioService(prisma as never);

    const res = await service.bulkUpdateCostos(auth, {
      variantes: [
        { id: 'var-1', precioReferencia: 1500.55, moneda: 'usd' },
        { id: 'var-2', precioReferencia: 200 },
      ],
      materiales: [{ id: 'mat-1', unidadStock: 'litro' as never }],
    });

    expect(res).toEqual({ variantesActualizadas: 2, materialesActualizados: 1 });
    expect(varianteUpdate).toHaveBeenCalledWith({
      where: { id: 'var-1' },
      data: expect.objectContaining({ moneda: 'USD' }),
    });
    expect(materiaUpdate).toHaveBeenCalledWith({
      where: { id: 'mat-1' },
      data: { unidadStock: 'LITRO' },
    });
  });

  it('rechaza (404) si una variante no pertenece al tenant', async () => {
    const prisma = {
      materiaPrimaVariante: {
        // Falta 'var-2' → pertenencia inválida.
        findMany: jest.fn().mockResolvedValue([{ id: 'var-1' }]),
      },
      materiaPrima: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    const service = new InventarioService(prisma as never);

    await expect(
      service.bulkUpdateCostos(auth, {
        variantes: [
          { id: 'var-1', precioReferencia: 10 },
          { id: 'var-2', precioReferencia: 20 },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('es noop si no hay cambios', async () => {
    const prisma = {
      materiaPrimaVariante: { findMany: jest.fn() },
      materiaPrima: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new InventarioService(prisma as never);

    const res = await service.bulkUpdateCostos(auth, {});
    expect(res).toEqual({ variantesActualizadas: 0, materialesActualizados: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
