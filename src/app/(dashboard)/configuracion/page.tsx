import { redirect } from "next/navigation";

import { seccionesConfigVisibles } from "@/components/configuracion/configuracion-secciones";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getCurrentUserCached } from "@/lib/auth-server";
import { permisosDe } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/**
 * "Configuración" a secas no es una pantalla: es el módulo. Manda a la primera
 * sección que la persona puede abrir —Empresa para el dueño, Datos fiscales
 * para el Administrativo, que entra con su llave de facturación y no tiene el
 * resto—. De ahí en adelante navega por la columna.
 */
export default async function Page() {
  const { currentUser } = await getCurrentUserCached();
  const permisos = permisosDe(currentUser);
  const visibles = seccionesConfigVisibles(
    (p) => permisos === null || permisos.has(p),
    currentUser.tenantActual?.regional?.paisCodigo ?? "AR",
  );
  // El layout ya frenó a quien no tiene ninguna de las dos llaves; esto cubre
  // el caso raro de un rol con la llave del módulo y ninguna sección.
  if (visibles.length === 0) {
    return <SinPermiso modulo="Configuración" />;
  }
  redirect(visibles[0].href);
}
