/**
 * Comprobante fiscal visto por el CLIENTE, sin sesión.
 *
 * Espejo de la proyección de `GET /comprobantes/publico/:token`
 * (apps/api/src/administracion/factura.service.ts → documento, menos el
 * estado). Es el mismo contenido que el PDF: lo que la normativa exige que
 * figure impreso.
 */

import { apiRequest } from "@/lib/api";

export type ComprobanteItem = {
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** Sólo la A discrimina: en B y C viene null. */
  alicuota: number | null;
  subtotal: number;
};

export type ComprobantePublico = {
  emisor: {
    razonSocial: string;
    domicilioFiscal: string | null;
    condicionFiscal: string;
    cuit: string;
    ingresosBrutos: string | null;
    inicioActividades: string | null;
  };
  letra: string;
  codigoArca: string;
  /** "Factura B", "Nota de Crédito A". */
  tipoLabel: string;
  puntoVenta: string;
  numero: string;
  fecha: string;
  vencimientoPago: string | null;
  receptor: {
    razonSocial: string;
    cuit: string | null;
    domicilio: string | null;
    condicionFiscal: string;
  };
  condicionVenta: string;
  moneda: string;
  discriminaIva: boolean;
  items: ComprobanteItem[];
  subtotal: number;
  ivaPorAlicuota: Array<{ alicuota: number; base: number; monto: number }>;
  /** RG 5614: el IVA contenido que informa un comprobante que no discrimina. */
  ivaContenido: number | null;
  otrosImpuestosIndirectos: number | null;
  otrosTributos: Array<{ descripcion: string; monto: number }>;
  otrosTributosTotal: number;
  total: number;
  cae: string | null;
  caeVencimiento: string | null;
  qrUrl: string | null;
  leyendas: Array<{ codigo: string | null; texto: string }>;
  ordenNumero: string | null;
  /** El emisor cargó logo: la vista lo pide por el endpoint del token. */
  tieneLogo: boolean;
};

export async function getComprobantePublico(
  token: string,
): Promise<ComprobantePublico> {
  return apiRequest(
    `/comprobantes/publico/${encodeURIComponent(token)}`,
    { cache: "no-store" },
    { auth: false },
  );
}

/** El PDF, por el proxy BFF (el endpoint del API es @Public). */
export function comprobantePdfUrl(token: string): string {
  return `/api/backend/comprobantes/publico/${encodeURIComponent(token)}/pdf`;
}

export function comprobanteLogoUrl(token: string): string {
  return `/api/backend/comprobantes/publico/${encodeURIComponent(token)}/logo`;
}
