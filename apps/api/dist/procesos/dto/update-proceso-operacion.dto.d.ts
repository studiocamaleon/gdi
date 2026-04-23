export declare class UpdateProcesoOperacionDto {
    nombre?: string;
    esOpcional?: boolean;
    activacionV2?: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';
    familiaV2?: string;
    unidadProductivaV2?: string;
    centroCostoId?: string;
    maquinaId?: string | null;
    perfilOperativoId?: string | null;
    plantillaOrigenId?: string | null;
    setupMin?: number | null;
    cleanupMin?: number | null;
    tiempoFijoMin?: number | null;
    productividadBase?: number | null;
    unidadTiempo?: 'HORA' | 'MINUTO' | 'SEGUNDO';
    condicionV2?: Record<string, unknown> | null;
    configNestingV2?: Record<string, unknown> | null;
}
