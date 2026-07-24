import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { SessionCacheService } from '../session-cache.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * El contexto de sesión lleva la suscripción para que el sidebar muestre plan
 * y días restantes. Lo que se fija acá es el CABLEO —que el dato llegue de
 * verdad hasta `tenantActual`— y sobre todo que NO se invente cuando falta:
 * el bug de origen era una card que le decía "Plan diamante · 14/30 días" a
 * todos los tenants por igual. El cálculo en sí vive en ciclo.spec.ts.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-suscripcion';
const prisma = new PrismaClient();

describe('Suscripción en el contexto de sesión', () => {
  const auth = new AuthService(
    prisma as unknown as PrismaService,
    new JwtService({ secret: process.env.JWT_SECRET }),
    new SessionCacheService(),
  );

  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const planIds: string[] = [];
  const password = 'clave-super-1234';

  /** Tenant + usuario admin + sesión, listo para pedir el contexto. */
  async function crearTenantConUsuario() {
    const sufijo = randomUUID().slice(0, 8);
    const tenant = await prisma.tenant.create({
      data: { nombre: `Susc ${sufijo}`, slug: `susc-${sufijo}`, activo: true },
      select: { id: true },
    });
    tenantIds.push(tenant.id);

    const user = await prisma.user.create({
      data: {
        email: `susc-${sufijo}@test.local`,
        passwordHash: await bcrypt.hash(password, 4),
        activo: true,
      },
      select: { id: true },
    });
    userIds.push(user.id);

    const membership = await prisma.membership.create({
      data: { userId: user.id, tenantId: tenant.id, rol: 'ADMINISTRADOR', activa: true },
      select: { id: true },
    });
    const sesion = await prisma.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: tenant.id,
        currentMembershipId: membership.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });

    return {
      tenantId: tenant.id,
      contexto: {
        userId: user.id,
        tenantId: tenant.id,
        sessionId: sesion.id,
        membershipId: membership.id,
        email: `susc-${sufijo}@test.local`,
        role: 'administrador' as const,
      },
    };
  }

  async function crearPlan(nombre: string, trialDias: number | null = null) {
    const plan = await prisma.plan.create({
      data: {
        codigo: `plan-${randomUUID().slice(0, 8)}`,
        nombre,
        precioMensual: 100,
        trialDias,
        featuresJson: {},
      },
      select: { id: true },
    });
    planIds.push(plan.id);
    return plan.id;
  }

  afterAll(async () => {
    // Acotado a los ids propios: borrar por patrón se pisa entre workers.
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.suscripcion.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.$disconnect();
  });

  it('sin suscripción NO inventa plan ni contador', async () => {
    const { contexto } = await crearTenantConUsuario();
    const r = await auth.getCurrentContext(contexto);
    expect(r.currentUser.tenantActual.suscripcion).toBeNull();
  });

  it('lleva el plan y los días que faltan del período', async () => {
    const { tenantId, contexto } = await crearTenantConUsuario();
    const ahora = Date.now();
    await prisma.suscripcion.create({
      data: {
        tenantId,
        planId: await crearPlan('Estudio'),
        estado: 'activa',
        periodoDesde: new Date(ahora - 20 * 86_400_000),
        proximoCobro: new Date(ahora + 10 * 86_400_000),
      },
    });

    const susc = (await auth.getCurrentContext(contexto)).currentUser
      .tenantActual.suscripcion;
    expect(susc).toMatchObject({
      planNombre: 'Estudio',
      estado: 'activa',
      diasRestantes: 10,
      diasTotales: 30,
      enPrueba: false,
    });
  });

  it('en prueba informa la prueba, no el cobro', async () => {
    const { tenantId, contexto } = await crearTenantConUsuario();
    const ahora = Date.now();
    await prisma.suscripcion.create({
      data: {
        tenantId,
        planId: await crearPlan('Prueba', 14),
        estado: 'activa',
        trialHasta: new Date(ahora + 6 * 86_400_000),
        periodoDesde: new Date(ahora),
        proximoCobro: new Date(ahora + 30 * 86_400_000),
      },
    });

    const susc = (await auth.getCurrentContext(contexto)).currentUser
      .tenantActual.suscripcion;
    expect(susc).toMatchObject({
      enPrueba: true,
      diasRestantes: 6,
      diasTotales: 14,
    });
  });

  it('sin inicio de período informa los días pero no el total', async () => {
    const { tenantId, contexto } = await crearTenantConUsuario();
    await prisma.suscripcion.create({
      data: {
        tenantId,
        planId: await crearPlan('Taller'),
        estado: 'activa',
        proximoCobro: new Date(Date.now() + 5 * 86_400_000),
      },
    });

    const susc = (await auth.getCurrentContext(contexto)).currentUser
      .tenantActual.suscripcion;
    expect(susc).toMatchObject({ diasRestantes: 5, diasTotales: null });
  });
});
