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
export async function tienePermiso(permiso: PermisoClave): Promise<boolean> {
  try {
    const { currentUser } = await getCurrentUserCached();
    const permisos = permisosDe(currentUser);
    // Sin lista (sesión de una versión anterior del API) se deja pasar: el API
    // frena igual, y una pantalla de "no tenés acceso" falsa es peor.
    return permisos === null || permisos.has(permiso);
  } catch {
    return true;
  }
}
