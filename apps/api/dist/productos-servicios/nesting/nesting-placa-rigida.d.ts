export type NestingPlacaInput = {
    piezaAnchoMm: number;
    piezaAltoMm: number;
    placaAnchoMm: number;
    placaAltoMm: number;
    separacionHMm: number;
    separacionVMm: number;
    margenMm: number;
    permitirRotacion: boolean;
};
export type NestingPlacaPlacement = {
    x: number;
    y: number;
    anchoMm: number;
    altoMm: number;
    rotada: boolean;
};
export type NestingPlacaResult = {
    piezasPorPlaca: number;
    columnas: number;
    filas: number;
    rotada: boolean;
    placements: NestingPlacaPlacement[];
    aprovechamientoPct: number;
    largoConsumidoMm: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
};
export type NestingMultiMedidaInput = {
    anchoMm: number;
    altoMm: number;
    cantidad: number;
};
export type NestingMultiMedidaPlacaLayout = {
    areaUtilMm2: number;
    largoConsumidoMm: number;
    placements: Array<{
        x: number;
        y: number;
        anchoMm: number;
        altoMm: number;
        rotada: boolean;
    }>;
};
export type NestingMultiMedidaResult = {
    placas: number;
    totalPiezas: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
    aprovechamientoPct: number;
    placaLayouts: NestingMultiMedidaPlacaLayout[];
};
export declare function nestRectangularGrid(input: NestingPlacaInput): NestingPlacaResult;
export declare function calculatePlatesNeeded(totalPiezas: number, piezasPorPlaca: number): {
    placas: number;
    sobrantes: number;
};
export declare function nestMultiMedida(medidas: NestingMultiMedidaInput[], placaAnchoMm: number, placaAltoMm: number, sepH: number, sepV: number, margen: number, permitirRotacion: boolean, _orientacionPlaca?: 'usar_lado_corto' | 'usar_lado_largo'): NestingMultiMedidaResult;
