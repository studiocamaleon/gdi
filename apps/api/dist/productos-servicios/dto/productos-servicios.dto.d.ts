export declare enum TipoProductoServicioDto {
    producto = "producto",
    servicio = "servicio"
}
export declare enum EstadoProductoServicioDto {
    activo = "activo",
    inactivo = "inactivo"
}
export declare enum TipoVentaGranFormatoDto {
    m2 = "m2",
    metro_lineal = "metro_lineal"
}
export declare enum UnidadComercialProductoDto {
    unidad = "unidad",
    m2 = "m2",
    metro_lineal = "metro_lineal"
}
export declare enum GranFormatoImposicionCriterioOptimizacionDto {
    menor_costo_total = "menor_costo_total",
    menor_desperdicio = "menor_desperdicio",
    menor_largo_consumido = "menor_largo_consumido"
}
export declare enum GranFormatoPanelizadoDireccionDto {
    automatica = "automatica",
    vertical = "vertical",
    horizontal = "horizontal"
}
export declare enum GranFormatoPanelizadoDistribucionDto {
    equilibrada = "equilibrada",
    libre = "libre"
}
export declare enum GranFormatoPanelizadoInterpretacionAnchoMaximoDto {
    total = "total",
    util = "util"
}
export declare enum GranFormatoPanelizadoModoDto {
    automatico = "automatico",
    manual = "manual"
}
export declare class GranFormatoPanelManualItemDto {
    panelIndex: number;
    usefulWidthMm: number;
    usefulHeightMm: number;
    overlapStartMm: number;
    overlapEndMm: number;
    finalWidthMm: number;
    finalHeightMm: number;
}
export declare class GranFormatoPanelManualLayoutItemDto {
    sourcePieceId: string;
    pieceWidthMm: number;
    pieceHeightMm: number;
    axis: GranFormatoPanelizadoDireccionDto;
    panels: GranFormatoPanelManualItemDto[];
}
export declare class GranFormatoPanelManualLayoutDto {
    items: GranFormatoPanelManualLayoutItemDto[];
}
export declare enum TipoImpresionProductoVarianteDto {
    bn = "bn",
    cmyk = "cmyk"
}
export declare enum CarasProductoVarianteDto {
    simple_faz = "simple_faz",
    doble_faz = "doble_faz"
}
export declare enum TipoProductoAdicionalDto {
    servicio = "servicio",
    acabado = "acabado"
}
export declare enum MetodoCostoProductoAdicionalDto {
    time_only = "time_only",
    time_plus_material = "time_plus_material"
}
export declare enum TipoConsumoAdicionalMaterialDto {
    por_unidad = "por_unidad",
    por_pliego = "por_pliego",
    por_m2 = "por_m2"
}
export declare enum DimensionOpcionProductivaDto {
    tipo_impresion = "tipo_impresion",
    caras = "caras",
    tipo_copia = "tipo_copia"
}
export declare enum ValorOpcionProductivaDto {
    bn = "bn",
    cmyk = "cmyk",
    simple_faz = "simple_faz",
    doble_faz = "doble_faz",
    copia_simple = "copia_simple",
    duplicado = "duplicado",
    triplicado = "triplicado",
    cuadruplicado = "cuadruplicado"
}
export declare enum TipoProductoAdicionalEfectoDto {
    route_effect = "route_effect",
    cost_effect = "cost_effect",
    material_effect = "material_effect"
}
export declare enum TipoInsercionRouteEffectDto {
    append = "append",
    before_step = "before_step",
    after_step = "after_step"
}
export declare enum ReglaCostoAdicionalEfectoDto {
    flat = "flat",
    por_unidad = "por_unidad",
    por_pliego = "por_pliego",
    porcentaje_sobre_total = "porcentaje_sobre_total",
    tiempo_extra_min = "tiempo_extra_min"
}
export declare enum TipoChecklistPreguntaDto {
    binaria = "binaria",
    single_select = "single_select"
}
export declare enum TipoChecklistAccionReglaDto {
    activar_paso = "activar_paso",
    seleccionar_variante_paso = "seleccionar_variante_paso",
    costo_extra = "costo_extra",
    material_extra = "material_extra",
    mutar_producto_base = "mutar_producto_base",
    set_atributo_tecnico = "set_atributo_tecnico",
    configurar_terminacion = "configurar_terminacion"
}
export declare enum ReglaCostoChecklistDto {
    tiempo_min = "tiempo_min",
    flat = "flat",
    por_unidad = "por_unidad",
    por_pliego = "por_pliego",
    porcentaje_sobre_total = "porcentaje_sobre_total"
}
export declare enum MetodoCalculoPrecioProductoDto {
    margen_variable = "margen_variable",
    por_margen = "por_margen",
    precio_fijo = "precio_fijo",
    fijado_por_cantidad = "fijado_por_cantidad",
    fijo_con_margen_variable = "fijo_con_margen_variable",
    variable_por_cantidad = "variable_por_cantidad",
    precio_fijo_para_margen_minimo = "precio_fijo_para_margen_minimo"
}
export declare class UpsertVarianteOpcionProductivaDimensionDto {
    dimension: DimensionOpcionProductivaDto;
    valores: ValorOpcionProductivaDto[];
}
export declare class UpsertVarianteOpcionesProductivasDto {
    dimensiones: UpsertVarianteOpcionProductivaDimensionDto[];
}
export declare class UpsertProductoAdicionalEfectoScopeDto {
    varianteId?: string;
    dimension?: DimensionOpcionProductivaDto;
    valor?: ValorOpcionProductivaDto;
}
export declare class UpsertProductoAdicionalRouteEffectPasoDto {
    orden?: number;
    nombre: string;
    centroCostoId: string;
    maquinaId?: string;
    perfilOperativoId?: string;
    usarMaquinariaTerminacion?: boolean;
    setupMin?: number;
    runMin?: number;
    cleanupMin?: number;
    tiempoFijoMin?: number;
    tiempoFijoMinFallback?: number;
    overridesProductividad?: Record<string, unknown>;
}
export declare class UpsertProductoAdicionalRouteInsertionDto {
    modo: TipoInsercionRouteEffectDto;
    pasoPlantillaId?: string;
}
export declare class UpsertProductoAdicionalRouteEffectDto {
    pasos: UpsertProductoAdicionalRouteEffectPasoDto[];
    insertion?: UpsertProductoAdicionalRouteInsertionDto;
}
export declare class UpsertProductoAdicionalCostEffectDto {
    regla: ReglaCostoAdicionalEfectoDto;
    valor: number;
    centroCostoId?: string;
    detalle?: Record<string, unknown>;
}
export declare class UpsertProductoAdicionalMaterialEffectDto {
    materiaPrimaVarianteId: string;
    tipoConsumo: TipoConsumoAdicionalMaterialDto;
    factorConsumo: number;
    mermaPct?: number;
    detalle?: Record<string, unknown>;
}
export declare class UpsertProductoAdicionalEfectoDto {
    tipo: TipoProductoAdicionalEfectoDto;
    nombre?: string;
    activo?: boolean;
    scopes?: UpsertProductoAdicionalEfectoScopeDto[];
    routeEffect?: UpsertProductoAdicionalRouteEffectDto;
    costEffect?: UpsertProductoAdicionalCostEffectDto;
    materialEffect?: UpsertProductoAdicionalMaterialEffectDto;
}
export declare class UpsertProductoAdicionalMaterialDto {
    materiaPrimaVarianteId: string;
    tipoConsumo: TipoConsumoAdicionalMaterialDto;
    factorConsumo: number;
    mermaPct?: number;
    activo: boolean;
    detalle?: Record<string, unknown>;
}
export declare class UpsertProductoAdicionalDto {
    codigo?: string;
    nombre: string;
    descripcion?: string;
    tipo: TipoProductoAdicionalDto;
    metodoCosto: MetodoCostoProductoAdicionalDto;
    centroCostoId?: string;
    activo: boolean;
    metadata?: Record<string, unknown>;
    materiales: UpsertProductoAdicionalMaterialDto[];
}
export declare class UpsertProductoAdicionalServicioNivelDto {
    id?: string;
    nombre: string;
    orden?: number;
    activo?: boolean;
}
export declare class UpsertProductoAdicionalServicioReglaCostoDto {
    nivelId: string;
    tiempoMin: number;
}
export declare class UpsertProductoAdicionalServicioPricingDto {
    niveles: UpsertProductoAdicionalServicioNivelDto[];
    reglas: UpsertProductoAdicionalServicioReglaCostoDto[];
}
export declare class AssignProductoAdicionalDto {
    adicionalId: string;
    activo?: boolean;
}
export declare class SetVarianteAdicionalRestrictionDto {
    adicionalId: string;
    permitido: boolean;
}
export declare class UpsertFamiliaProductoDto {
    codigo: string;
    nombre: string;
    activo: boolean;
}
export declare class UpsertProductoImpuestoDto {
    codigo: string;
    nombre: string;
    porcentaje: number;
    detalle?: Record<string, unknown>;
    activo: boolean;
}
export declare class UpsertProductoComisionDto {
    codigo: string;
    nombre: string;
    porcentaje: number;
    detalle?: Record<string, unknown>;
    activo: boolean;
}
export declare class UpsertSubfamiliaProductoDto {
    familiaProductoId: string;
    codigo: string;
    nombre: string;
    unidadComercial?: string;
    activo: boolean;
}
export declare class UpsertProductoServicioDto {
    tipo?: TipoProductoServicioDto;
    codigo?: string;
    nombre: string;
    descripcion?: string;
    motorCodigo?: string;
    motorVersion?: number;
    familiaProductoId: string;
    subfamiliaProductoId?: string;
    unidadComercial: UnidadComercialProductoDto;
    estado: EstadoProductoServicioDto;
    activo: boolean;
}
export declare class CreateProductoVarianteDto {
    nombre: string;
    anchoMm: number;
    altoMm: number;
    papelVarianteId?: string;
    tipoImpresion: TipoImpresionProductoVarianteDto;
    caras: CarasProductoVarianteDto;
    procesoDefinicionId?: string;
    activo?: boolean;
}
export declare class UpdateProductoVarianteDto {
    nombre?: string;
    anchoMm?: number;
    altoMm?: number;
    papelVarianteId?: string;
    tipoImpresion?: TipoImpresionProductoVarianteDto;
    caras?: CarasProductoVarianteDto;
    procesoDefinicionId?: string;
    activo?: boolean;
}
export declare class AssignVarianteRutaDto {
    procesoDefinicionId?: string;
}
export declare class UpsertProductoRutaBaseMatchingItemDto {
    tipoImpresion?: TipoImpresionProductoVarianteDto | null;
    caras?: CarasProductoVarianteDto | null;
    pasoPlantillaId: string;
    perfilOperativoId: string;
}
export declare class UpsertProductoRutaBaseMatchingVarianteDto {
    varianteId: string;
    matching: UpsertProductoRutaBaseMatchingItemDto[];
}
export declare class UpsertProductoRutaPasoFijoItemDto {
    pasoPlantillaId: string;
    perfilOperativoId: string;
}
export declare class UpsertProductoRutaPasoFijoVarianteDto {
    varianteId: string;
    pasos: UpsertProductoRutaPasoFijoItemDto[];
}
export declare class UpdateProductoRutaPolicyDto {
    usarRutaComunVariantes: boolean;
    procesoDefinicionDefaultId?: string | null;
    dimensionesBaseConsumidas?: DimensionOpcionProductivaDto[];
    matchingBasePorVariante?: UpsertProductoRutaBaseMatchingVarianteDto[];
    pasosFijosPorVariante?: UpsertProductoRutaPasoFijoVarianteDto[];
}
export declare class AssignProductoVariantesRutaMasivaDto {
    procesoDefinicionId: string;
    incluirInactivas?: boolean;
}
export declare class AssignProductoMotorDto {
    motorCodigo: string;
    motorVersion: number;
}
export declare class UpdateProductoPrecioDto {
    metodoCalculo: MetodoCalculoPrecioProductoDto;
    measurementUnit?: string | null;
    detalle?: Record<string, unknown>;
    impuestos?: Record<string, unknown>;
    comisiones?: Record<string, unknown>;
}
export declare class UpdateProductoPrecioEspecialClientesDto {
    items: Record<string, unknown>[];
}
export declare class UpsertProductoMotorConfigDto {
    parametros: Record<string, unknown>;
}
export declare class GranFormatoImposicionMedidaDto {
    anchoMm?: number | null;
    altoMm?: number | null;
    cantidad: number;
}
export declare class UpdateGranFormatoImposicionDto {
    medidas?: GranFormatoImposicionMedidaDto[];
    piezaAnchoMm?: number | null;
    piezaAltoMm?: number | null;
    cantidadReferencia?: number;
    tecnologiaDefault?: string | null;
    maquinaDefaultId?: string | null;
    perfilDefaultId?: string | null;
    permitirRotacion?: boolean;
    separacionHorizontalMm?: number;
    separacionVerticalMm?: number;
    margenLateralIzquierdoMmOverride?: number | null;
    margenLateralDerechoMmOverride?: number | null;
    margenInicioMmOverride?: number | null;
    margenFinalMmOverride?: number | null;
    criterioOptimizacion?: GranFormatoImposicionCriterioOptimizacionDto;
    panelizadoActivo?: boolean;
    panelizadoModo?: GranFormatoPanelizadoModoDto;
    panelizadoDireccion?: GranFormatoPanelizadoDireccionDto;
    panelizadoSolapeMm?: number | null;
    panelizadoAnchoMaxPanelMm?: number | null;
    panelizadoDistribucion?: GranFormatoPanelizadoDistribucionDto;
    panelizadoInterpretacionAnchoMaximo?: GranFormatoPanelizadoInterpretacionAnchoMaximoDto;
    panelizadoManualLayout?: GranFormatoPanelManualLayoutDto | null;
}
export declare class UpdateGranFormatoConfigDto {
    tecnologiasCompatibles: string[];
    maquinasCompatibles: string[];
    perfilesCompatibles: string[];
    materialBaseId?: string | null;
    materialesCompatibles: string[];
    imposicion?: UpdateGranFormatoImposicionDto;
}
export declare class UpsertGranFormatoRutaBaseReglaImpresionDto {
    tecnologia: string;
    maquinaId?: string | null;
    pasoPlantillaId: string;
    perfilOperativoDefaultId?: string | null;
}
export declare class UpdateGranFormatoRutaBaseDto {
    procesoDefinicionId?: string | null;
    reglasImpresion: UpsertGranFormatoRutaBaseReglaImpresionDto[];
}
export declare class CreateGranFormatoVarianteDto {
    nombre: string;
    maquinaId: string;
    perfilOperativoId: string;
    materiaPrimaVarianteId: string;
    esDefault?: boolean;
    permiteOverrideEnCotizacion?: boolean;
    activo?: boolean;
    observaciones?: string;
}
export declare class UpdateGranFormatoVarianteDto {
    nombre?: string;
    maquinaId?: string;
    perfilOperativoId?: string;
    materiaPrimaVarianteId?: string;
    esDefault?: boolean;
    permiteOverrideEnCotizacion?: boolean;
    activo?: boolean;
    observaciones?: string;
}
export declare class UpsertVarianteMotorOverrideDto {
    parametros: Record<string, unknown>;
}
export declare class CotizarAddonConfigDto {
    addonId: string;
    nivelId?: string;
}
export declare class CotizarChecklistRespuestaDto {
    preguntaId: string;
    respuestaId: string;
    terminacionParams?: Record<string, unknown>;
}
export declare class CotizarSeleccionBaseDto {
    dimension: DimensionOpcionProductivaDto;
    valor: ValorOpcionProductivaDto;
}
export declare class UpsertChecklistReglaNivelDto {
    id?: string;
    nombreNivel: string;
    orden?: number;
    activo?: boolean;
    costoRegla?: ReglaCostoChecklistDto;
    costoValor?: number;
    tiempoMin?: number;
}
export declare class UpsertChecklistReglaDto {
    id?: string;
    accion: TipoChecklistAccionReglaDto;
    orden?: number;
    activo?: boolean;
    pasoPlantillaId?: string;
    variantePasoId?: string;
    atributoTecnicoDimension?: DimensionOpcionProductivaDto;
    atributoTecnicoValor?: ValorOpcionProductivaDto;
    costoRegla?: ReglaCostoChecklistDto;
    costoValor?: number;
    costoCentroCostoId?: string;
    materiaPrimaVarianteId?: string;
    tipoConsumo?: TipoConsumoAdicionalMaterialDto;
    factorConsumo?: number;
    mermaPct?: number;
    detalle?: Record<string, unknown>;
}
export declare class UpsertChecklistRespuestaDto {
    id?: string;
    texto: string;
    codigo?: string;
    orden?: number;
    activo?: boolean;
    preguntaSiguienteId?: string;
    reglas?: UpsertChecklistReglaDto[];
}
export declare class UpsertChecklistPreguntaDto {
    id?: string;
    texto: string;
    tipoPregunta?: TipoChecklistPreguntaDto;
    orden?: number;
    activo?: boolean;
    respuestas: UpsertChecklistRespuestaDto[];
}
export declare class UpsertProductoChecklistDto {
    activo?: boolean;
    preguntas: UpsertChecklistPreguntaDto[];
}
export declare class UpsertGranFormatoChecklistPorTecnologiaDto {
    tecnologia: string;
    checklist: UpsertProductoChecklistDto;
}
export declare class UpdateGranFormatoChecklistDto {
    aplicaATodasLasTecnologias: boolean;
    checklistComun?: UpsertProductoChecklistDto;
    checklistsPorTecnologia?: UpsertGranFormatoChecklistPorTecnologiaDto[];
}
export declare class UpsertRigidPrintedChecklistPorTipoDto {
    tipoImpresion: string;
    checklist: UpsertProductoChecklistDto;
}
export declare class UpdateRigidPrintedChecklistDto {
    aplicaATodosLosTiposImpresion: boolean;
    checklistComun?: UpsertProductoChecklistDto;
    checklistsPorTipoImpresion?: UpsertRigidPrintedChecklistPorTipoDto[];
}
export declare class PreviewGranFormatoCostoMedidaDto {
    anchoMm: number;
    altoMm: number;
    cantidad: number;
}
export declare class PreviewGranFormatoCostosDto {
    periodo?: string;
    tecnologia?: string;
    perfilOverrideId?: string;
    persistirSnapshot?: boolean;
    incluirCandidatos?: boolean;
    medidas: PreviewGranFormatoCostoMedidaDto[];
    checklistRespuestas?: CotizarChecklistRespuestaDto[];
    panelizado?: {
        activo?: boolean;
        modo?: GranFormatoPanelizadoModoDto | null;
        direccion?: GranFormatoPanelizadoDireccionDto | null;
        solapeMm?: number | null;
        anchoMaxPanelMm?: number | null;
        distribucion?: GranFormatoPanelizadoDistribucionDto | null;
        interpretacionAnchoMaximo?: GranFormatoPanelizadoInterpretacionAnchoMaximoDto | null;
        manualLayout?: GranFormatoPanelManualLayoutDto | null;
    };
}
export declare class CotizarProductoVarianteDto {
    cantidad: number;
    periodo?: string;
    checklistRespuestas?: CotizarChecklistRespuestaDto[];
    seleccionesBase?: CotizarSeleccionBaseDto[];
    parametros?: Record<string, unknown>;
}
export declare class PreviewImposicionProductoVarianteDto {
    parametros?: Record<string, unknown>;
}
