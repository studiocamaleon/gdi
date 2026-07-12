import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertCentroCapacidadDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  diasPorMes: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasPorDia: number;

  /**
   * % de tiempo NO productivo (descansos, setup general, limpieza, ausentismo,
   * paradas). La capacidad práctica = teórica × (1 − %/100).
   */
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentajeNoProductivo?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overrideManualCapacidad?: number;
}
