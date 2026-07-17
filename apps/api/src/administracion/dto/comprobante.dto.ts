import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const COMPROBANTE_TIPOS = [
  'factura',
  'nota_credito',
  'nota_debito',
] as const;
export type ComprobanteTipo = (typeof COMPROBANTE_TIPOS)[number];

export const COMPROBANTE_ESTADOS = [
  'borrador',
  'emitido',
  'rechazado',
  'anulado',
] as const;

/**
 * Condiciones de venta de ARCA. Definen el vencimiento, del que depende
 * todo el aging de deudores.
 */
export const CONDICIONES_VENTA = [
  'contado',
  'cuenta_corriente',
  'transferencia',
  'tarjeta',
  'otra',
] as const;

export class ComprobanteItemDto {
  @IsString()
  @MinLength(1)
  descripcion: string;

  @IsNumber()
  @Min(0)
  cantidad: number;

  @IsNumber()
  precioUnitarioSinIva: number;

  /** 21 | 10.5 | 27 | 0 | 'exento' | 'no_gravado'. */
  @IsOptional()
  alicuotaIva?: number | 'exento' | 'no_gravado';

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonificacionPct?: number;
}

export class CrearComprobanteDto {
  @IsIn(COMPROBANTE_TIPOS as unknown as string[])
  tipo: ComprobanteTipo;

  @IsString()
  puntoVentaId: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  /** Si viene, los ítems se arman desde la orden y se vinculan a ella. */
  @IsOptional()
  @IsString()
  ordenId?: string;

  /** ISO date YYYY-MM-DD. Default: hoy. */
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComprobanteItemDto)
  items?: ComprobanteItemDto[];

  @IsOptional()
  @IsIn(['ARS', 'USD'])
  moneda?: 'ARS' | 'USD';

  @IsOptional()
  @IsNumber()
  @Min(0)
  cotizacion?: number;

  @IsOptional()
  @IsIn(CONDICIONES_VENTA as unknown as string[])
  condicionVenta?: string;

  /** Días hasta el vencimiento (cta. cte.). El aging depende de esto. */
  @IsOptional()
  @IsInt()
  @Min(0)
  diasVencimiento?: number;

  /** Para NC/ND: el comprobante que corrigen. */
  @IsOptional()
  @IsString()
  comprobanteOrigenId?: string;
}

export class CargarCaeDto {
  @IsString()
  @MinLength(1)
  cae: string;

  /** ISO date YYYY-MM-DD. */
  @IsString()
  caeVencimiento: string;
}

export class ImputarCobroDto {
  @IsString()
  comprobanteId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;
}
