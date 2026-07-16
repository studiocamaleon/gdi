import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const METODO_PAGO_TIPOS = [
  'efectivo',
  'transferencia',
  'billetera_qr',
  'tarjeta_debito',
  'tarjeta_credito',
  'cheque_echeq',
  'debito_automatico',
] as const;

export type MetodoPagoTipo = (typeof METODO_PAGO_TIPOS)[number];

export class UpsertMetodoPagoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsIn(METODO_PAGO_TIPOS)
  tipo: MetodoPagoTipo;

  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPct: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ivaComisionPct: number;

  @IsInt()
  @Min(0)
  @Max(365)
  plazoAcreditacionDias: number;

  @IsBoolean()
  sufreRetencion: boolean;

  @IsOptional()
  @IsUUID()
  cuentaDestinoId?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
