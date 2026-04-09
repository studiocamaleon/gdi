import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class RigidPrintedMotorModule implements ProductMotorModule {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getDefinition(): ProductMotorDefinition;
    getProductConfig(auth: CurrentAuth, productoId: string): Promise<{
        parametros: string | number | boolean | Record<string, unknown> | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        parametros: string | number | boolean | Record<string, unknown> | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
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
        bloques: {
            procesos: {
                orden: number;
                codigo: string;
                nombre: string;
                centroCostoId: string | null;
                centroCostoNombre: string;
                setupMin: number;
                runMin: number;
                totalMin: number;
                tarifaHora: number;
                costo: number;
            }[];
            materiales: {
                materiaPrimaVarianteId: string;
                nombre: string;
                unidad: string;
                cantidad: number;
                costoUnitario: number;
                costoTotal: number;
            }[];
        };
        subtotales: {
            procesos: number;
            material: number;
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
            tipoImpresion: string;
            caras: string;
            multiplicadorCaras: number;
            estrategiaCosteo: "m2_exacto" | "largo_consumido" | "segmentos_placa";
            costeoDetalle: {
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
            resumenTecnico: {
                anchoMm: number;
                altoMm: number;
                placaAnchoMm: number;
                placaAltoMm: number;
                piezasPorPlaca: number;
                placasNecesarias: number;
                aprovechamientoPct: number;
                rotada: boolean;
                sobrantes: number;
            };
        };
        snapshotId: string;
    }>;
    previewVariant(_auth: CurrentAuth, _varianteId: string, _payload: PreviewImposicionProductoVarianteDto): Promise<void>;
}
