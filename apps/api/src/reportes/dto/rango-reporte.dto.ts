import { IsOptional, IsString, Matches } from 'class-validator';

/** Rango de todo endpoint del Panel. Sin fechas → mes en curso. */
export class RangoReporteDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '"desde" debe ser YYYY-MM-DD.' })
  desde?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '"hasta" debe ser YYYY-MM-DD.' })
  hasta?: string;
}
