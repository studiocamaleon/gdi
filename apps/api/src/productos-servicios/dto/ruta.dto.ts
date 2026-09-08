import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
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

export class NodoRutaWorkflowDto {
  @IsString()
  @Length(1, 160)
  clave!: string;

  @IsIn(['PASO', 'ETAPA', 'COMPONENTE'])
  tipo!: 'PASO' | 'ETAPA' | 'COMPONENTE';

  @IsInt()
  @Min(0)
  orden!: number;

  @IsOptional()
  @IsString()
  familiaCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombreVisible?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icono?: string;

  @IsOptional()
  @IsUUID()
  productoComponenteId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 180)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  requerido?: boolean;
}

export class AristaRutaWorkflowDto {
  @IsString()
  @Length(1, 160)
  desdeClave!: string;

  @IsString()
  @Length(1, 160)
  haciaClave!: string;
}

export class RutaWorkflowDto {
  @IsOptional()
  @IsInt()
  contractVersion?: 1;

  @IsOptional()
  @IsIn(['LINEAL', 'DAG'])
  topologia?: 'LINEAL' | 'DAG';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NodoRutaWorkflowDto)
  nodos!: NodoRutaWorkflowDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AristaRutaWorkflowDto)
  aristas!: AristaRutaWorkflowDto[];
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PasoRutaDto)
  pasos?: PasoRutaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RutaWorkflowDto)
  workflow?: RutaWorkflowDto;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => RutaWorkflowDto)
  workflow?: RutaWorkflowDto;

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
