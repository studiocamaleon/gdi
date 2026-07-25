import { RolSistema } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UsuariosService } from '../usuarios.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionCacheService } from '../../auth/session-cache.service';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Restablecer la clave de otro.
 *
 * La regla de fondo: el admin puede devolverle el acceso a cualquiera sin
 * saber la clave que tenía y sin quedarse sabiendo la que va a usar después.
 * Lo primero lo hace el restablecimiento; lo segundo, el flag que obliga a
 * cambiarla al entrar.
 */

const AUTH: CurrentAuth = {
  userId: 'admin',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

/** Lo que los tests miran de cada llamada. */
type UpdateUser = {
  data: { passwordHash: string; debeCambiarPassword: boolean };
};
type CreateEvento = { data: { tipo: string; actorNombre: string } };

function armar(membership: Record<string, unknown> | null) {
  const userUpdate = jest
    .fn<Promise<unknown>, [UpdateUser]>()
    .mockResolvedValue({});
  const sesionesUpdate = jest.fn().mockResolvedValue({ count: 2 });
  const eventoCreate = jest
    .fn<Promise<unknown>, [CreateEvento]>()
    .mockResolvedValue({});
  const prisma = {
    membership: { findUnique: jest.fn().mockResolvedValue(membership) },
    user: { update: userUpdate },
    authSession: { updateMany: sesionesUpdate },
    eventoAcceso: { create: eventoCreate },
  } as unknown as PrismaService;
  const invalidarTenant = jest.fn();
  const service = new UsuariosService(
    prisma,
    { invalidarTenant } as unknown as SessionCacheService,
    {} as unknown as SuscripcionesService,
  );
  return { service, userUpdate, sesionesUpdate, invalidarTenant, eventoCreate };
}

const MEMBERSHIP = {
  id: 'm2',
  userId: 'u2',
  user: { email: 'operario@imprenta.test', nombreCompleto: 'Juan Operario' },
};

describe('restablecer la clave de otro', () => {
  it('no pide la clave actual: el caso es justamente que se la olvidó', async () => {
    const { service } = armar(MEMBERSHIP);
    await expect(service.restablecerPassword(AUTH, 'u2')).resolves.toEqual(
      expect.objectContaining({ email: MEMBERSHIP.user.email }),
    );
  });

  it('devuelve una provisoria legible y la guarda hasheada', async () => {
    const { service, userUpdate } = armar(MEMBERSHIP);
    const { provisoria } = await service.restablecerPassword(AUTH, 'u2');

    // Tres bloques de cuatro, sin caracteres que se confundan al dictarlos.
    expect(provisoria).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(provisoria).not.toMatch(/[OIL01]/);

    const guardado = userUpdate.mock.calls[0][0];
    expect(guardado.data.passwordHash).not.toBe(provisoria);
    expect(await bcrypt.compare(provisoria, guardado.data.passwordHash)).toBe(
      true,
    );
  });

  /** El admin la sabe, así que sólo puede servir para entrar una vez. */
  it('obliga a cambiarla al entrar', async () => {
    const { service, userUpdate } = armar(MEMBERSHIP);
    await service.restablecerPassword(AUTH, 'u2');
    expect(userUpdate.mock.calls[0][0].data.debeCambiarPassword).toBe(true);
  });

  /** Si le cambian la clave, lo que quedó abierto en otra máquina no vale. */
  it('corta las sesiones abiertas de esa persona', async () => {
    const { service, sesionesUpdate, invalidarTenant } = armar(MEMBERSHIP);
    await service.restablecerPassword(AUTH, 'u2');
    expect(sesionesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u2', revokedAt: null },
      }),
    );
    expect(invalidarTenant).toHaveBeenCalledWith('t1');
  });

  it('deja constancia de quién se la restableció', async () => {
    const { service, eventoCreate } = armar(MEMBERSHIP);
    await service.restablecerPassword(AUTH, 'u2');
    const evento = eventoCreate.mock.calls[0][0];
    expect(evento.data.tipo).toBe('password_restablecida');
    expect(evento.data.actorNombre).toBe(AUTH.email);
  });

  it('dos restablecimientos no dan la misma clave', async () => {
    const a = await armar(MEMBERSHIP).service.restablecerPassword(AUTH, 'u2');
    const b = await armar(MEMBERSHIP).service.restablecerPassword(AUTH, 'u2');
    expect(a.provisoria).not.toBe(b.provisoria);
  });

  it('no se le restablece la clave a alguien de otra empresa', async () => {
    const { service } = armar(null);
    await expect(service.restablecerPassword(AUTH, 'ajeno')).rejects.toThrow(
      /no existe/i,
    );
  });
});
