import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CotizarProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
} from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';

export class DigitalSheetMotorModule implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return this.service.getDigitalMotorDefinition();
  }

  getProductConfig(auth: CurrentAuth, productoId: string) {
    return this.service.getDigitalProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ) {
    return this.service.upsertDigitalProductMotorConfig(auth, productoId, payload);
  }

  getVariantOverride(auth: CurrentAuth, varianteId: string) {
    return this.service.getDigitalVariantMotorOverride(auth, varianteId);
  }

  upsertVariantOverride(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpsertVarianteMotorOverrideDto,
  ) {
    return this.service.upsertDigitalVariantMotorOverride(auth, varianteId, payload);
  }

  quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto) {
    return this.service.quoteDigitalVariant(auth, varianteId, payload);
  }

  previewVariant(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto) {
    return this.service.previewDigitalVariant(auth, varianteId, payload);
  }
}
