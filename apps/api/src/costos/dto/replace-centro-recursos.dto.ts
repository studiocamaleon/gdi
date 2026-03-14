import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum TipoRecursoCentroCostoDto {
  empleado = 'empleado',
  maquinaria = 'maquinaria',
  gasto_general = 'gasto_general',
  activo_fijo = 'activo_fijo',
}

export enum TipoGastoGeneralCentroCostoDto {
  limpieza = 'limpieza',
  mantenimiento = 'mantenimiento',
  servicios = 'servicios',
  alquiler = 'alquiler',
  otro = 'otro',
}

export class CentroCostoRecursoItemDto {
  @IsEnum(TipoRecursoCentroCostoDto)
  tipoRecurso: TipoRecursoCentroCostoDto;

  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @IsOptional()
  @IsUUID()
  maquinaId?: string;

  @IsOptional()
  @IsString()
  nombreRecurso?: string;

  @IsOptional()
  @IsEnum(TipoGastoGeneralCentroCostoDto)
  tipoGastoGeneral?: TipoGastoGeneralCentroCostoDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMensual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  vidaUtilRestanteMeses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorFinalVida?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentajeAsignacion?: number;

  @IsBoolean()
  activo: boolean;
}

export class ReplaceCentroRecursosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CentroCostoRecursoItemDto)
  recursos: CentroCostoRecursoItemDto[];
}
