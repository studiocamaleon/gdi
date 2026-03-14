import { ModoProductividadProcesoDto, TipoOperacionProcesoDto, UnidadProcesoDto } from './upsert-proceso.dto';
export declare class UpsertProcesoOperacionPlantillaDto {
    nombre: string;
    tipoOperacion: TipoOperacionProcesoDto;
    centroCostoId?: string;
    maquinaId?: string;
    perfilOperativoId?: string;
    setupMin?: number;
    cleanupMin?: number;
    modoProductividad?: ModoProductividadProcesoDto;
    productividadBase?: number;
    unidadEntrada?: UnidadProcesoDto;
    unidadSalida?: UnidadProcesoDto;
    unidadTiempo?: UnidadProcesoDto;
    mermaRunPct?: number;
    reglaVelocidad?: Record<string, unknown>;
    reglaMerma?: Record<string, unknown>;
    observaciones?: string;
    activo: boolean;
}
