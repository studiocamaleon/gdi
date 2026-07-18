import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

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
}
