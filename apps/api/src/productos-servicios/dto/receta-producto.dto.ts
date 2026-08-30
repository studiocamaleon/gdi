import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EtapaDesarrolloDocumento,
  PoliticaEjecucionRecetaComponente,
  PropositoArchivoMaestro,
  TipoAprobacionDocumento,
} from '@prisma/client';

export class RecetaDocumentoDto {
  @IsString()
  @Length(1, 100)
  codigo!: string;

  @IsString()
  @Length(1, 180)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pasoClave?: string | null;

  @IsEnum(PropositoArchivoMaestro)
  proposito!: PropositoArchivoMaestro;

  @IsEnum(EtapaDesarrolloDocumento)
  etapa!: EtapaDesarrolloDocumento;

  @IsOptional()
  @IsEnum(TipoAprobacionDocumento)
  tipoAprobacion?: TipoAprobacionDocumento | null;

  @IsOptional()
  @IsBoolean()
  requerido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000)
  orden?: number;
}

export class RecetaComponenteDto {
  @IsUUID()
  productoComponenteId!: string;

  @IsString()
  @Length(1, 100)
  codigo!: string;

  @IsString()
  @Length(1, 180)
  nombre!: string;

  @IsOptional()
  @IsEnum(PoliticaEjecucionRecetaComponente)
  politicaEjecucion?: PoliticaEjecucionRecetaComponente;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  formula?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  cantidad!: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  unidad?: string;

  @IsOptional()
  @IsBoolean()
  requerido?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10_000)
  orden?: number;
}

export class GuardarBorradorRecetaDto {
  @IsUUID()
  rutaAlternativaId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  cambios?: string;

  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecetaDocumentoDto)
  documentos?: RecetaDocumentoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecetaComponenteDto)
  componentes?: RecetaComponenteDto[];
}

export class PublicarRecetaDto {
  @IsISO8601()
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  cambios?: string;
}

export class DescartarBorradorRecetaDto {
  @IsISO8601()
  expectedUpdatedAt!: string;
}

export class DeprecarRecetaDto {
  @IsISO8601()
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  motivo?: string;
}
