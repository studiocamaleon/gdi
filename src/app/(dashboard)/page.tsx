import { redirect } from "next/navigation";

import { getCurrentUserCached } from "@/lib/auth-server";
import { flattenNavDestinations } from "@/components/navigation/nav-items";
import { permisosDe } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/**
 * El home, por ahora, no es una pantalla: manda a cada uno al primer lugar que
 * su rol le deja ver.
 *
 * Hasta acá "/" era el Panel general, que en realidad era un módulo entero de
 * ocho reportes disfrazado de home — y encima uno que el Operario no podía
 * abrir, porque no tiene el permiso. Los reportes se mudaron a /reportes; qué
 * va a vivir en el home (y para quién) se diseña aparte. Mientras tanto esto
 * redirige en vez de mostrar una pantalla vacía, que sería peor.
 *
 * El destino sale del MISMO árbol que dibuja el sidebar, así que no hay una
 * segunda lista de rutas por rol que se desincronice: el primer destino
 * visible del sidebar es el primer destino de acá.
 */
export default async function DashboardPage() {
  const { currentUser } = await getCurrentUserCached();
  const destinos = flattenNavDestinations(permisosDe(currentUser));

  // Sin un solo destino la sesión no tiene ningún módulo: es un rol vacío, y lo
  // que corresponde es decirlo, no rebotar en un bucle contra "/".
  if (destinos.length === 0) {
    return (
      <div className="d-empty" style={{ padding: 48 }}>
        Tu rol todavía no tiene ningún módulo habilitado. Pedile a quien
        administra el sistema en tu empresa que te asigne uno.
      </div>
    );
  }

  redirect(destinos[0].href);
}
