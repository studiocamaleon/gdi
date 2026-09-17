import { apiRequest } from "@/lib/api";

export type PropositoArchivoMaestro =
  | "PRINT"
  | "CUT"
  | "RENDER"
  | "PLANO"
  | "INSTRUCTIVO"
  | "OTRO";
export type EtapaDesarrolloDocumento =
  | "BRIEF"
  | "DISENO"
  | "PROTOTIPO"
  | "MUESTRA"
  | "PRODUCCION";
export type TipoAprobacionDocumento =
  | "CLIENTE"
  | "DISENO"
  | "COLOR_MUESTRA"
  | "INGENIERIA"
  | "LIBERACION_PRODUCTIVA";
export type EstadoRevisionArchivo =
  | "BORRADOR"
  | "EN_REVISION"
  | "OBSERVADA"
  | "APROBADA"
  | "OBSOLETA";
export type EstadoSolicitudAprobacion =
  | "PENDIENTE"
  | "APROBADA"
  | "OBSERVADA"
  | "RECHAZADA"
  | "CANCELADA";
export type DecisionAprobacionDocumento =
  | "APROBAR"
  | "OBSERVAR"
  | "RECHAZAR"
  | "CANCELAR";

export type DesarrolloDocumental = {
  maestros: ArchivoMaestro[];
};

export type ArchivoMaestro = {
  id: string;
  proyectoCampanaId: string;
  nombre: string;
  proposito: PropositoArchivoMaestro;
  etapa: EtapaDesarrolloDocumento;
  descripcion: string | null;
  requerido: boolean;
  creadoPorNombre: string;
  createdAt: string;
  revisionAprobada: { id: string; numero: number } | null;
  revisionLiberada: {
    id: string;
    numero: number;
    liberadaEl: string | null;
    liberadaPorNombre: string | null;
    archivo: { id: string; nombre: string };
  } | null;
  revisiones: Array<{
    id: string;
    numero: number;
    estado: EstadoRevisionArchivo;
    comentario: string | null;
    hash: string | null;
    autorNombre: string;
    createdAt: string;
    liberadaEl: string | null;
    liberadaPorNombre: string | null;
    archivo: {
      id: string;
      nombre: string;
      mimeType: string;
      bytes: number;
      hash: string | null;
    };
    solicitudes: Array<{
      id: string;
      tipo: TipoAprobacionDocumento;
      estado: EstadoSolicitudAprobacion;
      comentario: string | null;
      solicitadaPorNombre: string;
      asignadaAUsuario: { id: string; nombre: string } | null;
      asignadaARol: string | null;
      permiteDecisionExterna: boolean;
      expiraEl: string | null;
      resueltaEl: string | null;
      createdAt: string;
      decisiones: Array<{
        id: string;
        decision: DecisionAprobacionDocumento;
        comentario: string | null;
        actorNombre: string;
        actorRol: string | null;
        origen: string;
        createdAt: string;
      }>;
    }>;
  }>;
  gates: Array<{
    id: string;
    nombre: string;
    tipoAprobacion: TipoAprobacionDocumento;
    activo: boolean;
    orden: { id: string; numero: string; estado: string };
    paso: { id: string; nombre: string; estado: string } | null;
  }>;
};

export function getDesarrolloCampana(campanaId: string) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/campanas/${campanaId}`,
  );
}

export type EstadoDocumentalOrden = {
  orden: { id: string; numero: string };
  gates: Array<{
    id: string;
    nombre: string;
    tipoAprobacion: TipoAprobacionDocumento;
    paso: { id: string; nombre: string; estado: string } | null;
    cumplido: boolean;
    documento: {
      id: string;
      nombre: string;
      proposito: PropositoArchivoMaestro;
    };
    revisionLiberada: {
      id: string;
      numero: number;
      liberadaEl: string | null;
      liberadaPorNombre: string | null;
      archivo: { id: string; nombre: string };
    } | null;
  }>;
};

export function getEstadoDocumentalOrden(ordenId: string) {
  return apiRequest<EstadoDocumentalOrden>(
    `/desarrollo-documental/ordenes/${ordenId}`,
  );
}

export function crearArchivoMaestro(payload: {
  proyectoCampanaId: string;
  nombre: string;
  proposito: PropositoArchivoMaestro;
  etapa: EtapaDesarrolloDocumento;
  descripcion?: string;
  requerido?: boolean;
}) {
  return apiRequest<DesarrolloDocumental>("/desarrollo-documental/maestros", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function crearRevisionArchivo(
  maestroId: string,
  payload: { archivoId: string; comentario?: string },
) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/maestros/${maestroId}/revisiones`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function solicitarAprobacionDocumento(
  revisionId: string,
  payload: {
    tipo: TipoAprobacionDocumento;
    comentario?: string;
    asignadaARol?: string;
    permiteDecisionExterna?: boolean;
    expiraEl?: string;
  },
) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/revisiones/${revisionId}/solicitudes`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function decidirAprobacionDocumento(
  solicitudId: string,
  payload: { decision: DecisionAprobacionDocumento; comentario?: string },
) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/solicitudes/${solicitudId}/decision`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function emitirLinkAprobacion(solicitudId: string, diasVigencia = 14) {
  return apiRequest<{ token: string; url: string; expiraEl: string }>(
    `/desarrollo-documental/solicitudes/${solicitudId}/link`,
    { method: "POST", body: JSON.stringify({ diasVigencia }) },
  );
}

export function revocarLinkAprobacion(solicitudId: string) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/solicitudes/${solicitudId}/link`,
    { method: "DELETE" },
  );
}

export function liberarRevision(revisionId: string) {
  return apiRequest<DesarrolloDocumental>(
    `/desarrollo-documental/revisiones/${revisionId}/liberar`,
    { method: "POST" },
  );
}

export function crearGateDocumento(payload: {
  proyectoCampanaId: string;
  ordenId: string;
  archivoMaestroId: string;
  tipoAprobacion: TipoAprobacionDocumento;
  nombre: string;
}) {
  return apiRequest<DesarrolloDocumental>("/desarrollo-documental/gates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type AprobacionDocumentalPublica = {
  negocio: string;
  campana: { codigo: string; nombre: string };
  documento: {
    nombre: string;
    proposito: PropositoArchivoMaestro;
    etapa: EtapaDesarrolloDocumento;
  };
  revision: {
    numero: number;
    nombreArchivo: string;
    mimeType: string;
    bytes: number;
    hash: string | null;
  };
  solicitud: {
    tipo: TipoAprobacionDocumento;
    estado: EstadoSolicitudAprobacion;
    comentario: string | null;
    expiraEl: string | null;
  };
  decision: {
    decision: DecisionAprobacionDocumento;
    actorNombre: string;
    comentario: string | null;
    fecha: string;
  } | null;
};

export function getAprobacionDocumentalPublica(token: string) {
  return apiRequest<AprobacionDocumentalPublica>(
    `/desarrollo-documental/publico/${token}`,
    undefined,
    { auth: false },
  );
}

export function decidirAprobacionDocumentalPublica(
  token: string,
  payload: {
    decision: "APROBAR" | "OBSERVAR" | "RECHAZAR";
    actorNombre: string;
    comentario?: string;
  },
) {
  return apiRequest<{ estado: EstadoSolicitudAprobacion }>(
    `/desarrollo-documental/publico/${token}/decision`,
    { method: "POST", body: JSON.stringify(payload) },
    { auth: false },
  );
}
