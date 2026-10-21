import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import type { CurrentAuth } from '../../auth/auth.types';

const auth = {
  tenantId: 'empresa-demo',
  userId: 'admin-demo',
  role: 'ADMINISTRADOR',
  email: 'admin@example.invalid',
} as CurrentAuth;

function escenario(userId: string | null = null) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: auth.tenantId }]),
    membership: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 'm-demo',
          activa: true,
          user: { nombreCompleto: 'Ana Demo', email: auth.email },
        }),
      update: jest.fn().mockResolvedValue({}),
    },
    empleado: {
      findFirst: jest.fn().mockResolvedValue({ id: 'empleado-demo', userId }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    eventoAcceso: { create: jest.fn().mockResolvedValue({}) },
  };
  const cache = { invalidarTenant: jest.fn() };
  const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
  const service = new UsuariosService(
    prisma as never,
    cache as never,
    {} as never,
  );
  return { tx, cache, service };
}

describe('vinculación de empleados de usuarios existentes', () => {
  it('permite al administrador vincular su propio legajo sin modificar rol, acceso ni ventas', async () => {
    const { service, tx, cache } = escenario();
    await expect(
      service.editar(auth, auth.userId, { empleadoId: 'empleado-demo' }),
    ).resolves.toEqual({ ok: true });
    expect(tx.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_tenantId: { userId: auth.userId, tenantId: auth.tenantId },
        },
      }),
    );
    expect(tx.membership.update).toHaveBeenCalledWith({
      where: { id: 'm-demo' },
      data: {},
    });
    expect(tx.empleado.findFirst).toHaveBeenCalledWith({
      where: { id: 'empleado-demo', tenantId: auth.tenantId, activo: true },
      select: { id: true, userId: true },
    });
    expect(tx.empleado.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { userId: auth.userId } }),
    );
    expect(tx.eventoAcceso.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          usuarioAfectadoId: auth.userId,
          tipo: 'empleado_vinculado',
        }),
      }),
    );
    expect(cache.invalidarTenant).toHaveBeenCalledWith(auth.tenantId);
  });

  it('no quita a otra cuenta su empleado, aunque el formulario esté desactualizado', async () => {
    const { service, tx } = escenario('otro-usuario');
    await expect(
      service.editar(auth, auth.userId, { empleadoId: 'empleado-demo' }),
    ).rejects.toThrow(ConflictException);
    expect(tx.empleado.updateMany).not.toHaveBeenCalled();
  });

  it('no desvincula el anterior si el nuevo es ajeno a la empresa o está de baja', async () => {
    const { service, tx } = escenario();
    tx.empleado.findFirst.mockResolvedValue(null);
    await expect(
      service.editar(auth, auth.userId, { empleadoId: 'empleado-ajeno' }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.empleado.updateMany).not.toHaveBeenCalled();
  });

  it('permite quitar sólo el propio vínculo en esta empresa', async () => {
    const { service, tx } = escenario(auth.userId);
    await service.editar(auth, auth.userId, { empleadoId: null });
    expect(tx.empleado.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.empleado.updateMany).toHaveBeenCalledWith({
      where: { tenantId: auth.tenantId, userId: auth.userId },
      data: { userId: null },
    });
  });

  it('rechaza un usuario que no pertenece a la empresa', async () => {
    const { service, tx } = escenario();
    tx.membership.findUnique.mockResolvedValue(null);
    await expect(
      service.editar(auth, 'usuario-ajeno', { empleadoId: 'empleado-demo' }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.empleado.updateMany).not.toHaveBeenCalled();
  });

  it.each([{ rolId: 'rol-operario' }, { activa: false }])(
    'conserva la protección del propio acceso (%j)',
    async (dto) => {
      const { service, tx } = escenario();
      await expect(
        service.editar(auth, auth.userId, {
          ...dto,
          empleadoId: 'empleado-demo',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.empleado.updateMany).not.toHaveBeenCalled();
    },
  );
});
