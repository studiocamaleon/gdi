/**
 * Cupones de descuento (F4 — docs/descuentos-diseno.md §5.3). El cupón es una
 * fuente AUTORIZADA del mismo descuento por línea del módulo de descuentos:
 * validar un código devuelve qué líneas alcanza; la ficha lo materializa con
 * la maquinaria existente y la redención ocurre al emitir la OT.
 */
import { apiRequest } from "@/lib/api";

export type CuponAlcanceTipo =
  "ORDEN" | "CATEGORIA" | "SUBCATEGORIA" | "PRODUCTO" | "CLIENTE";

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
  estado?: "VIGENTE" | "PAUSADO" | "VENCIDO" | "AGOTADO" | "PROGRAMADO";
  version: number;
  creadoPor: string | null;
  actualizadoPor: string | null;
  createdAt: string;
  updatedAt: string;
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

/** El código no se edita: es la identidad y ya puede estar impreso en QRs. */
export type ActualizarCuponPayload = Partial<
  Omit<
    CrearCuponPayload,
    | "codigo"
    | "descripcion"
    | "alcanceRef"
    | "montoMinimo"
    | "vigenciaDesde"
    | "vigenciaHasta"
    | "usoMax"
  >
> & {
  version: number;
  activo?: boolean;
  descripcion?: string | null;
  alcanceRef?: string | null;
  montoMinimo?: number | null;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  usoMax?: number | null;
  confirmarUsoMaxMenor?: boolean;
};

export type CuponMetricas = {
  total: number;
  vigentes: number;
  porVencer: number;
  agotados: number;
  redencionesMes: number;
  descontadoMes: number;
};

export type CuponesListado = {
  items: Cupon[];
  total: number;
  skip: number;
  limit: number;
  metricas: CuponMetricas;
};

export function listarCupones(filtros?: {
  busqueda?: string;
  estado?: Cupon["estado"];
  skip?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (filtros?.busqueda) qs.set("busqueda", filtros.busqueda);
  if (filtros?.estado) qs.set("estado", filtros.estado);
  if (filtros?.skip != null) qs.set("skip", String(filtros.skip));
  if (filtros?.limit != null) qs.set("limit", String(filtros.limit));
  const query = qs.toString();
  return apiRequest<CuponesListado>(`/cupones${query ? `?${query}` : ""}`);
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

export type CuponHistorial = {
  cupon: Cupon;
  eventos: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    actor: string;
    fecha: string;
  }>;
  redenciones: Array<{
    id: string;
    estado: "RESERVADA" | "CONSUMIDA" | "LIBERADA";
    montoAplicado: number;
    presupuesto: { id: string; numero: string | null } | null;
    orden: { id: string; numero: string } | null;
    actor: string | null;
    fecha: string;
    liberadaEl: string | null;
    liberadaMotivo: string | null;
  }>;
};

export function historialCupon(id: string) {
  return apiRequest<CuponHistorial>(`/cupones/${id}/historial`);
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

export type ValidarCuponResultado = {
  cupon: Cupon;
  alcanzadas: string[];
  plan: Array<{ key: string; tipo: "PORCENTAJE" | "MONTO"; valor: number }>;
  montoAplicado: number | null;
};

export function validarCupon(payload: ValidarCuponPayload) {
  return apiRequest<ValidarCuponResultado>("/cupones/validar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
