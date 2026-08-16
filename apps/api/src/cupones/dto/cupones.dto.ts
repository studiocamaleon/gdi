import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
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
export const CUPON_ESTADOS = [
  'VIGENTE',
  'PAUSADO',
  'VENCIDO',
  'AGOTADO',
  'PROGRAMADO',
] as const;

const FECHA_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONTO = 999_999_999_999.99;

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
  @Max(MAX_MONTO)
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
  @Max(MAX_MONTO)
  montoMinimo?: number;

  @IsOptional()
  @Matches(FECHA_DIA, { message: 'La fecha debe usar YYYY-MM-DD.' })
  vigenciaDesde?: string;

  @IsOptional()
  @Matches(FECHA_DIA, { message: 'La fecha debe usar YYYY-MM-DD.' })
  vigenciaHasta?: string;

  /** null/ausente = ilimitado; 1 = un solo uso (sorteo). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  usoMax?: number;
}

/**
 * El CÓDIGO no se edita: es la identidad del cupón y ya puede estar impreso
 * en QRs circulando. Para otro código, otro cupón.
 */
export class ActualizarCuponDto {
  /** Versión que el editor leyó. Evita pisar cambios de otro supervisor. */
  @IsInt()
  @Min(1)
  version: number;

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
  @Max(MAX_MONTO)
  valor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MONTO)
  montoMinimo?: number | null;

  @IsOptional()
  @Matches(FECHA_DIA, { message: 'La fecha debe usar YYYY-MM-DD.' })
  vigenciaDesde?: string | null;

  @IsOptional()
  @Matches(FECHA_DIA, { message: 'La fecha debe usar YYYY-MM-DD.' })
  vigenciaHasta?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  usoMax?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmarUsoMaxMenor?: boolean;
}

export class ListarCuponesDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busqueda?: string;

  @IsOptional()
  @IsIn(CUPON_ESTADOS)
  estado?: (typeof CUPON_ESTADOS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
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
  productoCodigo?: string;

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
  @Max(MAX_MONTO)
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
