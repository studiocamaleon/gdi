import { IsInt, Max, Min } from 'class-validator';

export class ActualizarConfiguracionProduccionDto {
  /** Días hábiles (L-V no feriado) de colchón sobre la ETA. 0 = sin margen. */
  @IsInt()
  @Min(0)
  @Max(15)
  margenEtaDias: number;
}
