/** Instala de forma idempotente el material, producto y sus dos rutas. */
const { PrismaClient } = require('@prisma/client');
const {
  provisionViniloEsmeriladoProduct,
} = require('./seed-modulos/vinilo-esmerilado-producto');

async function main() {
  const prisma = new PrismaClient();
  const tenants = process.env.TENANT_ID
    ? await prisma.tenant.findMany({ where: { id: process.env.TENANT_ID } })
    : await prisma.tenant.findMany({ where: { activo: true } });
  if (tenants.length !== 1) {
    throw new Error(
      `Se esperaba un único tenant activo; se encontraron ${tenants.length}. Definí TENANT_ID.`,
    );
  }
  const result = await provisionViniloEsmeriladoProduct(prisma, tenants[0].id);
  console.log(
    `OK · ${result.product.nombre} con rutas de plotter y corte manual`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
