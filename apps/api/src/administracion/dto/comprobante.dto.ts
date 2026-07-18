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

/** Cuánto de este comprobante aplica a una orden (monto TOTAL, IVA incluido). */
export class ComprobanteOrdenVinculoDto {
  @IsString()
  ordenId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;
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

  /**
   * Vínculos factura↔orden con monto (parciales y lote). La suma tiene
   * que dar el total del comprobante: se reparte completo. Excluyente
   * con `ordenId` (que es el atajo "toda la factura a una orden").
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComprobanteOrdenVinculoDto)
  ordenes?: ComprobanteOrdenVinculoDto[];

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

/**
 * Facturar una orden desde su ficha: monto TOTAL (IVA incluido) con
 * atajos en la UI (100% del saldo / 50% / libre) y concepto texto libre.
 * Sin monto factura el saldo sin facturar completo.
 */
export class FacturarOrdenDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsString()
  concepto?: string;

  /** Default: el primer punto de venta activo. */
  @IsOptional()
  @IsString()
  puntoVentaId?: string;

  /** false = dejar el borrador sin pedir CAE. Default: emitir. */
  @IsOptional()
  emitir?: boolean;
}

export const FACTURAR_LOTE_MODOS = ['por_orden', 'agrupada'] as const;
export type FacturarLoteModo = (typeof FACTURAR_LOTE_MODOS)[number];

/**
 * Facturación en lote desde Administración → Facturación. Cada orden se
 * factura por su saldo sin facturar. 'agrupada' exige un solo cliente
 * (una factura tiene un receptor) y arma un renglón por orden.
 */
export class FacturarLoteDto {
  @IsArray()
  @IsString({ each: true })
  ordenIds: string[];

  @IsIn(FACTURAR_LOTE_MODOS as unknown as string[])
  modo: FacturarLoteModo;

  @IsOptional()
  @IsString()
  puntoVentaId?: string;
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
