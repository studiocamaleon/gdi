import { apiRequest } from "./api";
import type {
  ConfiguracionCad,
  FormatoPruebaCad,
  planPruebaCad,
} from "../../apps/api/src/impresion/cad.domain";
import type {
  ConfiguracionDocumento,
  PerfilDisponible,
  RutaImpresion,
} from "./perfiles-impresion";
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
export const getFirmaDetallesImpresoras = (timestamp: number) =>
  apiRequest<FirmaQz>("/impresion/detalles-impresoras", {
    method: "POST",
    body: JSON.stringify({ timestamp }),
  });
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

export const getFirmaEscucha = (
  impresora: string | string[],
  timestamp: number,
) =>
  apiRequest<FirmaQz>("/impresion/escuchar", {
    method: "POST",
    body: JSON.stringify(
      Array.isArray(impresora)
        ? { impresoras: impresora, timestamp }
        : { impresora, timestamp },
    ),
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
  trabajoId?: string;
  pagina?: number;
  planCad?: {
    escala: number;
    giro: number;
    anchoSalidaMm: number;
    largoSalidaMm: number;
  };
  perfilSnapshot?: PerfilDisponible;
  configuracion?: ConfiguracionDocumento;
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
  paginasCad?: Array<{ pagina: number; copias: number; anchoMm: number; altoMm: number }>;
  pasoId?: string | null;
  trabajoId?: string;
  fechaEntrega?: string | null;
  paginaCad?: {
    pagina: number;
    copias: number;
    anchoMm: number;
    altoMm: number;
  } | null;
  configuracion: ConfiguracionDocumento;
  ruta: RutaImpresion;
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
export type HistorialImpresion = {
  ordenId: string;
  numero: string;
  estado: string;
  total: number;
  siguiente: number | null;
  pendientesSinEnvio: number;
  puedeConfirmar: boolean;
  envios: Array<EnvioDocumento & { vigente: boolean }>;
};
export const getHistorialImpresion = (ordenId: string, desde = 0) =>
  apiRequest<HistorialImpresion>(`/impresion/ordenes/${encodeURIComponent(ordenId)}/historial-documentos?desde=${desde}`);
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
    perfilId: string;
    revisionPerfil: string;
    reimpresionDe?: string;
    pagina?: number;
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

export type BandejaImpresion = {
  id: string;
  destinoId: string;
  nombre: string;
  codigo: string;
  version: number;
  papelPreparadoId: string | null;
  gramajePreparado: number | null;
  preparadoPor: string | null;
  preparadoEl: string | null;
};
export type DestinoImpresion = {
  id: string;
  nombre: string;
  host: string;
  impresora: string;
  maquinaId: string;
  activo: boolean;
  version: number;
  bandejas: BandejaImpresion[];
  cad?: ConfiguracionCad | null;
};
export type DatosDestino = Omit<
  DestinoImpresion,
  "id" | "bandejas" | "version" | "cad"
> & { version?: number };
export type DatosPerfil = Omit<
  PerfilDisponible,
  "id" | "bandeja" | "version"
> & { bandejaId: string; version?: number };
export type ConfiguracionPerfiles = {
  destinos: DestinoImpresion[];
  perfiles: PerfilDisponible[];
  maquinas: Array<{
    id: string;
    nombre: string;
    plantilla: string;
    activo: boolean;
  }>;
  papeles: Array<{ id: string; nombre: string }>;
};
export const getPerfilesImpresion = () =>
  apiRequest<ConfiguracionPerfiles>("/impresion/perfiles");
export const guardarDestinoImpresion = (datos: DatosDestino, id?: string) =>
  apiRequest<DestinoImpresion>(`/impresion/destinos${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos),
  });
export const agregarBandejaImpresion = (
  id: string,
  datos: { nombre: string; codigo: string },
) =>
  apiRequest<BandejaImpresion>(`/impresion/destinos/${id}/bandejas`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
export const guardarPerfilImpresion = (datos: DatosPerfil, id?: string) =>
  apiRequest<PerfilDisponible>(`/impresion/perfiles${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos),
  });
export const prepararBandejaImpresion = (
  id: string,
  version: number,
  perfilId?: string,
) =>
  apiRequest<{ ok: boolean }>(`/impresion/bandejas/${id}/preparacion`, {
    method: "POST",
    body: JSON.stringify({ version, perfilId }),
  });
export const prepararPruebaPerfil = (id: string) =>
  apiRequest<TrabajoQz>(`/impresion/perfiles/${id}/prueba`, { method: "POST" });

export type DatosCad = Omit<ConfiguracionCad, "margenMm"> & {
  version: number;
  habilitado: boolean;
};
export const guardarConfiguracionCad = (id: string, datos: DatosCad) =>
  apiRequest<DestinoImpresion>(`/impresion/destinos/${id}/cad`, {
    method: "PUT",
    body: JSON.stringify({
      version: datos.version,
      habilitado: datos.habilitado,
      anchoRolloMm: datos.anchoRolloMm,
      origenPapel: datos.origenPapel,
      usarOrigenPredeterminado: datos.usarOrigenPredeterminado,
    }),
  });
export const prepararPruebaCad = (
  id: string,
  version: number,
  formato: FormatoPruebaCad,
  color: "BN" | "COLOR" = "COLOR",
) =>
  apiRequest<TrabajoQz & { plan: ReturnType<typeof planPruebaCad> }>(
    `/impresion/destinos/${id}/prueba-cad`,
    {
      method: "POST",
      body: JSON.stringify({ version, formato, color }),
    },
  );

export const claveDocumento = (d: {
  itemId: string;
  paginaCad?: { pagina: number } | null;
  pagina?: number;
  trabajoId?: string;
}) => d.trabajoId ?? `${d.itemId}:${d.paginaCad?.pagina ?? d.pagina ?? 0}`;
export const solicitarImpresionOrden = (id: string) =>
  apiRequest<VistaDocumentos>(`/impresion/ordenes/${id}/cola`, {
    method: "POST",
  });
export const getColaImpresion = (desde = 0) =>
  apiRequest<{
    vistas: VistaDocumentos[];
    total: number;
    siguiente: number | null;
  }>(`/impresion/cola?desde=${desde}`);
export const liberarImpresion = (
  id: string,
  trabajos: string[],
  perfilId: string,
  revision: string,
) =>
  apiRequest<{ ok: boolean }>(`/impresion/ordenes/${id}/liberar-impresion`, {
    method: "POST",
    body: JSON.stringify({ trabajos, perfilId, revision }),
  });

export const liberarLoteImpresion = (
  grupos: { ordenId: string; trabajos: string[] }[],
  perfilId: string,
  revision: string,
) =>
  apiRequest<{ ok: boolean }>("/impresion/cola/liberar", {
    method: "POST",
    body: JSON.stringify({ grupos, perfilId, revision }),
  });
