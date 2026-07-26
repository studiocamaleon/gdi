import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertCuentaFondosDto {
  @IsIn(['caja', 'banco', 'billetera', 'cartera_valores'])
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
  @IsIn(['ARS', 'USD'])
  moneda?: string;
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
}

export class ArqueoDto {
  @IsNumber()
  @Min(0)
  contado: number;
}
