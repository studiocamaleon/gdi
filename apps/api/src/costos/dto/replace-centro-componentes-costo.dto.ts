import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum CategoriaComponenteCostoCentroDto {
  sueldos = 'sueldos',
  cargas = 'cargas',
  mantenimiento = 'mantenimiento',
  energia = 'energia',
  alquiler = 'alquiler',
  amortizacion = 'amortizacion',
  tercerizacion = 'tercerizacion',
  insumos_indirectos = 'insumos_indirectos',
  otros = 'otros',
}

export enum OrigenComponenteCostoCentroDto {
  manual = 'manual',
  sugerido = 'sugerido',
}

export class CentroCostoComponenteCostoItemDto {
  @IsEnum(CategoriaComponenteCostoCentroDto)
  categoria: CategoriaComponenteCostoCentroDto;

  @IsString()
  nombre: string;

  @IsEnum(OrigenComponenteCostoCentroDto)
  origen: OrigenComponenteCostoCentroDto;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  importeMensual: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;
}

export class ReplaceCentroComponentesCostoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CentroCostoComponenteCostoItemDto)
  componentes: CentroCostoComponenteCostoItemDto[];
}
