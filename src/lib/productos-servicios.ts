export type TipoProductoServicio = 'producto' | 'servicio';
export type EstadoProductoServicio = 'activo' | 'inactivo';
export type TipoImpresionProductoVariante = 'bn' | 'cmyk';
export type CarasProductoVariante = 'simple_faz' | 'doble_faz';
export type DimensionOpcionProductiva = 'tipo_impresion' | 'caras';
export type ValorOpcionProductiva = 'bn' | 'cmyk' | 'simple_faz' | 'doble_faz';
export type TipoChecklistPregunta = 'binaria' | 'single_select';
export type TipoChecklistAccionRegla =
  | 'activar_paso'
  | 'seleccionar_variante_paso'
  | 'costo_extra'
  | 'material_extra';
export type ReglaCostoChecklist =
  | 'tiempo_min'
  | 'flat'
  | 'por_unidad'
  | 'por_pliego'
  | 'porcentaje_sobre_total';
export type MetodoCalculoPrecioProducto =
  | 'margen_variable'
  | 'por_margen'
  | 'precio_fijo'
  | 'fijado_por_cantidad'
  | 'fijo_con_margen_variable'
  | 'variable_por_cantidad'
  | 'precio_fijo_para_margen_minimo';

export type ProductoImpuestoCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  detalle: {
    items: Array<{
      nombre: string;
      porcentaje: number;
    }>;
  };
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductoPrecioImpuestoItem = {
  nombre: string;
  porcentaje: number;
};

export type ProductoPrecioImpuestosConfig = {
  esquemaId: string | null;
  esquemaNombre: string;
  items: ProductoPrecioImpuestoItem[];
  porcentajeTotal: number;
};

export type ProductoPrecioComisionTipo = 'financiera' | 'vendedor';

export type ProductoPrecioComisionItem = {
  id: string;
  nombre: string;
  tipo: ProductoPrecioComisionTipo;
  porcentaje: number;
  activo: boolean;
};

export type ProductoPrecioComisionesConfig = {
  items: ProductoPrecioComisionItem[];
  porcentajeTotal: number;
};

export type ProductoPrecioFilaCantidadPrecio = {
  quantity: number;
  price: number;
};

export type ProductoPrecioFilaRangoPrecio = {
  quantityUntil: number;
  price: number;
};

export type ProductoPrecioFilaRangoMargen = {
  quantityUntil: number;
  marginPct: number;
};

export type ProductoPrecioFilaCantidadMargen = {
  quantity: number;
  marginPct: number;
};

export type ProductoPrecioPorMargenConfig = {
  marginPct: number;
  minimumMarginPct: number;
};

export type ProductoPrecioFijoConfig = {
  price: number;
  minimumPrice: number;
};

export type ProductoPrecioFijoMargenMinimoConfig = {
  price: number;
  minimumPrice: number;
  minimumMarginPct: number;
};

export type ProductoPrecioFijadoPorCantidadConfig = {
  tiers: ProductoPrecioFilaCantidadPrecio[];
};

export type ProductoPrecioVariablePorCantidadConfig = {
  tiers: ProductoPrecioFilaRangoPrecio[];
};

export type ProductoPrecioMargenVariableConfig = {
  tiers: ProductoPrecioFilaRangoMargen[];
};

export type ProductoPrecioFijoConMargenVariableConfig = {
  tiers: ProductoPrecioFilaCantidadMargen[];
};

export type ProductoPrecioDetalleMap = {
  margen_variable: ProductoPrecioMargenVariableConfig;
  por_margen: ProductoPrecioPorMargenConfig;
  precio_fijo: ProductoPrecioFijoConfig;
  fijado_por_cantidad: ProductoPrecioFijadoPorCantidadConfig;
  fijo_con_margen_variable: ProductoPrecioFijoConMargenVariableConfig;
  variable_por_cantidad: ProductoPrecioVariablePorCantidadConfig;
  precio_fijo_para_margen_minimo: ProductoPrecioFijoMargenMinimoConfig;
};

