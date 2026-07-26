import { enlacePublicoPath, enlacePublicoUrl } from "@/lib/enlaces-publicos";
import { apiRequest } from "@/lib/api";

/**
 * Presupuestos — contrato con /presupuestos (ciclo comercial de la
 * cotización). Ver docs/presupuestos-modulo-estudio.md y
 * apps/api/src/presupuestos/.
 */

export type PresupuestoEstado =
  | "borrador"
  | "pendiente_aprobacion"
  | "enviado"
  | "aprobado"
  | "rechazado"
  | "vencido"
  | "convertido";

export const MOTIVOS_PERDIDA: Array<{ value: string; label: string }> = [
  { value: "precio", label: "Precio" },
  { value: "plazo", label: "Plazo de entrega" },
  { value: "sin_respuesta", label: "Sin respuesta del cliente" },
  { value: "competencia", label: "Se fue a la competencia" },
  { value: "otro", label: "Otro" },
];

export type PresupuestoItemPayload = {
  cotizacionItemId?: string;
  codigo: string;
  nombre: string;
  familia: string;
  categoriaComercial?: string;
  subcategoriaComercial?: string;
  cantidad: number;
  cantidadUnidad: string;
  subtotal: number;
  impuestos: number;
  total: number;
  specs?: Array<{ etiqueta: string; valor: string }>;
  adicionales?: string[];
};

export type PresupuestoResumen = {
  id: string;
  numero: string;
  estado: PresupuestoEstado;
  fechaEmision: string | null;
  fechaValidez: string | null;
  fechaEnvio: string | null;
  fechaResuelto: string | null;
  visto: boolean;
  motivoPerdida: string | null;
  total: number;
  items: number;
  cliente: string;
  clienteId: string | null;
  vendedor: string | null;
  publicToken: string | null;
  ordenConvertida: string | null;
  ordenConvertidaId: string | null;
};

export type PresupuestoEventoPanel = {
  fecha: string;
  tipo: string;
  descripcion: string;
  usuario: string;
  origen: string;
};

export type PresupuestoDetalle = {
  id: string;
  numero: string | null;
  estado: PresupuestoEstado;
  cliente: { id: string; nombre: string } | null;
  vendedor: { id: string; nombre: string } | null;
  canalVenta: string | null;
  fechaEmision: string | null;
  fechaValidez: string | null;
  fechaEnvio: string | null;
  fechaResuelto: string | null;
  primeraVistaEl: string | null;
  motivoPerdida: string | null;
  motivoPerdidaDetalle: string | null;
  /** F2: motivos que dispararon la aprobación interna y quién resolvió. */
  aprobacionMotivos: Array<{ regla: string; detalle: string }>;
  aprobacionSolicitadaEl: string | null;
  aprobacionResueltaPor: string | null;
  observaciones: string | null;
  senaSugeridaPct: number | null;
  subtotal: number;
  impuestos: number;
  total: number;
  cargosDirectos: number;
  fechaEntrega: string | null;
  publicToken: string | null;
  ordenConvertida: string | null;
  ordenConvertidaId: string | null;
  items: Array<{
    cotizacionItemId: string | null;
    codigo: string;
    nombre: string;
    familia: string;
    cantidad: number;
    cantidadUnidad: string;
    subtotal: number;
    impuestos: number;
    total: number;
    specs: Array<{ etiqueta: string; valor: string }>;
    adicionales: string[];
  }>;
  eventos: PresupuestoEventoPanel[];
};

export type PresupuestosListado = {
  presupuestos: PresupuestoResumen[];
  stats: Array<{ estado: PresupuestoEstado; cantidad: number; total: number }>;
};

