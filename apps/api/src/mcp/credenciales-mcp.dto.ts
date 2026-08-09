import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearCredencialMcpDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  nombre!: string;

  /** Vacío/ausente = scopes de sólo-lectura para cotizar (default seguro). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsISO8601()
  expiraEl?: string | null;
}
