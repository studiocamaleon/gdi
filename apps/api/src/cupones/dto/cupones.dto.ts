import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const CUPON_TIPOS = ['PORCENTAJE', 'MONTO'] as const;
export const CUPON_ALCANCES = [
  'ORDEN',
  'CATEGORIA',
  'SUBCATEGORIA',
  'PRODUCTO',
  'CLIENTE',
] as const;

export class CrearCuponDto {
  /** Tecleable/escaneable: letras, números y guiones. Se normaliza a MAYÚS. */
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'El código sólo admite letras, números y guiones.',
  })
  codigo: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @IsIn(CUPON_TIPOS)
  tipo: (typeof CUPON_TIPOS)[number];

  @IsNumber()
  @Min(0.01)
  valor: number;

  @IsOptional()
  @IsIn(CUPON_ALCANCES)
  alcanceTipo?: (typeof CUPON_ALCANCES)[number];

  /** Código de categoría/subcategoría, id de producto o de cliente. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  alcanceRef?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMinimo?: number;

  @IsOptional()
  @IsISO8601()
  vigenciaDesde?: string;

  @IsOptional()
  @IsISO8601()
  vigenciaHasta?: string;

  /** null/ausente = ilimitado; 1 = un solo uso (sorteo). */
  @IsOptional()
  @IsInt()
  @Min(1)
  usoMax?: number;
}

/**
 * El CÓDIGO no se edita: es la identidad del cupón y ya puede estar impreso
 * en QRs circulando. Para otro código, otro cupón.
 */
export class ActualizarCuponDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @IsOptional()
  @IsIn(CUPON_TIPOS)
  tipo?: (typeof CUPON_TIPOS)[number];

  @IsOptional()
  @IsIn(CUPON_ALCANCES)
  alcanceTipo?: (typeof CUPON_ALCANCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  alcanceRef?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMinimo?: number | null;

  @IsOptional()
  @IsISO8601()
  vigenciaDesde?: string | null;

  @IsOptional()
  @IsISO8601()
  vigenciaHasta?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  usoMax?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ItemCarritoDto {
  @IsString()
  @MaxLength(80)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoriaCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategoriaCodigo?: string;

  @IsNumber()
  @Min(0)
  neto: number;
}

/** Validar un código contra el carrito actual de la ficha. */
export class ValidarCuponDto {
  @IsString()
  @MaxLength(40)
  codigo: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemCarritoDto)
  @ArrayMaxSize(100)
  items: ItemCarritoDto[];
}
