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

export class RigidPrintedMotorModule implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return this.service.getRigidPrintedMotorDefinition();
  }

  getProductConfig(auth: CurrentAuth, productoId: string) {
    return this.service.getRigidPrintedProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ) {
    return this.service.upsertRigidPrintedProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('El motor rigidos_impresos@1 no usa overrides por variante.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('El motor rigidos_impresos@1 no usa overrides por variante.');
  }

  async quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto) {
    return this.service.quoteRigidPrintedVariant(auth, varianteId, payload);
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('El preview del motor rigidos_impresos@1 está en desarrollo.');
  }
}
