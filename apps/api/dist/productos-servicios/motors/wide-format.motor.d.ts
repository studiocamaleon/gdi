import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class WideFormatMotorModule implements ProductMotorModule {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getDefinition(): ProductMotorDefinition;
    getProductConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray;
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
    quoteVariant(_auth: CurrentAuth, _varianteId: string, _payload: CotizarProductoVarianteDto): Promise<void>;
    previewVariant(_auth: CurrentAuth, _varianteId: string, _payload: PreviewImposicionProductoVarianteDto): Promise<void>;
}
