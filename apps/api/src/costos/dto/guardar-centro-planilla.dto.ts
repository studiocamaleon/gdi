import { Type } from 'class-transformer';
import {
  IsDateString,
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CentroCostoLineaItemDto } from './replace-centro-lineas.dto';
import { UpsertCentroCostoDto } from './upsert-centro-costo.dto';

/** Contrato único para guardar identidad, planilla, capacidad y publicación. */
export class GuardarCentroPlanillaDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  periodo: string;

  @ValidateNested()
  @Type(() => UpsertCentroCostoDto)
  centro: UpsertCentroCostoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(500)
  @Type(() => CentroCostoLineaItemDto)
  lineas: CentroCostoLineaItemDto[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasProductivas: number;

  /** Evita que dos administradores se pisen una ficha abierta en paralelo. */
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
