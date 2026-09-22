import { apiRequest } from "./api";
import type {
  VistaAsignacionPlan,
  ResultadoAsignacion,
} from "../../apps/api/src/plataforma/planes/asignacion-planes";
export type {
  VistaAsignacionPlan,
  ResultadoAsignacion,
} from "../../apps/api/src/plataforma/planes/asignacion-planes";
export const diagnosticoAsignacionPlan = (
  tenantId: string,
  versionId: string | null,
) =>
  apiRequest<VistaAsignacionPlan>("/plataforma/planes-asignacion/diagnostico", {
    method: "POST",
    body: JSON.stringify({ tenantId, versionId }),
  });
export const asignarVersionPlan = (solicitud: {
  tenantId: string;
  versionId: string | null;
  operacionId: string;
  revision: number;
  huella: string;
  motivo: string;
  revisionesAceptadas: string[];
}) =>
  apiRequest<ResultadoAsignacion>("/plataforma/planes-asignacion", {
    method: "POST",
    body: JSON.stringify(solicitud),
  });
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
  problemasPublicacionPlan,
  revisionComercial,
} from "../../apps/api/src/plataforma/planes/validacion-planes";
import type {
  HistorialPlanes,
  VersionPlan,
} from "../../apps/api/src/plataforma/planes/versiones-planes";
export type {
  HistorialPlanes,
  VersionPlan,
  ResumenVersionPlan,
} from "../../apps/api/src/plataforma/planes/versiones-planes";
export const consultarVersionesPlan = (id: string, antes?: number) =>
  apiRequest<HistorialPlanes>(
    `/plataforma/planes-versiones/borrador/${id}${antes ? `?antes=${antes}` : ""}`,
  );
export const consultarVersionPlan = (id: string) =>
  apiRequest<VersionPlan>(`/plataforma/planes-versiones/${id}`);
export const publicarVersionPlan = (plan: BorradorPlan, motivo: string) =>
  apiRequest<VersionPlan>(`/plataforma/planes-versiones/borrador/${plan.id}`, {
    method: "POST",
    body: JSON.stringify({
      revision: plan.revision,
      catalogoVersion: plan.catalogoVersion,
      motivo,
    }),
  });
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

import type {
  EstadoOferta as EstadoOfertaPlan,
  ActivarOferta as ActivarOfertaDto,
  RetirarOferta as RetirarOfertaDto,
} from "../../apps/api/src/plataforma/planes/ofertas-planes";
export type {
  EstadoOferta as EstadoOfertaPlan,
  ActivarOferta as ActivarOfertaDto,
  RetirarOferta as RetirarOfertaDto,
} from "../../apps/api/src/plataforma/planes/ofertas-planes";
export const consultarOfertaPlan = (borradorId: string) =>
  apiRequest<EstadoOfertaPlan>(
    `/plataforma/planes-ofertas/borrador/${borradorId}`,
    { cache: "no-store" },
  );
export const activarOfertaPlan = (dto: ActivarOfertaDto) =>
  apiRequest<EstadoOfertaPlan>("/plataforma/planes-ofertas/activar", {
    method: "POST",
    body: JSON.stringify(dto),
  });
export const retirarOfertaPlan = (dto: RetirarOfertaDto) =>
  apiRequest<{ ok: boolean }>("/plataforma/planes-ofertas/retirar", {
    method: "POST",
    body: JSON.stringify(dto),
  });

export const sincronizarOfertaPlan = (dto: {
  versionId: string;
  entorno: string;
  revision: number;
  recomendado: boolean;
  motivo: string;
}) =>
  apiRequest<EstadoOfertaPlan>("/plataforma/planes-ofertas/sincronizar", {
    method: "POST",
    body: JSON.stringify(dto),
  });
