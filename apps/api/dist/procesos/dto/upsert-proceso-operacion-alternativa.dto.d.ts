export declare class UpsertProcesoOperacionAlternativaDto {
    maquinaId?: string | null;
    perfilOperativoId?: string | null;
    label: string;
    esDefault?: boolean;
    orden?: number;
    activo?: boolean;
    setupMin?: number | null;
    cleanupMin?: number | null;
    tiempoFijoMin?: number | null;
    productividadBase?: number | null;
    configNestingV2?: Record<string, unknown> | null;
}
