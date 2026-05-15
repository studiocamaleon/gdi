import {
  IsBoolean,
  IsEnum,
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
}

export class CrearProductoDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Código solo letras/números/_/-, sin espacios',
  })
  codigo!: string;

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
  @IsNumber()
  @Min(0)
  medidaDefaultAnchoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAltoMm?: number;

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
  @IsNumber()
  @Min(0)
  medidaDefaultAnchoMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  medidaDefaultAltoMm?: number | null;

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
