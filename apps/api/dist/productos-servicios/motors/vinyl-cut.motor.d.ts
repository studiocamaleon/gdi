import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class VinylCutMotorModule implements ProductMotorModule {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getDefinition(): ProductMotorDefinition;
    getProductConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | Record<string, unknown> | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    getVariantOverride(_auth: CurrentAuth, _varianteId: string): Promise<void>;
    upsertVariantOverride(_auth: CurrentAuth, _varianteId: string, _payload: UpsertVarianteMotorOverrideDto): Promise<void>;
    quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<{
        createdAt: string;
        varianteId: string;
        productoServicioId: string;
        productoNombre: string;
        varianteNombre: string;
        motorCodigo: string;
        motorVersion: number;
        periodo: string;
        cantidad: number;
        piezasPorPliego: any;
        pliegos: number;
        warnings: string[];
        bloques: {
            procesos: {
                orden: any;
                codigo: any;
                nombre: any;
                centroCostoId: any;
                centroCostoNombre: any;
                origen: any;
                addonId: null;
                detalleTecnico: any;
                setupMin: number;
                runMin: number;
                cleanupMin: number;
                tiempoFijoMin: number;
                totalMin: number;
                tarifaHora: number;
                costo: number;
            }[];
            materiales: any[] | never[];
        };
        subtotales: {
            procesos: number;
            papel: number;
            toner: number;
            desgaste: number;
            consumiblesTerminacion: number;
            adicionalesMateriales: number;
            adicionalesCostEffects: number;
        };
        total: number;
        unitario: number;
        trazabilidad: {
            config: {
                [x: string]: unknown;
            };
            configVersionBase: number | null;
            configVersionOverride: number | null;
            resumenTecnico: Record<string, unknown>;
            nestingPreview: {} | null;
            coloresResumen: {
                colorId: any;
                colorLabel: any;
                materialVarianteId: any;
                nestingPreview: {} | null;
                resumenTecnico: Record<string, unknown> | null;
                totales: Record<string, unknown> | null;
                materiasPrimas: unknown;
            }[];
        };
        snapshotId: string;
    }>;
    previewVariant(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<{
        config: Record<string, unknown>;
        periodo: string;
        colorResults: Array<Record<string, unknown>>;
        items: Array<Record<string, unknown>>;
        rejected: Array<Record<string, unknown>>;
        warnings: string[];
        aggregated: {
            totalMateriales: number;
            totalCentrosCosto: number;
            totalTecnico: number;
            centrosCosto: never[];
            materiasPrimas: never[];
        };
    } | {
        config: Record<string, unknown>;
        periodo: string;
        colorResults: {
            colorId: string;
            colorLabel: string;
            materialVarianteId: string | null;
            colorFiltro: string | null;
            items: Array<Record<string, unknown>>;
            winner: Record<string, unknown> | null;
            warnings: string[];
        }[];
        items: Record<string, unknown>[];
        rejected: Record<string, unknown>[];
        warnings: string[];
        aggregated: {
            totalMateriales: number;
            totalCentrosCosto: number;
            totalTecnico: number;
            centrosCosto: Record<string, unknown>[];
            materiasPrimas: any[];
        };
    }>;
}
