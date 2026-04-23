import type { FamiliaPaso } from '../pasos/familias';
export type PasoRutaParaValidar = {
    id: string;
    orden: number;
    familiaCodigo: string;
    maquinaPrintableWidthMm?: number | null;
    configNesting?: Record<string, unknown> | null;
};
export type RutaValidationError = {
    codigo: 'R1_familia_desconocida' | 'R2_produce_sin_algoritmo' | 'R3_consume_sin_produce' | 'R4_capacidad_incompatible' | 'R5_config_invalida';
    pasoId: string;
    mensaje: string;
};
export type RutaValidationResult = {
    ok: boolean;
    errors: RutaValidationError[];
    warnings: string[];
};
export declare function validateRuta(pasos: PasoRutaParaValidar[], familiasMap: Record<string, FamiliaPaso>): RutaValidationResult;
