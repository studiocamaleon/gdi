import { apiRequest } from "@/lib/api";

/**
 * La suscripción vista por el TENANT (su plan y a cuáles puede pasarse).
 * Espejo del contrato de apps/api/src/suscripciones/suscripciones.service.ts.
 * Ver docs/suscripciones-cobro-diseno.md
 */

export type PlanContratable = {
  codigo: string;
  nombre: string;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  priceId: string;
  esActual: boolean;
};

export type EstadoSuscripcion = {
  actual: {
    planCodigo: string;
    planNombre: string;
    precioMensual: number;
    moneda: string;
    estado: string;
    estadoProveedor: string | null;
    proveedor: string;
    proximoCobro: string | null;
    desde: string;
  } | null;
  planes: PlanContratable[];
  checkout: { tenantId: string; email: string };
};

export async function getSuscripcion(): Promise<EstadoSuscripcion> {
  return apiRequest("/suscripcion", { cache: "no-store" });
}
