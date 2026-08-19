import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const FRECUENCIAS_RECURRENTE = [
  'mensual',
  'bimestral',
  'trimestral',
  'semestral',
  'anual',
] as const;

export const FRECUENCIA_LABELS: Record<string, string> = {
  mensual: 'Mensual',
  bimestral: 'Cada 2 meses',
  trimestral: 'Cada 3 meses',
  semestral: 'Cada 6 meses',
  anual: 'Anual',
};

/** 'YYYY-MM'. */
const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CrearRecurrenteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  descripcion: string;

  @IsUUID()
  categoriaEgresoId: string;

  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  /** Una SUGERENCIA: la luz no viene igual dos meses seguidos. */
  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @IsOptional()
  @IsUUID()
  metodoPagoId?: string;

  @IsOptional()
  @IsIn(FRECUENCIAS_RECURRENTE)
  frecuencia?: string;

  /** 1-31, con clamp a fin de mes corto. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimiento?: number;

  @Matches(PERIODO, { message: 'El período va como YYYY-MM.' })
  vigenteDesde: string;

  @IsOptional()
  @Matches(PERIODO, { message: 'El período va como YYYY-MM.' })
  vigenteHasta?: string;

  /** El puente con el presupuestado del costeo. */
  @IsOptional()
  @IsUUID()
  gastoFijoEstructuraId?: string | null;
}

export class EditarRecurrenteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaVencimiento?: number;

  @IsOptional()
  @Matches(PERIODO, { message: 'El período va como YYYY-MM.' })
  vigenteHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsUUID()
  gastoFijoEstructuraId?: string | null;
}
