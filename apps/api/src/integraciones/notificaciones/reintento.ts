import { createHash } from 'node:crypto';
import type { NotificacionWhatsapp } from '@prisma/client';

type Aviso = Pick<
  NotificacionWhatsapp,
  | 'id'
  | 'canal'
  | 'estado'
  | 'enviadaEl'
  | 'reservaToken'
  | 'intentos'
  | 'motivo'
>;

/** Sólo un rechazo confirmado. Nunca inferir fallo a partir de un timeout. */
export function puedeReintentarAviso(n: Aviso): boolean {
  return n.canal === 'WATI' && n.estado === 'fallida' && !n.enviadaEl;
}

/** Versión opaca de la fila: evita repetir una acción desde un historial viejo
 * sin exponer el token interno que reserva el despacho. */
export function versionReintento(n: Aviso): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        n.id,
        n.canal,
        n.estado,
        n.reservaToken,
        n.intentos,
        n.motivo,
        n.enviadaEl,
      ]),
    )
    .digest('hex');
}
