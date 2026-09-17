import type { PrismaClient } from '@prisma/client';

/** Los fixtures anteriores a compra/uso cotizaban sus precios por unidad de uso. */
export async function declararUnidadPrecioFixture(
  prisma: Pick<PrismaClient, 'materiaPrimaVariante'>,
  tenantId: string,
) {
  const pendientes = await prisma.materiaPrimaVariante.findMany({
    where: { tenantId, unidadPrecio: null },
    include: { materiaPrima: true },
  });
  for (const v of pendientes)
    await prisma.materiaPrimaVariante.update({
      where: { id: v.id },
      data: { unidadPrecio: v.unidadStock ?? v.materiaPrima.unidadStock },
    });
  return async () => {
    await prisma.materiaPrimaVariante.updateMany({
      where: { id: { in: pendientes.map((v) => v.id) } },
      data: { unidadPrecio: null },
    });
  };
}
