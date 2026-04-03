import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CotizarProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
} from '../dto/productos-servicios.dto';

export type MotorCategory = 'digital_sheet' | 'wide_format' | 'vinyl_cut' | 'talonario';

export type ProductMotorCapabilities = {
  hasProductConfig: boolean;
  hasVariantOverride: boolean;
  hasPreview: boolean;
  hasQuote: boolean;
};

export type ProductMotorDefinition = {
  code: string;
  version: number;
  label: string;
  category: MotorCategory;
  capabilities: ProductMotorCapabilities;
  schema: Record<string, unknown>;
  exposedInCatalog: boolean;
};

export interface ProductMotorModule {
  getDefinition(): ProductMotorDefinition;
  getProductConfig(auth: CurrentAuth, productoId: string): Promise<unknown>;
  upsertProductConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ): Promise<unknown>;
  getVariantOverride(auth: CurrentAuth, varianteId: string): Promise<unknown>;
  upsertVariantOverride(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpsertVarianteMotorOverrideDto,
  ): Promise<unknown>;
  quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<unknown>;
  previewVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: PreviewImposicionProductoVarianteDto,
  ): Promise<unknown>;
}
