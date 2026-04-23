export declare class UpsertProcesoOperacionMaterialVarianteDto {
    materiaPrimaVarianteId: string;
    orden?: number;
    activo?: boolean;
}
export declare const MATERIAL_FORMULAS: readonly ["por_unidad_productiva", "por_m2", "por_pieza", "por_metro_lineal", "fijo"];
export type MaterialFormula = (typeof MATERIAL_FORMULAS)[number];
export declare class UpsertProcesoOperacionMaterialDto {
    nombre: string;
    materiaPrimaVarianteId?: string | null;
    productoComponenteId?: string | null;
    varianteComponenteId?: string | null;
    formula: MaterialFormula;
    cantidadPorUnidad: number;
    unidad: string;
    precioManual?: number | null;
    aplicaMultiCaras?: boolean;
    esSustratoNesting?: boolean;
    variantesHabilitadas?: UpsertProcesoOperacionMaterialVarianteDto[];
    orden?: number;
    activo?: boolean;
}
