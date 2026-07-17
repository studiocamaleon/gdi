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

  @IsNumber()
  @Min(0.01)
  monto: number;
}

export class ArqueoDto {
  @IsNumber()
  @Min(0)
  contado: number;
}
