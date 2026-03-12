export type TipoMovimientoStockMateriaPrima =
  | "ingreso"
  | "egreso"
  | "ajuste_entrada"
  | "ajuste_salida"
  | "transferencia_salida"
  | "transferencia_entrada";

export type OrigenMovimientoStockMateriaPrima =
  | "compra"
  | "consumo_produccion"
  | "ajuste_manual"
  | "transferencia"
  | "devolucion"
  | "otro";

export type AlmacenMateriaPrima = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  ubicaciones: Array<{
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    activo: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type UpsertAlmacenPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

export type UbicacionAlmacenMateriaPrima = {
  id: string;
  almacenId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertUbicacionPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

export type RegistrarMovimientoStockPayload = {
  varianteId: string;
  ubicacionId: string;
  tipo: "ingreso" | "egreso" | "ajuste_entrada" | "ajuste_salida";
  origen: OrigenMovimientoStockMateriaPrima;
  cantidad: number;
  costoUnitario?: number;
  referenciaTipo?: string;
  referenciaId?: string;
  notas?: string;
};

export type RegistrarTransferenciaStockPayload = {
  varianteId: string;
  ubicacionOrigenId: string;
  ubicacionDestinoId: string;
  cantidad: number;
  referenciaTipo?: string;
  referenciaId?: string;
  notas?: string;
};

export type MovimientoStockMateriaPrima = {
  movimientoId: string;
  varianteId: string;
  ubicacionId: string;
  ubicacionNombre?: string;
  tipo: TipoMovimientoStockMateriaPrima;
  origen: OrigenMovimientoStockMateriaPrima;
  cantidad: number;
  costoUnitario: number | null;
  saldoPosterior: number;
  costoPromedioPost: number;
  referenciaTipo: string | null;
  referenciaId: string | null;
  transferenciaId: string | null;
  notas: string | null;
  createdAt: string;
};

export type StockMateriaPrimaItem = {
  id: string;
  varianteId: string;
  varianteSku: string;
  materiaPrimaId: string;
  materiaPrimaNombre: string;
  ubicacionId: string;
  ubicacionNombre: string;
  almacenId: string;
  almacenNombre: string;
  cantidadDisponible: number;
  costoPromedio: number;
  valorStock: number;
  updatedAt: string;
};

export type KardexResponse = {
  items: MovimientoStockMateriaPrima[];
  total: number;
  page: number;
  pageSize: number;
};
