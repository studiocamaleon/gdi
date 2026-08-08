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
  /** Código/id con el que filtra el motor (dato técnico, no se muestra). */
  alcanceRef: string | null;
  /** Nombre legible de `alcanceRef`, congelado al crear ("Cartelería"). */
  alcanceNombre: string | null;
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
  alcanceNombre?: string;
  montoMinimo?: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  usoMax?: number;
};

/** El código no se edita: es la identidad y ya puede estar impreso en QRs. */
export type ActualizarCuponPayload = Partial<
  Omit<CrearCuponPayload, "codigo">
> & { activo?: boolean; alcanceRef?: string | null };

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

/** Sólo borra si el cupón nunca se redimió; si tiene historial, el backend
 * responde 400 pidiendo desactivarlo. */
export function eliminarCupon(id: string) {
  return apiRequest<{ id: string; codigo: string }>(`/cupones/${id}`, {
    method: "DELETE",
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
    /** Id (uuid) del producto: lo que la ficha lleva como `motorCodigo`. */
    productoId?: string;
    /** Código del producto. Va además del id porque un cupón con alcance
     *  PRODUCTO pudo guardar cualquiera de los dos. */
    productoCodigo?: string;
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
