import { cache } from "react";
import { consultarCapacidades, type ClaveCapacidad } from "./capacidades";
import { tienePermiso } from "./permisos-server";
import type { PermisoClave } from "./permisos";

// React comparte la lectura sólo dentro del render de una solicitud. No se
// cachean contratos entre empresas ni se demoran revocaciones en la API.
export const consultarCapacidadesCached = cache(consultarCapacidades);
export async function tieneCapacidad(clave: ClaveCapacidad) {
  return (await consultarCapacidadesCached()).funciones[clave] === true;
}

/** Configurar un catálogo exige tanto el plan como el permiso personal. */
export async function puedeConfigurar(
  claves: ClaveCapacidad | ClaveCapacidad[],
  permiso: PermisoClave,
) {
  const [capacidades, autorizado] = await Promise.all([
    consultarCapacidadesCached(),
    tienePermiso(permiso),
  ]);
  return (
    autorizado &&
    (Array.isArray(claves) ? claves : [claves]).every(
      (clave) => capacidades.funciones[clave] === true,
    )
  );
}
