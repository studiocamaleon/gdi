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
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const RETENCION_REGIMENES = [
  'SIRCREB',
  'SIRTAC',
  'IIBB_CONVENIO',
  'SICORE_GANANCIAS',
  'IVA_RG2854',
  'PERCEPCION_IIBB',
  'otro',
] as const;

export class RetencionLineaDto {
  @IsIn(RETENCION_REGIMENES)
  regimen: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  jurisdiccion?: string;

  @IsNumber()
  @Min(0)
  base: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  alicuota: number;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nroComprobante?: string;
}

export class ValorCobroDto {
  @IsIn(['fisico', 'echeq'])
  formato: string;

  @IsIn(['tercero', 'propio'])
  origen: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  numero: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  banco: string;

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
  ordenId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  /** ISO date. */
  @IsISO8601()
  fecha: string;

  @IsUUID()
  metodoPagoId: string;

  @IsUUID()
  cuentaDestinoId: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
