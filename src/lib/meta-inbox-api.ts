import type {
  UbicacionInbox,
  ContactoCompartidoInbox,
  CitaInbox,
} from "../../apps/api/src/common/inbox/contenidos";
import { apiRequest } from "@/lib/api";

export type InboxIdentidad = {
  empresaId: string;
  usuarioId: string;
  empresa: string;
  operador: string;
  puedeConfigurarConexion?: boolean;
};
type ClienteInbox = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  activo: boolean;
  contactos: string[];
};
export type OperadorInbox = {
  id: string;
  nombre: string;
  presencia?: "CONECTADO" | "DESCONECTADO" | "DESCONOCIDA";
};
export type EstadoConversacionInbox = "ACTIVA" | "RESUELTA";
export type FiltrosInbox = {
  responsable: FiltroInbox;
  estados: EstadoConversacionInbox[];
  sinLeer: boolean;
  sinResponder: boolean;
  participe: boolean;
};
export const filtrosInboxIniciales: FiltrosInbox = {
  responsable: "TODAS",
  estados: [],
  sinLeer: false,
  sinResponder: false,
  participe: false,
};
export function consultaFiltrosInbox(f: FiltrosInbox): InboxConsulta {
  return {
    filtro: f.responsable,
    estados: f.estados.length === 1 ? f.estados.join(",") : undefined,
    sinLeer: f.sinLeer ? "true" : undefined,
    sinResponder: f.sinResponder ? "true" : undefined,
    participe: f.participe ? "true" : undefined,
  };
}
export type FiltroInbox = "TODAS" | "MIAS" | "SIN_ASIGNAR" | "PARTICIPE";
export type EventoEquipoInbox = {
  id: string;
  tipo: string;
  actor: { id: string | null; nombre: string };
  texto: string | null;
  anterior: { id: string; nombre: string | null } | null;
  responsable: { id: string; nombre: string | null } | null;
  creadoEl: string;
};
export type EquipoInbox = {
  presenciaSimulada?: boolean;
  estado?: EstadoConversacionInbox;
  estadoVersion?: number;
  entrantesRevision?: number;
  responsable: (OperadorInbox & { disponible: boolean }) | null;
  version: number;
  operadores: OperadorInbox[];
  eventos: EventoEquipoInbox[];
  anterior: string | null;
};
export type MetaInbox = {
  colaboracionHabilitada?: boolean;
  lectura?: { revision: number; pendiente: boolean } | null;
  equipo?: EquipoInbox | null;
  empresaId: string;
  usuarioId: string;
  origen?: "GENERAL";
  prueba?: { numero: string; venceEl: string } | null;
  canalId?: string;
  conversacionId?: string | null;
  conversaciones?: {
    estado?: EstadoConversacionInbox;
    sinLeer?: boolean;
    id: string;
    telefono: string;
    nombre: string | null;
    ultimoMensaje: MetaInbox["mensajes"][number] | null;
  }[];
  listaAnterior?: string | null;
  ventanaAcotada?: boolean;
  respuesta?: RespuestaInbox;
  envios?: IntentoInbox[];
  contacto: { telefono: string; nombre?: string | null };
  mensajes: {
    id: string;
    nombreContacto: string | null;
    autor?: OperadorInbox | null;
    tipo: string;
    plantilla?: boolean;
    texto: string | null;
    enviadoEl: string;
    direccion?: string | null;
    eliminado?: boolean;
    editado?: boolean;
    voz?: boolean;
    ubicacion?: UbicacionInbox | null;
    contactos?: ContactoCompartidoInbox[];
    cita?: CitaInbox | null;
    reaccion?: (CitaInbox & { emoji: string }) | null;
    noDisponible?: string | null;
    estadoEntrega?: string | null;
    delHistorial?: boolean;
    delCelular?: boolean;
    adjunto?: {
      estado: string;
      nombre: string | null;
      mimeType: string | null;
      bytes: number | null;
      version: string;
      motivo?: string | null;
    } | null;
  }[];
  anterior: string | null;
  contexto: {
    estado: "encontrado" | "seleccionar_cliente" | "sin_coincidencias";
    telefono: string;
    cliente: ClienteInbox | null;
    coincidencias: ClienteInbox[];
    permisos: { clientes: boolean; ordenes: boolean };
    ordenes: {
      id: string;
      numero: string;
      estado: string;
      fechaEntrega: string | null;
      items: {
        nombre: string;
        cantidad: number;
        cantidadUnidad: string | null;
      }[];
    }[];
  } | null;
};
export type InboxConsulta = {
  estados?: string;
  sinLeer?: "true";
  sinResponder?: "true";
  participe?: "true";
  filtro?: FiltroInbox;
  eventosAntesDe?: string;
  eventosDesdeId?: string;
  antesDe?: string;
  clienteId?: string;
  conversacionId?: string;
  desdeId?: string;
  listaAntesDe?: string;
  busqueda?: string;
};
export type CargarInbox = (
  query: InboxConsulta,
  signal?: AbortSignal,
) => Promise<MetaInbox | null>;
export const getMetaInbox: CargarInbox = (query, signal) => {
  const params = new URLSearchParams();
  if (query.antesDe) params.set("antesDe", query.antesDe);
  if (query.clienteId) params.set("clienteId", query.clienteId);
  for (const key of [
    "filtro",
    "estados",
    "sinLeer",
    "sinResponder",
    "participe",
    "eventosAntesDe",
    "eventosDesdeId",
    "conversacionId",
    "desdeId",
    "listaAntesDe",
    "busqueda",
  ] as const)
    if (query[key]) params.set(key, query[key]);
  return apiRequest(`/integraciones/meta/inbox?${params}`, { signal });
};

