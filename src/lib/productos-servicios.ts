export type TipoProductoServicio = 'producto' | 'servicio';
export type EstadoProductoServicio = 'activo' | 'inactivo';
export type MotorCategory = 'digital_sheet' | 'wide_format' | 'vinyl_cut';
export type TipoVentaGranFormato = 'm2' | 'metro_lineal';
export type UnidadComercialProducto = 'unidad' | 'm2' | 'metro_lineal';
export const unidadComercialProductoItems: Array<{
  value: UnidadComercialProducto;
  label: string;
}> = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'm2', label: 'Metro cuadrado' },
  { value: 'metro_lineal', label: 'Metro lineal' },
];
export type TipoImpresionProductoVariante = 'bn' | 'cmyk';
export type CarasProductoVariante = 'simple_faz' | 'doble_faz';
export type DimensionOpcionProductiva = 'tipo_impresion' | 'caras' | 'tipo_copia';
export type ValorOpcionProductiva = 'bn' | 'cmyk' | 'simple_faz' | 'doble_faz' | 'copia_simple' | 'duplicado' | 'triplicado' | 'cuadruplicado';
export type TipoChecklistPregunta = 'binaria' | 'single_select';
export type TipoChecklistAccionRegla =
  | 'activar_paso'
  | 'seleccionar_variante_paso'
  | 'costo_extra'
  | 'material_extra'
  | 'mutar_producto_base'
  | 'configurar_terminacion';
export type ChecklistCotizadorValue = Record<string, {
  respuestaId: string;
  terminacionParams?: Record<string, unknown>;
}>;
export type ProductoChecklistMutacionTipo = 'agregar_demasia_por_lado';
export type ProductoChecklistMutacionEjes = 'ancho' | 'alto' | 'ambos';
export type ProductoChecklistMutacionProductoBase =
  | {
      tipo: 'agregar_demasia_por_lado';
      ejes: ProductoChecklistMutacionEjes;
      valorMmPorLado: number;
    };
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

