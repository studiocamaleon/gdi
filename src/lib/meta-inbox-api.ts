import { apiRequest } from "@/lib/api";

export const INBOX_CONEXION_ACTUALIZADA = "grafo:inbox-conexion-actualizada";
export type DisponibilidadInbox = {
  empresaId: string;
  usuarioId: string;
  disponible: boolean;
};
export const getDisponibilidadInbox = (signal?: AbortSignal) =>
  apiRequest<DisponibilidadInbox>("/integraciones/meta/inbox/disponibilidad", {
    signal,
  });

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
  contacto: { telefono: string };
  mensajes: {
    id: string;
    nombreContacto: string | null;
    tipo: string;
    texto: string | null;
    enviadoEl: string;
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
export type InboxConsulta = { antesDe?: string; clienteId?: string };
export type CargarInbox = (
  query: InboxConsulta,
  signal?: AbortSignal,
) => Promise<MetaInbox | null>;
export const getMetaInbox: CargarInbox = (query, signal) => {
  const params = new URLSearchParams();
  if (query.antesDe) params.set("antesDe", query.antesDe);
  if (query.clienteId) params.set("clienteId", query.clienteId);
  return apiRequest(`/integraciones/meta/inbox?${params}`, { signal });
};
