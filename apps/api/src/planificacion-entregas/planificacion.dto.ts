import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EntregaSolicitadaDto {
  @IsString() @MaxLength(80) clave!: string;
  @IsInt() @Min(1) @Max(1_000_000) cantidad!: number;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaSolicitada?: string;
}

export class SolicitarPlanEntregaDto {
  @IsUUID() idempotencyKey!: string;
  @IsInt() @Min(0) expectedVersion!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EntregaSolicitadaDto)
  entregas!: EntregaSolicitadaDto[];
}

export class ElegirPlanEntregaDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsUUID() revisionId!: string;
  @IsString() @MaxLength(80) alternativaId!: string;
  @IsOptional() @IsBoolean() aceptarAjusteNesting?: boolean;
  @IsOptional() @IsBoolean() aceptarCambioEntregas?: boolean;
}

export class EliminarPlanEntregaDto {
  @IsUUID() planId!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

/** Referencia a la distribución preparada antes del primer guardado de la OT. */
export class VincularPlanEntregaDto {
  @IsUUID() planId!: string;
  @IsUUID() revisionId!: string;
  @IsInt() @Min(0) expectedVersion!: number;
}

export class ReprogramarEntregasDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsUUID() revisionId!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ordenesExcluidas!: string[];
}
