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
    tipo: TipoProductoServicioDto;
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
export declare class CotizarProductoVarianteDto {
    cantidad: number;
    periodo?: string;
}
export declare class PreviewImposicionProductoVarianteDto {
    parametros?: Record<string, unknown>;
}
