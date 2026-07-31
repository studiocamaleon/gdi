import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Categorías fiscales soportadas para el IVA por producto (Fase 2, AR).
 * 'general' resuelve a la fila de IVA general del catálogo (default);
 * 'exento' no lleva IVA. 'reducida' queda para más adelante.
 */
export const CATEGORIAS_FISCALES = ['general', 'exento'] as const;

/** Setea la categoría fiscal del producto (dispara la resolución del IVA). */
export class CategoriaFiscalDto {
  @IsIn(CATEGORIAS_FISCALES)
  categoriaFiscal!: (typeof CATEGORIAS_FISCALES)[number];
}

/**
 * Asociar UN impuesto del catálogo al producto.
 * Para asociar varios en una sola pasada, usar AsignarImpuestosBatchDto (replace-all).
 */
export class AsignarImpuestoDto {
  @IsUUID()
  impuestoCatalogoId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class AsignarComisionDto {
  @IsUUID()
  comisionCatalogoId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

/**
 * Replace-all batch: setea la lista completa de impuestos del producto.
 * Operación atómica — borra los que no estén en la lista, agrega los nuevos,
 * actualiza el orden de los existentes.
 */
export class AsignarImpuestosBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignarImpuestoDto)
  items!: AsignarImpuestoDto[];
}

export class AsignarComisionesBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignarComisionDto)
  items!: AsignarComisionDto[];
}
