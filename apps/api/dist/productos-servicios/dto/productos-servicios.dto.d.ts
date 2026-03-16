export declare enum TipoProductoServicioDto {
    producto = "producto",
    servicio = "servicio"
}
export declare enum EstadoProductoServicioDto {
    activo = "activo",
    inactivo = "inactivo"
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
    caras = "caras"
}
export declare enum ValorOpcionProductivaDto {
    bn = "bn",
    cmyk = "cmyk",
    simple_faz = "simple_faz",
    doble_faz = "doble_faz"
}
export declare enum TipoProductoAdicionalEfectoDto {
    route_effect = "route_effect",
    cost_effect = "cost_effect",
    material_effect = "material_effect"
}
export declare enum ReglaCostoAdicionalEfectoDto {
    flat = "flat",
    por_unidad = "por_unidad",
    por_pliego = "por_pliego",
    porcentaje_sobre_total = "porcentaje_sobre_total",
    tiempo_extra_min = "tiempo_extra_min"
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
    setupMin?: number;
    runMin?: number;
    cleanupMin?: number;
    tiempoFijoMin?: number;
}
export declare class UpsertProductoAdicionalRouteEffectDto {
    pasos: UpsertProductoAdicionalRouteEffectPasoDto[];
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
export declare class UpdateProductoRutaPolicyDto {
    usarRutaComunVariantes: boolean;
    procesoDefinicionDefaultId?: string | null;
}
export declare class AssignProductoVariantesRutaMasivaDto {
    procesoDefinicionId: string;
    incluirInactivas?: boolean;
}
export declare class AssignProductoMotorDto {
    motorCodigo: string;
    motorVersion: number;
}
export declare class UpsertProductoMotorConfigDto {
    parametros: Record<string, unknown>;
}
export declare class UpsertVarianteMotorOverrideDto {
    parametros: Record<string, unknown>;
}
export declare class CotizarAddonConfigDto {
    addonId: string;
    nivelId?: string;
}
export declare class CotizarProductoVarianteDto {
    cantidad: number;
    periodo?: string;
    addonsSeleccionados?: string[];
    addonsConfig?: CotizarAddonConfigDto[];
}
export declare class PreviewImposicionProductoVarianteDto {
    parametros?: Record<string, unknown>;
}
