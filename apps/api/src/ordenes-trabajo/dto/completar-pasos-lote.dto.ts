import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Ahorro de material CONCRETADO al consolidar la tanda (simulador gran
 * formato): el front calcula el nesting y el baseline cotizado; acá viaja
 * el resultado para persistirlo como valor generado por el sistema.
 */
export class AhorroConsolidacionDto {
  @IsOptional()
  @IsUUID()
  materiaPrimaId?: string;

  @IsString()
  @MaxLength(200)
  materiaPrimaNombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tecnologia?: string;

  @IsInt()
  @Min(1)
  jobs: number;

  @IsNumber()
  @Min(0)
  consumoSeparadoMl: number;

  @IsNumber()
  @Min(0)
  consumoConsolidadoMl: number;

  @IsNumber()
  ahorroMl: number;

  @IsOptional()
  @IsNumber()
  costoSeparado?: number;

  @IsOptional()
  @IsNumber()
  costoConsolidado?: number;

  @IsOptional()
  @IsNumber()
  ahorroPesos?: number;

  @IsOptional()
  @IsBoolean()
  baselineParcial?: boolean;
}

export class CompletarPasosLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  pasoIds: string[];

  /**
   * Cuánto duró la TANDA completa (opcional, D11): se prorratea entre los
   * pasos del lote por peso del estimado y queda como tiempo 'medido_lote'.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  duracionTandaMin?: number;

  /** Ahorro por consolidación de la tanda (simulador gran formato). */
  @IsOptional()
  @ValidateNested()
  @Type(() => AhorroConsolidacionDto)
  ahorro?: AhorroConsolidacionDto;
}
