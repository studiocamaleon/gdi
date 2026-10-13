import type { ReferenciaTanda } from "../../apps/api/src/common/tandas-copiado";
import type { ResumenPrecioCopiado } from "../../apps/api/src/centro-copiado/pedidos/resumen-precios-pedido";
import { apiRequest } from "./api";
import type { PropuestaItem } from "./propuestas";
import type { ResultadoPedidoCopiado } from "../../apps/api/src/centro-copiado/pedidos/calculo-pedido";
type FinanzasCopiado = {
  costoTotal: number | null;
  ejecucion?: Pick<PropuestaItem["cotizacion"], "costos" | "pasos">;
  cargas:
    | {
        tipo: "IMPUESTO_INTERNO" | "COMISION";
        base: "NETO" | "BRUTO_COBRADO";
        porcentaje: string;
      }[]
    | null;
};
export type RevisionCopiado =
  | { modalidad: "MOTOR"; items?: ItemRevisionCopiado[] }
  | {
      modalidad: "TARIFARIO";
      id: string | null;
      huella: string | null;
      cotizacionId: string | null;
      nombre: string;
      numero: number;
      resumenPrecios?: ResumenPrecioCopiado[];
      calculado: Omit<ResultadoPedidoCopiado, "control" | "terminaciones"> & {
        control: Pick<ResultadoPedidoCopiado["control"], "estado"> &
          Partial<ResultadoPedidoCopiado["control"]>;
        terminaciones: {
          id: string;
          control: Pick<ResultadoPedidoCopiado["control"], "estado"> &
            Partial<ResultadoPedidoCopiado["control"]>;
        }[];
      };
      items: ItemRevisionCopiado[];
    };
export type ItemRevisionCopiado = {
  tandaImpresion?: ReferenciaTanda | null;
  anteriorId: string;
  id: string;
  subtotal: number;
  iva: number;
  total: number;
  descuentoMonto: number;
  finanzas?: FinanzasCopiado;
};
export const revisarPedidoCopiado = (datos: {
  items: string[];
  descuentos?: {
    cotizacionItemId: string;
    tipo: "PORCENTAJE" | "MONTO";
    valor: number;
  }[];
  canalVenta: string;
  clienteId?: string;
  tratamientoFiscal: "FISCAL" | "SIN_COMPROBANTE";
}) =>
  apiRequest<RevisionCopiado>("/centro-copiado/pedidos/revisar", {
    method: "POST",
    body: JSON.stringify(datos),
  });
export function claveRevisionCopiado(
  items: PropuestaItem[],
  canal: string,
  clienteId: string,
  sinComprobante: boolean,
) {
  return JSON.stringify({
    canal,
    clienteId,
    sinComprobante,
    items: items.map((i) => ({
      id: i.id,
      cotizacionItemId: i.cotizacionItemId,
      motorCodigo: i.motorCodigo,
      jobContext: i.jobContext,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      impuestoMonto: i.impuestoMonto,
      total: i.total,
      descuento: i.descuentoInput,
      cambio: i.cotizacion?.tipoCambio?.id,
    })),
  });
}
export function ponerPrecioCopiado(
  item: PropuestaItem,
  p: {
    tandaImpresion?: ReferenciaTanda | null;
    subtotal: number;
    iva: number;
    total: number;
    descuentoMonto?: number;
    finanzas?: FinanzasCopiado;
  },
  cotizacionItemId: string,
): PropuestaItem {
  const d = item.cotizacion?.desglosePrecio;
  const cantidadPricing =
    item.cotizacion?.cantidadComercialPricing || item.cantidad || 1;
  const finanzas = p.finanzas;
  const cargas = finanzas?.cargas;
  const sumar = (tipo: string) =>
    (cargas ?? [])
      .filter((c) => c.tipo === tipo)
      .reduce(
        (s, c) =>
          s +
          ((c.base === "NETO" ? p.subtotal : p.total) * Number(c.porcentaje)) /
            100,
        0,
      );
  const internos = sumar("IMPUESTO_INTERNO"),
    comisiones = sumar("COMISION");
  const base = p.subtotal - internos - comisiones;
  return {
    ...item,
    cotizacionItemId,
    jobContext: item.jobContext?._centroCopiado
      ? {
          ...item.jobContext,
          _centroCopiado: {
            ...(item.jobContext._centroCopiado as Record<string, unknown>),
            tandaImpresion: p.tandaImpresion ?? null,
          },
        }
      : item.jobContext,
    subtotal: p.subtotal,
    impuestoMonto: p.iva,
    total: p.total,
    precioUnitario: p.subtotal / item.cantidad,
    impuestoPorcentaje: p.subtotal > 0 ? (p.iva / p.subtotal) * 100 : 0,
    cotizacion: {
      ...item.cotizacion,
      ...(finanzas?.ejecucion ?? {}),
      ...(finanzas?.costoTotal != null && item.cotizacion?.costos
        ? {
            costos: {
              ...item.cotizacion.costos,
              ...(finanzas?.ejecucion?.costos ?? {}),
              total: finanzas.costoTotal,
              unitario: finanzas.costoTotal / cantidadPricing,
            },
          }
        : {}),
      ...(d
        ? {
            desglosePrecio: {
              ...d,
              ...(cargas
                ? {
                    precioBase: base / cantidadPricing,
                    totalImpuestos: (p.iva + internos) / cantidadPricing,
                    totalComisiones: comisiones / cantidadPricing,
                    margenEfectivoPct:
                      finanzas?.costoTotal == null || p.subtotal <= 0
                        ? undefined
                        : ((base - finanzas.costoTotal) / p.subtotal) * 100,
                  }
                : {}),
              precioNetoTotal: p.subtotal,
              precioBrutoTotal: p.total,
              precioNetoUnitario: p.subtotal / cantidadPricing,
              precioBrutoUnitario: p.total / cantidadPricing,
              descuento: {
                ...d.descuento,
                montoTotal: p.descuentoMonto ?? d.descuento.montoTotal,
              },
            },
          }
        : {}),
    },
  };
}

export const estadoPedidoCopiado = (datos: {
  items: string[];
  canalVenta: string;
  clienteId?: string;
  tratamientoFiscal: "FISCAL" | "SIN_COMPROBANTE";
}) =>
  apiRequest<{ revision: RevisionCopiado; vigente: boolean } | null>(
    "/centro-copiado/pedidos/estado",
    { method: "POST", body: JSON.stringify(datos) },
  );
