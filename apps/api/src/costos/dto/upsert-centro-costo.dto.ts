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
  apoyo = 'apoyo',
  administrativo = 'administrativo',
  comercial = 'comercial',
  logistico = 'logistico',
  tercerizado = 'tercerizado',
}

export enum ImputacionPreferidaCentroCostoDto {
  directa = 'directa',
  indirecta = 'indirecta',
  reparto = 'reparto',
}

export enum UnidadBaseCentroCostoDto {
  ninguna = 'ninguna',
  hora_maquina = 'hora_maquina',
  hora_hombre = 'hora_hombre',
  pliego = 'pliego',
  unidad = 'unidad',
  m2 = 'm2',
  kg = 'kg',
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

  @IsEnum(ImputacionPreferidaCentroCostoDto)
  imputacionPreferida: ImputacionPreferidaCentroCostoDto;

  @IsEnum(UnidadBaseCentroCostoDto)
  unidadBaseFutura: UnidadBaseCentroCostoDto;

  @IsBoolean()
  activo: boolean;
}
