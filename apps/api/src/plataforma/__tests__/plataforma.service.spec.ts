import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PlataformaService } from '../plataforma.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PaddleService } from '../../cobro/paddle.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';

/**
 * La consola lee A TRAVÉS de los tenants — contra la base real
 * (gdi_saas_test) a propósito: lo que se prueba es justamente que las
 * lecturas sin contexto vean TODOS los tenants y que cada fila junte los
 * números del tenant correcto. Con un mock se probaría el mock.
 *
 * Otras suites crean y borran tenants en paralelo, así que acá se asserta
 * sobre LOS tenants propios (creados con slug aleatorio) y sobre el resumen
 * sólo en relativo (>=), nunca en totales exactos.
 */

const prisma = new PrismaClient();

describe('PlataformaService.consola', () => {
  const servicio = new PlataformaService(
    prisma as unknown as PrismaService,
    new PaddleService(),
    new TenantProvisioningService(),
  );
  let tenantVivoId: string;
  let tenantDormidoId: string;

  beforeAll(async () => {
    // Tenant "vivo": un usuario con sesión reciente y una OT emitida hoy.
    const vivo = await prisma.tenant.create({
      data: {
        nombre: 'Consola viva',
        slug: `test-cpl-vivo-${randomUUID()}`,
      },
      select: { id: true },
    });
    tenantVivoId = vivo.id;

    const user = await prisma.user.create({
      data: { email: `cpl-${randomUUID()}@test.local` },
      select: { id: true },
    });
    const membership = await prisma.membership.create({
      data: { userId: user.id, tenantId: tenantVivoId, rol: 'ADMINISTRADOR' },
      select: { id: true },
    });
    await prisma.authSession.create({
      data: {
        userId: user.id,
        currentTenantId: tenantVivoId,
        currentMembershipId: membership.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.ordenTrabajo.create({
      data: {
        tenantId: tenantVivoId,
        numero: 'OT-TEST-CPL-0001',
        estado: 'pendiente',
        fechaEmision: new Date(),
      },
    });
    await prisma.cotizacion.create({ data: { tenantId: tenantVivoId } });

    // Tenant "dormido": existe y nada más — nunca entró nadie.
    const dormido = await prisma.tenant.create({
      data: {
        nombre: 'Consola dormida',
        slug: `test-cpl-dormido-${randomUUID()}`,
      },
      select: { id: true },
    });
    tenantDormidoId = dormido.id;
  });

  afterAll(async () => {
    // El cascade de Tenant se lleva membership/sesión/OT/cotización; el User
    // de prueba se borra aparte (no cuelga de ningún tenant).
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantVivoId, tenantDormidoId] } },
    });
    // Sólo los usuarios de ESTA suite (no todos los @test.local, que otros
    // specs paralelos están usando).
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'cpl-' } },
    });
    await prisma.$disconnect();
  });

  it('ve TODOS los tenants, no uno: es la definición del plano', async () => {
    const { tenants } = await servicio.consola();
    const ids = tenants.map((t) => t.id);
    expect(ids).toContain(tenantVivoId);
    expect(ids).toContain(tenantDormidoId);
  });

  it('cada fila junta los números de SU tenant, sin mezclar', async () => {
    const { tenants } = await servicio.consola();
    const vivo = tenants.find((t) => t.id === tenantVivoId)!;
    const dormido = tenants.find((t) => t.id === tenantDormidoId)!;

    expect(vivo.usuariosActivos).toBe(1);
    expect(vivo.ots30d).toBe(1);
    expect(vivo.cotizaciones30d).toBe(1);
    expect(vivo.ultimoAccesoEl).not.toBeNull();
    expect(vivo.sinActividad14d).toBe(false);

    // El dormido no hereda nada del vivo: ni usuarios, ni OTs, ni accesos.
    expect(dormido.usuariosActivos).toBe(0);
    expect(dormido.ots30d).toBe(0);
    expect(dormido.ultimoAccesoEl).toBeNull();
    expect(dormido.sinActividad14d).toBe(true);
  });

  it('las series del gráfico tienen su forma: 12 semanas y 6 meses', async () => {
    const c = await servicio.consola();
    expect(c.actividadSemanal).toHaveLength(12);
    expect(c.altasMensuales).toHaveLength(6);
    // La OT emitida hoy cae en la última semana de la serie.
    expect(c.actividadSemanal[11].ots).toBeGreaterThanOrEqual(1);
    // Los dos tenants de esta suite se dieron de alta este mes.
    expect(c.altasMensuales[5].altas).toBeGreaterThanOrEqual(2);
  });

  it('el resumen agrega por encima de los tenants propios', async () => {
    const { resumen } = await servicio.consola();
    expect(resumen.tenants).toBeGreaterThanOrEqual(2);
    expect(resumen.tenantsActivos).toBeGreaterThanOrEqual(2);
    expect(resumen.usuariosActivos).toBeGreaterThanOrEqual(1);
    expect(resumen.ots30d).toBeGreaterThanOrEqual(1);
    expect(resumen.sinActividad14d).toBeGreaterThanOrEqual(1);
  });
});
