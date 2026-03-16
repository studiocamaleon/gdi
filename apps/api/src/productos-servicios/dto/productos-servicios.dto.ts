import {
  IsNumber,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Matches,
} from 'class-validator';

export enum TipoProductoServicioDto {
  producto = 'producto',
  servicio = 'servicio',
}

export enum EstadoProductoServicioDto {
  activo = 'activo',
  inactivo = 'inactivo',
}

export enum TipoImpresionProductoVarianteDto {
  bn = 'bn',
  cmyk = 'cmyk',
}

export enum CarasProductoVarianteDto {
  simple_faz = 'simple_faz',
  doble_faz = 'doble_faz',
}

export class UpsertFamiliaProductoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsBoolean()
  activo: boolean;
}

export class UpsertSubfamiliaProductoDto {
  @IsUUID()
  familiaProductoId: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  unidadComercial?: string;

  @IsBoolean()
  activo: boolean;
}

export class UpsertProductoServicioDto {
  @IsEnum(TipoProductoServicioDto)
  tipo: TipoProductoServicioDto;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motorCodigo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  motorVersion?: number;

  @IsUUID()
  familiaProductoId: string;

  @IsOptional()
  @IsUUID()
  subfamiliaProductoId?: string;

  @IsEnum(EstadoProductoServicioDto)
  estado: EstadoProductoServicioDto;

  @IsBoolean()
  activo: boolean;
}

export class CreateProductoVarianteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsNumber()
  @Min(1)
  anchoMm: number;

  @IsNumber()
  @Min(1)
  altoMm: number;

  @IsOptional()
  @IsUUID()
  papelVarianteId?: string;

  @IsEnum(TipoImpresionProductoVarianteDto)
  tipoImpresion: TipoImpresionProductoVarianteDto;

  @IsEnum(CarasProductoVarianteDto)
  caras: CarasProductoVarianteDto;

  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateProductoVarianteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  anchoMm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  altoMm?: number;

  @IsOptional()
  @IsUUID()
  papelVarianteId?: string;

  @IsOptional()
  @IsEnum(TipoImpresionProductoVarianteDto)
  tipoImpresion?: TipoImpresionProductoVarianteDto;

  @IsOptional()
  @IsEnum(CarasProductoVarianteDto)
  caras?: CarasProductoVarianteDto;

  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AssignVarianteRutaDto {
  @IsOptional()
  @IsUUID()
  procesoDefinicionId?: string;
}

export class UpdateProductoRutaPolicyDto {
  @IsBoolean()
  usarRutaComunVariantes: boolean;

  @IsOptional()
  @IsUUID()
  procesoDefinicionDefaultId?: string | null;
}

export class AssignProductoVariantesRutaMasivaDto {
  @IsUUID()
  procesoDefinicionId: string;

  @IsOptional()
  @IsBoolean()
  incluirInactivas?: boolean;
}

export class AssignProductoMotorDto {
  @IsString()
  @IsNotEmpty()
  motorCodigo: string;

  @IsNumber()
  @Min(1)
  motorVersion: number;
}

export class UpsertProductoMotorConfigDto {
  @IsObject()
  parametros: Record<string, unknown>;
}

export class UpsertVarianteMotorOverrideDto {
  @IsObject()
  parametros: Record<string, unknown>;
}

export class CotizarProductoVarianteDto {
  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo?: string;
}

export class PreviewImposicionProductoVarianteDto {
  @IsOptional()
  @IsObject()
  parametros?: Record<string, unknown>;
}
