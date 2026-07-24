import { apiRequest } from "@/lib/api";

/**
 * La suscripción vista por el TENANT (su plan y a cuáles puede pasarse).
 * Espejo del contrato de apps/api/src/suscripciones/suscripciones.service.ts.
 * Ver docs/suscripciones-cobro-diseno.md
 */

export type PlanContratable = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  priceId: string;
  esActual: boolean;
  /** Variante anual con el ahorro ya calculado por el backend. */
  anual: {
    priceId: string;
    precio: number;
    doceMeses: number;
    ahorro: number;
    ahorroPct: number;
    equivalenteMensual: number;
  } | null;
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
  facturas: FacturaSuscripcion[];
  puedePortal: boolean;
  prueba: {
    enPrueba: boolean;
    diasRestantes: number | null;
    hasta: string | null;
    vencida: boolean;
  };
};

export type FacturaSuscripcion = {
  id: string;
  numero: string | null;
  fecha: string | null;
  total: number;
  moneda: string;
  estado: string;
};

export async function getSuscripcion(): Promise<EstadoSuscripcion> {
  return apiRequest("/suscripcion", { cache: "no-store" });
}

/** Abre el portal de Paddle: medio de pago, facturas y cancelación. */
export async function abrirPortalSuscripcion(): Promise<{ url: string }> {
  return apiRequest("/suscripcion/portal", { method: "POST" });
}
