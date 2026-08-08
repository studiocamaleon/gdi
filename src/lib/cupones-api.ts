/**
 * Cupones de descuento (F4 — docs/descuentos-diseno.md §5.3). El cupón es una
 * fuente AUTORIZADA del mismo descuento por línea del módulo de descuentos:
 * validar un código devuelve qué líneas alcanza; la ficha lo materializa con
 * la maquinaria existente y la redención ocurre al emitir la OT.
 */
import { apiRequest } from "@/lib/api";

export type CuponAlcanceTipo =
  | "ORDEN"
  | "CATEGORIA"
  | "SUBCATEGORIA"
  | "PRODUCTO"
  | "CLIENTE";

export type Cupon = {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: "PORCENTAJE" | "MONTO";
  valor: number;
  alcanceTipo: CuponAlcanceTipo;
  alcanceRef: string | null;
  montoMinimo: number | null;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  usoMax: number | null;
  usoCount: number;
  activo: boolean;
  createdAt: string;
};

export type CrearCuponPayload = {
  codigo: string;
  descripcion?: string;
  tipo: "PORCENTAJE" | "MONTO";
  valor: number;
  alcanceTipo?: CuponAlcanceTipo;
  alcanceRef?: string;
  montoMinimo?: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  usoMax?: number;
};

export type ActualizarCuponPayload = Partial<
  Pick<
    CrearCuponPayload,
    "descripcion" | "valor" | "montoMinimo" | "vigenciaDesde" | "vigenciaHasta" | "usoMax"
  >
> & { activo?: boolean };

export function listarCupones() {
  return apiRequest<Cupon[]>("/cupones");
}

export function crearCupon(payload: CrearCuponPayload) {
  return apiRequest<Cupon>("/cupones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarCupon(id: string, payload: ActualizarCuponPayload) {
  return apiRequest<Cupon>(`/cupones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** QR del código plano (el lector 2D lo tipea como teclado). */
export function qrCupon(id: string) {
  return apiRequest<{ codigo: string; dataUrl: string }>(`/cupones/${id}/qr`);
}

export type ValidarCuponPayload = {
  codigo: string;
  clienteId?: string;
  items: Array<{
    key: string;
    productoId?: string;
    categoriaCodigo?: string;
    subcategoriaCodigo?: string;
    /** Neto de lista de la línea (sin descuentos previos). */
    neto: number;
  }>;
};

export function validarCupon(payload: ValidarCuponPayload) {
  return apiRequest<{ cupon: Cupon; alcanzadas: string[] }>(
    "/cupones/validar",
    { method: "POST", body: JSON.stringify(payload) },
  );
}
