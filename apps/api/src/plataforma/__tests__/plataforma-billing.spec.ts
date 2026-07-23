import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PlataformaBillingService } from '../plataforma-billing.service';
import { PlataformaModule } from '../plataforma.module';
import { IntegracionesModule } from '../../integraciones/integraciones.module';

/**
 * El billing de suscripciones (etapa B2), de punta a punta contra la base:
 * generar el período tiene que dejar un BORRADOR fiscal real en el tenant
 * plataforma (con letra por receptor y totales del módulo de comprobantes,
 * no una copia), el registro FacturaSuscripcion que lo hace idempotente, y
 * el tenant cliente convertido en Cliente de Grupo Idea.
 *
 * Se instancia vía Nest testing module porque el servicio arrastra el módulo
 * fiscal entero — eso es el diseño (reusar, no duplicar), y acá se paga con
 * un poco más de setup.
 */

const prisma = new PrismaClient();

describe('PlataformaBillingService', () => {
  let billing: PlataformaBillingService;
  let staffId: string;
  let plataformaId: string;
  let clienteRiId: string;
  let trialId: string;
  let pvId: string;
  const tenants: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // IntegracionesModule es @Global en la app; en el módulo de test
      // aislado hay que traerlo a mano (Administración depende de él).
      imports: [PlataformaModule, IntegracionesModule],
    }).compile();
    billing = moduleRef.get(PlataformaBillingService);

    const staff = await prisma.user.create({
      data: { email: `b2-${randomUUID()}@test.local`, rolPlataforma: 'ADMIN' },
      select: { id: true },
    });
    staffId = staff.id;

    // El tenant plataforma: Grupo Idea, RI, con su punto de venta del SaaS.
    const plataforma = await prisma.tenant.create({
      data: {
        nombre: 'Grupo Idea Test',
        slug: `test-b2-plataforma-${randomUUID()}`,
        esPlataforma: true,
        configuracionFiscal: {
          create: {
            razonSocial: 'Grupo Idea Test SAS',
            cuit: '30718882581',
            condicionFiscal: 'RI',
          },
        },
      },
      select: { id: true, configuracionFiscal: { select: { id: true } } },
    });
    plataformaId = plataforma.id;
    tenants.push(plataforma.id);
    // PuntoVenta lleva LAS DOS FK (tenant y config): anidado bajo la config
    // no recibe tenantId, así que va aparte.
    const pv = await prisma.puntoVenta.create({
      data: {
        tenantId: plataforma.id,
        configuracionFiscalId: plataforma.configuracionFiscal!.id,
        numero: 99,
        nombre: 'SaaS',
        modalidad: 'electronico',
      },
      select: { id: true },
    });
    pvId = pv.id;

    const estudio = await prisma.plan.findUnique({
      where: { codigo: 'estudio' },
    });
    const trial = await prisma.plan.findUnique({ where: { codigo: 'trial' } });

    // Cliente RI con datos fiscales: le corresponde factura A.
    const clienteRi = await prisma.tenant.create({
      data: {
        nombre: 'Imprenta RI Test',
        slug: `test-b2-ri-${randomUUID()}`,
        suscripcion: { create: { planId: estudio!.id, estado: 'activa' } },
        configuracionFiscal: {
          create: {
            razonSocial: 'Imprenta RI SRL',
            cuit: '30112223339',
            condicionFiscal: 'RI',
          },
        },
      },
      select: { id: true },
    });
    clienteRiId = clienteRi.id;
    tenants.push(clienteRi.id);

    // Trial: activo pero precio 0 — no se factura.
    const enTrial = await prisma.tenant.create({
      data: {
        nombre: 'Trial Test',
        slug: `test-b2-trial-${randomUUID()}`,
        suscripcion: { create: { planId: trial!.id, estado: 'activa' } },
      },
      select: { id: true },
    });
    trialId = enTrial.id;
    tenants.push(enTrial.id);

    // La plataforma también tiene suscripción (Diamante en dev): NUNCA se
    // factura a sí misma — el spec lo fija.
    const diamante = await prisma.plan.findUnique({
      where: { codigo: 'diamante' },
    });
    await prisma.suscripcion.create({
      data: { tenantId: plataformaId, planId: diamante!.id, estado: 'activa' },
    });
  });

  afterAll(async () => {
    await prisma.plataformaEvento.deleteMany({
      where: { staffUserId: staffId },
    });
    // FacturaSuscripcion cae por cascade del Comprobante, que cae con la
    // config fiscal del tenant plataforma… no: Comprobante cae con el tenant.
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.user.deleteMany({ where: { id: staffId } });
    await prisma.$disconnect();
  });

  it('el estado lista al RI como pendiente y excluye trial y plataforma', async () => {
    const e = await billing.estado();
    expect(e.tenantPlataforma?.id).toBe(plataformaId);
    const ids = e.pendientes.map((p) => p.tenantId);
    expect(ids).toContain(clienteRiId);
    expect(ids).not.toContain(trialId);
    expect(ids).not.toContain(plataformaId);
  });

  it('generar deja el borrador fiscal real, el registro y el Cliente', async () => {
    const r = await billing.generarPeriodo(staffId, pvId);
    // generadas es un total global (otros specs corren en paralelo): lo que
    // importa es que ESTE tenant quedó facturado. La salteada propia sí es 0.
    expect(r.generadas).toBeGreaterThanOrEqual(1);
    expect(r.salteadas.some((x) => x.tenantNombre === 'Imprenta RI Test')).toBe(
      false,
    );

    const factura = await prisma.facturaSuscripcion.findFirst({
      where: { tenantClienteId: clienteRiId },
      include: { comprobante: true },
    });
    expect(factura).not.toBeNull();
    expect(Number(factura!.monto)).toBe(189000);

    // El comprobante es del módulo fiscal de verdad: borrador, en el tenant
    // plataforma, letra A (RI → RI) y con el total exacto del plan.
    const c = factura!.comprobante;
    expect(c.estado).toBe('borrador');
    expect(c.tenantId).toBe(plataformaId);
    expect(c.letra).toBe('A');
    expect(Number(c.total)).toBeCloseTo(189000, 1);
    expect(JSON.stringify(c.receptorSnapshot)).toContain('30112223339');

    // El tenant cliente quedó como Cliente de Grupo Idea, por su CUIT.
    const cliente = await prisma.cliente.findFirst({
      where: { tenantId: plataformaId, cuit: '30112223339' },
    });
    expect(cliente).not.toBeNull();
  });

  it('correrlo de nuevo no duplica: el período ya está', async () => {
    await billing.generarPeriodo(staffId, pvId);
    // La idempotencia se mide en ESTE tenant: sigue con una sola factura.
    expect(
      await prisma.facturaSuscripcion.count({
        where: { tenantClienteId: clienteRiId },
      }),
    ).toBe(1);
  });

  it('borrar el borrador libera el período (cascade) y se puede regenerar', async () => {
    const factura = await prisma.facturaSuscripcion.findFirst({
      where: { tenantClienteId: clienteRiId },
      select: { comprobanteId: true },
    });
    await prisma.comprobante.delete({ where: { id: factura!.comprobanteId } });
    expect(
      await prisma.facturaSuscripcion.count({
        where: { tenantClienteId: clienteRiId },
      }),
    ).toBe(0);

    const r = await billing.generarPeriodo(staffId, pvId);
    expect(r.generadas).toBe(1);
    // El Cliente no se duplica: lo encuentra por CUIT.
    expect(
      await prisma.cliente.count({
        where: { tenantId: plataformaId, cuit: '30112223339' },
      }),
    ).toBe(1);
  });

  it('quedó auditado en PlataformaEvento', async () => {
    const eventos = await prisma.plataformaEvento.findMany({
      where: { staffUserId: staffId, tipo: 'billing_generado' },
    });
    expect(eventos.length).toBeGreaterThanOrEqual(2);
  });
});
