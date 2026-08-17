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
  @Max(1_000_000)
  horasProductivas?: number;
}