export type ArchivoInbox = {
  url: string;
  /** Enlace privado inline, sólo para PDF. Opcional durante despliegues mixtos. */
  vistaPreviaUrl?: string;
  nombre: string;
  mimeType: string;
  bytes: number;
  expiraEn: number;
};
export type AbrirAdjuntoInbox = (
  id: string,
  signal?: AbortSignal,
) => Promise<ArchivoInbox>;
export const abrirAdjuntoInbox: AbrirAdjuntoInbox = (id, signal) =>
  apiRequest(
    `/integraciones/meta/inbox/mensajes/${encodeURIComponent(id)}/adjunto`,
    { signal },
  );

export type RespuestaInbox = {
  plantillasHabilitadas?: boolean;
  habilitado: boolean;
  abierta: boolean;
  hasta: string | null;
  servidorEl: string;
};
export type IntentoInbox = {
  autor?: OperadorInbox | null;
  id: string;
  clave: string;
  texto: string | null;
  estado: string;
  codigo: string | null;
  creadoEl: string;
  mensajeId: string | null;
};
export type EnviarTextoInbox = (
  conversacionId: string,
  dto: { clave: string; canalId: string; texto: string },
  signal?: AbortSignal,
) => Promise<IntentoInbox>;
export const enviarTextoInbox: EnviarTextoInbox = (id, dto, signal) =>
  apiRequest(
    `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/texto`,
    {
      method: "POST",
      body: JSON.stringify(dto),
      signal,
    },
  );

export type {
  PlantillaInbox,
  ArchivoPlantillaInbox,
} from "../../apps/api/src/common/inbox/plantillas";
import type {
  PlantillaInbox,
  ArchivoPlantillaInbox,
} from "../../apps/api/src/common/inbox/plantillas";
export type PedidoPlantillaInbox = {
  clave: string;
  canalId: string;
  plantillaId: string;
  version: string;
  pagina: string | null;
  valores: string[];
  consentimientoConfirmado: boolean;
  archivoId?: string;
  archivoVersion?: string;
};
export type PlantillasInboxApi = {
  archivos?: (
    conversacionId: string,
    canalId: string,
    signal?: AbortSignal,
  ) => Promise<{
    archivos: ArchivoPlantillaInbox[];
    cliente: { id: string; nombre: string } | null;
    motivo: string | null;
  }>;
  urlArchivo?: (
    archivo: ArchivoPlantillaInbox,
    conversacionId: string,
    canalId: string,
  ) => string;
  listar: (
    canalId: string,
    despues?: string | null,
    signal?: AbortSignal,
  ) => Promise<{
    canalId: string;
    plantillas: PlantillaInbox[];
    siguiente: string | null;
  }>;
  enviar: (
    conversacionId: string,
    dto: PedidoPlantillaInbox,
    signal?: AbortSignal,
  ) => Promise<IntentoInbox>;
};
export const plantillasInboxApi: PlantillasInboxApi = {
  archivos: (id, canalId, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/archivos-plantilla?${new URLSearchParams({ canalId })}`,
      { signal },
    ),
  urlArchivo: (archivo, id, canalId) =>
    `/api/backend/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/archivos-plantilla/${encodeURIComponent(archivo.id)}?${new URLSearchParams({ canalId, version: archivo.version })}`,
  listar: (canalId, despues, signal) => {
    const params = new URLSearchParams({ canalId });
    if (despues) params.set("despues", despues);
    return apiRequest(`/integraciones/meta/inbox/plantillas?${params}`, {
      signal,
    });
  },
  enviar: (id, dto, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/plantilla`,
      { method: "POST", body: JSON.stringify(dto), signal },
    ),
};

export type EquipoInboxApi = {
  estado?: (
    id: string,
    dto: {
      canalId: string;
      clave: string;
      estado: EstadoConversacionInbox;
      version: number;
      revision: number;
    },
    signal?: AbortSignal,
  ) => Promise<{ guardado: boolean }>;
  lectura?: (
    id: string,
    dto: { canalId: string; revision: number },
    signal?: AbortSignal,
  ) => Promise<{ guardado: boolean }>;
  asignar: (
    id: string,
    dto: {
      canalId: string;
      clave: string;
      responsableId: string | null;
      version: number;
    },
    signal?: AbortSignal,
  ) => Promise<{ guardado: boolean }>;
  nota: (
    id: string,
    dto: { canalId: string; clave: string; texto: string },
    signal?: AbortSignal,
  ) => Promise<{ guardado: boolean }>;
};
export const equipoInboxApi: EquipoInboxApi = {
  estado: (id, dto, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/estado`,
      { method: "POST", body: JSON.stringify(dto), signal },
    ),
  lectura: (id, dto, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/lectura`,
      { method: "POST", body: JSON.stringify(dto), signal },
    ),
  asignar: (id, dto, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/responsable`,
      { method: "POST", body: JSON.stringify(dto), signal },
    ),
  nota: (id, dto, signal) =>
    apiRequest(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/notas`,
      { method: "POST", body: JSON.stringify(dto), signal },
    ),
};
