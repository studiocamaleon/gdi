import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PlataformaService } from '../plataforma.service';
import { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PaddleService } from '../../cobro/paddle.service';

/**
 * Las escrituras del control plane (etapa B1) y el lector de features, contra
 * la base real: lo que importa es la CADENA — cambiar un plan tiene que
 * mover el feature gate del tenant y dejar rastro en la auditoría, no sólo
 * escribir una fila. La migración seedea el catálogo (trial/taller/estudio/
 * diamante), así que los planes están.
 */

const prisma = new PrismaClient();

describe('Control plane — escrituras y feature gates', () => {
  const plataforma = new PlataformaService(
    prisma as unknown as PrismaService,
    new PaddleService(),
  );
  const suscripciones = new SuscripcionesService(
    prisma as unknown as PrismaService,
    new PaddleService(),
  );
  let staffId: string;
  let tenantId: string;
  const tenantsCreados: string[] = [];

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        email: `staff-${randomUUID()}@test.local`,
        rolPlataforma: 'ADMIN',
      },
      select: { id: true },
    });
    staffId = staff.id;
    const t = await prisma.tenant.create({
      data: { nombre: 'B1 escrituras', slug: `test-b1-${randomUUID()}` },
      select: { id: true },
    });
    tenantId = t.id;
    tenantsCreados.push(t.id);
  });

  afterAll(async () => {
    await prisma.plataformaEvento.deleteMany({
      where: { staffUserId: staffId },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantsCreados } } });
    await prisma.user.deleteMany({ where: { id: staffId } });
    await prisma.$disconnect();
  });

  const planPorCodigo = async (codigo: string) => {
    const p = await prisma.plan.findUnique({ where: { codigo } });
    if (!p) throw new Error(`Falta el plan ${codigo}: ¿migró el seed?`);
    return p;
  };

  it('el catálogo seedeado está y expone sus features', async () => {
    const planes = await plataforma.planes();
    const codigos = planes.map((p) => p.codigo);
    expect(codigos).toEqual(
      expect.arrayContaining(['trial', 'taller', 'estudio', 'diamante']),
    );
    const estudio = planes.find((p) => p.codigo === 'estudio')!;
    expect(estudio.features.afip).toBe(true);
    expect(estudio.precioMensual).toBe(189000);
  });

  it('sin suscripción el tenant es legacy: todo permitido (grandfathered)', async () => {
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(true);
    await expect(suscripciones.de(tenantId)).resolves.toBeNull();
    const limites = await suscripciones.limites(tenantId);
    expect(limites.usuariosMax).toBeNull();
  });

  it('cambiarPlan asigna, el gate obedece al plan, y queda auditado', async () => {
    const taller = await planPorCodigo('taller');
    await plataforma.cambiarPlan(staffId, tenantId, taller.id);

    // Taller NO incluye AFIP: el gate del tenant lo refleja al instante.
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(false);
    await expect(suscripciones.feature(tenantId, 'whatsapp')).resolves.toBe(
      true,
    );
    const limites = await suscripciones.limites(tenantId);
    expect(limites.usuariosMax).toBe(6);

    // Upgrade: upsert, no una segunda fila.
    const estudio = await planPorCodigo('estudio');
    await plataforma.cambiarPlan(staffId, tenantId, estudio.id);
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(true);
    expect(await prisma.suscripcion.count({ where: { tenantId } })).toBe(1);

    const eventos = await prisma.plataformaEvento.findMany({
      where: { staffUserId: staffId, tipo: 'plan_cambiado' },
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[1].descripcion).toContain('Taller → Estudio');
  });

  it('suspender corta el tenant Y su suscripción; reactivar restituye', async () => {
    await plataforma.suspenderTenant(staffId, tenantId, 'prueba de suspensión');

    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { activo: true },
    });
    expect(t?.activo).toBe(false);
    // Suscripción suspendida = sin features, aunque el plan los tenga.
    await expect(suscripciones.feature(tenantId, 'whatsapp')).resolves.toBe(
      false,
    );

    await plataforma.reactivarTenant(staffId, tenantId);
    const t2 = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { activo: true },
    });
    expect(t2?.activo).toBe(true);
    await expect(suscripciones.feature(tenantId, 'whatsapp')).resolves.toBe(
      true,
    );

    const tipos = (
      await prisma.plataformaEvento.findMany({
        where: { staffUserId: staffId },
        orderBy: { createdAt: 'asc' },
        select: { tipo: true },
      })
    ).map((e) => e.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining(['tenant_suspendido', 'tenant_reactivado']),
    );
  });

  it('crearTenant deja todo en una transacción: tenant + plan + invitación sin sender', async () => {
    const trial = await planPorCodigo('trial');
    const slug = `test-b1-alta-${randomUUID().slice(0, 8)}`;
    const r = await plataforma.crearTenant(staffId, {
      nombre: 'Alta B1',
      slug,
      planId: trial.id,
      adminEmail: 'duenio@imprenta.test.local',
    });
    tenantsCreados.push(r.tenantId);

    expect(r.invitacionUrl).toContain('/aceptar-invitacion?token=');

    const invitacion = await prisma.invitation.findFirst({
      where: { tenantId: r.tenantId },
    });
    expect(invitacion?.email).toBe('duenio@imprenta.test.local');
    expect(invitacion?.rol).toBe('ADMINISTRADOR');
    // La marca del control plane: sin membership emisora.
    expect(invitacion?.invitedByMembershipId).toBeNull();

    await expect(suscripciones.de(r.tenantId)).resolves.toMatchObject({
      planCodigo: 'trial',
      estado: 'activa',
    });
  });

  it('el slug repetido rebota antes de crear nada', async () => {
    const trial = await planPorCodigo('trial');
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    await expect(
      plataforma.crearTenant(staffId, {
        nombre: 'Duplicado',
        slug: t!.slug,
        planId: trial.id,
        adminEmail: 'x@test.local',
      }),
    ).rejects.toThrow('slug');
  });
});
