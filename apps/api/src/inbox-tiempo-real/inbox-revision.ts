import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export type CanalInbox = {
  tenantId: string;
  wabaId: string;
  phoneNumberId: string;
};
export const claveCanalInbox = (canal: CanalInbox) =>
  createHash('sha256')
    .update(JSON.stringify([canal.tenantId, canal.wabaId, canal.phoneNumberId]))
    .digest('hex');

/** Se llama DENTRO de la transacción del cambio. El bloqueo de esta fila
 * ordena los commits del canal; Redis nunca es el registro de verdad. */
export async function registrarCambioInbox(
  tx: Prisma.TransactionClient,
  canal: CanalInbox,
) {
  return tx.inboxCanalRevision.upsert({
    where: { tenantId_wabaId_phoneNumberId: canal },
    create: { ...canal, revision: 1n },
    update: { revision: { increment: 1 } },
    select: { revision: true },
  });
}
