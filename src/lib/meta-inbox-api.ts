import { apiRequest } from "@/lib/api";

export type InboxIdentidad = {
  empresaId: string;
  usuarioId: string;
  empresa: string;
  operador: string;
};
type ClienteInbox = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  activo: boolean;
  contactos: string[];
};
export type MetaInbox = {
  empresaId: string;
  usuarioId: string;
  origen?: "GENERAL";
  canalId?: string;
  conversacionId?: string | null;
  conversaciones?: {
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
    tipo: string;
    texto: string | null;
    enviadoEl: string;
    direccion?: string | null;
    eliminado?: boolean;
    editado?: boolean;
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
  habilitado: boolean;
  abierta: boolean;
  hasta: string | null;
  servidorEl: string;
};
export type IntentoInbox = {
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
