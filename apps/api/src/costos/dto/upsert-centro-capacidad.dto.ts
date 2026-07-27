import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertCentroCapacidadDto {
  /**
   * Las horas productivas del período, cargadas a mano. Cuando viene, manda:
   * la fórmula de abajo (días × horas − % no productivo) queda como asistente
   * y se retira en F7. Ver docs/centros-de-costo-carga-manual-diseno.md
   */
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasProductivas?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  diasPorMes?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasPorDia?: number;

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
