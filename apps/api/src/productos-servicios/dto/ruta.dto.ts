import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombreVisible?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icono?: string;
}

export class CrearRutaDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9_-]+$/)
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
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
  @ArrayMinSize(1)
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
  @MaxLength(500)
  cambios?: string;
}

export class DuplicarRutaDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9_-]+$/)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class MigrarProductosRutaDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  rutaAlternativaIds!: string[];
}
