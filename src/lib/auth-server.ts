import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { ZONA_DEFAULT } from "@/lib/zona";

export const getCurrentUserCached = cache(getCurrentUser);

/**
 * La zona horaria del tenant, para páginas SERVER (las de cliente usan
 * `useConfigRegional()`). Sale de la misma sesión cacheada que ya resolvió
 * el layout, así que no cuesta un viaje extra. Sin dato → Argentina.
 */
export async function zonaHorariaDelTenant(): Promise<string> {
  try {
    const { currentUser } = await getCurrentUserCached();
    return currentUser.tenantActual?.regional?.zonaHoraria || ZONA_DEFAULT;
  } catch {
    return ZONA_DEFAULT;
  }
}
