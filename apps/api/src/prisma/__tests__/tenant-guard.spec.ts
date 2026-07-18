import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { runWithTenant } from '../../common/tenant-context';
import { tenantGuardExtension } from '../tenant-guard.extension';

/**
 * Regresión del post-filtro de findUnique del tenant-guard: con `select`
 * parcial (sin tenantId) el guard comparaba `undefined !== tenantId` y
 * descartaba filas PROPIAS — la configuración fiscal aparecía como
 * inexistente. El fix inyecta tenantId en el select para poder verificar.
 * Corre contra gdi_saas_test (ver test/jest-setup-db.ts).
 */
describe('tenant-guard — findUnique con select parcial', () => {
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
});
