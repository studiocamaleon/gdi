/**
 * Instala/actualiza Polyfan y el producto vectorial sin borrar datos.
 *
 * Si hay más de un tenant, TENANT_SLUG es obligatorio:
 *   TENANT_SLUG=gdi-demo node prisma/install-polyfan-product.js
 */
const { PrismaClient } = require('@prisma/client');
const { provisionPolyfanProduct } = require('./seed-modulos/polyfan-producto');

async function resolveTenant(prisma) {
  const requestedSlug = process.env.TENANT_SLUG?.trim();
  if (requestedSlug) {
    return prisma.tenant.findUniqueOrThrow({ where: { slug: requestedSlug } });
  }
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, nombre: true },
    take: 2,
  });
  if (tenants.length !== 1) {
    throw new Error(
      'Indicá TENANT_SLUG: la base no contiene exactamente un tenant.',
    );
  }
  return tenants[0];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const tenant = await resolveTenant(prisma);
    const result = await provisionPolyfanProduct(prisma, tenant.id);
    console.info(
      [
        `OK · tenant ${tenant.slug}`,
        `producto "${result.product.nombre}"`,
        `ruta "${result.route.nombre}"`,
        `${result.material.variants.length} variantes de Polyfan`,
        'familia corte_hilo_caliente',
      ].join(' · '),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
