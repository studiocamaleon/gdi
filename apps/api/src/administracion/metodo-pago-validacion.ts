import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** La FK sólo comprueba existencia global: una referencia de pago debe
 * pertenecer a la misma empresa, también en relaciones anidadas de Prisma.
 * Se permiten métodos propios inactivos para conservar referencias históricas;
 * la operación de pago sigue exigiendo que el método esté activo. */
export async function exigirMetodoPagoDelTenant(
  db: Pick<Prisma.TransactionClient, 'metodoPago'>,
  tenantId: string,
  metodoPagoId: string | null | undefined,
): Promise<void> {
  if (metodoPagoId == null) return;
  const metodo = await db.metodoPago.findFirst({
    where: { id: metodoPagoId, tenantId },
    select: { id: true },
  });
  if (!metodo) {
    throw new BadRequestException(
      'El método de pago no está disponible en esta empresa.',
    );
  }
}
