import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ActualizarConfiguracionProduccionDto {
  /** Días hábiles (L-V no feriado) de colchón sobre la ETA. 0 = sin margen. */
  @IsInt()
  @Min(0)
  @Max(15)
  margenEtaDias: number;

  /** Minutos entre pasos por defecto, para estaciones sin el suyo. */
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempoEntrePasosMin?: number;

  /**
   * Hora local "HH:mm" de corte de jornada: los tramos de trabajo abiertos
   * se cierran solos a esta hora (registro-tiempos-produccion D9).
   */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'corteJornada debe ser una hora HH:mm (ej: 20:00).',
  })
  corteJornada?: string;
}
