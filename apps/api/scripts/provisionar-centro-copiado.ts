/**
 * Runner del provisionador del producto plantilla del TPV Centro de copiado.
 * La lógica vive en src/centro-copiado/provisionar-plantilla.ts (fuente única,
 * también usada por el servicio y los tests).
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register scripts/provisionar-centro-copiado.ts
 *   npx ts-node -r tsconfig-paths/register scripts/provisionar-centro-copiado.ts <tenantId>
 */
import { PrismaClient } from '@prisma/client';
import { provisionarPlantillaCentroCopiado } from '../src/centro-copiado/provisionar-plantilla';

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  const tenants = arg
    ? await prisma.tenant.findMany({ where: { id: arg } })
    : await prisma.tenant.findMany();
  if (tenants.length === 0) {
    console.warn('No hay tenants para provisionar.');
    return;
  }
  for (const t of tenants) {
    const r = await provisionarPlantillaCentroCopiado(prisma, t.id);
    if (r.estado === 'ya_existe')
      console.log(`[${t.nombre}] ya existe SYS-IMPRESION-DOC (${r.productoId}) — skip`);
    else if (r.estado === 'omitido')
      console.warn(`[${t.nombre}] omitido: ${r.motivo}`);
    else console.log(`[${t.nombre}] creado (${r.productoId})\n   ${r.detalle}`);
  }
}

main()
  .catch((e) => {
    console.error('ERROR:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
