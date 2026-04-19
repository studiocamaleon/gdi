import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MATERIAL_FORMULAS = [
  'por_unidad_productiva',
  'por_m2',
  'por_pieza',
  'por_metro_lineal',
  'fijo',
] as const;

export type MaterialFormula = (typeof MATERIAL_FORMULAS)[number];

export class UpsertProcesoOperacionMaterialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsUUID('4')
  materiaPrimaVarianteId?: string | null;

  @IsIn(MATERIAL_FORMULAS)
  formula!: MaterialFormula;

  @IsNumber()
  @Min(0)
  cantidadPorUnidad!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unidad!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioManual?: number | null;

  @IsOptional()
  @IsBoolean()
  aplicaMultiCaras?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
