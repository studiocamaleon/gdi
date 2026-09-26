import type { EstadoAltaMeta, InboxImportacion, Prisma } from '@prisma/client';

export type EstadoImportacionInbox =
  | 'PREPARANDO'
  | 'ESPERANDO_META'
  | 'RECIBIENDO'
  | 'PROCESANDO'
  | 'RECIBIDO_PROCESADO'
  | 'NO_COMPARTIDO'
  | 'REVISION';

/** Foto de lo recibido, NO un certificado de que Meta entregó todos los chats.
 * No existe un total documentado de bloques; una fase vacía no envía webhook. */
export async function resumirImportacion(
  tx: Prisma.TransactionClient,
  scope: { tenantId: string; vinculoId: string; autorizacionId: string },
  imp: Pick<
    InboxImportacion,
    | 'progresoInformado'
    | 'finInformadoEl'
    | 'historialRechazado'
    | 'necesitaRevision'
  > | null,
  alta: { estado: EstadoAltaMeta } | null,
) {
  const where = {
    ...scope,
    crudo: { tipo: 'history', tenantId: scope.tenantId },
  };
  const pendientes = await tx.inboxTrabajoEvento.count({
    where: { ...where, estado: 'PENDIENTE' },
  });
  const revisiones = await tx.inboxTrabajoEvento.count({
    where: { ...where, estado: { in: ['REVISION', 'PAUSADO'] } },
  });
  const bloques = await tx.inboxBloqueHistorial.count({ where: scope });
  const ultimo = await tx.inboxTrabajoEvento.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  let estado: EstadoImportacionInbox;
  if (
    imp?.necesitaRevision ||
    revisiones ||
    (alta && ['REVISION', 'PAUSADA'].includes(alta.estado))
  )
    estado = 'REVISION';
  else if (pendientes) estado = 'PROCESANDO';
  else if (imp?.historialRechazado) estado = 'NO_COMPARTIDO';
  else if (imp?.finInformadoEl && imp.progresoInformado === 100)
    estado = 'RECIBIDO_PROCESADO';
  else if (ultimo || bloques) estado = 'RECIBIENDO';
  else if (alta?.estado === 'SOLICITUDES_COMPLETADAS')
    estado = 'ESPERANDO_META';
  else estado = 'PREPARANDO';
  return {
    estado,
    pendientes,
    revisiones,
    bloquesProcesados: bloques,
    ultimoRecibidoEl: ultimo?.createdAt ?? null,
  };
}
