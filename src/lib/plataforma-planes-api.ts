import { apiRequest } from "./api";
import type { ComparacionPlanes } from "../../apps/api/src/plataforma/planes/comparacion-planes";
export type { ComparacionPlanes } from "../../apps/api/src/plataforma/planes/comparacion-planes";
import type { ContenidoPlan } from "../../apps/api/src/plataforma/planes/catalogo-planes";
export const compararPlanes = (
  tenantId: string,
  catalogoVersion: number,
  planes: ContenidoPlan[],
) =>
  apiRequest<ComparacionPlanes>("/plataforma/planes-borradores/comparar", {
    method: "POST",
    body: JSON.stringify({ tenantId, catalogoVersion, planes }),
  });
export type {
  BorradorPlan,
  CapacidadPlan,
  CatalogoPlanesRespuesta,
  ContenidoPlan,
} from "../../apps/api/src/plataforma/planes/catalogo-planes";
export {
  problemasPlan,
  revisionComercial,
} from "../../apps/api/src/plataforma/planes/validacion-planes";
import type {
  BorradorPlan,
  CatalogoPlanesRespuesta,
} from "../../apps/api/src/plataforma/planes/catalogo-planes";

export const consultarBorradores = () =>
  apiRequest<CatalogoPlanesRespuesta>("/plataforma/planes-borradores");
export const guardarBorradores = (
  catalogoVersion: number,
  cambios: BorradorPlan[],
) =>
  apiRequest<{ borradores: BorradorPlan[] }>("/plataforma/planes-borradores", {
    method: "PUT",
    body: JSON.stringify({
      catalogoVersion,
      cambios: cambios.map(({ id, revision, contenido }) => ({
        id,
        revision,
        contenido,
      })),
    }),
  });
