export declare enum TipoMovimientoStockMateriaPrimaDto {
    ingreso = "ingreso",
    egreso = "egreso",
    ajuste_entrada = "ajuste_entrada",
    ajuste_salida = "ajuste_salida"
}
export declare enum OrigenMovimientoStockMateriaPrimaDto {
    compra = "compra",
    consumo_produccion = "consumo_produccion",
    ajuste_manual = "ajuste_manual",
    transferencia = "transferencia",
    devolucion = "devolucion",
    otro = "otro"
}
export declare class RegistrarMovimientoStockDto {
    varianteId: string;
    ubicacionId: string;
    tipo: TipoMovimientoStockMateriaPrimaDto;
    origen: OrigenMovimientoStockMateriaPrimaDto;
    cantidad: number;
    costoUnitario?: number;
    referenciaTipo?: string;
    referenciaId?: string;
    notas?: string;
}
