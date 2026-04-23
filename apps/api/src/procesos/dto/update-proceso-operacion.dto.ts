import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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

/**
 * P1.5 — Update parcial de un paso (ProcesoOperacion).
 *
 * Sólo expone los campos editables desde el tab "Ruta de producción". Los
 * campos referenciales (centroCosto, maquina, perfil) usan convención:
 *   - `undefined` → no tocar el campo.
 *   - `null` → limpiar el campo (aplica sólo donde la DB lo permite).
 */
export class UpdateProcesoOperacionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  esOpcional?: boolean;

  @IsOptional()
  @IsIn(['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'])
  activacionV2?: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  familiaV2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unidadProductivaV2?: string;

  @IsOptional()
  @IsUUID('4')
  centroCostoId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID('4')
  @Transform(({ value }) => (value === '' ? null : value))
  maquinaId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID('4')
  @Transform(({ value }) => (value === '' ? null : value))
  perfilOperativoId?: string | null;

  /**
   * Fase C — herencia plantilla→paso. Cuando se setea, los campos
   * `productividadBase`, `setupMin`, `cleanupMin`, `tiempoFijoMin` que
   * estén en `null` heredan automáticamente el valor declarado en la
   * plantilla. `null` desasocia el paso de la plantilla. `undefined`
   * no toca el vínculo actual.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID('4')
  @Transform(({ value }) => (value === '' ? null : value))
  plantillaOrigenId?: string | null;

  // Fase C — los campos numéricos aceptan `null` para indicar "limpiar
  // override y heredar de la plantilla origen" (cuando exista).
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  setupMin?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cleanupMin?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tiempoFijoMin?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  productividadBase?: number | null;

  /**
   * Fase D.2 — Unidad de tiempo de la productividad. El motor convierte a
   * minutos internamente: HORA → ×60, SEGUNDO → /60, MINUTO → literal.
   */
  @IsOptional()
  @IsIn(['HORA', 'MINUTO', 'SEGUNDO'])
  unidadTiempo?: 'HORA' | 'MINUTO' | 'SEGUNDO';

  /**
   * Expresión JsonLogic para la activación CONDICIONAL. `null` limpia la
   * condición; ausente (undefined) no toca el campo.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  condicionV2?: Record<string, unknown> | null;

  /**
   * Configuración del algoritmo de nesting que aplica a este paso. El shape
   * varía según `familiaV2` (ver `nesting-runner.ts`):
   *   - impresion_por_hoja  → { pliegos[], margenMm, separacionHMm, separacionVMm, permitirRotacion, criterio }
   *   - impresion_por_area  → { printableWidthMm, marginLeftMm, marginStartMm, marginEndMm, separacionHorizontalMm, separacionVerticalMm, permitirRotacion, panelizado{} }
   *   - impresion_por_pieza → { placaAnchoMm, placaAltoMm, margenMm, separacionHMm, separacionVMm, permitirRotacion }
   * `null` limpia la config; ausente no toca el campo.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  configNestingV2?: Record<string, unknown> | null;
}
