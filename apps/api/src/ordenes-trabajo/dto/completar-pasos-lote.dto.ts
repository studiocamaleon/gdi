import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Ahorro de material CONCRETADO al consolidar la tanda (simulador gran
 * formato): el navegador sólo declara el rollo elegido. El servidor vuelve a
 * calcular el nesting, el baseline y los importes antes de persistirlos.
 */
export class AhorroConsolidacionDto {
  @IsUUID()
  varianteId: string;

  /** Ancho realmente elegido por el operador. El servidor vuelve a correr el
   * nesting y calcula consumos/costos; ningún importe del navegador se confía. */
  @IsNumber()
  @Min(1)
  @Max(100000)
  anchoMm: number;
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

  /**
   * El simulador láser pide una validación atómica adicional: todos los pasos
   * deben seguir en frontera y compartir máquina, variante, gramaje, pliego,
   * color y caras antes de que se complete el primero.
   */
  @IsOptional()
  @IsBoolean()
  validarCompatibilidadLaser?: boolean;

  /** Ahorro por consolidación de la tanda (simulador gran formato). */
  @IsOptional()
  @ValidateNested()
  @Type(() => AhorroConsolidacionDto)
  ahorro?: AhorroConsolidacionDto;
}
