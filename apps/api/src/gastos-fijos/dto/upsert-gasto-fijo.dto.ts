import { FrecuenciaGastoFijo } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 'YYYY-MM' */
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ProgramacionGastoFijoDto {
  @IsBoolean()
  activa: boolean;

  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimiento: number;

  @Matches(PERIODO_RE)
  desde: string;
}

/** Alta y edición de un gasto fijo de estructura comparten este DTO. */
export class UpsertGastoFijoDto {
  /** Opt-in: omitirlo conserva la programación existente; nunca crea una. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ProgramacionGastoFijoDto)
  programacion?: ProgramacionGastoFijoDto;

  @IsString()
  @MinLength(1)
  nombre: string;

  /** Del catálogo compartido con Cuentas por pagar, naturaleza GASTO_ESTRUCTURA. */
  @IsUUID()
  categoriaEgresoId: string;

  /**
   * El valor de UNA cuota. El importe mensual lo deriva el servidor cruzándolo
   * con la frecuencia: si viajara ya prorrateado, el formulario mostraría un
   * número distinto del que el usuario cargó.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor: number;

  @IsEnum(FrecuenciaGastoFijo)
  frecuencia: FrecuenciaGastoFijo;

  /** El "Favorecido": a quién se le paga. */
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @IsOptional()
  @IsUUID()
  metodoPagoId?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsString()
  @Matches(PERIODO_RE, { message: 'vigenteDesde debe tener formato YYYY-MM' })
  vigenteDesde: string;

  @IsOptional()
  @IsString()
  @Matches(PERIODO_RE, { message: 'vigenteHasta debe tener formato YYYY-MM' })
  vigenteHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  notas?: string;
}
