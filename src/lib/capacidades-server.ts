import { cache } from "react";
import { consultarCapacidades, type ClaveCapacidad } from "./capacidades";

// React comparte la lectura sólo dentro del render de una solicitud. No se
// cachean contratos entre empresas ni se demoran revocaciones en la API.
export const consultarCapacidadesCached = cache(consultarCapacidades);
export async function tieneCapacidad(clave: ClaveCapacidad) {
  return (await consultarCapacidadesCached()).funciones[clave] === true;
}
