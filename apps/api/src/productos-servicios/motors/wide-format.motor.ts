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

export class WideFormatMotorModule implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return this.service.getWideFormatMotorDefinition();
  }

  getProductConfig(auth: CurrentAuth, productoId: string) {
    return this.service.getWideFormatProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ) {
    return this.service.upsertWideFormatProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('El motor gran_formato@1 no usa overrides por variante en esta etapa.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('El motor gran_formato@1 no usa overrides por variante en esta etapa.');
  }

  async quoteVariant(_auth: CurrentAuth, _varianteId: string, _payload: CotizarProductoVarianteDto) {
    throw new BadRequestException('La cotización del motor gran_formato@1 todavía está en análisis.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('El preview técnico del motor gran_formato@1 todavía está en análisis.');
  }
}
