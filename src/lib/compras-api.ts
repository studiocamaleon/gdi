import { apiRequest } from "./api";
import type { MaterialUnitContext } from "./material-units";
export type DecimalCompra = number | string;
export type OfertaCompra = {
  id: string;
  proveedorId: string;
  varianteId: string;
  codigoProveedor: string | null;
  unidadCompra: string;
  unidadStock: string;
  factorStock: DecimalCompra;
  precio: DecimalCompra | null;
  moneda: string;
  minimo: DecimalCompra;
  multiplo: DecimalCompra | null;
  reposicionDias: number | null;
  reposicionTipo: string | null;
  vigenteHasta: string | null;
  activo: boolean;
  version: number;
};
export type VarianteCompra = {
  contextoUnidades?: MaterialUnitContext;
  precioReferencia?: DecimalCompra | null;
  moneda?: string | null;
  nombreDisplay?: string;
  id: string;
  nombreVariante: string | null;
  atributosVarianteJson: Record<string, unknown>;
  unidadCompra: string | null;
  unidadStock: string | null;
  proveedorReferenciaId: string | null;
  materiaPrima: { nombre: string; unidadCompra: string; unidadStock: string };
  ofertasCompra: OfertaCompra[];
};
export type CatalogoCompras = {
  proveedores: Array<{
    id: string;
    nombre: string;
    reposicionDias: number | null;
    reposicionTipo: string;
  }>;
  variantes: VarianteCompra[];
  ubicaciones: Array<{
    id: string;
    nombre: string;
    almacen: { nombre: string };
  }>;
  monedaStock: string;
  unidades: string[];
};
export type NecesidadCompra = {
  id: string;
  orden: { id: string; numero: string };
  varianteId: string;
  nombre: string;
  unidad: string;
  revision: string;
  revisar: boolean;
  cantidad: DecimalCompra;
  reservada: DecimalCompra;
  consumida: DecimalCompra;
  pendiente: DecimalCompra;
  enCompra: DecimalCompra;
  porCubrir: DecimalCompra;
  libre: DecimalCompra;
  compras: Array<{
    ordenId: string;
    numero: number;
    cantidad: number;
    fecha: string | null;
    confirmada: boolean;
    estado: string;
  }>;
  proveedor: {
    id: string;
    nombre: string;
    reposicionDias: number | null;
    reposicionTipo: string;
  } | null;
};
export type LineaCompra = {
  id: string;
  varianteId: string;
  nombre: string;
  unidadCompra: string;
  unidadStock: string;
  factorStock: DecimalCompra;
  cantidad: DecimalCompra;
  recibida: DecimalCompra;
  precio: DecimalCompra;
  fechaEstimada: string | null;
  fechaConfirmada: string | null;
  plazoDias: number | null;
  plazoTipo: string | null;
  coberturas?: Array<{
    id: string;
    cantidad: DecimalCompra;
    recibida: DecimalCompra;
    necesidad: { orden: { id: string; numero: string } };
  }>;
};
export type Compra = {
  id: string;
  numero: number;
  estado: string;
  version: number;
  proveedorId: string;
  proveedorNombre: string;
  ubicacionId: string;
  ubicacion: { nombre: string; almacen: { nombre: string } };
  fechaPedido: string;
  moneda: string;
  monedaStock: string;
  tipoCambio: DecimalCompra;
  notas: string | null;
  motivoCierre: string | null;
  lineas: LineaCompra[];
  recepciones?: Array<{
    id: string;
    createdAt: string;
    actor: string;
    referencia: string | null;
    ubicacion: { nombre: string };
    detalles: Array<{
      lineaId: string;
      cantidadCompra: DecimalCompra;
      cantidadStock: DecimalCompra;
      reservasJson: Array<{ cantidad: number; ordenId: string }>;
    }>;
  }>;
};
export type PaginaCompra<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type LineaCompraPayload = {
  varianteId: string;
  unidadCompra: string;
  factorStock: number;
  cantidad: number;
  precio: number;
  fechaConfirmada?: string | null;
  asignaciones: Array<{
    necesidadId: string;
    revision: string;
    cantidad: number;
  }>;
};
export type CrearCompraPayload = {
  proveedorId: string;
  ubicacionId: string;
  fechaPedido: string;
  moneda: string;
  tipoCambio: number;
  notas?: string;
  lineas: LineaCompraPayload[];
};
export const numeroCompra = (n: number) => `OC-${String(n).padStart(6, "0")}`;
export const nombreVarianteCompra = (v: VarianteCompra) =>
  v.nombreDisplay ??
  [v.materiaPrima.nombre, v.nombreVariante].filter(Boolean).join(" · ");
export const getCatalogoCompras = (signal?: AbortSignal) =>
  apiRequest<CatalogoCompras>("/compras/catalogo", { signal });
export const getNecesidadesCompra = (page = 1, signal?: AbortSignal) =>
  apiRequest<PaginaCompra<NecesidadCompra>>(
    `/compras/necesidades?page=${page}`,
    { signal },
  );
export const getCompras = (page = 1, estado = "", signal?: AbortSignal) =>
  apiRequest<PaginaCompra<Compra>>(
    `/compras?page=${page}${estado ? `&estado=${estado}` : ""}`,
    { signal },
  );
export const getCompra = (id: string, signal?: AbortSignal) =>
  apiRequest<Compra>(`/compras/${id}`, { signal });
export const crearCompra = (payload: CrearCompraPayload & { clave: string }) =>
  apiRequest<{ ordenId: string }>("/compras", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const accionCompra = (
  id: string,
  payload: {
    clave: string;
    version: number;
    accion: string;
    motivo?: string;
    lineaId?: string;
    fechaConfirmada?: string | null;
  },
) =>
  apiRequest<{ ordenId: string }>(`/compras/${id}/acciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const recibirCompra = (
  id: string,
  payload: {
    clave: string;
    version: number;
    ubicacionId: string;
    referencia?: string;
    notas?: string;
    lineas: Array<{ lineaId: string; cantidad: number; cantidadStock: number }>;
  },
) =>
  apiRequest<{ ordenId: string }>(`/compras/${id}/recepciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const guardarOfertaCompra = (
  payload: Omit<OfertaCompra, "id" | "unidadStock" | "vigenteHasta"> & {
    vigenteHasta: string | null;
  },
) =>
  apiRequest<OfertaCompra>("/compras/ofertas", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