export type ProductoPrecioConfig = {
  [K in MetodoCalculoPrecioProducto]: {
    metodoCalculo: K;
    measurementUnit: string | null;
    impuestos: ProductoPrecioImpuestosConfig;
    comisiones: ProductoPrecioComisionesConfig;
    detalle: ProductoPrecioDetalleMap[K];
  }
}[MetodoCalculoPrecioProducto];

export type ProductoPrecioEspecialCliente = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
} & ProductoPrecioConfig;

export type ProductoPrecioEspecialClientePayload = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  descripcion?: string;
  activo: boolean;
  metodoCalculo: MetodoCalculoPrecioProducto;
  measurementUnit?: string | null;
  detalle?: Record<string, unknown>;
};

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
  unidadComercial: string;
  precio?: ProductoPrecioConfig | null;
  precioEspecialClientes?: ProductoPrecioEspecialCliente[];
  dimensionesBaseConsumidas?: DimensionOpcionProductiva[];
  matchingBasePorVariante?: ProductoRutaBaseMatchingVariante[];
  pasosFijosPorVariante?: ProductoRutaPasoFijoVariante[];
  createdAt: string;
  updatedAt: string;
};

export type ProductoRutaBaseMatchingItem = {
  tipoImpresion: TipoImpresionProductoVariante | null;
  caras: CarasProductoVariante | null;
  pasoPlantillaId: string;
  pasoPlantillaNombre: string;
  perfilOperativoId: string;
  perfilOperativoNombre: string;
};

export type ProductoRutaBaseMatchingVariante = {
  varianteId: string;
  matching: ProductoRutaBaseMatchingItem[];
};

export type ProductoRutaPasoFijoItem = {
  pasoPlantillaId: string;
  pasoPlantillaNombre: string;
  perfilOperativoId: string;
  perfilOperativoNombre: string;
};

export type ProductoRutaPasoFijoVariante = {
  varianteId: string;
  pasos: ProductoRutaPasoFijoItem[];
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
  dimensionesBaseConsumidas?: DimensionOpcionProductiva[];
  matchingBasePorVariante?: ProductoRutaBaseMatchingVariante[];
  pasosFijosPorVariante?: ProductoRutaPasoFijoVariante[];
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

export type TipoProductoAdicional = "servicio" | "acabado";
export type MetodoCostoProductoAdicional = "time_only" | "time_plus_material";
export type TipoProductoAdicionalEfecto = "route_effect" | "cost_effect" | "material_effect";
export type TipoInsercionRouteEffect = "append" | "before_step" | "after_step";

export type ProductoAdicionalCatalogo = {
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
    niveles: Array<{ id: string; nombre: string; orden: number; activo: boolean }>;
    reglas: Array<{ id: string; nivelId: string; tiempoMin: number }>;
  };
  efectos: Array<{ id: string; tipo: TipoProductoAdicionalEfecto; activo: boolean }>;
  materiales: Array<{
    id: string;
    materiaPrimaVarianteId: string;
    materiaPrimaNombre: string;
    materiaPrimaSku: string;
    tipoConsumo: "por_unidad" | "por_pliego" | "por_m2";
    factorConsumo: number;
    mermaPct: number | null;
    activo: boolean;
    detalle: Record<string, unknown> | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ProductoAdicionalAsignado = {
  id: string;
  productoServicioId: string;
  adicionalId: string;
  activo: boolean;
  adicional: ProductoAdicionalCatalogo;
  createdAt: string;
  updatedAt: string;
};

export type ProductoAdicionalEfecto = {
  id: string;
  adicionalId: string;
  tipo: TipoProductoAdicionalEfecto;
  nombre: string;
  activo: boolean;
  scopes: Array<{
    id: string;
    varianteId: string | null;
    dimension: DimensionOpcionProductiva | null;
    valor: ValorOpcionProductiva | null;
  }>;
  routeEffect: {
    id: string;
    insertion: {
      modo: TipoInsercionRouteEffect;
      pasoPlantillaId: string | null;
    };
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
      usarMaquinariaTerminacion: boolean;
      setupMin: number | null;
      runMin: number | null;
      cleanupMin: number | null;
      tiempoFijoMin: number | null;
      tiempoFijoMinFallback: number | null;
      overridesProductividad: Record<string, unknown> | null;
    }>;
  } | null;
  costEffect: {
    id: string;
    regla: "flat" | "por_unidad" | "por_pliego" | "porcentaje_sobre_total" | "tiempo_extra_min";
    valor: number;
    centroCostoId: string | null;
    centroCostoNombre: string;
    detalle: Record<string, unknown> | null;
  } | null;
  materialEffect: {
    id: string;
    materiaPrimaVarianteId: string;
    materiaPrimaNombre: string;
    materiaPrimaSku: string;
    tipoConsumo: "por_unidad" | "por_pliego" | "por_m2";
    factorConsumo: number;
    mermaPct: number | null;
    detalle: Record<string, unknown> | null;
  } | null;
  createdAt: string;
  updatedAt: string;
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
      detalleTecnico?: Record<string, unknown> | null;
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
    consumiblesTerminacion?: number;
    adicionalesMateriales?: number;
    adicionalesCostEffects?: number;
  };
  total: number;
  unitario: number;
  trazabilidad: Record<string, unknown>;
  createdAt: string;
};

