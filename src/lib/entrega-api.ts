/**
 * Entrega en el mostrador: el cliente llega con el QR de su orden, el
 * operador lo escanea y se despacha lo que está listo.
 * Ver docs/entrega-por-escaneo-diseno.md
 */
import { apiRequest } from "@/lib/api";
import type { CrearCobroPayload } from "@/lib/administracion-api";

export type ItemEntrega = {
  id: string;
  nombre: string;
  cantidad: number;
  cantidadUnidad: string;
  total: number;
  /** Specs resumidas en una línea, para reconocer el trabajo de un vistazo. */
  detalle: string;
  /** Terminó todos sus pasos (o no tiene ruta): se puede entregar. */
  listo: boolean;
  pasosHechos: number;
  pasosTotal: number;
  /** El paso en el que está, si sigue en producción. */
  pasoActual: string | null;
  entregadoEl: string | null;
  entregadoPorNombre: string | null;
  retiradoPorNombre: string | null;
};

export type OrdenEscaneada = {
  id: string;
  numero: string;
  estado: string;
  creadaEl: string;
  cliente: { id: string; nombre: string; telefono: string | null } | null;
  total: number;
  cobrado: number;
  /** Lo que falta cobrar; nunca negativo. */
  saldo: number;
  items: ItemEntrega[];
};

/** Resuelve el código del QR (el número de la orden) a la orden del tenant. */
export function escanearOrden(codigo: string) {
  return apiRequest<OrdenEscaneada>("/ordenes-trabajo/escaneo", {
    method: "POST",
    body: JSON.stringify({ codigo }),
  });
}

export type EntregarPayload = {
  itemIds: string[];
  retiraTercero?: { nombre: string; dni: string };
  /** Cobro a registrar en el mismo acto (sin ordenId: lo pone el backend). */
  cobro?: Omit<CrearCobroPayload, "ordenId" | "clienteId">;
};

export type EntregaResultado = {
  entregados: number;
  ordenCerrada: boolean;
  cobro: { id: string; numeroRecibo: string } | null;
};

export function entregarItems(ordenId: string, payload: EntregarPayload) {
  return apiRequest<EntregaResultado>(
    `/ordenes-trabajo/${ordenId}/entregar`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function revertirEntrega(
  ordenId: string,
  payload: { itemIds: string[]; motivo: string },
) {
  return apiRequest<{ revertidos: number }>(
    `/ordenes-trabajo/${ordenId}/entregar/revertir`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}
