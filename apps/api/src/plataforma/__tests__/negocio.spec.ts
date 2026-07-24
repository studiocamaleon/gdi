import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { NegocioService } from '../negocio.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Inteligencia de negocio del ecosistema: lo que fija el spec es que la
 * agregación es CROSS-TENANT (suma ventas de tenants distintos, sin filtrar) y
 * que el mix por categoría y el ranking por tenant salen bien. Corre contra
 * gdi_saas_test, que puede tener data de otros suites: por eso las
 * aserciones buscan los tenants/categorías propios por id/nombre (únicos), y
 * los totales se comparan con `>=`, no por igualdad. Ver
 * docs/control-plane-negocio-diseno.md
 */

const prisma = new PrismaClient();
const servicio = new NegocioService(prisma as unknown as PrismaService);

// Categorías únicas por corrida, para encontrarlas sin ruido de otros suites.
const catA = `TEST-CAT-A-${randomUUID().slice(0, 8)}`;
const catB = `TEST-CAT-B-${randomUUID().slice(0, 8)}`;

let tenantAId: string;
let tenantBId: string;

async function crearTenantConVenta(
  nombre: string,
  categoria: string,
  subtotal: number,
): Promise<string> {
  const t = await prisma.tenant.create({
    data: { nombre, slug: `test-neg-${randomUUID()}` },
    select: { id: true },
  });
  const ot = await prisma.ordenTrabajo.create({
    data: {
      tenantId: t.id,
      numero: `OT-NEG-${randomUUID().slice(0, 8)}`,
      estado: 'pendiente', // no-borrador → cuenta como venta
      fechaEmision: new Date(),
    },
    select: { id: true },
  });
  await prisma.ordenTrabajoItem.create({
    data: {
      tenantId: t.id,
      ordenId: ot.id,
      codigo: 'X',
      nombre: 'Item de prueba',
      familia: '',
      categoriaComercial: categoria,
      cantidad: 1,
      cantidadUnidad: 'unidad',
      subtotal,
      impuestos: 0,
      total: subtotal,
    },
  });
  return t.id;
}

describe('NegocioService — agregación cross-tenant', () => {
  beforeAll(async () => {
    tenantAId = await crearTenantConVenta('Imprenta Neg A', catA, 1000);
    tenantBId = await crearTenantConVenta('Imprenta Neg B', catB, 2000);
  });

  afterAll(async () => {
    // El cascade de Tenant se lleva OT + items.
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
    await prisma.$disconnect();
  });

  it('suma ventas de tenants distintos (no filtra por uno)', async () => {
    const r = await servicio.negocio('12m');
    // El total del ecosistema incluye al menos las dos ventas de prueba.
    expect(r.kpis.ventas).toBeGreaterThanOrEqual(3000);

    const a = r.porTenant.find((t) => t.tenantId === tenantAId);
    const b = r.porTenant.find((t) => t.tenantId === tenantBId);
    expect(a?.ventas).toBe(1000);
    expect(b?.ventas).toBe(2000);
  });

  it('arma el mix por categoría comercial', async () => {
    const r = await servicio.negocio('12m');
    const ca = r.porCategoria.find((c) => c.categoria === catA);
    const cb = r.porCategoria.find((c) => c.categoria === catB);
    expect(ca?.ventas).toBe(1000);
    expect(cb?.ventas).toBe(2000);
    // pct es share del total del ecosistema (0..100).
    expect(ca?.pct).toBeGreaterThan(0);
  });

  it('cuenta adopción: los dos tenants tienen ventas', async () => {
    const r = await servicio.negocio('12m');
    expect(r.adopcion.conVentas).toBeGreaterThanOrEqual(2);
    expect(r.adopcion.totalTenants).toBeGreaterThanOrEqual(2);
  });

  it('respeta el período: 30 días no incluye ventas viejas', async () => {
    // Movemos la OT de A a hace 200 días y pedimos 30d: no debe aparecer.
    await prisma.ordenTrabajo.updateMany({
      where: { tenantId: tenantAId },
      data: { fechaEmision: new Date(Date.now() - 200 * 86_400_000) },
    });
    const r = await servicio.negocio('30d');
    const a = r.porTenant.find((t) => t.tenantId === tenantAId);
    expect(a).toBeUndefined();
    // B sigue estando (fechaEmision de hoy).
    const b = r.porTenant.find((t) => t.tenantId === tenantBId);
    expect(b?.ventas).toBe(2000);
  });
});
