import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ORDEN_CANALES_VENTA = [
  'mostrador',
  'web',
  'vendedor_externo',
  'telefono',
] as const;

export class OrdenTrabajoItemSpecDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  etiqueta: string;

  @IsString()
  @MaxLength(500)
  valor: string;
}

export class CrearOrdenTrabajoItemDto {
  /** FK obligatoria: los montos de la OT se toman de este snapshot. */
  @IsUUID()
  cotizacionItemId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  codigo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre: string;

  @IsString()
  @MaxLength(80)
  familia: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoriaComercial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategoriaComercial?: string;

  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsString()
  @MaxLength(20)
  cantidadUnidad: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  impuestos: number;

  @IsNumber()
  @Min(0)
  total: number;

  // Descuento comercial de la línea (traza; el efecto ya está en subtotal/total).
  @IsOptional()
  @IsIn(['PORCENTAJE', 'MONTO'])
  descuentoTipo?: 'PORCENTAJE' | 'MONTO' | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoValor?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoMonto?: number | null;

  /** Cupón que originó el descuento (F4): se redime al emitir la OT. */
  @IsOptional()
  @IsUUID()
  descuentoCuponId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdenTrabajoItemSpecDto)
  @ArrayMaxSize(60)
  specs?: OrdenTrabajoItemSpecDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  adicionales?: string[];
}

export class CrearOrdenTrabajoCargoDto {
  @IsUUID()
  cargoDirectoCatalogoId: string;

  /** Inputs elegidos por el comercial (zona, porcentaje o precio unitario). */
  @IsObject()
  configInput: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidadInput?: number;

  @IsNumber()
  @Min(0)
  montoNeto: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}

export class CrearOrdenTrabajoDto {
  /** Identificador estable del intento para que un retry no duplique la OT. */
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @IsOptional()
  @IsUUID()
  cotizacionId?: string;

  /** Estado inicial: borrador (guardar) o pendiente (emitir al taller). */
  @IsOptional()
  @IsIn(['borrador', 'pendiente'])
  estado?: 'borrador' | 'pendiente';

  /** ISO date (YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601()
  fechaEntrega?: string;

  @IsOptional()
  @IsIn(ORDEN_CANALES_VENTA)
  canalVenta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cargosDirectos?: number;

  /** Sin comprobante fiscal desde el vamos (mostrador). Default FISCAL.
   *  Ver docs/margen-y-decisiones-de-precio.md §6. */
  @IsOptional()
  @IsIn(['FISCAL', 'SIN_COMPROBANTE'])
  tratamientoFiscal?: 'FISCAL' | 'SIN_COMPROBANTE';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearOrdenTrabajoCargoDto)
  @ArrayMaxSize(30)
  cargos?: CrearOrdenTrabajoCargoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearOrdenTrabajoItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  items: CrearOrdenTrabajoItemDto[];
}

/**
 * Edición de datos comerciales de una OT existente. Qué campos se aceptan
 * depende del estado (gating en el service); cada cambio genera un evento
 * de auditoría con diff.
 */
export class EditarOrdenTrabajoDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @IsOptional()
  @IsIn(ORDEN_CANALES_VENTA)
  canalVenta?: string;

  /** ISO date (YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601()
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class EditarOrdenTrabajoItemLoteDto extends CrearOrdenTrabajoItemDto {
  /** ID de la línea si ya existe; sin ID se crea dentro del mismo commit. */
  @IsOptional()
  @IsUUID()
  id?: string;

  /**
   * Líneas reemplazadas cuyos adjuntos debe heredar esta línea. Sólo se usa al
   * transformar una carga compuesta (por ejemplo, varios documentos en tomo).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  archivosOrigenItemIds?: string[];
}

/**
 * Commit atómico del editor. `expectedVersion` evita guardar sobre una orden
 * que cambió desde que el usuario abrió la ficha y `items` representa el
 * conjunto final completo (altas, cambios, bajas y orden incluidos).
 */
export class EditarOrdenTrabajoLoteDto extends EditarOrdenTrabajoDto {
  @IsISO8601()
  expectedVersion: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditarOrdenTrabajoItemLoteDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  items?: EditarOrdenTrabajoItemLoteDto[];
}

export class CancelarOrdenTrabajoDto {
  /**
   * Por qué se cancela. Obligatorio: una orden que desaparece de las ventas
   * sin explicación es una discusión asegurada tres meses después.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivo: string;

  /**
   * Emitir la nota de crédito de las facturas vivas de la orden y recién
   * entonces cancelar, en un solo acto.
   *
   * Sin esto la cancelación de una orden facturada se frena y hay que ir a
   * Comprobantes a emitir la NC a mano. Pide `administracion.anular` además
   * del permiso de cancelar: acreditar ante ARCA no es cosa de cualquiera.
   */
  @IsOptional()
  @IsBoolean()
  emitirNotaCredito?: boolean;
}

export class CambiarEstadoOrdenTrabajoDto {
  @IsIn(['pendiente', 'produccion', 'finalizada', 'entregada'])
  estado: 'pendiente' | 'produccion' | 'finalizada' | 'entregada';

  /** Avance 0-100 informado junto con el cambio (opcional). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progresoPct?: number;
}

export class TratamientoFiscalDto {
  @IsIn(['FISCAL', 'SIN_COMPROBANTE'])
  tratamientoFiscal: 'FISCAL' | 'SIN_COMPROBANTE';
}
