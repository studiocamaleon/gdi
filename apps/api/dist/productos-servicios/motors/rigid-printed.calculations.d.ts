import type { EstrategiaCosteoMaterial } from './rigid-printed.types';
export type NestingInput = {
    piezaAnchoMm: number;
    piezaAltoMm: number;
    placaAnchoMm: number;
    placaAltoMm: number;
    separacionHMm: number;
    separacionVMm: number;
    margenMm: number;
    permitirRotacion: boolean;
};
export type NestingPiecePosition = {
    x: number;
    y: number;
    anchoMm: number;
    altoMm: number;
    rotada: boolean;
};
export type NestingResult = {
    piezasPorPlaca: number;
    columnas: number;
    filas: number;
    rotada: boolean;
    posiciones: NestingPiecePosition[];
    aprovechamientoPct: number;
    largoConsumidoMm: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
};
export declare function nestRectangularGrid(input: NestingInput): NestingResult;
export declare function calculatePlatesNeeded(totalPiezas: number, piezasPorPlaca: number): {
    placas: number;
    sobrantes: number;
};
export type MultiMedidaInput = {
    anchoMm: number;
    altoMm: number;
    cantidad: number;
};
export type MultiMedidaResult = {
    placas: number;
    totalPiezas: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
    aprovechamientoPct: number;
    placaLayouts: Array<{
        areaUtilMm2: number;
        largoConsumidoMm: number;
    }>;
};
export declare function nestMultiMedida(medidas: MultiMedidaInput[], placaAnchoMm: number, placaAltoMm: number, sepH: number, sepV: number, margen: number, permitirRotacion: boolean, orientacionPlaca?: 'usar_lado_corto' | 'usar_lado_largo'): MultiMedidaResult;
export type CosteoInput = {
    estrategia: EstrategiaCosteoMaterial;
    precioPlaca: number;
    placaAnchoMm: number;
    placaAltoMm: number;
    nesting: NestingResult;
    placasNecesarias: number;
    piezasUltimaPlaca: number;
    segmentosPlaca: number[];
    cantidadTotal: number;
    piezaAnchoMm: number;
    piezaAltoMm: number;
};
export type CosteoResult = {
    estrategia: EstrategiaCosteoMaterial;
    costoTotal: number;
    detalle: {
        precioPlaca: number;
        precioM2: number;
        placasCompletas: number;
        costoPlacasCompletas: number;
        ultimaPlaca: {
            ocupacionPct: number;
            segmentoAplicado: number | null;
            costo: number;
        } | null;
    };
};
export declare function calcularCosteoMaterial(input: CosteoInput): CosteoResult;
