import { Type } from 'class-transformer';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';

/**
 * SM.1.d — Variante habilitada como candidata para nesting cuando el material
 * padre tiene `esSustratoNesting=true`. El motor itera estas variantes,
 * corre el algoritmo (ej. nesting-rollo) por cada una y elige la mejor.
 */
export class UpsertProcesoOperacionMaterialVarianteDto {
  @IsUUID('4')
  materiaPrimaVarianteId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

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

  /**
   * Sub-producto consumido como insumo (recursión en super motor). Si está
   * seteado, `materiaPrimaVarianteId` debe ser null: un material es o stock
   * o sub-producto, no ambos. El service valida esta invariante.
   */
  @IsOptional()
  @IsUUID('4')
  productoComponenteId?: string | null;

  /** Variante específica del sub-producto. Solo válido si productoComponenteId está seteado. */
  @IsOptional()
  @IsUUID('4')
  varianteComponenteId?: string | null;

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

  /**
   * SM.1.d — Marca este material como SUSTRATO del nesting del paso. Cuando
   * es true, el motor itera `variantesHabilitadas` (en lugar de usar
   * `materiaPrimaVarianteId`) y elige la mejor por criterio.
   * Reglas validadas en service:
   *   - Máximo 1 material por paso puede tener `esSustratoNesting=true`
   *   - Solo aplica si `familiaV2` del paso produce nesting
   *   - Si true, se requiere al menos 1 variante en `variantesHabilitadas`
   */
  @IsOptional()
  @IsBoolean()
  esSustratoNesting?: boolean;

  /**
   * Variantes habilitadas. Solo se persisten cuando `esSustratoNesting=true`.
   * Cada elemento es una variante de la misma materia prima padre.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertProcesoOperacionMaterialVarianteDto)
  variantesHabilitadas?: UpsertProcesoOperacionMaterialVarianteDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
