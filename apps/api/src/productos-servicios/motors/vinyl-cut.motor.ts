import { BadRequestException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CotizarProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
} from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';

export class VinylCutMotorModule implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return this.service.getVinylCutMotorDefinition();
  }

  getProductConfig(auth: CurrentAuth, productoId: string) {
    return this.service.getVinylCutProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ) {
    return this.service.upsertVinylCutProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('El motor vinilo_de_corte@1 no usa overrides por variante en esta etapa.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('El motor vinilo_de_corte@1 no usa overrides por variante en esta etapa.');
  }

  quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto) {
    return this.service.quoteVinylCutVariant(auth, varianteId, payload);
  }

  previewVariant(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto) {
    return this.service.previewVinylCutVariant(auth, varianteId, payload);
  }
}
