import {
  IsBoolean,
  IsEnum,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

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

export enum MinimoComercialPoliticaDto {
  NONE = 'NONE',
  ADVERTIR_FACTURAR_MINIMO = 'ADVERTIR_FACTURAR_MINIMO',
  BLOQUEAR = 'BLOQUEAR',
}

export enum MinimoComercialBaseDto {
  cantidad_comercial = 'cantidad_comercial',
  pliegos_impresos = 'pliegos_impresos',
}

export interface MedidaPredefinidaDto {
  id?: string;
  nombre?: string;
  anchoMm?: number;
  altoMm?: number;
  esDefault?: boolean;
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
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  subcategoriaComercialCodigo!: string;

  @IsEnum(UnidadComercialDto)
  unidadComercial!: UnidadComercialDto;

  @IsEnum(ModoMedidasDto)
  modoMedidas!: ModoMedidasDto;

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
  @IsArray()
  medidasPredefinidasJson?: MedidaPredefinidaDto[];

  @IsOptional()
  @IsArray()
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
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoriaComercialCodigo?: string;

  @IsOptional()
  @IsEnum(UnidadComercialDto)
  unidadComercial?: UnidadComercialDto;

  @IsOptional()
  @IsEnum(ModoMedidasDto)
  modoMedidas?: ModoMedidasDto;

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
  @IsArray()
  medidasPredefinidasJson?: MedidaPredefinidaDto[] | null;

  @IsOptional()
  @IsArray()
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
