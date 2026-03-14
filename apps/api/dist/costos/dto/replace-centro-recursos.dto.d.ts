export declare enum TipoRecursoCentroCostoDto {
    empleado = "empleado",
    maquinaria = "maquinaria",
    gasto_general = "gasto_general",
    activo_fijo = "activo_fijo"
}
export declare enum TipoGastoGeneralCentroCostoDto {
    limpieza = "limpieza",
    mantenimiento = "mantenimiento",
    servicios = "servicios",
    alquiler = "alquiler",
    otro = "otro"
}
export declare class CentroCostoRecursoItemDto {
    tipoRecurso: TipoRecursoCentroCostoDto;
    empleadoId?: string;
    maquinaId?: string;
    nombreRecurso?: string;
    tipoGastoGeneral?: TipoGastoGeneralCentroCostoDto;
    valorMensual?: number;
    vidaUtilRestanteMeses?: number;
    valorActual?: number;
    valorFinalVida?: number;
    descripcion?: string;
    porcentajeAsignacion?: number;
    activo: boolean;
}
export declare class ReplaceCentroRecursosDto {
    recursos: CentroCostoRecursoItemDto[];
}