export type ProductoComisionCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  detalle: {
    items: Array<{
      nombre: string;
      tipo: ProductoPrecioComisionTipo;
      porcentaje: number;
      activo: boolean;
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
  esquemaOrigenId?: string;
};

export type ProductoPrecioComisionesConfig = {
  esquemaId: string | null;
  esquemaIds?: string[];
  esquemaNombre: string;
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
  unidadComercial: UnidadComercialProducto;
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

export type ProductoCore = Pick<
  ProductoServicio,
  | 'id'
  | 'tipo'
  | 'codigo'
  | 'nombre'
  | 'descripcion'
  | 'motorCodigo'
  | 'motorVersion'
  | 'estado'
  | 'activo'
  | 'familiaProductoId'
  | 'familiaProductoNombre'
  | 'subfamiliaProductoId'
  | 'subfamiliaProductoNombre'
  | 'createdAt'
  | 'updatedAt'
>;

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
  papelVarianteNombre?: string;
  papelAtributos?: {
    material: string;
    acabado: string;
    gramaje: number | null;
  };
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

export type MotorCapabilities = {
  hasProductConfig: boolean;
  hasVariantOverride: boolean;
  hasPreview: boolean;
  hasQuote: boolean;
};

export type MotorCostoCatalogItem = {
  code: string;
  version: number;
  label: string;
  category: MotorCategory;
  capabilities: MotorCapabilities;
  schema: Record<string, unknown>;
};

export type MotorDefinition = MotorCostoCatalogItem;

export type ProductoMotorConfig = {
  productoId: string;
  motorCodigo: string;
  motorVersion: number;
  parametros: Record<string, unknown>;
  versionConfig: number;
  activo: boolean;
  updatedAt: string | null;
};

export type MotorProductConfig = ProductoMotorConfig;

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

export type MotorVariantOverride = VarianteMotorOverride;

export type DigitalProductDetailModel = {
  producto: ProductoServicio;
  variantes: ProductoVariante[];
  motores: MotorDefinition[];
};

export type GranFormatoConfig = {
  productoId: string;
  tecnologiasCompatibles: string[];
  maquinasCompatibles: string[];
  perfilesCompatibles: string[];
  materialBaseId: string | null;
  materialesCompatibles: string[];
  imposicion: GranFormatoImposicionConfig;
  updatedAt: string | null;
};

export type ViniloCorteImposicionMedida = {
  anchoMm: number | null;
  altoMm: number | null;
  cantidad: number;
  rotacionPermitida?: boolean;
};

export type VinylCutMedida = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
  rotacionPermitida?: boolean;
};

export type VinylCutColorEntry = {
  id: string;
  label: string;
  materialVarianteId: string | null; // conservado para retrocompatibilidad
  colorFiltro: string | null;        // nuevo: filtra variantes por color; sistema elige el ancho óptimo
  medidas: VinylCutMedida[];
};

export type VinylCutConfig = {
  tipoPlantilla: 'vinilo_de_corte';
  criterioSeleccionMaterial: 'menor_costo_total' | 'menor_largo_consumido' | 'menor_desperdicio';
  plottersCompatibles: string[];
  perfilesCompatibles: string[];
  materialesCompatibles: string[];
  materialBaseId: string | null;
  maquinaDefaultId: string | null;
  perfilDefaultId: string | null;
  permitirRotacion: boolean;
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  colores: VinylCutColorEntry[];
};

export type ViniloCorteConfig = {
  productoId: string;
  plottersCompatibles: string[];
  perfilesCompatibles: string[];
  materialBaseId: string | null;
  materialesCompatibles: string[];
  updatedAt: string | null;
};

export type GranFormatoImposicionCriterioOptimizacion =
  | "menor_costo_total"
  | "menor_desperdicio"
  | "menor_largo_consumido";

export type GranFormatoPanelizadoDireccion = "automatica" | "vertical" | "horizontal";
export type GranFormatoPanelizadoDistribucion = "equilibrada" | "libre";
export type GranFormatoPanelizadoInterpretacionAnchoMaximo = "total" | "util";
export type GranFormatoPanelizadoModo = "automatico" | "manual";

export type GranFormatoPanelManualItem = {
  panelIndex: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  finalWidthMm: number;
  finalHeightMm: number;
};

export type GranFormatoPanelManualLayoutItem = {
  sourcePieceId: string;
  pieceWidthMm: number;
  pieceHeightMm: number;
  axis: "vertical" | "horizontal";
  panels: GranFormatoPanelManualItem[];
};

export type GranFormatoPanelManualLayout = {
  items: GranFormatoPanelManualLayoutItem[];
};

export type GranFormatoImposicionMedida = {
  anchoMm: number | null;
  altoMm: number | null;
  cantidad: number;
};

export type GranFormatoImposicionConfig = {
  medidas: GranFormatoImposicionMedida[];
  piezaAnchoMm: number | null;
  piezaAltoMm: number | null;
  cantidadReferencia: number;
  tecnologiaDefault: string | null;
  maquinaDefaultId: string | null;
  perfilDefaultId: string | null;
  permitirRotacion: boolean;
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  margenLateralIzquierdoMmOverride: number | null;
  margenLateralDerechoMmOverride: number | null;
  margenInicioMmOverride: number | null;
  margenFinalMmOverride: number | null;
  criterioOptimizacion: GranFormatoImposicionCriterioOptimizacion;
  panelizadoActivo: boolean;
  panelizadoDireccion: GranFormatoPanelizadoDireccion;
  panelizadoSolapeMm: number | null;
  panelizadoAnchoMaxPanelMm: number | null;
  panelizadoDistribucion: GranFormatoPanelizadoDistribucion;
  panelizadoInterpretacionAnchoMaximo: GranFormatoPanelizadoInterpretacionAnchoMaximo;
  panelizadoModo: GranFormatoPanelizadoModo;
  panelizadoManualLayout: GranFormatoPanelManualLayout | null;
};

export type GranFormatoRutaBaseReglaImpresion = {
  id: string;
  tecnologia: string;
  maquinaId: string | null;
  maquinaNombre: string;
  pasoPlantillaId: string;
  pasoPlantillaNombre: string;
  perfilOperativoDefaultId: string | null;
  perfilOperativoDefaultNombre: string;
};

export type GranFormatoRutaBase = {
  productoId: string;
  procesoDefinicionId: string | null;
  procesoDefinicionNombre: string;
  reglasImpresion: GranFormatoRutaBaseReglaImpresion[];
  updatedAt: string | null;
};

export type GranFormatoVariante = {
  id: string;
  productoServicioId: string;
  nombre: string;
  maquinaId: string;
  maquinaNombre: string;
  plantillaMaquina: string;
  tecnologia: string;
  geometriaTrabajo: string;
  anchoUtilMaquina: number | null;
  perfilOperativoId: string;
  perfilOperativoNombre: string;
  productivityValue: number | null;
  productivityUnit: string;
  cantidadPasadas: number | null;
  materialPreset: string;
  configuracionTintas: string;
  materiaPrimaVarianteId: string;
  materiaPrimaNombre: string;
  materiaPrimaSku: string;
  esDefault: boolean;
  permiteOverrideEnCotizacion: boolean;
  activo: boolean;
  observaciones: string;
  detalle: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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
  detalle: Record<string, unknown> | ProductoChecklistMutacionProductoBase | null;
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

export type ProductoChecklistPayload = {
  activo?: boolean;
  preguntas: Array<{
    id?: string;
    texto: string;
    tipoPregunta?: 'binaria' | 'single_select';
    orden?: number;
    activo?: boolean;
    respuestas: Array<{
      id?: string;
      texto: string;
      codigo?: string;
      preguntaSiguienteId?: string;
      orden?: number;
      activo?: boolean;
      reglas?: Array<{
        id?: string;
        accion: TipoChecklistAccionRegla;
        orden?: number;
        activo?: boolean;
        pasoPlantillaId?: string;
        variantePasoId?: string;
        costoRegla?: 'tiempo_min' | 'flat' | 'por_unidad' | 'por_pliego' | 'porcentaje_sobre_total';
        costoValor?: number;
        costoCentroCostoId?: string;
        materiaPrimaVarianteId?: string;
        tipoConsumo?: 'por_unidad' | 'por_pliego' | 'por_m2';
        factorConsumo?: number;
        mermaPct?: number;
        detalle?: Record<string, unknown> | ProductoChecklistMutacionProductoBase;
      }>;
    }>;
  }>;
};

export type GranFormatoChecklistConfig = {
  productoId: string;
  aplicaATodasLasTecnologias: boolean;
  checklistComun: ProductoChecklist;
  checklistsPorTecnologia: Array<{
    tecnologia: string;
    checklist: ProductoChecklist;
  }>;
  updatedAt: string | null;
};

export type PreviewGranFormatoCostoMedida = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
};

export type PreviewGranFormatoCostosPayload = {
  periodo?: string;
  tecnologia?: string;
  perfilOverrideId?: string;
  persistirSnapshot?: boolean;
  incluirCandidatos?: boolean;
  medidas: PreviewGranFormatoCostoMedida[];
  checklistRespuestas?: Array<{
    preguntaId: string;
    respuestaId: string;
  }>;
  panelizado?: {
    activo?: boolean;
    modo?: GranFormatoPanelizadoModo | null;
    direccion?: GranFormatoPanelizadoDireccion | null;
    solapeMm?: number | null;
    anchoMaxPanelMm?: number | null;
    distribucion?: GranFormatoPanelizadoDistribucion | null;
    interpretacionAnchoMaximo?: GranFormatoPanelizadoInterpretacionAnchoMaximo | null;
    manualLayout?: GranFormatoPanelManualLayout | null;
  };
};

export type GranFormatoCostosCandidateResumen = {
  variantId: string;
  rollWidthMm: number;
  printableWidthMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginStartMm: number;
  marginEndMm: number;
  orientacion: "normal" | "rotada" | "mixta";
  panelizado: boolean;
  panelAxis: "vertical" | "horizontal" | null;
  panelCount: number;
  panelOverlapMm: number | null;
  panelMaxWidthMm: number | null;
  panelDistribution: GranFormatoPanelizadoDistribucion | null;
  panelWidthInterpretation: GranFormatoPanelizadoInterpretacionAnchoMaximo | null;
  panelMode: GranFormatoPanelizadoModo | null;
  piecesPerRow: number;
  rows: number;
  consumedLengthMm: number;
  usefulAreaM2: number;
  consumedAreaM2: number;
  wasteAreaM2: number;
  wastePct: number;
  substrateCost: number;
  inkCost: number;
  timeCost: number;
  totalCost: number;
  placements: Array<{
    id: string;
    widthMm: number;
    heightMm: number;
    usefulWidthMm: number;
    usefulHeightMm: number;
    overlapStartMm: number;
    overlapEndMm: number;
    centerXMm: number;
    centerYMm: number;
    label: string;
    rotated: boolean;
    originalWidthMm: number;
    originalHeightMm: number;
    panelIndex: number | null;
    panelCount: number | null;
    panelAxis: "vertical" | "horizontal" | null;
    sourcePieceId: string | null;
  }>;
};

export type GranFormatoCostosNestingPiece = {
  id: string;
  w: number;
  h: number;
  originalW?: number | null;
  originalH?: number | null;
  usefulW?: number | null;
  usefulH?: number | null;
  cx: number;
  cy: number;
  color: string;
  label: string;
  textColor?: string;
  rotated?: boolean;
  panelIndex?: number | null;
  panelCount?: number | null;
  panelAxis?: "vertical" | "horizontal" | null;
  sourcePieceId?: string | null;
  overlapStart?: number | null;
  overlapEnd?: number | null;
};

export type GranFormatoCostosNestingPreview = {
  rollWidth: number;
  rollLength: number;
  marginLeft: number;
  marginRight: number;
  marginStart: number;
  marginEnd: number;
  panelizado?: boolean;
  panelAxis?: "vertical" | "horizontal" | null;
  panelCount?: number;
  panelOverlap?: number | null;
  panelMaxWidth?: number | null;
  panelDistribution?: GranFormatoPanelizadoDistribucion | null;
  panelWidthInterpretation?: GranFormatoPanelizadoInterpretacionAnchoMaximo | null;
  panelMode?: GranFormatoPanelizadoModo | null;
  pieces: GranFormatoCostosNestingPiece[];
};

export type GranFormatoCostosGrupoTrabajo = {
  grupoId: string;
  corridaId?: string | null;
  variantId: string;
  varianteNombre: string;
  varianteChips: Array<{
    label: string;
    value: string;
  }>;
  panelizado: boolean;
  panelAxis: "vertical" | "horizontal" | null;
  panelCount: number;
  piecesCount: number;
  orientacion: "normal" | "rotada" | "mixta";
  anchoRolloMm: number;
  anchoImprimibleMm: number;
  largoConsumidoMm: number;
  areaUtilM2: number;
  areaConsumidaM2: number;
  areaDesperdicioM2: number;
  desperdicioPct: number;
  costoSustrato: number;
  costoTinta: number;
  costoTiempo: number;
  costoTotal: number;
  materiasPrimas?: GranFormatoCostosMaterialItem[];
  centrosCosto?: GranFormatoCostosCentroItem[];
  nestingPreview: GranFormatoCostosNestingPreview | null;
};

export type GranFormatoCostosCorridaTrabajo = {
  corridaId: string;
  variantId: string;
  varianteNombre: string;
  varianteChips: Array<{
    label: string;
    value: string;
  }>;
  piecesCount: number;
  groupCount: number;
  gruposCompletos: number;
  gruposPanelizados: number;
  anchoRolloMm: number;
  anchoImprimibleMm: number;
  largoConsumidoMm: number;
  areaUtilM2: number;
  areaConsumidaM2: number;
  areaDesperdicioM2: number;
  desperdicioPct: number;
  costoSustrato: number;
  costoTinta: number;
  costoTiempo: number;
  costoTotal: number;
  nestingPreview: GranFormatoCostosNestingPreview | null;
};

export type GranFormatoCostosResumenTecnico = {
  varianteId: string;
  varianteNombre: string;
  varianteChips: Array<{
    label: string;
    value: string;
  }>;
  anchoRolloMm: number;
  anchoImprimibleMm: number;
  orientacion: "normal" | "rotada" | "mixta";
  panelizado: boolean;
  panelAxis: "vertical" | "horizontal" | null;
  panelCount: number;
  panelOverlapMm: number | null;
  panelMaxWidthMm: number | null;
  panelDistribution: GranFormatoPanelizadoDistribucion | null;
  panelWidthInterpretation: GranFormatoPanelizadoInterpretacionAnchoMaximo | null;
  panelMode: GranFormatoPanelizadoModo | null;
  piezasPorFila: number;
  filas: number;
  largoConsumidoMm: number;
  areaUtilM2: number;
  areaConsumidaM2: number;
  areaDesperdicioM2: number;
  desperdicioPct: number;
  costoSustrato: number;
  costoTinta: number;
  costoTiempo: number;
  costoTotal: number;
};

export type GranFormatoCostosMaterialItem = {
  tipo: string;
  nombre: string;
  sku: string;
  variantChips?: Array<{
    label: string;
    value: string;
  }>;
  cantidad: number;
  costoUnitario: number;
  costo: number;
  origen: string;
  unidad?: string | null;
  detalle?: Record<string, unknown> | null;
};

export type GranFormatoCostosCentroItem = {
  orden: number;
  codigo: string;
  paso: string;
  centroCostoId: string;
  centroCostoNombre: string;
  origen: string;
  minutos: number;
  tarifaHora: number;
  costo: number;
  detalleTecnico?: Record<string, unknown> | null;
};

export type GranFormatoCostosResponse = {
  productoId: string;
  snapshotId?: string;
  createdAt?: string;
  simulacionHibrida?: boolean;
  cantidadTotal: number;
  periodo: string;
  tecnologia: string;
  medidasOriginales: PreviewGranFormatoCostoMedida[];
  medidasEfectivas: PreviewGranFormatoCostoMedida[];
  mutacionesAplicadas: Array<{
    tipo: ProductoChecklistMutacionTipo;
    ejes: ProductoChecklistMutacionEjes;
    valorMmPorLado: number;
    deltaAnchoMm: number;
    deltaAltoMm: number;
    preguntaId: string;
    pregunta: string;
    respuestaId: string;
    respuesta: string;
    reglaId: string;
  }>;
  traceChecklist: Array<{
    preguntaId: string;
    pregunta: string;
    respuestaId: string;
    respuesta: string;
  }>;
  maquinaId: string | null;
  maquinaNombre: string;
  perfilId: string | null;
  perfilNombre: string;
  warnings: string[];
  resumenTecnico: GranFormatoCostosResumenTecnico;
  gruposTrabajo?: GranFormatoCostosGrupoTrabajo[];
  corridasTrabajo?: GranFormatoCostosCorridaTrabajo[];
  materiasPrimas: GranFormatoCostosMaterialItem[];
  centrosCosto: GranFormatoCostosCentroItem[];
  totales: {
    materiales: number;
    centrosCosto: number;
    tecnico: number;
  };
  nestingPreview: GranFormatoCostosNestingPreview | null;
  candidatos?: GranFormatoCostosCandidateResumen[];
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
