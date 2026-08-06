/**
 * DTOs del CRUD de pasos del tenant (instancias de plantilla).
 *
 * La FORMA ya no se escribe —se hereda de la plantilla— así que acá sólo
 * queda identidad y defaults del taller.
 * docs/pasos-tenant-por-plantilla-diseno.md
 */
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Defaults del taller; null limpia el campo. */
export class DefaultsPasoTenantDto {
  @IsOptional()
  @IsString()
  centroCostoId?: string | null;

  @IsOptional()
  @IsNumber()
  productividadHora?: number | null;

  @IsOptional()
  @IsNumber()
  tiempoFijoMin?: number | null;

  @IsOptional()
  @IsNumber()
  demasiaMm?: number | null;

  @IsOptional()
  @IsNumber()
  solapePanelMm?: number | null;

  @IsOptional()
  @IsBoolean()
  tercerizado?: boolean | null;

  @IsOptional()
  @IsString()
  proveedorId?: string | null;

  @IsOptional()
  @IsString()
  fuenteCostoTercerizado?: string | null;

  @IsOptional()
  @IsNumber()
  plazoProveedorDias?: number | null;
}

export class CrearPasoTenantDto {
  @IsString()
  @MaxLength(80)
  nombre!: string;

  /** FamiliaCodigo del catálogo del que HEREDA la ficha. */
  @IsString()
  plantillaCodigo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  icono?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultsPasoTenantDto)
  defaults?: DefaultsPasoTenantDto | null;
}

export class ActualizarPasoTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsString()
  plantillaCodigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  icono?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultsPasoTenantDto)
  defaults?: DefaultsPasoTenantDto | null;
}
