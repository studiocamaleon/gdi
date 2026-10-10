import { Prisma } from '@prisma/client';
import { contieneSinAcentos } from '../common/busqueda-texto';

/** También incluye inactivos: las órdenes históricas deben seguir encontrándose. */
export async function idsClientesPorNombre(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  tenantId: string,
  texto: string,
): Promise<string[]> {
  if (!texto.trim()) return [];
  const filas = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM "Cliente" c WHERE c."tenantId" = ${tenantId}::uuid
    AND (${contieneSinAcentos(Prisma.sql`c.nombre`, texto)}
      OR ${contieneSinAcentos(Prisma.sql`c."razonSocial"`, texto)})`);
  return filas.map((fila) => fila.id);
}
