/**
 * Recibo de pago visto por el CLIENTE, sin sesión.
 *
 * Espejo de la proyección de `GET /recibos/publico/:token`
 * (apps/api/src/administracion/recibos.service.ts → documento).
 * Ver docs/recibos-pago-diseno.md
 */

import { apiRequest } from "@/lib/api";

export type ReciboOrden = {
  numero: string;
  detalle: string | null;
  subtitulo: string | null;
  total: number;
  pagosAnteriores: number;
  saldoPendiente: number;
  pctAbonado: number;
};

export type ReciboPublico = {
  numero: string;
  negocio: string;
  iniciales: string;
  /** Presente pero NO se usa en la web: el logo va por el endpoint del token. */
  logoDataUri?: string | null;
  clienteNombre: string | null;
  fecha: string;
  registradoPor: string | null;
  referencia: string | null;
  monto: number;
  montoEnLetras: string;
  metodoNombre: string;
  cuentaTexto: string | null;
  /** null = pago a cuenta, sin orden contra la cual medir saldo. */
  orden: ReciboOrden | null;
};

export async function getReciboPublico(token: string): Promise<ReciboPublico> {
  return apiRequest(
    `/recibos/publico/${encodeURIComponent(token)}`,
    { cache: "no-store" },
    { auth: false },
  );
}

/** El PDF, por el proxy BFF (el endpoint del API es @Public). */
export function reciboPdfUrl(token: string): string {
  return `/api/backend/recibos/publico/${encodeURIComponent(token)}/pdf`;
}

export function reciboLogoUrl(token: string): string {
  return `/api/backend/recibos/publico/${encodeURIComponent(token)}/logo`;
}

export const money = (n: number) =>
  "$" +
  n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
