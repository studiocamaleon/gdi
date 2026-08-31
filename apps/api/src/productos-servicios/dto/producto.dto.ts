import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsArray,
  ArrayUnique,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UnidadComercialDto {
  unidad = 'unidad',
  m2 = 'm2',
  metro_lineal = 'metro_lineal',
}

export enum ModoMedidasDto {
  FIJA = 'FIJA',
  LIBRE = 'LIBRE',
  COMERCIAL_ELIGE = 'COMERCIAL_ELIGE',
  MIXTA = 'MIXTA',
}

export enum DimensionProductoDto {
  ANCHO = 'ANCHO',
  ALTO = 'ALTO',
  PROFUNDIDAD = 'PROFUNDIDAD',
}

export enum EstructuraProductoDto {
  SIMPLE = 'SIMPLE',
  COMPUESTO = 'COMPUESTO',
}

export enum MinimoComercialPoliticaDto {
  NONE = 'NONE',
  ADVERTIR_FACTURAR_MINIMO = 'ADVERTIR_FACTURAR_MINIMO',
  BLOQUEAR = 'BLOQUEAR',
}

export enum MinimoComercialBaseDto {
  cantidad_comercial = 'cantidad_comercial',
  pliegos_impresos = 'pliegos_impresos',
}

export class MedidaPredefinidaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  anchoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  altoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  profundidadMm?: number;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean;
  /** "pliego_util" = plancha completa: la pieza se deriva del pliego del paso
   *  de impresión en el sheet (área útil). Ausente = medida fija. */
  @IsOptional()
  @IsEnum(['fija', 'pliego_util'])
  tipo?: 'fija' | 'pliego_util';
}

export class CrearProductoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Código solo letras/números/_/-, sin espacios',
  })
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(EstructuraProductoDto)
  estructuraProducto?: EstructuraProductoDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subcategoriaComercialCodigo!: string;

  @IsEnum(UnidadComercialDto)
  unidadComercial!: UnidadComercialDto;

  @IsEnum(ModoMedidasDto)
  modoMedidas!: ModoMedidasDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(DimensionProductoDto, { each: true })
  dimensionesRequeridas?: DimensionProductoDto[];

  @IsOptional()
  @IsEnum(MinimoComercialPoliticaDto)
  minimoComercialPolitica?: MinimoComercialPoliticaDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimoComercialCantidad?: number | null;

  @IsOptional()
  @IsEnum(MinimoComercialBaseDto)
  minimoComercialBase?: MinimoComercialBaseDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAnchoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAltoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultProfundidadMm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MedidaPredefinidaDto)
  medidasPredefinidasJson?: MedidaPredefinidaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  personalizacionesJson?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  precioConfigJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  atributosComercialesJson?: Record<string, unknown>;
}

export class ActualizarProductoDto {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(EstructuraProductoDto)
  estructuraProducto?: EstructuraProductoDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subcategoriaComercialCodigo?: string;

  @IsOptional()
  @IsEnum(UnidadComercialDto)
  unidadComercial?: UnidadComercialDto;

  @IsOptional()
  @IsEnum(ModoMedidasDto)
  modoMedidas?: ModoMedidasDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(DimensionProductoDto, { each: true })
  dimensionesRequeridas?: DimensionProductoDto[];

  @IsOptional()
  @IsEnum(MinimoComercialPoliticaDto)
  minimoComercialPolitica?: MinimoComercialPoliticaDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimoComercialCantidad?: number | null;

  @IsOptional()
  @IsEnum(MinimoComercialBaseDto)
  minimoComercialBase?: MinimoComercialBaseDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAnchoMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAltoMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultProfundidadMm?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MedidaPredefinidaDto)
  medidasPredefinidasJson?: MedidaPredefinidaDto[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  personalizacionesJson?: Record<string, unknown>[] | null;

  @IsOptional()
  @IsObject()
  precioConfigJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  atributosComercialesJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DuplicarProductoDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Código solo letras/números/_/-, sin espacios',
  })
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
