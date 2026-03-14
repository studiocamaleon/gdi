import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum MetodoDepreciacionMaquinaDto {
  lineal = 'lineal',
}

export class CentroCostoRecursoMaquinaPeriodoItemDto {
  @IsUUID()
  centroCostoRecursoId: string;

  @IsEnum(MetodoDepreciacionMaquinaDto)
  metodoDepreciacion: MetodoDepreciacionMaquinaDto;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorCompra: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorResidual: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  vidaUtilMeses: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  potenciaNominalKw: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  factorCargaPct: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  tarifaEnergiaKwh: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasProgramadasMes: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  disponibilidadPct: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  eficienciaPct: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mantenimientoMensual: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  segurosMensual: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otrosFijosMensual: number;
}

export class UpsertCentroRecursosMaquinariaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CentroCostoRecursoMaquinaPeriodoItemDto)
  recursos: CentroCostoRecursoMaquinaPeriodoItemDto[];
}
