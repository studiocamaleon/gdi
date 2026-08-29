import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const CAMPANA_ESTADOS = [
  'borrador',
  'activo',
  'pausado',
  'completado',
  'cancelado',
] as const;
export type CampanaEstado = (typeof CAMPANA_ESTADOS)[number];

export const CAMPANA_PRIORIDADES = [
  'baja',
  'normal',
  'alta',
  'critica',
] as const;
export type CampanaPrioridad = (typeof CAMPANA_PRIORIDADES)[number];

export const HITO_ESTADOS = [
  'pendiente',
  'en_curso',
  'completado',
  'cancelado',
] as const;
export type HitoEstado = (typeof HITO_ESTADOS)[number];

export class CampanasQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsIn(CAMPANA_ESTADOS)
  estado?: CampanaEstado;

  @IsOptional()
  @IsIn(CAMPANA_PRIORIDADES)
  prioridad?: CampanaPrioridad;

  @IsOptional()
  @IsUUID()
  responsableEmpleadoId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaDesde?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaHasta?: string;
}

export class CampanasOpcionesQueryDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class CampanaMiembroDto {
  @IsUUID()
  empleadoId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  funcion?: string;
}

export class CrearHitoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsUUID()
  responsableEmpleadoId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaObjetivo?: string;

  @IsOptional()
  @IsIn(HITO_ESTADOS)
  estado?: HitoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  notas?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class CrearCampanaDto {
  @IsUUID()
  clienteId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipo?: string;

  @IsOptional()
  @IsIn(CAMPANA_PRIORIDADES)
  prioridad?: CampanaPrioridad;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaInicio?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaObjetivo?: string;

  @IsOptional()
  @IsUUID()
  responsableEmpleadoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observaciones?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampanaMiembroDto)
  equipo?: CampanaMiembroDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CrearHitoDto)
  hitos?: CrearHitoDto[];
}

export class EditarCampanaDto {
  @IsISO8601()
  updatedAt!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipo?: string | null;

  @IsOptional()
  @IsIn(CAMPANA_PRIORIDADES)
  prioridad?: CampanaPrioridad;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaInicio?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaObjetivo?: string | null;

  @IsOptional()
  @IsUUID()
  responsableEmpleadoId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observaciones?: string | null;
}

export class CambiarEstadoCampanaDto {
  @IsIn(CAMPANA_ESTADOS)
  estado!: CampanaEstado;

  @IsISO8601()
  updatedAt!: string;
}

export class EditarHitoDto {
  @IsISO8601()
  updatedAt!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @IsOptional()
  @IsUUID()
  responsableEmpleadoId?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaObjetivo?: string | null;

  @IsOptional()
  @IsIn(HITO_ESTADOS)
  estado?: HitoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  notas?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;
}

export class ReemplazarEquipoDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CampanaMiembroDto)
  equipo!: CampanaMiembroDto[];
}
