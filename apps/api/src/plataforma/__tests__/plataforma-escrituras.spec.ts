import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PlataformaService } from '../plataforma.service';
import { InvitacionesEmpresaService } from '../invitaciones-empresa.service';
import { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PaddleService } from '../../cobro/paddle.service';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';

/**
 * Las escrituras del control plane (etapa B1) y el lector de features, contra
 * la base real: lo que importa es la CADENA — cambiar un plan tiene que
 * mover el feature gate del tenant y dejar rastro en la auditoría, no sólo
 * escribir una fila. Trial/Founder son internos; los escenarios de cambio usan
 * planes propios y no dependen de planes comerciales archivados.
 */

const prisma = new PrismaClient();

describe('Control plane — escrituras y feature gates', () => {
  const plataforma = new PlataformaService(
    prisma as unknown as PrismaService,
    new PaddleService(),
    new TenantProvisioningService(),
    new InvitacionesEmpresaService(
      prisma as unknown as PrismaService,
      {
        enviarInvitacionEmpresa: jest
          .fn()
          .mockResolvedValue({ id: 'simulado' }),
      } as never,
    ),
  );
  const suscripciones = new SuscripcionesService(
    prisma as unknown as PrismaService,
    new PaddleService(),
    new SuscripcionSyncService(prisma as unknown as PrismaService),
  );
  let staffId: string;
  let tenantId: string;
  const tenantsCreados: string[] = [];
  const planesPrueba: string[] = [];
  const codigosPrueba = {
    base: `base-${randomUUID()}`,
    ampliado: `ampliado-${randomUUID()}`,
  };

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        email: `staff-${randomUUID()}@test.local`,
        rolPlataforma: 'ADMIN',
      },
      select: { id: true },
    });
    staffId = staff.id;
    for (const [codigo, nombre, featuresJson] of [
      [
        codigosPrueba.base,
        'Base de prueba',
        { afip: false, whatsapp: true, usuariosMax: 6 },
      ],
      [
        codigosPrueba.ampliado,
        'Ampliado de prueba',
        { afip: true, whatsapp: true, usuariosMax: 20 },
      ],
    ] as const) {
      const plan = await prisma.plan.create({
        data: {
          codigo,
          nombre,
          featuresJson: { ...featuresJson },
          precioMensual: 100,
          publico: false,
        },
      });
      planesPrueba.push(plan.id);
    }
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
    await prisma.plan.deleteMany({ where: { id: { in: planesPrueba } } });
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
    expect(codigos).toEqual(expect.arrayContaining(['trial', 'founder']));
    expect(codigos).not.toEqual(
      expect.arrayContaining(['taller', 'estudio', 'diamante']),
    );
    const founder = planes.find((p) => p.codigo === 'founder')!;
    expect(founder.precioMensual).toBe(1);
    expect(founder.moneda).toBe('USD');
    expect(founder.publico).toBe(false);
    expect(founder.features.todo).toBe(true);
  });

  it('sin suscripción el tenant es legacy: todo permitido (grandfathered)', async () => {
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(true);
    await expect(suscripciones.de(tenantId)).resolves.toBeNull();
    const limites = await suscripciones.limites(tenantId);
    expect(limites.usuariosMax).toBeNull();
  });

  it('cambiarPlan asigna, el gate obedece al plan, y queda auditado', async () => {
    const taller = await planPorCodigo(codigosPrueba.base);
    await plataforma.cambiarPlan(staffId, tenantId, taller.id);

    // El plan base de prueba NO incluye AFIP: el gate del tenant lo refleja al instante.
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(false);
    await expect(suscripciones.feature(tenantId, 'whatsapp')).resolves.toBe(
      true,
    );
    const limites = await suscripciones.limites(tenantId);
    expect(limites.usuariosMax).toBe(6);

    // Upgrade: upsert, no una segunda fila.
    const estudio = await planPorCodigo(codigosPrueba.ampliado);
    await plataforma.cambiarPlan(staffId, tenantId, estudio.id);
    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(true);
    expect(await prisma.suscripcion.count({ where: { tenantId } })).toBe(1);

    const eventos = await prisma.plataformaEvento.findMany({
      where: { staffUserId: staffId, tipo: 'plan_cambiado' },
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[1].descripcion).toContain(
      'Base de prueba → Ampliado de prueba',
    );
  });

  it('Founder habilita todo, no impone límites y permanece privado', async () => {
    const founder = await planPorCodigo('founder');
    await plataforma.cambiarPlan(staffId, tenantId, founder.id);

    await expect(suscripciones.feature(tenantId, 'afip')).resolves.toBe(true);
    await expect(suscripciones.feature(tenantId, 'whatsapp')).resolves.toBe(
      true,
    );
    await expect(
      suscripciones.feature(tenantId, 'centroCopiado'),
    ).resolves.toBe(true);
    await expect(suscripciones.limites(tenantId)).resolves.toMatchObject({
      planNombre: 'Founder',
      usuariosMax: null,
      ordenesMesMax: null,
      storageGb: null,
    });

    const otroTenant = await prisma.tenant.create({
      data: { nombre: 'Sin Founder', slug: `sin-founder-${randomUUID()}` },
      select: { id: true },
    });
    tenantsCreados.push(otroTenant.id);
    const priceIdPrueba = `pri_${randomUUID().replaceAll('-', '')}`;
    await prisma.plan.update({
      where: { id: founder.id },
      data: { paddlePriceId: priceIdPrueba },
    });
    try {
      const ofertaPropia = await suscripciones.estadoParaTenant(tenantId);
      expect(ofertaPropia.planes.some((p) => p.codigo === 'founder')).toBe(
        true,
      );

      const ofertaAjena = await suscripciones.estadoParaTenant(otroTenant.id);
      expect(ofertaAjena.planes.some((p) => p.codigo === 'founder')).toBe(
        false,
      );
    } finally {
      await prisma.plan.update({
        where: { id: founder.id },
        data: { paddlePriceId: null },
      });
    }
  });

  it('bloquear corta el acceso sin modificar la suscripción; levantar restituye', async () => {
    await plataforma.suspenderTenant(staffId, tenantId, 'prueba de suspensión');

    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { activo: true },
    });
    expect(t?.activo).toBe(false);
    // El bloqueo corta los features sin alterar el contrato de suscripción.
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
