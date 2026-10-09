import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const RETENCION_REGIMENES = [
  'SIRCREB',
  'SIRTAC',
  'SIRCUPA',
  'IIBB_CONVENIO',
  'SICORE_GANANCIAS',
  'IVA_RG2854',
  'PERCEPCION_IIBB',
  'otro',
] as const;

export class RetencionLineaDto {
  @IsOptional()
  @IsIn(['procesador', 'banco', 'cliente', 'no_informado'])
  agente?: string;
  @IsOptional() @IsUUID() reglaId?: string;

  @IsIn(RETENCION_REGIMENES)
  regimen: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  jurisdiccion?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  base: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  alicuota: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nroComprobante?: string;
}

export class ValorCobroDto {
  @IsIn(['fisico', 'echeq'])
  formato: string;

  @IsOptional()
  @IsIn(['comun', 'diferido'])
  modalidad?: 'comun' | 'diferido';

  /** En un cobro siempre es de tercero respecto de la empresa. */
  @IsIn(['tercero'])
  origen: 'tercero';

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  numero: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  banco: string;

  /** ID que informa el banco para un eCheq. No reemplaza al número visible. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  identificadorBancario?: string;

  /** ISO date. */
  @IsOptional()
  @IsISO8601()
  fechaEmision?: string;

  /** ISO date — presente si es diferido. */
  @IsOptional()
  @IsISO8601()
  fechaPago?: string;
}

export class CrearCobroDto {
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
  @IsOptional()
  @IsUUID()
  ordenId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** ISO date. */
  @IsISO8601()
  fecha: string;

  @IsUUID()
  metodoPagoId: string;

  /** Requerida para dinero; los cheques la reciben al ser depositados. */
  @IsOptional()
  @IsUUID()
  cuentaDestinoId?: string | null;

  @IsNumber()
  @Min(0.01)
  montoBruto: number;

  /** % de comisión aplicado (editable sobre el sugerido del método). */
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPctAplicada: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetencionLineaDto)
  @ArrayMaxSize(20)
  retenciones?: RetencionLineaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ValorCobroDto)
  valor?: ValorCobroDto;

  /** "N° de operación": lo que devuelve la transferencia, el cupón o el ticket. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class AnularCobroDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

/** Se confirman importes y fecha REALES, nunca sólo el vencimiento previsto. */
export class AcreditarCobroDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  comisionMonto: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  comisionIvaMonto: number;
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RetencionLineaDto)
  retenciones: RetencionLineaDto[];
  @IsString() @MinLength(1) @MaxLength(100) referencia: string;
}
