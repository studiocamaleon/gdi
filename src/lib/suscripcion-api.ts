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
  /** Ya hay suscripción en la pasarela → cambiar de plan NO pide tarjeta. */
  puedeCambiarSinPago: boolean;
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

/** Cambia el plan sin checkout (usa la tarjeta en archivo, con prorrateo). */
export async function cambiarPlanSuscripcion(
  planCodigo: string,
  ciclo: "mensual" | "anual",
): Promise<EstadoSuscripcion> {
  return apiRequest("/suscripcion/cambiar-plan", {
    method: "POST",
    body: JSON.stringify({ planCodigo, ciclo }),
  });
}

/** Cuánto se cobra ahora por el cambio, antes de confirmarlo. */
export async function previsualizarCambio(
  planCodigo: string,
  ciclo: "mensual" | "anual",
): Promise<{ aCobrar: number; aCredito: number; moneda: string } | null> {
  return apiRequest("/suscripcion/cambiar-plan/previsualizar", {
    method: "POST",
    body: JSON.stringify({ planCodigo, ciclo }),
  });
}

/** Trae el alta desde la pasarela apenas cierra el checkout. */
export async function sincronizarSuscripcion(
  transaccionId: string,
): Promise<EstadoSuscripcion> {
  return apiRequest("/suscripcion/sincronizar", {
    method: "POST",
    body: JSON.stringify({ transaccionId }),
  });
}

/** Abre el portal de Paddle: medio de pago, facturas y cancelación. */
export async function abrirPortalSuscripcion(): Promise<{ url: string }> {
  return apiRequest("/suscripcion/portal", { method: "POST" });
}
