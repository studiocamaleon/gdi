import { MfaService } from '../../auth/mfa.service';
import { SecretosService } from '../../integraciones/cripto/secretos.service';
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
    new MfaService(
      prisma as unknown as PrismaService,
      new SecretosService(),
      new SessionCacheService(),
    ),
  );
  const impersonacion = new ImpersonacionService(
    prisma as unknown as PrismaService,
    auth,
  );
  const guard = new AuthGuard(
    new Reflector(),
    jwt,
    prisma as unknown as PrismaService,
  );

  let staffId: string;
  let staffAuth: CurrentAuth;
  let tenantId: string;
  const tenants: string[] = [];

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        email: `imp-staff-${randomUUID()}@test.local`,
        nombreCompleto: 'Valentina Sosa',
        rolPlataforma: 'ADMIN',
        mfa: {
          create: {
            activatedAt: new Date(0),
            recuperacionConfirmadaEl: new Date(1),
          },
        },
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

  beforeEach(async () => {
    const staff = await prisma.user.update({
      where: { id: staffId },
      data: {
        activo: true,
        rolPlataforma: 'ADMIN',
        debeCambiarPassword: false,
      },
    });
    await prisma.userMfa.update({
      where: { userId: staffId },
      data: { activatedAt: new Date(0), recuperacionConfirmadaEl: new Date(1) },
    });
    const session = await prisma.authSession.create({
      data: {
        userId: staffId,
        expiresAt: new Date(Date.now() + 3600000),
        mfaVerificadoEl: new Date(),
      },
    });
    staffAuth = {
      userId: staffId,
      sessionId: session.id,
      tenantId: '',
      membershipId: '',
      email: staff.email,
      role: 'ADMINISTRADOR',
      esPlataforma: true,
      plataformaMfaPendiente: false,
      plataformaPasswordPendiente: false,
    };
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
    await expect(
      impersonacion.iniciar(staffAuth, tenantId, 'x'),
    ).rejects.toThrow(/motivo/i);
  });

  it.each([
    'revocada',
    'vencida',
    'sin-factor',
    'factor-reemplazado',
    'rol-revocado',
    'inactivo',
    'clave-provisoria',
  ] as const)(
    'no inicia soporte si el origen cambió después del guard (%s)',
    async (estado) => {
      if (estado === 'revocada')
        await prisma.authSession.update({
          where: { id: staffAuth.sessionId },
          data: { revokedAt: new Date() },
        });
      if (estado === 'vencida')
        await prisma.authSession.update({
          where: { id: staffAuth.sessionId },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
      if (estado === 'sin-factor')
        await prisma.authSession.update({
          where: { id: staffAuth.sessionId },
          data: { mfaVerificadoEl: null },
        });
      if (estado === 'factor-reemplazado')
        await prisma.userMfa.update({
          where: { userId: staffId },
          data: { activatedAt: new Date(Date.now() + 1000) },
        });
      if (estado === 'rol-revocado')
        await prisma.user.update({
          where: { id: staffId },
          data: { rolPlataforma: 'SOPORTE' },
        });
      if (estado === 'inactivo')
        await prisma.user.update({
          where: { id: staffId },
          data: { activo: false },
        });
      if (estado === 'clave-provisoria')
        await prisma.user.update({
          where: { id: staffId },
          data: { debeCambiarPassword: true },
        });
      const antes = await prisma.sesionImpersonacion.findMany({
        where: { staffUserId: staffId },
        orderBy: { id: 'asc' },
      });
      const sesiones = await prisma.authSession.count({
        where: { userId: staffId },
      });
      const eventos = await prisma.plataformaEvento.count({
        where: { staffUserId: staffId },
      });
      await expect(
        impersonacion.iniciar(
          staffAuth,
          tenantId,
          'Ensayo de origen no vigente',
        ),
      ).rejects.toThrow();
      expect(
        await prisma.sesionImpersonacion.findMany({
          where: { staffUserId: staffId },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(antes);
      expect(
        await prisma.authSession.count({ where: { userId: staffId } }),
      ).toBe(sesiones);
      expect(
        await prisma.plataformaEvento.count({
          where: { staffUserId: staffId },
        }),
      ).toBe(eventos);
    },
  );

  it('iniciar emite un token que el guard resuelve como el tenant, firmado por el actor', async () => {
    const { token, tenantNombre } = await impersonacion.iniciar(
      staffAuth,
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
      staffAuth,
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

  it('perder administración invalida incluso una impersonación todavía abierta', async () => {
    const { token } = await impersonacion.iniciar(
      staffAuth,
      tenantId,
      'Verificar revocación de permisos',
    );
    await prisma.user.update({
      where: { id: staffId },
      data: { rolPlataforma: 'SOPORTE' },
    });
    try {
      await expect(resolver(token)).rejects.toThrow(UnauthorizedException);
    } finally {
      await prisma.user.update({
        where: { id: staffId },
        data: { rolPlataforma: 'ADMIN' },
      });
    }
  });

  it('una sesión vencida no vale, aunque nadie la haya cerrado', async () => {
    const { token } = await impersonacion.iniciar(
      staffAuth,
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
      staffAuth,
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
    const nuevaSesion = await prisma.authSession.findUniqueOrThrow({
      where: { id: payload.sessionId },
    });
    expect(nuevaSesion.mfaVerificadoEl).not.toBeNull();
    expect((await resolver(r.accessToken!)).impersonacion).toBeUndefined();
    expect(
      (
        await prisma.sesionImpersonacion.findUniqueOrThrow({
          where: { id: resuelto.impersonacion!.sesionId },
        })
      ).cerradaEl,
    ).not.toBeNull();
  });

  it('dos salidas simultáneas sólo convierten una vez la sesión de soporte', async () => {
    const { token } = await impersonacion.iniciar(
      staffAuth,
      tenantId,
      'Ensayo de salida simultánea',
    );
    const actual = await resolver(token);
    const resultado = await Promise.allSettled([
      auth.salirDeImpersonacion(actual),
      auth.salirDeImpersonacion(actual),
    ]);
    expect(resultado.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultado.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('el token de soporte conserva el factor comprobado y no supera el vencimiento de origen', async () => {
    const factor = new Date(1000);
    const vencimiento = new Date(Date.now() + 5 * 60_000);
    await prisma.authSession.update({
      where: { id: staffAuth.sessionId },
      data: { mfaVerificadoEl: factor, expiresAt: vencimiento },
    });
    const { token } = await impersonacion.iniciar(
      staffAuth,
      tenantId,
      'Ensayo de continuidad del factor',
    );
    const payload = jwt.verify<JwtPayload>(token);
    const creada = await prisma.authSession.findUniqueOrThrow({
      where: { id: payload.sessionId },
    });
    expect(creada.mfaVerificadoEl).toEqual(factor);
    expect(creada.expiresAt).toEqual(vencimiento);
    await expect(resolver(token)).resolves.toMatchObject({
      userId: staffId,
      tenantId,
    });
  });

  it('un fallo de firma revierte el reemplazo, la sesión y la auditoría', async () => {
    await impersonacion.iniciar(staffAuth, tenantId, 'Primera sesión ficticia');
    const antes = await prisma.sesionImpersonacion.findMany({
      where: { staffUserId: staffId },
      orderBy: { id: 'asc' },
    });
    const sesiones = await prisma.authSession.findMany({
      where: { userId: staffId },
      orderBy: { id: 'asc' },
    });
    const eventos = await prisma.plataformaEvento.count({
      where: { staffUserId: staffId },
    });
    const firma = jest
      .spyOn(jwt, 'signAsync')
      .mockRejectedValueOnce(new Error('Fallo ficticio de firma'));
    try {
      await expect(
        impersonacion.iniciar(
          staffAuth,
          tenantId,
          'Reemplazo que debe revertirse',
        ),
      ).rejects.toThrow('Fallo ficticio de firma');
    } finally {
      firma.mockRestore();
    }
    expect(
      await prisma.sesionImpersonacion.findMany({
        where: { staffUserId: staffId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antes);
    expect(
      await prisma.authSession.findMany({
        where: { userId: staffId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(sesiones);
    expect(
      await prisma.plataformaEvento.count({ where: { staffUserId: staffId } }),
    ).toBe(eventos);
  });

  it('dos entradas simultáneas dejan una sola sesión de soporte activa', async () => {
    const resultados = await Promise.all([
      impersonacion.iniciar(staffAuth, tenantId, 'Entrada ficticia A'),
      impersonacion.iniciar(staffAuth, tenantId, 'Entrada ficticia B'),
    ]);
    expect(
      await prisma.sesionImpersonacion.count({
        where: { staffUserId: staffId, tenantId, cerradaEl: null },
      }),
    ).toBe(1);
    const accesos = await Promise.allSettled(
      resultados.map((r) => resolver(r.token)),
    );
    expect(accesos.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(accesos.filter((r) => r.status === 'rejected')).toHaveLength(1);
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
