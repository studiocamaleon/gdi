import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CentroCopiadoIdempotenciaService } from '../centro-copiado-idempotencia.service';

const prisma = new PrismaClient();

afterAll(async () => prisma.$disconnect());

it('devuelve el primer resultado sin ejecutar dos veces la operación', async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const service = new CentroCopiadoIdempotenciaService(prisma as never);
  const clave = randomUUID();
  const accion = jest.fn(async () => ({ id: 'resultado', total: 1250 }));

  const primera = await service.ejecutar({
    tenantId: tenant.id,
    tipo: 'PRUEBA',
    clave,
    accion,
  });
  const segunda = await service.ejecutar({
    tenantId: tenant.id,
    tipo: 'PRUEBA',
    clave,
    accion,
  });

  expect(primera).toEqual(segunda);
  expect(accion).toHaveBeenCalledTimes(1);
  await prisma.centroCopiadoOperacion.deleteMany({
    where: { tenantId: tenant.id, tipo: 'PRUEBA', idempotencyKey: clave },
  });
});

it('libera la clave cuando la operación falla', async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const service = new CentroCopiadoIdempotenciaService(prisma as never);
  const clave = randomUUID();

  await expect(
    service.ejecutar({
      tenantId: tenant.id,
      tipo: 'PRUEBA_ERROR',
      clave,
      accion: async () => {
        throw new Error('fallo esperado');
      },
    }),
  ).rejects.toThrow('fallo esperado');

  await expect(
    prisma.centroCopiadoOperacion.findUnique({
      where: {
        tenantId_tipo_idempotencyKey: {
          tenantId: tenant.id,
          tipo: 'PRUEBA_ERROR',
          idempotencyKey: clave,
        },
      },
    }),
  ).resolves.toBeNull();
});
