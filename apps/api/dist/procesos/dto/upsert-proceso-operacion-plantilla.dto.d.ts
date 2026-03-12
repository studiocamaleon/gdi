import { ModoProductividadProcesoDto, TipoProcesoDto, TipoOperacionProcesoDto, UnidadProcesoDto } from './upsert-proceso.dto';
export declare class UpsertProcesoOperacionPlantillaDto {
    nombre: string;
    tipoProceso: TipoProcesoDto;
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
