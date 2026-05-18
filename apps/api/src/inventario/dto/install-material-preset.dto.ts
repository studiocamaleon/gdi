import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UnidadMateriaPrimaDto } from './upsert-materia-prima.dto';

export enum ModoDuplicadoMaterialPresetDto {
  agregar_faltantes = 'agregar_faltantes',
  crear_separado = 'crear_separado',
}

export class InstallMaterialPresetCustomVariantDto {
  @IsString()
  @MinLength(1)
  sku: string;

  @IsOptional()
  @IsString()
  nombreVariante?: string;

  @IsObject()
  atributosVariante: Record<string, unknown>;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadStock?: UnidadMateriaPrimaDto;

  @IsOptional()
  @IsEnum(UnidadMateriaPrimaDto)
  unidadCompra?: UnidadMateriaPrimaDto;
}

export class InstallMaterialPresetDto {
  @IsString()
  @MinLength(1)
  visibleName: string;

  @IsString()
  @MinLength(1)
  codigo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  aliasUsado?: string;

  @IsArray()
  @IsString({ each: true })
  variantPresetIds: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallMaterialPresetCustomVariantDto)
  customVariants?: InstallMaterialPresetCustomVariantDto[];

  @IsEnum(ModoDuplicadoMaterialPresetDto)
  modoDuplicado: ModoDuplicadoMaterialPresetDto;
}
