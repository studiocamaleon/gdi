import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ImpersonacionService } from '../impersonacion.service';
import { AuthService } from '../../auth/auth.service';
import { AuthGuard } from '../../auth/auth.guard';
import { ImpersonacionGuard } from '../../auth/impersonacion.guard';
import { SessionCacheService } from '../../auth/session-cache.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth, JwtPayload } from '../../auth/auth.types';

/**
 * Impersonación (etapa C), de punta a punta contra la base. Lo que se fija es
 * lo que hace segura la función:
 *  - el token vale sólo mientras la sesión vive (cerrar o expirar lo mata YA);
 *  - los límites duros: impersonando no se tocan integraciones ni se borra;
 *  - todo queda auditado y la sesión es consultable (el cliente puede verla).
 *
 * JWT_SECRET se fija acá para que el guard verifique el token que emite el
 * servicio (los dos usan process.env.JWT_SECRET).
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-impersonacion';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_SECRET });

function contexto(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('Impersonación', () => {
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    new SessionCacheService(),
  );
  const impersonacion = new ImpersonacionService(
    prisma as unknown as PrismaService,
    auth,
  );
  const guard = new AuthGuard(
    new Reflector(),
    jwt,
    prisma as unknown as PrismaService,
    new SessionCacheService(),
  );

  let staffId: string;
  let tenantId: string;
  const tenants: string[] = [];

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        email: `imp-staff-${randomUUID()}@test.local`,
        nombreCompleto: 'Valentina Sosa',
        rolPlataforma: 'ADMIN',
      },
      select: { id: true },
    });
    staffId = staff.id;
    const t = await prisma.tenant.create({
      data: { nombre: 'Cliente Impersonado', slug: `test-imp-${randomUUID()}` },
      select: { id: true },
    });
    tenantId = t.id;
    tenants.push(t.id);
  });

  afterAll(async () => {
    await prisma.plataformaEvento.deleteMany({
      where: { staffUserId: staffId },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.user.deleteMany({ where: { id: staffId } });
    await prisma.$disconnect();
  });

  /** Corre el AuthGuard sobre un token y devuelve el CurrentAuth resuelto. */
  async function resolver(token: string): Promise<CurrentAuth> {
    const req: { headers: Record<string, string>; auth?: CurrentAuth } = {
      headers: { authorization: `Bearer ${token}` },
    };
    await guard.canActivate(contexto(req));
    return req.auth!;
  }

  it('el motivo es obligatorio: no se entra sin decir por qué', async () => {
    await expect(impersonacion.iniciar(staffId, tenantId, 'x')).rejects.toThrow(
      /motivo/i,
    );
  });

  it('iniciar emite un token que el guard resuelve como el tenant, firmado por el actor', async () => {
    const { token, tenantNombre } = await impersonacion.iniciar(
      staffId,
      tenantId,
      'Ticket 412: el cliente no ve su PDF',
    );
    expect(tenantNombre).toBe('Cliente Impersonado');

    const resuelto = await resolver(token);
    // Opera COMO el tenant (rol admin), pero el actor real viaja aparte.
    expect(resuelto.tenantId).toBe(tenantId);
    expect(resuelto.role).toBe('ADMINISTRADOR');
    expect(resuelto.impersonacion?.actorUserId).toBe(staffId);
    expect(resuelto.impersonacion?.actorNombre).toContain('Soporte Grafo');
    expect(resuelto.impersonacion?.actorNombre).toContain('Valentina Sosa');
  });

  it('cerrar mata el token AL INSTANTE: el guard lo rechaza', async () => {
    const { token } = await impersonacion.iniciar(
      staffId,
      tenantId,
      'Otra sesión para cerrar',
    );
    const activas1 = await impersonacion.activas();
    const mia = activas1.find((s) => s.tenantId === tenantId)!;
    await impersonacion.cerrar(staffId, mia.id);

    await expect(resolver(token)).rejects.toThrow(UnauthorizedException);
    const activas2 = await impersonacion.activas();
    expect(activas2.find((s) => s.id === mia.id)).toBeUndefined();
  });

  it('una sesión vencida no vale, aunque nadie la haya cerrado', async () => {
    const { token } = await impersonacion.iniciar(
      staffId,
      tenantId,
      'Sesión que voy a vencer a mano',
    );
    const activa = (await impersonacion.activas()).find(
      (s) => s.tenantId === tenantId,
    )!;
    // La empujo al pasado: expiró.
    await prisma.sesionImpersonacion.update({
      where: { id: activa.id },
      data: { expiraEl: new Date(Date.now() - 1000) },
    });
    await expect(resolver(token)).rejects.toThrow(/termin|expir/i);
  });

  it('el ImpersonacionGuard bloquea las acciones prohibidas', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const impGuard = new ImpersonacionGuard(reflector);

    const impAuth = {
      impersonacion: { sesionId: 's', actorUserId: staffId, actorNombre: 'x' },
    } as CurrentAuth;
    expect(() => impGuard.canActivate(contexto({ auth: impAuth }))).toThrow(
      ForbiddenException,
    );

    // Un usuario normal en el MISMO endpoint prohibido pasa sin problema.
    const normal = { membershipId: 'm' } as CurrentAuth;
    expect(impGuard.canActivate(contexto({ auth: normal }))).toBe(true);
  });

  it('salir cierra la sesión y devuelve al staff a su cuenta', async () => {
    // El staff necesita una membership propia para "volver a".
    const propia = await prisma.tenant.create({
      data: { nombre: 'Casa del staff', slug: `test-imp-casa-${randomUUID()}` },
      select: { id: true },
    });
    tenants.push(propia.id);
    await prisma.membership.create({
      data: { userId: staffId, tenantId: propia.id, rol: 'ADMINISTRADOR' },
    });

    const { token } = await impersonacion.iniciar(
      staffId,
      tenantId,
      'Sesión para salir por auth',
    );
    const resuelto = await resolver(token);
    const r = await auth.salirDeImpersonacion(resuelto);
    expect(r.accessToken).not.toBeNull();

    // El token nuevo es una sesión NORMAL del staff, no una impersonación.
    const payload = jwt.verify<JwtPayload>(r.accessToken!);
    expect(payload.imp).toBeUndefined();
    expect(payload.sub).toBe(staffId);
    expect(payload.tenantId).toBe(propia.id);
  });

  it('quedó auditado: iniciar y cerrar dejan su evento', async () => {
    const eventos = (
      await prisma.plataformaEvento.findMany({
        where: { staffUserId: staffId },
        select: { tipo: true },
      })
    ).map((e) => e.tipo);
    expect(eventos).toContain('impersonacion_iniciada');
    expect(eventos).toContain('impersonacion_cerrada');
  });
});
