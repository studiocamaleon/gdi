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
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Defaults del taller; null limpia el campo. */
export class DefaultsPasoTenantDto {
  @IsOptional()
  @IsUUID()
  centroCostoId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  productividadHora?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tiempoFijoMin?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  demasiaMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  solapePanelMm?: number | null;

  @IsOptional()
  @IsBoolean()
  tercerizado?: boolean | null;

  @IsOptional()
  @IsUUID()
  proveedorId?: string | null;

  @IsOptional()
  @IsIn(['tarifa_magnitud', 'matriz', 'fijo'])
  fuenteCostoTercerizado?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
  @MaxLength(50)
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
  @MaxLength(50)
  icono?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultsPasoTenantDto)
  defaults?: DefaultsPasoTenantDto | null;
}
