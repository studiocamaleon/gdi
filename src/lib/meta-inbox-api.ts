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
