import type { CotizarResponse } from "@/lib/productos-servicios-api";
import { formatearMoneda, type Moneda } from "@/lib/moneda";

export type TipoPropuesta = "orden_trabajo" | "presupuesto";

export type UnidadPropuesta = "unidad" | "m2" | "metro_lineal";

export type CotizacionPropuestaSnapshot = NonNullable<CotizarResponse["cotizacion"]>;

export type PasoProduccionPropuesta = {
  nombre: string;
  centroCosto: string;
  minutos: number;
  origen: "base" | "opcional" | "manual";
};

export type PropuestaItem = {
  id: string;
  cotizacionItemId?: string;
  productoNombre: string;
  productoCodigo: string;
  motorCodigo: string;
  categoriaComercialCodigo: string;
  categoriaComercialNombre: string;
  subcategoriaComercialCodigo: string;
  subcategoriaComercialNombre: string;
  varianteNombre?: string;
  unidadMedida: UnidadPropuesta;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  fechaEntrega?: string;
  especificaciones: Record<string, string>;
  cotizacion: CotizacionPropuestaSnapshot;
  pasos: PasoProduccionPropuesta[];
  adicionales: string[];
  notaProduccion?: string;
  rutaAlternativaId?: string | null;
  jobContext?: Record<string, unknown>;
  atributosSchema: Array<{
    key: string;
    label: string;
    tipo: string;
    visible: boolean;
    orden: number;
  }>;
  /**
   * Archivos originales a subir a R2 cuando el ítem se persista como ORDEN_ITEM
   * (los PDF del centro de copiado). Sólo en memoria — no se serializa ni se
   * manda al backend; se sube por el flujo de Archivos al guardar la orden.
   */
  archivosPendientes?: File[];
};

export type PropuestaCargoDirecto = {
  id: string;
  cargoDirectoCatalogoId: string;
  codigoSnapshot: string;
  nombreSnapshot: string;
  descripcionSnapshot?: string | null;
  modoCalculoSnapshot:
    | "MONTO_FIJO_PLANO"
    | "PORCENTAJE_SOBRE_BASE"
    | "POR_UNIDAD_INPUT";
  configSnapshot: Record<string, unknown>;
  baseCalculo: number;
  cantidadInput?: number;
  montoNeto: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  detalle: string;
  nota?: string;
  createdAt: string;
};

export type PropuestaResumen = {
  subtotal: number;
  impuestos: number;
  total: number;
  cantidadItems: number;
};

export const CANALES_VENTA = [
  { value: "mostrador", label: "Mostrador" },
  { value: "web", label: "Web" },
  { value: "vendedor_externo", label: "Vendedor externo" },
  { value: "telefono", label: "Telefono" },
];

export function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatCurrency(value: number, moneda: Moneda) {
  return formatearMoneda(value, moneda, { decimales: 0 });
}

/**
 * Precio POR UNIDAD: muestra centavos cuando es chico (ej. tercerizado por
 * tanda: $0,10/u), pero entero para valores grandes. Los totales siguen usando
 * `formatCurrency` (enteros).
 */
export function formatUnitPrice(value: number, moneda: Moneda) {
  const digits = value !== 0 && Math.abs(value) < 100 ? 2 : 0;
  return formatearMoneda(value, moneda, { decimales: digits });
}

export function formatUnidad(unidad: UnidadPropuesta) {
  if (unidad === "m2") return "m²";
  if (unidad === "metro_lineal") return "ml";
  return "u.";
}

export function calcularResumen(items: PropuestaItem[]): PropuestaResumen {
  return items.reduce<PropuestaResumen>(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      impuestos: acc.impuestos + item.impuestoMonto,
      total: acc.total + item.total,
      cantidadItems: acc.cantidadItems + 1,
    }),
    { subtotal: 0, impuestos: 0, total: 0, cantidadItems: 0 },
  );
}

export function calcularCostoTotal(item: PropuestaItem) {
  return item.cotizacion.costos.total;
}
