export declare enum MetodoDepreciacionMaquinaDto {
    lineal = "lineal"
}
export declare class CentroCostoRecursoMaquinaPeriodoItemDto {
    centroCostoRecursoId: string;
    metodoDepreciacion: MetodoDepreciacionMaquinaDto;
    valorCompra: number;
    valorResidual: number;
    vidaUtilMeses: number;
    potenciaNominalKw: number;
    factorCargaPct: number;
    tarifaEnergiaKwh: number;
    horasProgramadasMes: number;
    disponibilidadPct: number;
    eficienciaPct: number;
    mantenimientoMensual: number;
    segurosMensual: number;
    otrosFijosMensual: number;
}
export declare class UpsertCentroRecursosMaquinariaDto {
    recursos: CentroCostoRecursoMaquinaPeriodoItemDto[];
}
