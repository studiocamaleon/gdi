import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Una FK global sólo prueba que el UUID existe. Esta validación prueba además
 * que el proveedor pertenece al tenant y sigue habilitado para operar.
 */
export async function exigirProveedorActivoDelTenant(
  db: Db,
  tenantId: string,
  proveedorId: string | null | undefined,
) {
  if (!proveedorId) return null;
  const proveedor = await db.proveedor.findFirst({
    where: { id: proveedorId, tenantId, activo: true },
    select: { id: true, nombre: true },
  });
  if (!proveedor) {
    throw new BadRequestException(
      'El proveedor indicado no existe, está inhabilitado o pertenece a otra empresa.',
    );
  }
  return proveedor;
}
