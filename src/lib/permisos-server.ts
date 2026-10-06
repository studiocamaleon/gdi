import { getCurrentUserCached } from "@/lib/auth-server";
import { permisosDe, type PermisoClave } from "@/lib/permisos";

/**
 * ¿El usuario de esta sesión tiene el permiso? Para los layouts de módulo.
 *
 * Vive aparte de `@/lib/permisos` porque toca la sesión del servidor, y ese
 * archivo lo importa el sidebar, que es un componente de cliente.
 *
 * Como todo lo del front, es cortesía: sirve para mostrar una pantalla que
 * explica en vez de una vacía con errores. La autorización real la hace el API.
 */
export async function tienePermiso(
  permiso: PermisoClave,
  { exigirConfirmacion = false }: { exigirConfirmacion?: boolean } = {},
): Promise<boolean> {
  try {
    const { currentUser } = await getCurrentUserCached();
    const permisos = permisosDe(currentUser);
    // Los layouts legacy toleran sesiones sin lista. Las vistas comerciales
    // sensibles exigen confirmación y no cargan datos ante un fallo de sesión.
    return permisos === null ? !exigirConfirmacion : permisos.has(permiso);
  } catch {
    return !exigirConfirmacion;
  }
}

/** Sólo para la puerta de una sección; cada página/API exige su vista. */
export async function tieneSeccion(seccion: string): Promise<boolean> {
  try {
    const { currentUser } = await getCurrentUserCached();
    const permisos = permisosDe(currentUser);
    return permisos === null || [...permisos].some(p => p.startsWith(`${seccion}.`) && p.endsWith('.ver'));
  } catch { return false; }
}
