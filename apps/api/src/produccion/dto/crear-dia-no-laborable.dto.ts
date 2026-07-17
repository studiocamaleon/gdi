import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CrearDiaNoLaborableDto {
  /** Fecha calendario local del taller. */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  fecha: string;

  /** "Feriado nacional", "Vacaciones", "Inventario"… */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  descripcion?: string;
}
