import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export enum TipoCentroCostoDto {
  productivo = 'productivo',
  no_productivo = 'no_productivo',
}

export class UpsertCentroCostoDto {
  @IsUUID()
  plantaId: string;

  @IsString()
  @MinLength(1)
  codigo: string;

  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(TipoCentroCostoDto)
  tipoCentro: TipoCentroCostoDto;

  @IsBoolean()
  activo: boolean;
}
