import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** `HH:MM` en 24 h. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lista ISO separada por comas: `1,2,3,4,5`. Vacío = ningún día. */
const DIAS = /^$|^[1-7](,[1-7])*$/;

export class CambiarConfigDto {
  /** Freno de mano: corta todos los envíos sin perder la configuración. */
  @IsOptional()
  @IsBoolean()
  pausado?: boolean;

  @IsOptional()
  @IsString()
  @Matches(HORA, { message: 'La hora de inicio tiene que ser HH:MM.' })
  horaDesde?: string;

  @IsOptional()
  @IsString()
  @Matches(HORA, { message: 'La hora de fin tiene que ser HH:MM.' })
  horaHasta?: string;

  /**
   * Días con el local abierto al público (1 = lunes … 7 = domingo).
   *
   * Se valida el formato acá y no el orden ni los repetidos: el service los
   * mete en un Set, así que `3,1,1` es lo mismo que `1,3`.
   */
  @IsOptional()
  @IsString()
  @Matches(DIAS, {
    message: 'Los días tienen que ser números del 1 al 7 separados por comas.',
  })
  diasAtencion?: string;

  /**
   * Cuántos días después de entregada se pide la reseña.
   *
   * El techo son 30 y no es arbitrario: el barrido mira una ventana de diez
   * días hacia atrás, así que un plazo más largo que el historial del campo
   * sólo produciría una función que no manda nada y nadie sabría por qué.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'El plazo no puede ser negativo.' })
  @Max(30, { message: 'El plazo no puede pasar de 30 días.' })
  resenaDiasDespues?: number;
}

export class CambiarEventoDto {
  @IsBoolean()
  activo!: boolean;
}
