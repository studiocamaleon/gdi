import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Una tanda: los pasos de un material y los anchos de rollo a comparar. */
export class SimularNestingGrupoDto {
  /** Identificador que el cliente usa para reconciliar la respuesta. */
  @IsString()
  @MaxLength(200)
  key!: string;

  /** Pasos `impresion_por_area` que entran al batch. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  pasoIds!: string[];

  /** Anchos de rollo a comparar (mm). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(100000, { each: true })
  anchosMm!: number[];
}

/**
 * Re-acomodo de las tandas del simulador GRAN FORMATO con el motor real.
 * Va en una sola llamada por interacción: el simulador necesita el acomodo de
 * todos los materiales de la tecnología a la vez para totalizar el ahorro.
 * Ver docs/simulador-impresion-diseno.md
 */
export class SimularNestingDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SimularNestingGrupoDto)
  grupos!: SimularNestingGrupoDto[];
}
