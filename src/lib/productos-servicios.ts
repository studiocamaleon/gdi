export type TipoProductoServicio = 'producto' | 'servicio';
export type EstadoProductoServicio = 'activo' | 'inactivo';
export type TipoImpresionProductoVariante = 'bn' | 'cmyk';
export type CarasProductoVariante = 'simple_faz' | 'doble_faz';

export type FamiliaProducto = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  subfamiliasCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type SubfamiliaProducto = {
  id: string;
  familiaProductoId: string;
  familiaProductoNombre: string;
  codigo: string;
  nombre: string;
  unidadComercial: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductoServicio = {
  id: string;
  tipo: TipoProductoServicio;
  codigo: string;
  nombre: string;
  descripcion: string;
  motorCodigo: string;
  motorVersion: number;
  usarRutaComunVariantes: boolean;
  procesoDefinicionDefaultId: string | null;
  procesoDefinicionDefaultNombre: string;
  estado: EstadoProductoServicio;
  activo: boolean;
  familiaProductoId: string;
  familiaProductoNombre: string;
  subfamiliaProductoId: string | null;
  subfamiliaProductoNombre: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductoVariante = {
  id: string;
  productoServicioId: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  papelVarianteId: string | null;
  papelVarianteSku: string;
  papelNombre: string;
  tipoImpresion: TipoImpresionProductoVariante;
  caras: CarasProductoVariante;
  procesoDefinicionId: string | null;
  procesoDefinicionCodigo: string;
  procesoDefinicionNombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MotorCostoCatalogItem = {
  code: string;
  version: number;
  label: string;
  schema: Record<string, unknown>;
};

export type ProductoMotorConfig = {
  productoId: string;
  motorCodigo: string;
  motorVersion: number;
  parametros: Record<string, unknown>;
  versionConfig: number;
  activo: boolean;
  updatedAt: string | null;
};

export type ProductoRutaPolicy = {
  id: string;
  usarRutaComunVariantes: boolean;
  procesoDefinicionDefaultId: string | null;
  procesoDefinicionDefaultNombre: string;
};

export type VarianteMotorOverride = {
  varianteId: string;
  motorCodigo: string;
  motorVersion: number;
  parametros: Record<string, unknown>;
  versionConfig: number;
  activo: boolean;
  updatedAt: string | null;
};

export type CotizacionProductoVariante = {
  snapshotId: string;
  varianteId: string;
  productoServicioId: string;
  productoNombre: string;
  varianteNombre: string;
  motorCodigo: string;
  motorVersion: number;
  periodo: string;
  cantidad: number;
  piezasPorPliego: number;
  pliegos: number;
  warnings: string[];
  bloques: {
    procesos: Array<{
      orden: number;
      codigo: string;
      nombre: string;
      centroCostoId: string;
      centroCostoNombre: string;
      setupMin: number;
      runMin: number;
      cleanupMin: number;
      tiempoFijoMin: number;
      totalMin: number;
      tarifaHora: number;
      costo: number;
    }>;
    materiales: Array<Record<string, unknown>>;
  };
  subtotales: {
    procesos: number;
    papel: number;
    toner: number;
    desgaste: number;
  };
  total: number;
  unitario: number;
  trazabilidad: Record<string, unknown>;
  createdAt: string;
};

export type CotizacionProductoSnapshotResumen = {
  id: string;
  cantidad: number;
  periodoTarifa: string;
  motorCodigo: string;
  motorVersion: number;
  configVersionBase: number | null;
  configVersionOverride: number | null;
  total: number;
  unitario: number;
  createdAt: string;
};

export type PliegoImpresionCatalogItem = {
  codigo: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  label: string;
};

export const tipoProductoServicioItems: Array<{ label: string; value: TipoProductoServicio }> = [
  { label: 'Producto', value: 'producto' },
  { label: 'Servicio', value: 'servicio' },
];

export const estadoProductoServicioItems: Array<{ label: string; value: EstadoProductoServicio }> = [
  { label: 'Activo', value: 'activo' },
  { label: 'Inactivo', value: 'inactivo' },
];

export const tipoImpresionProductoVarianteItems: Array<{
  label: string;
  value: TipoImpresionProductoVariante;
}> = [
  { label: 'Blanco y negro', value: 'bn' },
  { label: 'CMYK', value: 'cmyk' },
];

export const carasProductoVarianteItems: Array<{ label: string; value: CarasProductoVariante }> = [
  { label: 'Simple faz', value: 'simple_faz' },
  { label: 'Doble faz', value: 'doble_faz' },
];
