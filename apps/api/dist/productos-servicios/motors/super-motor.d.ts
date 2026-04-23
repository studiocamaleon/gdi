import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';
export declare class SuperMotorModule implements ProductMotorModule {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getDefinition(): ProductMotorDefinition;
    getProductConfig(_auth: CurrentAuth, _productoId: string): Promise<void>;
    upsertProductConfig(_auth: CurrentAuth, _productoId: string, _payload: UpsertProductoMotorConfigDto): Promise<void>;
    getVariantOverride(_auth: CurrentAuth, _varianteId: string): Promise<void>;
    upsertVariantOverride(_auth: CurrentAuth, _varianteId: string, _payload: UpsertVarianteMotorOverrideDto): Promise<void>;
    previewVariant(_auth: CurrentAuth, _varianteId: string, _payload: PreviewImposicionProductoVarianteDto): Promise<void>;
    quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<CotizacionCanonica>;
    private quoteInternal;
    private resolverMedidasTrabajo;
    private resolverMaterialesSubProducto;
    private resolverMaterialMaquinaContext;
}
