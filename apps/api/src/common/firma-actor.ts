import type { CurrentAuth } from '../auth/auth.types';

/**
 * El nombre que se persiste como autor de una acción del negocio.
 *
 * En una sesión normal es el nombre resuelto del usuario. En una
 * IMPERSONACIÓN devuelve "Soporte Grafo (Nombre)" —el actorNombre que ya
 * armó el control plane— así que todo lo que el tenant ve en su timeline
 * queda firmado como soporte, no camuflado como uno de sus empleados.
 * Ver docs/control-plane-diseno.md (etapa C).
 */
export function firmaActor(auth: CurrentAuth, nombreResuelto: string): string {
  return auth.impersonacion?.actorNombre ?? nombreResuelto;
}
