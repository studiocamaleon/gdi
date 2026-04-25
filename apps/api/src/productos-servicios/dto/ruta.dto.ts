import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PasoRutaDto {
  @IsInt()
  @Min(1)
  orden!: number;

  @IsString()
  @IsNotEmpty()
  familiaCodigo!: string;
}

export class CrearRutaDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9_\-]+$/)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PasoRutaDto)
  pasos!: PasoRutaDto[];
}

export class ActualizarRutaDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /**
   * Si se envían pasos, REEMPLAZAN completamente los actuales.
   * IMPORTANTE: si la ruta tiene productos asociados, el reemplazo de pasos
   * podría romper la configuración de esos productos. El service valida
   * y/o crea una nueva versión.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PasoRutaDto)
  pasos?: PasoRutaDto[];

  /**
   * Si true (default false), guardar como nueva versión en vez de patch in-place.
   * Heurística: cambios estructurales (pasos) → sugerir nueva versión.
   */
  @IsOptional()
  @IsBoolean()
  nuevaVersion?: boolean;

  @IsOptional()
  @IsString()
  cambios?: string;
}
