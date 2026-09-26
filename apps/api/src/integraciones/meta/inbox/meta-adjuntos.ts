import type { Prisma } from '@prisma/client';
import { objeto } from './meta-inbox-normalizar';
export const adjuntosHabilitados = () =>
  process.env.META_INBOX_ADJUNTOS_ENABLED === 'true';
export const tiposMedia = ['image', 'audio', 'video', 'document', 'sticker'];

/** Se agenda con el mensaje, nunca hace red dentro de la transacción. */
export async function encolarAdjunto(
  tx: Prisma.TransactionClient,
  canal: { id: string; tenantId: string; autorizacionId: string },
  wamid: string,
) {
  const m = await tx.inboxMensaje.findFirst({
    where: { tenantId: canal.tenantId, vinculoId: canal.id, wamid },
    include: { adjunto: true },
  });
  if (!m) return;
  const c = objeto(m.contenido);
  const mediaId = typeof c.mediaId === 'string' ? c.mediaId : '';
  if (m.revocadoEl || !tiposMedia.includes(m.tipo ?? '') || !mediaId) {
    if (m.adjunto)
      await tx.inboxAdjunto.update({
        where: { id: m.adjunto.id },
        data: {
          estado: 'PENDIENTE',
          proximoIntentoEl: new Date(),
          bloqueoId: null,
          bloqueoHasta: null,
        },
      });
    return;
  }
  if (m.adjunto?.mediaId === mediaId) return;
  await tx.inboxAdjunto.upsert({
    where: { mensajeId: m.id },
    create: {
      mensajeId: m.id,
      vinculoId: canal.id,
      tenantId: canal.tenantId,
      autorizacionId: canal.autorizacionId,
      mediaId,
    },
    update: {
      mediaId,
      autorizacionId: canal.autorizacionId,
      estado: 'PENDIENTE',
      intentos: 0,
      falloCodigo: null,
      bloqueoId: null,
      bloqueoHasta: null,
      proximoIntentoEl: new Date(),
    },
  });
}
