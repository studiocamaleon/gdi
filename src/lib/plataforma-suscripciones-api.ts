import type { CupoUsuarios } from "./usuarios-api";
import { apiRequest } from "./api";
import type { AccesoEmpresa } from "./plataforma-api";

export type CupoSuscripcion = CupoUsuarios & { editable: boolean };
export const ajustarCupoUsuarios = (id: string, datos: { adicionales: number; anteriores: number; motivo: string }) =>
  apiRequest<CupoUsuarios>(`/plataforma/suscripciones/${id}/cupo-usuarios`, { method: "PUT", body: JSON.stringify(datos) });

export type IntegracionPaddle = {
  apiConfigurada: boolean;
  firmaConfigurada: boolean;
  entorno: string;
  consultaAntiguaMinutos: number;
};
export type SuscripcionPlataforma = {
  id: string;
  empresa: { id: string; nombre: string; slug: string };
  plan: { id: string; nombre: string; codigo: string };
  proveedor: string;
  referencia: string | null;
  estado: string;
  estadoProveedor: string | null;
  acceso: AccesoEmpresa;
  senales: Array<{ codigo: string; titulo: string; detalle: string }>;
  trialHasta: string | null;
  graciaHasta: string | null;
  moraDesde: string | null;
  proximoCobro: string | null;
  periodoDesde: string | null;
  cambioProgramado: string | null;
  cambioProgramadoEl: string | null;
  ultimaConsulta: string | null;
  ultimoEvento: string | null;
  actualizadoProveedorEl: string | null;
  puedeConsultar: boolean;
};
export type PaginaSuscripciones = {
  total: number;
  pagina: number;
  limite: number;
  suscripciones: SuscripcionPlataforma[];
  integracion: IntegracionPaddle;
  consultadoEl: string;
};
export type DetalleSuscripcion = SuscripcionPlataforma & {
  integracion: IntegracionPaddle;
};
export type EventoSuscripcion = {
  id: string;
  eventoId: string;
  tipo: string;
  resultado: string;
  detalle: string;
  ocurridoEl: string | null;
  recibidoEl: string;
  procesadoEl: string | null;
};
export type OperacionPaddle = {
  id: string;
  motivo: string;
  estado: string;
  detalle: string | null;
  creadaEl: string;
  finalizadaEl: string | null;
  actor?: string;
  antesJson: Record<string, unknown> | null;
  despuesJson: Record<string, unknown> | null;
};
export type PaginaEventosSuscripcion = {
  total: number;
  pagina: number;
  limite: number;
  eventos: EventoSuscripcion[];
};
export type HistorialConsultasPaddle = {
  total: number;
  pagina: number;
  limite: number;
  operaciones: OperacionPaddle[];
};
export const consultarPaddlePlataforma = (
  id: string,
  solicitudId: string,
  motivo: string,
) =>
  apiRequest<OperacionPaddle>(`/plataforma/suscripciones/${id}/sincronizar`, {
    method: "POST",
    body: JSON.stringify({ solicitudId, motivo }),
  });
