import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

import { monedas } from '../../common/monedas';

const CODIGOS_MONEDA = monedas.map((moneda) => moneda.codigo);

export class UpsertCuentaFondosDto {
  @IsIn(['caja', 'banco', 'billetera'])
  tipo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  banco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cbuAlias?: string;

  @IsOptional()
  @IsIn(CODIGOS_MONEDA)
  moneda?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoInicial?: number;

  @IsOptional()
  @IsBoolean()
  permiteSaldoNegativo?: boolean;
}

export class EditarCuentaFondosDto {
  @IsOptional()
  @IsIn(['caja', 'banco', 'billetera'])
  tipo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  banco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cbuAlias?: string;

  @IsOptional()
  @IsIn(CODIGOS_MONEDA)
  moneda?: string;

  @IsOptional()
  @IsBoolean()
  permiteSaldoNegativo?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class TransferenciaDto {
  @IsUUID()
  desdeCuentaId: string;

  @IsUUID()
  haciaCuentaId: string;

  /** En la moneda de la cuenta de ORIGEN. */
  @IsNumber()
  @Min(0.01)
  monto: number;

  /**
   * Obligatorio cuando las cuentas son de DISTINTA moneda: lo que llegó a la
   * cuenta destino, en SU moneda. Se pide el monto y no el tipo de cambio a
   * propósito — el TC tiene dos convenciones posibles y el extracto del banco
   * dice un monto, no una tasa; la tasa se deriva y se guarda.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  montoDestino?: number;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class ArqueoDto {
  @IsNumber()
  @Min(0)
  contado: number;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class AjusteFondosDto {
  @IsIn(['entrada', 'salida'])
  tipo: 'entrada' | 'salida';

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsISO8601()
  fecha: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  concepto: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class MovimientosFondosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn([
    'cobro',
    'pago',
    'transferencia',
    'valor',
    'ajuste_arqueo',
    'ajuste_manual',
    'saldo_inicial',
  ])
  origenTipo?: string;

  @IsOptional()
  @IsIn(['pendiente', 'conciliado', 'diferencia'])
  estadoConciliacion?: string;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}

export class ConciliarMovimientoDto {
  @IsIn(['pendiente', 'conciliado', 'diferencia'])
  estado: 'pendiente' | 'conciliado' | 'diferencia';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class DepositarValorDto {
  @IsUUID()
  cuentaDestinoId: string;

  @IsISO8601()
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class AcreditarValorDto {
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class RechazarValorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

/** Corrección administrativa: deshace el último hito sin fingir un rechazo. */
export class RevertirOperacionValorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
