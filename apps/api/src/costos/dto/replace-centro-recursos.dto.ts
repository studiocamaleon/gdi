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
  proveedor = 'proveedor',
  gasto_manual = 'gasto_manual',
}

export class CentroCostoRecursoItemDto {
  @IsEnum(TipoRecursoCentroCostoDto)
  tipoRecurso: TipoRecursoCentroCostoDto;

  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @IsOptional()
  @IsString()
  nombreManual?: string;

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
