import { type NestingPlacaPlacement } from './nesting-placa-rigida';
export declare const CANONICAL_PLIEGOS_MM: NestingHojaPliego[];
export type NestingHojaPliego = {
    codigo: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
};
export type NestingHojaCriterio = 'menor_cantidad_pliegos' | 'mayor_aprovechamiento' | 'mayor_piezas_por_pliego';
export type NestingHojaInput = {
    piezaAnchoMm: number;
    piezaAltoMm: number;
    cantidadPiezas: number;
    pliegos?: NestingHojaPliego[];
    separacionHMm: number;
    separacionVMm: number;
    margenMm: number;
    permitirRotacion: boolean;
    criterio: NestingHojaCriterio;
    pliegoImpresion?: NestingHojaPliego | null;
};
export type NestingHojaAlternativa = {
    pliego: NestingHojaPliego;
    piezasPorPliego: number;
    pliegosNecesarios: number;
    aprovechamientoPct: number;
    rotada: boolean;
};
export type NestingHojaResult = {
    pliegoElegido: NestingHojaPliego;
    piezasPorPliego: number;
    pliegosNecesarios: number;
    aprovechamientoPct: number;
    columnas: number;
    filas: number;
    rotada: boolean;
    placements: NestingPlacaPlacement[];
    alternativas: NestingHojaAlternativa[];
    criterioAplicado: NestingHojaCriterio;
    sustratoElegido?: NestingHojaPliego;
    pliegosPorSustrato?: number;
    sustratosNecesarios?: number;
    orientacionConversion?: 'normal' | 'rotada';
};
export declare function nestOnSheet(input: NestingHojaInput): NestingHojaResult | null;
