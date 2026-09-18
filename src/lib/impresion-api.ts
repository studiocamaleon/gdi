import { apiRequest } from "./api";
import type {
  OrientacionDocumento,
  OrientacionPagina,
} from "./orientacion-pdf";
export type ConfiguracionImpresion = {
  tenantId: string;
  certificado: string | null;
  firmaDisponible: boolean;
  mensaje?: string;
  validoHasta?: string;
};
export type FirmaQz = { timestamp: number; hash: string; firma: string };
export type TrabajoQz = FirmaQz & {
  params: {
    printer: { name: string };
    options: { copies: number; jobName: string; [key: string]: unknown };
    data: Array<{ type: string; format: string; flavor: string; data: string }>;
  };
  totalPaginas: number;
};
export type VistaEtiqueta = {
  numero: string;
  anchoMm: number;
  altoMm: number;
  paginas: string[];
};
export const getConfiguracionImpresion = () =>
  apiRequest<ConfiguracionImpresion>("/impresion/configuracion");
export const getFirmaImpresoras = () =>
  apiRequest<FirmaQz>("/impresion/impresoras", { method: "POST" });
export const getVistaEtiqueta = (id: string) =>
  apiRequest<VistaEtiqueta>(
    `/impresion/ordenes/${encodeURIComponent(id)}/etiqueta`,
  );
export const prepararEtiqueta = (
  id: string,
  impresora: string,
  copias: number,
  pagina: number,
) =>
  apiRequest<TrabajoQz>(
    `/impresion/ordenes/${encodeURIComponent(id)}/etiqueta`,
    { method: "POST", body: JSON.stringify({ impresora, copias, pagina }) },
  );

export const getFirmaEscucha = (impresora: string, timestamp: number) =>
  apiRequest<FirmaQz>("/impresion/escuchar", {
    method: "POST",
    body: JSON.stringify({ impresora, timestamp }),
  });
export const prepararPruebaDocumento = (
  impresora: string,
  copias: number,
  dobleFaz: boolean,
) =>
  apiRequest<TrabajoQz>("/impresion/prueba-documento", {
    method: "POST",
    body: JSON.stringify({ impresora, copias, dobleFaz }),
  });

export type EstadoDocumento =
  | "PREPARADO"
  | "ENVIADO"
  | "SPOOLING"
  | "SCHEDULED"
  | "PRINTING"
  | "SENT"
  | "COMPLETE"
  | "PRINTED"
  | "DELETED"
  | "CANCELED"
  | "ABORTED"
  | "ERROR"
  | "PAUSED"
  | "SIN_CONFIRMAR";
export type EnvioDocumento = {
  id: string;
  itemId: string;
  nombre: string;
  copias: number;
  paginas: number;
  hojas: number;
  faz: 1 | 2;
  orientacion?: OrientacionDocumento | null;
  orientacionesPaginas?: OrientacionPagina[];
  host: string;
  impresora: string;
  jobName: string;
  estado: EstadoDocumento;
  fecha: string;
  actualizadoEl: string;
  usuario: string;
  confirmacion?: { fecha: string; usuario: string; usuarioId: string };
  eventos: Array<{ estado: EstadoDocumento; fecha: string; detalle: string }>;
};
export type DocumentoOrden = {
  itemId: string;
  nombre: string;
  copias: number;
  paginas: number;
  hojas: number;
  faz: 1 | 2;
  orientacion?: OrientacionDocumento | null;
  motivo: string | null;
  archivos: string[];
  documentos: number;
  seleccionPaginas?: Array<{
    nombre: string;
    rango: string;
    paginasOriginales: number;
  }>;
};
export type VistaDocumentos = {
  ordenId: string;
  numero: string;
  estado: string;
  documentos: DocumentoOrden[];
  historial: EnvioDocumento[];
};
export const getDocumentosOrden = (id: string) =>
  apiRequest<VistaDocumentos>(`/impresion/ordenes/${id}/documentos`);
export const confirmarDocumentosImpresos = (
  ordenId: string,
  envioIds: string[],
) =>
  apiRequest<{ ok: boolean }>(
    `/impresion/ordenes/${ordenId}/confirmacion-documentos`,
    { method: "POST", body: JSON.stringify({ envioIds }) },
  );
export const prepararDocumentoOrden = (
  ordenId: string,
  itemId: string,
  datos: {
    intentoId: string;
    impresora: string;
    host: string;
    reimpresionDe?: string;
  },
) =>
  apiRequest<TrabajoQz & { intento: EnvioDocumento }>(
    `/impresion/ordenes/${ordenId}/documentos/${itemId}`,
    { method: "POST", body: JSON.stringify(datos) },
  );
export const registrarEstadoDocumento = (
  ordenId: string,
  intentoId: string,
  estado: EstadoDocumento,
  detalle: string,
) =>
  apiRequest<EnvioDocumento>(
    `/impresion/ordenes/${ordenId}/envios/${intentoId}`,
    {
      method: "POST",
      body: JSON.stringify({ estado, detalle: detalle.slice(0, 500) }),
    },
  );