export type PresupuestoPublico = {
  numero: string;
  estado: PresupuestoEstado;
  negocio: string;
  /** ISO 4217 de la moneda del tenant; ausente en payloads viejos = ARS. */
  monedaCodigo?: string;
  cliente: string | null;
  vendedor: string | null;
  fechaEmision: string | null;
  fechaValidez: string | null;
  observaciones: string | null;
  senaSugeridaPct: number | null;
  subtotal: number;
  impuestos: number;
  cargosDirectos: number;
  total: number;
  items: Array<{
    nombre: string;
    cantidad: number;
    cantidadUnidad: string;
    total: number;
    specs: Array<{ etiqueta: string; valor: string }>;
    adicionales: string[];
  }>;
};

export type ConfigPresupuestos = {
  validezDiasDefault: number;
  senaSugeridaPctDefault: number;
  condicionesTexto: string | null;
  /** Reglas de aprobación interna; null = desactivada. */
  aprobacionMontoMax: number | null;
  aprobacionMargenMinPct: number | null;
};

export function listarPresupuestos(filtros?: {
  estado?: string;
  clienteId?: string;
  busqueda?: string;
}) {
  const params = new URLSearchParams();
  if (filtros?.estado) params.set("estado", filtros.estado);
  if (filtros?.clienteId) params.set("clienteId", filtros.clienteId);
  if (filtros?.busqueda) params.set("busqueda", filtros.busqueda);
  const s = params.toString();
  return apiRequest<PresupuestosListado>(`/presupuestos${s ? `?${s}` : ""}`);
}

export function getPresupuesto(id: string) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}`);
}

export function emitirPresupuesto(payload: {
  cotizacionId: string;
  clienteId: string;
  vendedorEmpleadoId?: string;
  canalVenta?: string;
  fechaEntrega?: string;
  validezDias?: number;
  observaciones?: string;
  senaSugeridaPct?: number;
  cargosDirectos?: number;
  items: PresupuestoItemPayload[];
}) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/emitir`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function enviarPresupuesto(id: string) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}/enviar`, {
    method: "PATCH",
  });
}

export function resolverPresupuesto(
  id: string,
  payload: { resultado: "aprobado" | "rechazado"; motivoPerdida?: string; motivoPerdidaDetalle?: string },
) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}/resolver`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function convertirPresupuesto(id: string, payload?: { itemIds?: string[] }) {
  return apiRequest<{ ordenId: string; ordenNumero: string; parcial: boolean }>(
    `/presupuestos/${id}/convertir`,
    { method: "POST", body: JSON.stringify(payload ?? {}) },
  );
}

/** Resolución de una aprobación pendiente (SUPERVISOR/ADMIN). */
export function resolverAprobacionPresupuesto(
  id: string,
  payload: { decision: "aprobar" | "devolver"; comentario?: string },
) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}/aprobacion`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getConfigPresupuestos() {
  return apiRequest<ConfigPresupuestos>(`/presupuestos/config`);
}

export function actualizarConfigPresupuestos(payload: Partial<ConfigPresupuestos>) {
  return apiRequest<ConfigPresupuestos>(`/presupuestos/config`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Link público (el token es la credencial; sin sesión). */
export function getPresupuestoPublico(token: string) {
  return apiRequest<PresupuestoPublico>(`/presupuestos/track/${token}`, undefined, {
    auth: false,
  });
}

export function decidirPresupuestoPublico(
  token: string,
  payload: { decision: "aprobado" | "rechazado"; comentario?: string },
) {
  return apiRequest<{ estado: string }>(`/presupuestos/track/${token}/decision`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, { auth: false });
}

/** El PDF sale por el proxy BFF (cookie httpOnly). */
export function presupuestoPdfUrl(id: string): string {
  return `/api/backend/presupuestos/${id}/pdf`;
}

/** Ruta pública del presupuesto: /p/<token>. */
export function presupuestoPublicPath(token: string): string {
  return enlacePublicoPath("presupuesto", token);
}

/** URL absoluta para compartir con el cliente (copiar, mandar por mail). */
export function presupuestoPublicUrl(token: string): string {
  return enlacePublicoUrl("presupuesto", token);
}
