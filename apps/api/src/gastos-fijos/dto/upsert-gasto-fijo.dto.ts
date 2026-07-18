import { CategoriaGastoFijo } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 'YYYY-MM' */
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Alta y edición de un gasto fijo de estructura comparten este DTO. */
export class UpsertGastoFijoDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsEnum(CategoriaGastoFijo)
  categoria: CategoriaGastoFijo;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  importeMensual: number;

  @IsString()
  @Matches(PERIODO_RE, { message: 'vigenteDesde debe tener formato YYYY-MM' })
  vigenteDesde: string;

  @IsOptional()
  @IsString()
  @Matches(PERIODO_RE, { message: 'vigenteHasta debe tener formato YYYY-MM' })
  vigenteHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  notas?: string;
}
