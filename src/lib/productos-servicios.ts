export type TipoProductoServicio = 'producto' | 'servicio';
export type EstadoProductoServicio = 'activo' | 'inactivo';
export type TipoImpresionProductoVariante = 'bn' | 'cmyk';
export type CarasProductoVariante = 'simple_faz' | 'doble_faz';
export type TipoProductoAdicional = 'servicio' | 'acabado';
export type MetodoCostoProductoAdicional = 'time_only' | 'time_plus_material';
export type TipoConsumoAdicionalMaterial = 'por_unidad' | 'por_pliego' | 'por_m2';
export type DimensionOpcionProductiva = 'tipo_impresion' | 'caras';
export type ValorOpcionProductiva = 'bn' | 'cmyk' | 'simple_faz' | 'doble_faz';
export type TipoProductoAdicionalEfecto = 'route_effect' | 'cost_effect' | 'material_effect';
export type ReglaCostoAdicionalEfecto =
  | 'flat'
  | 'por_unidad'
  | 'por_pliego'
  | 'porcentaje_sobre_total'
  | 'tiempo_extra_min';

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
  opcionesProductivas: Array<{
    dimension: DimensionOpcionProductiva;
    valores: ValorOpcionProductiva[];
  }> | null;
  procesoDefinicionId: string | null;
  procesoDefinicionCodigo: string;
  procesoDefinicionNombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductoAdicionalMaterial = {
  id: string;
  materiaPrimaVarianteId: string;
  materiaPrimaNombre: string;
  materiaPrimaSku: string;
  tipoConsumo: TipoConsumoAdicionalMaterial;
  factorConsumo: number;
  mermaPct: number | null;
  activo: boolean;
  detalle: Record<string, unknown> | null;
};

export type ProductoAdicional = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: TipoProductoAdicional;
  metodoCosto: MetodoCostoProductoAdicional;
  centroCostoId: string | null;
  centroCostoNombre: string;
  activo: boolean;
  metadata: Record<string, unknown> | null;
  servicioPricing: {
    niveles: Array<{
      id: string;
      nombre: string;
      orden: number;
      activo: boolean;
    }>;
    reglas: Array<{
      id: string;
      nivelId: string;
      tiempoMin: number;
    }>;
  };
  efectos: Array<{
    id: string;
    tipo: TipoProductoAdicionalEfecto;
    activo: boolean;
  }>;
  materiales: ProductoAdicionalMaterial[];
  createdAt: string;
  updatedAt: string;
};

export type VarianteOpcionesProductivas = {
  varianteId: string;
  source: 'legacy' | 'v2';
  dimensiones: Array<{
    dimension: DimensionOpcionProductiva;
    valores: ValorOpcionProductiva[];
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type AddonEffectScope = {
  id: string;
  varianteId: string | null;
  dimension: DimensionOpcionProductiva | null;
  valor: ValorOpcionProductiva | null;
};

export type AddonRouteEffect = {
  id: string;
  pasos: Array<{
    id: string;
    orden: number;
    nombre: string;
    centroCostoId: string;
    centroCostoNombre: string;
    maquinaId: string | null;
    maquinaNombre: string;
    perfilOperativoId: string | null;
    perfilOperativoNombre: string;
    setupMin: number | null;
    runMin: number | null;
    cleanupMin: number | null;
    tiempoFijoMin: number | null;
  }>;
};

export type AddonCostEffect = {
  id: string;
  regla: ReglaCostoAdicionalEfecto;
  valor: number;
  centroCostoId: string | null;
  centroCostoNombre: string;
  detalle: Record<string, unknown> | null;
};

export type AddonMaterialEffect = {
  id: string;
  materiaPrimaVarianteId: string;
  materiaPrimaNombre: string;
  materiaPrimaSku: string;
  tipoConsumo: TipoConsumoAdicionalMaterial;
  factorConsumo: number;
  mermaPct: number | null;
  detalle: Record<string, unknown> | null;
};

export type AddonEffect = {
  id: string;
  adicionalId: string;
  tipo: TipoProductoAdicionalEfecto;
  nombre: string;
  activo: boolean;
  scopes: AddonEffectScope[];
  routeEffect: AddonRouteEffect | null;
  costEffect: AddonCostEffect | null;
  materialEffect: AddonMaterialEffect | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductoAdicionalAsignado = {
  id: string;
  productoServicioId: string;
  adicionalId: string;
  activo: boolean;
  adicional: ProductoAdicional;
  createdAt: string;
  updatedAt: string;
};

export type VarianteAdicionalRestriccion = {
  id: string;
  varianteId: string;
  adicionalId: string;
  adicionalNombre: string;
  permitido: boolean;
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
      origen?: string;
      addonId?: string | null;
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
    adicionalesMateriales?: number;
    adicionalesCostEffects?: number;
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
