import { PrismaClient } from '@prisma/client';
import { CentroCopiadoSaludService } from '../centro-copiado-salud.service';

const prisma = new PrismaClient();

afterAll(async () => prisma.$disconnect());

it('diagnostica el tenant sin mutarlo y devuelve chequeos accionables', async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const service = new CentroCopiadoSaludService(prisma as never);
  const antes = await prisma.centroCopiadoEvento.count({
    where: { tenantId: tenant.id },
  });

  const salud = await service.obtener(tenant.id);

  expect(['OPERATIVO', 'ADVERTENCIA', 'ERROR']).toContain(salud.estado);
  expect(salud.chequeos.map((chequeo) => chequeo.codigo)).toEqual(
    expect.arrayContaining([
      'configuracion',
      'plantilla',
      'ruta_impresion',
      'papeles',
    ]),
  );
  expect(salud.resumen.papeles).toBeGreaterThan(0);
  await expect(
    prisma.centroCopiadoEvento.count({ where: { tenantId: tenant.id } }),
  ).resolves.toBe(antes);
});
