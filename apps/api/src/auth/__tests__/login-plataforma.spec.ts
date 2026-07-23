import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { AuthGuard } from '../auth.guard';
import { SessionCacheService } from '../session-cache.service';
import { SIN_TENANT_KEY } from '../../common/sin-tenant.decorator';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../auth.types';

/**
 * El login del backoffice (opción A). Lo que se fija:
 *  - un staff SIN empresa puede entrar (el login de tenant no lo dejaría);
 *  - un usuario de tenant SIN rol de plataforma NO entra por acá;
 *  - la sesión de plataforma sólo sirve en rutas @SinTenant — una ruta de
 *    tenant la rechaza (o leería todos los tenants sin contexto).
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-backoffice';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });

function contexto(
  request: Record<string, unknown>,
  sinTenant: boolean,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ __sinTenant: sinTenant }),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('Login de backoffice (sesión de plataforma)', () => {
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    new SessionCacheService(),
  );
  // Reflector que responde @SinTenant según la marca del handler falso.
  const reflector = {
    getAllAndOverride: (key: string, targets: Array<{ __sinTenant?: boolean }>) =>
      key === SIN_TENANT_KEY ? Boolean(targets[0]?.__sinTenant) : false,
  } as unknown as Reflector;
  const guard = new AuthGuard(
    reflector,
    jwt,
    prisma as unknown as PrismaService,
    new SessionCacheService(),
  );

  const emails: string[] = [];
  const password = 'clave-super-1234';

  async function crearUsuario(rolPlataforma: 'ADMIN' | 'SOPORTE' | null) {
    const email = `bo-${randomUUID()}@test.local`;
    emails.push(email);
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 4),
        activo: true,
        rolPlataforma,
      },
    });
    return email;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('un staff SIN empresa entra (donde el login de tenant fallaría)', async () => {
    const email = await crearUsuario('ADMIN');
    const r = await auth.loginPlataforma({ email, password });
    expect(r.accessToken).toBeTruthy();
    expect(r.staff.rolPlataforma).toBe('ADMIN');
  });

  it('un usuario de tenant SIN rol de plataforma NO entra por el backoffice', async () => {
    const email = await crearUsuario(null);
    await expect(
      auth.loginPlataforma({ email, password }),
    ).rejects.toThrow(/equipo de Grafo/i);
  });

  it('credenciales mal → invalidas (sin filtrar si el email existe)', async () => {
    const email = await crearUsuario('SOPORTE');
    await expect(
      auth.loginPlataforma({ email, password: 'no-es' }),
    ).rejects.toThrow(/invalid/i);
  });

  it('la sesión de plataforma sirve en rutas @SinTenant', async () => {
    const email = await crearUsuario('ADMIN');
    const { accessToken } = await auth.loginPlataforma({ email, password });
    const req: { headers: Record<string, string>; auth?: CurrentAuth } = {
      headers: { authorization: `Bearer ${accessToken}` },
    };
    await guard.canActivate(contexto(req, true));
    expect(req.auth?.esPlataforma).toBe(true);
    expect(req.auth?.tenantId).toBe('');
  });

  it('la sesión de plataforma NO sirve en una ruta de tenant', async () => {
    const email = await crearUsuario('ADMIN');
    const { accessToken } = await auth.loginPlataforma({ email, password });
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    await expect(guard.canActivate(contexto(req, false))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
