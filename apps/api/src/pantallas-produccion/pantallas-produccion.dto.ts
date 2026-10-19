import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class VincularPantallaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[\s-]/g, '').toUpperCase()
      : value,
  )
  @Matches(/^[0-9A-HJKMNP-TV-Z]{8}$/)
  codigo!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre!: string;

  @IsInt()
  @Min(10)
  @Max(60)
  intervaloSegundos: number = 15;
}