export type ProductoChecklistRegla = {
  id: string;
  accion: TipoChecklistAccionRegla;
  orden: number;
  activo: boolean;
  pasoPlantillaId: string | null;
  pasoPlantillaNombre: string;
  centroCostoId: string | null;
  centroCostoNombre: string;
  maquinaNombre: string;
  perfilOperativoNombre: string;
  setupMin: number | null;
  runMin: number | null;
  cleanupMin: number | null;
  tiempoFijoMin: number | null;
  variantePasoId: string | null;
  variantePasoNombre: string;
  variantePasoResumen: string;
  nivelesDisponibles: Array<{
    id: string;
    nombre: string;
    orden: number;
    activo: boolean;
    modoProductividadNivel: 'fija' | 'variable_manual' | 'variable_perfil';
    tiempoFijoMin: number | null;
    productividadBase: number | null;
    unidadSalida: string | null;
    unidadTiempo: string | null;
    maquinaId: string | null;
    maquinaNombre: string;
    perfilOperativoId: string | null;
    perfilOperativoNombre: string;
    setupMin: number | null;
    cleanupMin: number | null;
    resumen: string;
    detalle: Record<string, unknown> | null;
  }>;
  costoRegla: ReglaCostoChecklist | null;
  costoValor: number | null;
  costoCentroCostoId: string | null;
  costoCentroCostoNombre: string;
  materiaPrimaVarianteId: string | null;
  materiaPrimaNombre: string;
  materiaPrimaSku: string;
  tipoConsumo: 'por_unidad' | 'por_pliego' | 'por_m2' | null;
  factorConsumo: number | null;
  mermaPct: number | null;
  detalle: Record<string, unknown> | null;
};

export type ProductoChecklistRespuesta = {
  id: string;
  texto: string;
  codigo: string | null;
  orden: number;
  activo: boolean;
  preguntaSiguienteId: string | null;
  reglas: ProductoChecklistRegla[];
};

export type ProductoChecklistPregunta = {
  id: string;
  texto: string;
  tipoPregunta: TipoChecklistPregunta;
  orden: number;
  activo: boolean;
  respuestas: ProductoChecklistRespuesta[];
};

export type ProductoChecklist = {
  id?: string;
  productoId: string;
  activo: boolean;
  preguntas: ProductoChecklistPregunta[];
  createdAt: string | null;
  updatedAt: string | null;
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
