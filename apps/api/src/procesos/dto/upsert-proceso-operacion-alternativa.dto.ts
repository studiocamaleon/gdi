import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpsertProcesoOperacionAlternativaDto {
  /**
   * Fase D.1 — Opcional. Pasos manuales (diseño, embalaje, gestión externa)
   * pueden tener alternativas que solo varíen productividad/tiempo sin
   * involucrar máquina. Cuando es null, la alternativa es un override
   * puro de tiempo/productividad.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID('4')
  @Transform(({ value }) => (value === '' ? null : value))
  maquinaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  perfilOperativoId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsBoolean()
  esDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // P4.1 — Overrides opcionales respecto al paso base. Si null/undefined,
  // el super motor usa el valor del ProcesoOperacion padre.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  setupMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cleanupMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoFijoMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  productividadBase?: number | null;

  @IsOptional()
  @IsObject()
  configNestingV2?: Record<string, unknown> | null;
}
