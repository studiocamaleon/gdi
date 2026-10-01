import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { runWithTenant } from '../../common/tenant-context';
import { tenantGuardExtension } from '../tenant-guard.extension';

/** Pruebas reales en la base local aislada gdi_saas_test. */
describe('tenant-guard — aislamiento de lecturas y escrituras', () => {
  const base = new PrismaClient();
  const guarded = base.$extends(tenantGuardExtension);
  let tenantId: string;
  let otroTenantId: string;

  beforeAll(async () => {
    const slug = `test-guard-${randomUUID().slice(0, 8)}`;
    tenantId = (
      await base.tenant.create({ data: { nombre: 'Guard test', slug } })
    ).id;
    otroTenantId = (
      await base.tenant.create({
        data: { nombre: 'Guard test ajeno', slug: `${slug}-b` },
      })
    ).id;
    await base.configuracionFiscal.create({
      data: {
        tenantId,
        razonSocial: 'Guard SA',
        cuit: '30712345671',
        condicionFiscal: 'RI',
      },
    });
  });

  afterAll(async () => {
    await base.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenantId] } },
    });
    await base.$disconnect();
  });

  it('devuelve la fila propia aunque el select no incluya tenantId', async () => {
    const config = await runWithTenant(tenantId, async () =>
      guarded.configuracionFiscal.findUnique({
        where: { tenantId },
        select: { condicionFiscal: true },
      }),
    );
    expect(config?.condicionFiscal).toBe('RI');
  });

  it('sigue bloqueando la fila ajena con select parcial', async () => {
    const config = await runWithTenant(otroTenantId, async () =>
      guarded.configuracionFiscal.findUnique({
        where: { tenantId },
        select: { condicionFiscal: true },
      }),
    );
    expect(config).toBeNull();
  });

  it('findUniqueOrThrow propio con select parcial no explota', async () => {
    const config = await runWithTenant(tenantId, async () =>
      guarded.configuracionFiscal.findUniqueOrThrow({
        where: { tenantId },
        select: { razonSocial: true },
      }),
    );
    expect(config.razonSocial).toBe('Guard SA');
  });

  it('un upsert no actualiza la configuración fiscal de otra empresa', async () => {
    await expect(
      runWithTenant(otroTenantId, async () =>
        guarded.configuracionFiscal.upsert({
          where: { tenantId },
          update: { razonSocial: 'Cambio ajeno' },
          create: {
            tenantId: otroTenantId,
            razonSocial: 'Propia',
            cuit: '30712345672',
            condicionFiscal: 'RI',
          },
        }),
      ),
    ).rejects.toThrow();
    expect(
      (
        await base.configuracionFiscal.findUniqueOrThrow({
          where: { tenantId },
        })
      ).razonSocial,
    ).toBe('Guard SA');
  });

  it('un create explícito no puede escribir para otra empresa', async () => {
    await expect(
      runWithTenant(tenantId, async () =>
        guarded.planta.create({
          data: {
            tenantId: otroTenantId,
            nombre: 'Planta ajena',
            codigo: 'AJENA',
          },
        }),
      ),
    ).rejects.toThrow();
    expect(await base.planta.count({ where: { tenantId: otroTenantId } })).toBe(
      0,
    );
  });
  it('no traslada una fila propia a una empresa ajena con update', async () => {
    await expect(
      runWithTenant(tenantId, async () =>
        guarded.configuracionFiscal.update({
          where: { tenantId },
          data: { tenantId: { set: otroTenantId } },
        }),
      ),
    ).rejects.toThrow();
    expect(await base.configuracionFiscal.count({ where: { tenantId } })).toBe(
      1,
    );
  });

  it('no admite una fila ajena en createMany y revierte todo el lote', async () => {
    await expect(
      runWithTenant(tenantId, async () =>
        guarded.planta.createMany({
          data: [
            { tenantId, nombre: 'Propia', codigo: 'PROPIA' },
            { tenantId: otroTenantId, nombre: 'Ajena', codigo: 'AJENA' },
          ],
        }),
      ),
    ).rejects.toThrow();
    expect(
      await base.planta.count({
        where: { tenantId: { in: [tenantId, otroTenantId] } },
      }),
    ).toBe(0);
  });

  it('filtra la consulta única en la base, sin agregar tenantId al select', async () => {
    const propia = await runWithTenant(tenantId, async () =>
      guarded.configuracionFiscal.findUnique({
        where: { tenantId },
        select: { razonSocial: true },
      }),
    );
    expect(propia).toEqual({ razonSocial: 'Guard SA' });
    await expect(
      runWithTenant(otroTenantId, async () =>
        guarded.configuracionFiscal.findUniqueOrThrow({
          where: { tenantId },
          select: { razonSocial: true },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('mantiene las escrituras legítimas y la creación en lote con retorno', async () => {
    await runWithTenant(tenantId, async () =>
      guarded.configuracionFiscal.upsert({
        where: { tenantId },
        update: { razonSocial: 'Guard SA' },
        create: {
          tenantId,
          razonSocial: 'Guard SA',
          cuit: '30712345671',
          condicionFiscal: 'RI',
        },
      }),
    );
    const plantas = await runWithTenant(tenantId, async () =>
      guarded.planta.createManyAndReturn({
        data: { tenantId, nombre: 'Propia', codigo: 'OK' },
      }),
    );
    expect(plantas).toHaveLength(1);
    expect(plantas[0].tenantId).toBe(tenantId);
    const ajenas = await runWithTenant(otroTenantId, async () =>
      guarded.planta.updateManyAndReturn({
        where: { id: plantas[0].id },
        data: { nombre: 'Ajena' },
      }),
    );
    expect(ajenas).toEqual([]);
  });
});
