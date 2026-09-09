import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { runWithTenant } from '../common/tenant-context';

const db = new PrismaService();
const raw = new PrismaClient();
const tenants = [randomUUID(), randomUUID()];
const contorno = Array.from({ length: 100 }, (_, i) => ({
  x: i * 1.003,
  y: i / 7,
}));
const resultado = {
  cantidadCalculada: 80,
  placements: Array.from({ length: 300 }, (_, i) => ({
    pieceId: String(i),
    contorno,
  })),
};
beforeAll(async () => {
  for (const id of tenants)
    await db.tenant.create({
      data: { id, nombre: 'Codec F4', slug: `codec-${id}` },
    });
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await db.$disconnect();
  await raw.$disconnect();
});

it('conserva aislamiento entre tenants, formato antiguo, upsert y transacciones', async () => {
  for (const tenantId of tenants)
    await db.nestingGuardado.upsert({
      where: { tenantId_clave: { tenantId, clave: 'prueba' } },
      create: { tenantId, clave: 'prueba', resultadoJson: resultado },
      update: { resultadoJson: resultado },
    });
  const almacenado = await raw.nestingGuardado.findUniqueOrThrow({
    where: { tenantId_clave: { tenantId: tenants[0], clave: 'prueba' } },
  });
  expect(JSON.stringify(almacenado.resultadoJson).length).toBeLessThan(
    JSON.stringify(resultado).length / 10,
  );
  await runWithTenant(tenants[0], async () => {
    const propios = await db.nestingGuardado.findMany({});
    expect(propios).toHaveLength(1);
    expect(propios[0].resultadoJson).toEqual(resultado);
    expect(
      await db.nestingGuardado.findUnique({
        where: { tenantId_clave: { tenantId: tenants[1], clave: 'prueba' } },
        select: { resultadoJson: true },
      }),
    ).toBeNull();
  });
  await raw.nestingGuardado.create({
    data: {
      tenantId: tenants[0],
      clave: 'historico',
      resultadoJson: resultado,
    },
  });
  const historico = {
    where: { tenantId_clave: { tenantId: tenants[0], clave: 'historico' } },
  };
  expect(
    (await db.nestingGuardado.findUniqueOrThrow(historico)).resultadoJson,
  ).toEqual(
    (await raw.nestingGuardado.findUniqueOrThrow(historico)).resultadoJson,
  );
  const fallo = new Error('rollback deliberado');
  await expect(
    db.$transaction(async (tx) => {
      await tx.nestingGuardado.create({
        data: {
          tenantId: tenants[0],
          clave: 'rollback',
          resultadoJson: resultado,
        },
      });
      throw fallo;
    }),
  ).rejects.toBe(fallo);
  expect(
    await raw.nestingGuardado.count({
      where: { tenantId: tenants[0], clave: 'rollback' },
    }),
  ).toBe(0);
});

it('restaura relaciones seleccionadas y preserva mutaciones independientes', async () => {
  const res = await db.tenant.findUniqueOrThrow({
    where: { id: tenants[0] },
    include: { nestingsGuardados: true },
  });
  const primero = res.nestingsGuardados.find((n) => n.clave === 'prueba')!
    .resultadoJson as typeof resultado;
  primero.placements[0].contorno[0].x = -99;
  expect(primero.placements[1].contorno[0].x).toBe(0);
  const recargado = await db.nestingGuardado.findUniqueOrThrow({
    where: { tenantId_clave: { tenantId: tenants[0], clave: 'prueba' } },
  });
  expect(recargado.resultadoJson).toEqual(resultado);
});
