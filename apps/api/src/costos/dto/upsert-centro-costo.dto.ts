import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum TipoCentroCostoDto {
  productivo = 'productivo',
  no_productivo = 'no_productivo',
}

export class UpsertCentroCostoDto {
  /**
   * Opcional: la ficha dejó de preguntarla. Si no viene se resuelve la única
   * planta del tenant, o se crea una. La columna sigue siendo obligatoria en la
   * base porque Maquinaria la necesita.
   */
  @IsOptional()
  @IsUUID()
  plantaId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  codigo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsEnum(TipoCentroCostoDto)
  tipoCentro: TipoCentroCostoDto;

  @IsBoolean()
  activo: boolean;
}
