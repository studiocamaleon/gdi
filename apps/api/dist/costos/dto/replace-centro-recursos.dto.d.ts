export declare enum TipoRecursoCentroCostoDto {
    empleado = "empleado",
    maquinaria = "maquinaria",
    proveedor = "proveedor",
    gasto_manual = "gasto_manual"
}
export declare class CentroCostoRecursoItemDto {
    tipoRecurso: TipoRecursoCentroCostoDto;
    empleadoId?: string;
    proveedorId?: string;
    nombreManual?: string;
    descripcion?: string;
    porcentajeAsignacion?: number;
    activo: boolean;
}
export declare class ReplaceCentroRecursosDto {
    recursos: CentroCostoRecursoItemDto[];
}
