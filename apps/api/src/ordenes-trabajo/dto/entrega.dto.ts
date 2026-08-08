import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CrearCobroDto } from '../../administracion/dto/cobro.dto';

/** Resolver el código que salió del lector (o que se tecleó) a una orden. */
export class EscanearOrdenDto {
  @IsString()
  @MaxLength(40)
  codigo: string;
}

/** Quién se lleva el trabajo, cuando no es el cliente. */
export class RetiraTerceroDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  dni: string;
}

export class EntregarItemsDto {
  /** Qué se lleva el cliente ahora. Los demás quedan pendientes de retiro. */
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  itemIds: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RetiraTerceroDto)
  retiraTercero?: RetiraTerceroDto;

  /**
   * Cobro a registrar en el mismo acto. Va sin `ordenId` (lo pone el
   * endpoint) y pasa tal cual por CobrosService, con sus validaciones y su
   * recibo. Omitido = se entrega sin cobrar.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CrearCobroDto)
  cobro?: CrearCobroDto;
}

export class RevertirEntregaDto {
  /** Qué ítems vuelven a estar sin entregar. */
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  itemIds: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;
}
