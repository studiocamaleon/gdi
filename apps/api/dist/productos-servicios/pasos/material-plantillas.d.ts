import type { NestingResultUnion } from '../engine/nesting-runner';
export type MaterialConsumido = {
    nombre: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    costo: number;
    fuente: string;
};
export type MaterialPlantillaContext = {
    cantidadPedida: number;
    layout: NestingResultUnion | null;
    configPaso: Record<string, unknown> | null;
    variante: {
        anchoMm: unknown;
        altoMm: unknown;
        papelVariante: {
            id: string;
            sku: string;
            precioReferencia: unknown;
            atributosVarianteJson: unknown;
        } | null;
    };
    configProducto: Record<string, unknown>;
    selecciones: Map<string, string>;
};
export type MaterialPlantilla = (ctx: MaterialPlantillaContext) => MaterialConsumido[];
export declare const MATERIAL_PLANTILLAS: Record<string, MaterialPlantilla>;
export declare function calcularMaterialesDelPaso(familiaCodigo: string, ctx: MaterialPlantillaContext): MaterialConsumido[];
