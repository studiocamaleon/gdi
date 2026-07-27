import { RolSistema } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { UsuariosService } from '../usuarios.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionCacheService } from '../../auth/session-cache.service';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * El alta de un acceso.
 *
 * La regla que fijan estos tests: **hay una sola forma de entrar la primera
 * vez**, la clave provisoria que el admin dicta. Hasta el 2026-07-27 había una
 * segunda —"le mando un link"— que nunca se terminó: el link se generaba pero
 * no lo mandaba nadie, así que el admin igual tenía que copiarlo y pasarlo a
 * mano. Se retiró, y esto está para que no vuelva de contrabando: un alta que
 * no devuelva clave dejaría a la persona sin poder entrar y a nadie mirando.
 */

const AUTH: CurrentAuth = {
  userId: 'admin',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

const ROL = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 't1',
  nombre: 'Operario',
  codigo: 'operario',
  permisos: ['produccion.ver'],
};

type UpdateUser = {
  where: { id: string };
  data: { passwordHash: string; debeCambiarPassword: boolean };
};
type CreateUser = { data: { email: string } };
type RevocarInvitaciones = {
  where: { tenantId: string; acceptedAt: null; revokedAt: null };
  data: { revokedAt: Date };
};
type CreateEvento = { data: { tipo: string; actorNombre: string } };

/** `existente` = el `user.findUnique` del email que se está dando de alta. */
function armar(existente: Record<string, unknown> | null = null) {
  const userCreate = jest
    .fn<Promise<unknown>, [CreateUser]>()
    .mockResolvedValue({ id: 'u9' });
  const userUpdate = jest
    .fn<Promise<unknown>, [UpdateUser]>()
    .mockResolvedValue({});
  const membershipUpsert = jest.fn().mockResolvedValue({});
  const invitationUpdateMany = jest
    .fn<Promise<unknown>, [RevocarInvitaciones]>()
    .mockResolvedValue({ count: 0 });
  const invitationCreate = jest.fn().mockResolvedValue({});
  const eventoCreate = jest
    .fn<Promise<unknown>, [CreateEvento]>()
    .mockResolvedValue({});

  const tx = {
    user: { create: userCreate, update: userUpdate },
    membership: { upsert: membershipUpsert },
    invitation: {
      updateMany: invitationUpdateMany,
      create: invitationCreate,
    },
  };

  const prisma = {
    rol: { findFirst: jest.fn().mockResolvedValue(ROL) },
    user: { findUnique: jest.fn().mockResolvedValue(existente) },
    membership: { count: jest.fn().mockResolvedValue(2) },
    eventoAcceso: { create: eventoCreate },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;

  const service = new UsuariosService(
    prisma,
    { invalidarTenant: jest.fn() } as unknown as SessionCacheService,
    {
      limites: jest.fn().mockResolvedValue({ usuariosMax: 40 }),
    } as unknown as SuscripcionesService,
  );

  return {
    service,
    userCreate,
    userUpdate,
    membershipUpsert,
    invitationUpdateMany,
    invitationCreate,
    eventoCreate,
  };
}

const DTO = { email: 'Nuevo@Imprenta.test ', rolId: ROL.id };

describe('dar de alta un acceso', () => {
  it('devuelve una clave provisoria y la guarda hasheada', async () => {
    const { service, userUpdate } = armar();

    const res = await service.crear(AUTH, DTO);

    expect(res.provisoria).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    // Lo que se devuelve para dictar NO es lo que queda en la base.
    const guardado = userUpdate.mock.calls[0][0];
    expect(guardado.data.passwordHash).not.toBe(res.provisoria);
    expect(
      await bcrypt.compare(res.provisoria, guardado.data.passwordHash),
    ).toBe(true);
    expect(guardado.data.debeCambiarPassword).toBe(true);
  });

  /**
   * El punto del retiro del modo link: no hay forma de crear un acceso que
   * dependa de un link que nadie manda.
   */
  it('no emite ningún link de invitación', async () => {
    const { service, invitationCreate } = armar();

    const res = await service.crear(AUTH, DTO);

    expect(invitationCreate).not.toHaveBeenCalled();
    expect(res).not.toHaveProperty('invitacionUrl');
  });

  /** Un token que quedó vivo de la época del link deja de servir. */
  it('revoca las invitaciones que le hubieran quedado abiertas', async () => {
    const { service, invitationUpdateMany } = armar();

    await service.crear(AUTH, DTO);

    const { where, data } = invitationUpdateMany.mock.calls[0][0];
    expect(where.tenantId).toBe('t1');
    expect(where.acceptedAt).toBeNull();
    expect(where.revokedAt).toBeNull();
    expect(data.revokedAt).toBeInstanceOf(Date);
  });

  it('normaliza el email: lo guarda en minúsculas y sin espacios', async () => {
    const { service, userCreate } = armar();

    await service.crear(AUTH, DTO);

    expect(userCreate.mock.calls[0][0].data.email).toBe('nuevo@imprenta.test');
  });

  /**
   * El que ya tenía cuenta en OTRA empresa: entra a esta con la provisoria que
   * se le dicta, igual que cualquiera. Antes esto dependía del modo elegido.
   */
  it('al que ya tenía cuenta también se le dicta una clave', async () => {
    const { service, userUpdate, userCreate } = armar({
      id: 'u5',
      passwordHash: 'hash-viejo',
      memberships: [],
    });

    const res = await service.crear(AUTH, DTO);

    expect(userCreate).not.toHaveBeenCalled();
    expect(res.yaTeniaCuenta).toBe(true);
    expect(res.provisoria).not.toBeNull();
    expect(userUpdate.mock.calls[0][0].where).toEqual({ id: 'u5' });
  });

  it('no deja dar dos veces el acceso a la misma persona', async () => {
    const { service } = armar({
      id: 'u5',
      passwordHash: null,
      memberships: [{ activa: true }],
    });

    await expect(service.crear(AUTH, DTO)).rejects.toThrow(
      /ya tiene acceso a esta empresa/i,
    );
  });

  it('deja el alta en el registro de actividad', async () => {
    const { service, eventoCreate } = armar();

    await service.crear(AUTH, DTO);

    const { tipo, actorNombre } = eventoCreate.mock.calls[0][0].data;
    expect(tipo).toBe('usuario_invitado');
    expect(actorNombre).toBe(AUTH.email);
  });

  it('la clave es distinta en cada alta', async () => {
    const a = await armar().service.crear(AUTH, DTO);
    const b = await armar().service.crear(AUTH, DTO);
    expect(a.provisoria).not.toBe(b.provisoria);
  });
});
